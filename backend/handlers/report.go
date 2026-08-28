package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"chatwoot-dashboard-backend/cache"
	"chatwoot-dashboard-backend/chatwoot"
	"chatwoot-dashboard-backend/config"
	"chatwoot-dashboard-backend/ratelimit"
)

// HandleReport returns the consolidated agent report.
// Uses cache if available, otherwise fetches from Chatwoot API.
func HandleReport(cfg *config.Config, client *chatwoot.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		force := r.URL.Query().Get("refresh") == "1"
		startDate := r.URL.Query().Get("start")
		endDate := r.URL.Query().Get("end")

		// Cache key includes date range
		cacheKey := "chatwoot:report:v1"
		if startDate != "" || endDate != "" {
			cacheKey = fmt.Sprintf("chatwoot:report:v1_%s_%s", startDate, endDate)
		}

	// Try cache first
	if !force {
		cached, err := cache.Get(r.Context(), cacheKey)
		if err == nil && cached != "" {
			log.Printf("[report] Cache HIT (key=%s)", cacheKey)
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("X-Cache", "HIT")
			w.Write([]byte(cached))
			return
		}
		log.Printf("[report] Cache MISS (key=%s, err=%v)", cacheKey, err)
	}

	// Build fresh report
	report, err := buildReport(r.Context(), cfg, client, startDate, endDate)
		if err != nil {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

	// Cache the report
	data, _ := json.Marshal(report)
	cache.Set(r.Context(), cacheKey, string(data), cfg.CacheTTLSeconds)

	log.Printf("[report] Cache SET (key=%s, size=%d bytes)", cacheKey, len(data))

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Cache", "MISS")
	json.NewEncoder(w).Encode(report)
	}
}

// HandleReportRefresh returns cached data and is rate limited per user IP.
func HandleReportRefresh(cfg *config.Config, client *chatwoot.Client, limiter *ratelimit.Limiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clientIP := ratelimit.GetClientIP(r)

		// Check rate limit
		if !limiter.Allow(clientIP) {
			remaining := limiter.Remaining(clientIP)
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":     "Limite de atualizações atingido. Aguarde um momento.",
				"remaining": remaining,
			})
			return
		}

		remaining := limiter.Remaining(clientIP)
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

		// Return cached data immediately
		cached, err := cache.Get(r.Context(), "chatwoot:report:v1")
		if err == nil && cached != "" {
			log.Printf("[report-refresh] Cache HIT para %s (remaining: %d)", clientIP, remaining)
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("X-Cache", "HIT")
			w.Write([]byte(cached))
			return
		}

		// No cache yet — build fresh
		log.Printf("[report-refresh] Cache MISS, construindo dados para %s", clientIP)
		report, err := buildReport(r.Context(), cfg, client, "", "")
		if err != nil {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		cache.SetReport(report, cfg.CacheTTLSeconds)

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("X-Cache", "MISS")
		json.NewEncoder(w).Encode(report)
	}
}

// BuildReportPublic is a public wrapper for buildReport (used by warmup).
func BuildReportPublic(cfg *config.Config, client *chatwoot.Client, startDate, endDate string) (*chatwoot.Report, error) {
	return buildReport(context.Background(), cfg, client, startDate, endDate)
}

// buildReport fetches all data from Chatwoot and builds the aggregated report.
// If startDate/endDate are provided, conversations are filtered by LastActivityAt.
func buildReport(ctx context.Context, cfg *config.Config, client *chatwoot.Client, startDate, endDate string) (*chatwoot.Report, error) {
	// Fetch agents and labels in parallel
	var (
		agents []chatwoot.Agent
		labels []chatwoot.Label
		errA   error
		errL   error
		wg     sync.WaitGroup
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		agents, errA = client.GetAgents(ctx)
	}()
	go func() {
		defer wg.Done()
		labels, errL = client.GetLabels(ctx)
	}()
	wg.Wait()

	if errA != nil {
		return nil, fmt.Errorf("falha ao buscar agentes: %w", errA)
	}
	if errL != nil {
		return nil, fmt.Errorf("falha ao buscar etiquetas: %w", errL)
	}

	// Fetch all conversations
	log.Printf("[report] Buscando conversas (concorrência=%d)...", cfg.FetchConcurrency)
	fetched, err := client.FetchAllConversations(ctx, cfg.FetchConcurrency)
	if err != nil {
		return nil, fmt.Errorf("falha ao buscar conversas: %w", err)
	}
	log.Printf("[report] %d conversas obtidas (%d esperadas, %d páginas com falha)", len(fetched.Conversations), fetched.Expected, len(fetched.FailedPages))

	// Build agent map
	byAgent := make(map[int]*chatwoot.AgentReport)
	for _, a := range agents {
		byAgent[a.ID] = &chatwoot.AgentReport{
			ID:           a.ID,
			Name:         a.Name,
			Email:        a.Email,
			Role:         a.Role,
			Availability: a.AvailabilityStatus,
			Labels:       make(map[string]int),
		}
	}

	// Unassigned bucket
	unassigned := &chatwoot.AgentReport{
		ID:           0,
		Name:         "Sem responsável",
		Email:        "",
		Role:         "-",
		Availability: "-",
		Labels:       make(map[string]int),
	}

	// Parse date filters
	var startTS, endTS int64
	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			startTS = t.Unix()
		}
	}
	if endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			// Include the entire end day
			endTS = t.Add(24*time.Hour - time.Second).Unix()
		}
	}

	if startTS > 0 || endTS > 0 {
		log.Printf("[report] Filtrando conversas: start=%s (%d) end=%s (%d)", startDate, startTS, endDate, endTS)
	}

	// Aggregate conversations by agent (with optional date filter)
	for _, conv := range fetched.Conversations {
		// Apply date range filter
		if startTS > 0 && conv.LastActivityAt < startTS {
			continue
		}
		if endTS > 0 && conv.LastActivityAt > endTS {
			continue
		}

		var bucket *chatwoot.AgentReport

		if conv.Meta.Assignee != nil && conv.Meta.Assignee.ID > 0 {
			if b, ok := byAgent[conv.Meta.Assignee.ID]; ok {
				bucket = b
			} else {
				bucket = unassigned
			}
		} else {
			bucket = unassigned
		}

		bucket.Total++
		switch conv.Status {
		case "open":
			bucket.Open++
		case "resolved":
			bucket.Resolved++
		case "pending":
			bucket.Pending++
		case "snoozed":
			bucket.Snoozed++
		}

		for _, label := range conv.Labels {
			bucket.Labels[label]++
		}
	}

	// Collect rows (agents with activity + unassigned)
	rows := []chatwoot.AgentReport{}
	for _, b := range byAgent {
		if b.Total > 0 {
			rows = append(rows, *b)
		}
	}
	if unassigned.Total > 0 {
		rows = append(rows, *unassigned)
	}

	// Sort by total descending (simple bubble sort for small dataset)
	for i := 0; i < len(rows); i++ {
		for j := i + 1; j < len(rows); j++ {
			if rows[j].Total > rows[i].Total {
				rows[i], rows[j] = rows[j], rows[i]
			}
		}
	}

	// Build label info
	labelInfos := make([]chatwoot.LabelInfo, len(labels))
	for i, l := range labels {
		labelInfos[i] = chatwoot.LabelInfo{Title: l.Title, Color: l.Color}
	}

	return &chatwoot.Report{
		GeneratedAt:           time.Now().UTC().Format(time.RFC3339),
		TotalConversations:    len(rows),
		ExpectedConversations: fetched.Expected,
		FailedPages:           fetched.FailedPages,
		Labels:                labelInfos,
		Agents:                rows,
	}, nil
}

// HandleExportAgents generates a CSV export of agents data.
func HandleExportAgents(cfg *config.Config, client *chatwoot.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get cached or fresh report
		report, err := getCachedOrFreshReport(r.Context(), cfg, client)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Build CSV
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=dados-agentes.csv")

		// Header
		csvFields := []string{"Agente", "Email", "Perfil", "Status", "Total", "Abertas", "Pendentes", "Resolvidas", "Adiadas"}

		// Collect all label names
		labelNames := make([]string, len(report.Labels))
		for i, l := range report.Labels {
			labelNames[i] = l.Title
			csvFields = append(csvFields, l.Title)
		}

		fmt.Fprint(w, "\uFEFF") // BOM
		fmt.Fprint(w, joinRow(csvFields))

		for _, a := range report.Agents {
			row := []string{
				a.Name, a.Email, a.Role, a.Availability,
				strconv.Itoa(a.Total), strconv.Itoa(a.Open),
				strconv.Itoa(a.Pending), strconv.Itoa(a.Resolved),
				strconv.Itoa(a.Snoozed),
			}
			for _, name := range labelNames {
				row = append(row, strconv.Itoa(a.Labels[name]))
			}
			fmt.Fprint(w, joinRow(row))
		}
	}
}

// HandleExportAnalysis generates analysis CSVs (A: conversations, B: messages).
func HandleExportAnalysis(cfg *config.Config, client *chatwoot.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Parse cutoff date
		cutoff := parseCutoffDate(cfg.CutoffDate)

		// Fetch conversations since cutoff
		convs, err := fetchConversationsSince(r.Context(), client, cutoff)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Analysis A: conversations by agent with labels
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=analise-A-conversas.csv")

		fmt.Fprint(w, "\uFEFF")

		agents, _ := client.GetAgents(r.Context())
		labels, _ := client.GetLabels(r.Context())
		labelNames := make([]string, len(labels))
		header := []string{"Agente", "Email", "Status", "Total_Conversas", "Abertas", "Pendentes", "Resolvidas", "Adiadas"}
		for i, l := range labels {
			labelNames[i] = l.Title
			header = append(header, l.Title)
		}
		fmt.Fprint(w, joinRow(header))

		// Aggregate
		type agentStats struct {
			Name, Email, Availability string
			Total, Open, Resolved, Pending, Snoozed int
			Labels map[string]int
		}
		byAgent := make(map[int]*agentStats)
		for _, a := range agents {
			byAgent[a.ID] = &agentStats{
				Name: a.Name, Email: a.Email, Availability: a.AvailabilityStatus,
				Labels: make(map[string]int),
			}
		}
		unassigned := &agentStats{Name: "Sem responsável", Labels: make(map[string]int)}

		for _, c := range convs {
			var b *agentStats
			if c.Meta.Assignee != nil && c.Meta.Assignee.ID > 0 {
				if s, ok := byAgent[c.Meta.Assignee.ID]; ok {
					b = s
				} else {
					b = unassigned
				}
			} else {
				b = unassigned
			}
			b.Total++
			switch c.Status {
			case "open": b.Open++
			case "resolved": b.Resolved++
			case "pending": b.Pending++
			case "snoozed": b.Snoozed++
			}
			for _, l := range c.Labels {
				b.Labels[l]++
			}
		}

		for _, b := range byAgent {
			if b.Total == 0 {
				continue
			}
			row := []string{b.Name, b.Email, b.Availability,
				strconv.Itoa(b.Total), strconv.Itoa(b.Open),
				strconv.Itoa(b.Pending), strconv.Itoa(b.Resolved),
				strconv.Itoa(b.Snoozed)}
			for _, name := range labelNames {
				row = append(row, strconv.Itoa(b.Labels[name]))
			}
			fmt.Fprint(w, joinRow(row))
		}
		if unassigned.Total > 0 {
			row := []string{unassigned.Name, "", "",
				strconv.Itoa(unassigned.Total), strconv.Itoa(unassigned.Open),
				strconv.Itoa(unassigned.Pending), strconv.Itoa(unassigned.Resolved),
				strconv.Itoa(unassigned.Snoozed)}
			for _, name := range labelNames {
				row = append(row, strconv.Itoa(unassigned.Labels[name]))
			}
			fmt.Fprint(w, joinRow(row))
		}
	}
}

// HandleExportProspection generates a prospection report CSV.
func HandleExportProspection(cfg *config.Config, client *chatwoot.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=analise-prospeccao.csv")

		fmt.Fprint(w, "\uFEFF")
		header := []string{"Agente", "Data", "Hora", "DiaSemana", "Conversa_ID", "Cliente", "Telefone", "Status"}
		fmt.Fprint(w, joinRow(header))

		// TODO: Implement full prospection logic (find first message per conversation)
		// This is a placeholder that follows the same pattern as export-primeiras.js
		fmt.Fprint(w, "# Implementação completa: use scripts/cmd/export-primeiras/main.go\n")
	}
}

// HandleDashboardData returns the dashboard data JSON for supervisors.
func HandleDashboardData(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile("public/dashboard-data.json")
	if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "dashboard-data.json não encontrado. Rode: go run scripts/cmd/export-dashboard",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Write(data)
}

// --- Helpers ---

func getCachedOrFreshReport(ctx context.Context, cfg *config.Config, client *chatwoot.Client) (*chatwoot.Report, error) {
	cached, err := cache.GetReport()
	if err == nil && cached != nil {
		// Unmarshal from cached interface
		data, _ := json.Marshal(cached)
		var report chatwoot.Report
		json.Unmarshal(data, &report)
		return &report, nil
	}
	return buildReport(ctx, cfg, client, "", "")
}

func parseCutoffDate(dateStr string) time.Time {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Now().AddDate(0, 0, -30)
	}
	return t
}

func fetchConversationsSince(ctx context.Context, client *chatwoot.Client, since time.Time) ([]chatwoot.Conversation, error) {
	cutoff := since.Unix()
	var kept []chatwoot.Conversation
	page := 1

	for {
		path := fmt.Sprintf("/conversations?status=all&page=%d", page)
		data, err := client.APIGet(ctx, path, 4)
		if err != nil {
			return kept, err
		}

		convs := extractConversationsFromBytes(data)
		if len(convs) == 0 {
			break
		}

		anyRecent := false
		for _, c := range convs {
			if c.LastActivityAt >= cutoff {
				kept = append(kept, c)
				anyRecent = true
			}
		}

		if !anyRecent && page > 1 {
			break
		}
		page++
		if page > 200 {
			break
		}
	}

	return kept, nil
}

func extractConversationsFromBytes(data []byte) []chatwoot.Conversation {
	var wrapper struct {
		Data struct {
			Payload []chatwoot.Conversation `json:"payload"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil {
		return wrapper.Data.Payload
	}
	return nil
}

func joinRow(fields []string) string {
	parts := make([]string, len(fields))
	for i, f := range fields {
		f = strings.ReplaceAll(f, "\"", "\"\"")
		if strings.ContainsAny(f, "\";\n\r") {
			parts[i] = "\"" + f + "\""
		} else {
			parts[i] = f
		}
	}
	return strings.Join(parts, ";") + "\r\n"
}

func init() {
	// Suppress unused import warnings
	_ = math.NaN
	_ = strconv.Itoa
}
