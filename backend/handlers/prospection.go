package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"chatwoot-dashboard-backend/cache"
	"chatwoot-dashboard-backend/chatwoot"
	"chatwoot-dashboard-backend/config"
)

// ProspectionRecord represents a single prospection event.
type ProspectionRecord struct {
	Agente       string   `json:"agente"`
	Data         string   `json:"data"`
	Hora         string   `json:"hora"`
	DiaSemana    string   `json:"diaSemana"`
	ConversaID   int      `json:"conversaId"`
	Telefone     string   `json:"telefone"`
	ContatoID    *int     `json:"contatoId"`
	Status       string   `json:"status"`
	Labels       []string `json:"labels"`
	Supervisores []string `json:"supervisores"`
}

// ProspectionResponse is the full response for the prospection endpoint.
type ProspectionResponse struct {
	GeneratedAt string               `json:"generatedAt"`
	CutoffDate  string               `json:"cutoffDate"`
	Labels      []chatwoot.LabelInfo `json:"labels"`
	Teams       []string             `json:"teams"`
	AgentTeams  map[string][]string  `json:"agentTeams"`
	Records     []ProspectionRecord  `json:"records"`
	IsPartial   bool                 `json:"isPartial"`
}

// prospectionLock ensures only one prospection build runs at a time.
var (
	prospectionMu      sync.Mutex
	prospectionRunning bool
)

// HandleProspection generates prospection data dynamically from the Chatwoot API.
// Only one build runs at a time — concurrent requests return partial cache or 503.
func HandleProspection(cfg *config.Config, client *chatwoot.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		startDate := r.URL.Query().Get("start")
		endDate := r.URL.Query().Get("end")
		force := r.URL.Query().Get("refresh") == "1"

		cacheKey := "chatwoot:prospection:v1"
		if startDate != "" || endDate != "" {
			cacheKey = fmt.Sprintf("chatwoot:prospection:v1_%s_%s", startDate, endDate)
		}

		// 1. Try cache first (unless forced refresh)
		if !force {
			cached, err := cache.Get(r.Context(), cacheKey)
			if err == nil && cached != "" {
				log.Printf("[prospection] Cache HIT (key=%s, size=%d bytes)", cacheKey, len(cached))
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.Header().Set("X-Cache", "HIT")
				w.Write([]byte(cached))
				return
			}
		}

		// 2. Try to acquire build lock
		prospectionMu.Lock()
		if prospectionRunning {
			prospectionMu.Unlock()
			// Build already running — return partial cache if available
			if partialCached, pErr := cache.Get(r.Context(), cacheKey); pErr == nil && partialCached != "" {
				log.Printf("[prospection] Build em andamento, retornando cache parcial (key=%s)", cacheKey)
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.Header().Set("X-Cache", "PARTIAL")
				w.Write([]byte(partialCached))
				return
			}
			log.Printf("[prospection] Build em andamento, sem cache parcial ainda")
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error":     "Análise em processamento por outro request. Aguarde e tente novamente.",
				"isPartial": "true",
			})
			return
		}
		// Mark as running
		prospectionRunning = true
		prospectionMu.Unlock()

		// Ensure we clear the flag when done
		defer func() {
			prospectionMu.Lock()
			prospectionRunning = false
			prospectionMu.Unlock()
			log.Printf("[prospection] Lock liberado")
		}()

		// 3. Build prospection data
		ctx, cancel := context.WithTimeout(r.Context(), 25*time.Minute)
		defer cancel()

		log.Printf("[prospection] Iniciando construção de dados (start=%s, end=%s, force=%v)", startDate, endDate, force)

		data, err := buildProspectionData(ctx, cfg, client, cacheKey)
		if err != nil {
			log.Printf("[prospection] Erro: %v", err)

			// If timeout and we have partial cache, return it
			if ctx.Err() != nil {
				if partialCached, pErr := cache.Get(r.Context(), cacheKey); pErr == nil && partialCached != "" {
					log.Printf("[prospection] Retornando dados parciais do cache (key=%s)", cacheKey)
					w.Header().Set("Content-Type", "application/json; charset=utf-8")
					w.Header().Set("X-Cache", "PARTIAL")
					w.Write([]byte(partialCached))
					return
				}
			}

			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		// 4. Cache final result
		data.IsPartial = false
		dataBytes, _ := json.Marshal(data)
		cache.Set(r.Context(), cacheKey, string(dataBytes), cfg.CacheTTLSeconds)

		log.Printf("[prospection] Cache SET FINAL (key=%s, records=%d)", cacheKey, len(data.Records))

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("X-Cache", "MISS")
		w.Write(dataBytes)
	}
}

func buildProspectionData(ctx context.Context, cfg *config.Config, client *chatwoot.Client, cacheKey string) (*ProspectionResponse, error) {
	cutoff := parseCutoffDate(cfg.CutoffDate)

	// Fetch labels and teams in parallel
	var (
		labels []chatwoot.Label
		teams  []map[string]interface{}
		errL   error
		errT   error
		wg     sync.WaitGroup
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		labels, errL = client.GetLabels(ctx)
	}()
	go func() {
		defer wg.Done()
		teams, errT = client.GetTeams(ctx)
	}()
	wg.Wait()

	if errL != nil {
		return nil, fmt.Errorf("falha ao buscar etiquetas: %w", errL)
	}
	if errT != nil {
		log.Printf("[prospection] Aviso: falha ao buscar times: %v", errT)
	}

	agentTeams := make(map[string][]string)
	teamNames := make([]string, 0, len(teams))
	for _, t := range teams {
		name, _ := t["name"].(string)
		if name == "" {
			continue
		}
		teamNames = append(teamNames, name)
	}

	convs, err := fetchConversationsSince(ctx, client, cutoff)
	if err != nil {
		return nil, fmt.Errorf("falha ao buscar conversas: %w", err)
	}

	log.Printf("[prospection] %d conversas desde %s", len(convs), cfg.CutoffDate)

	excludeSet := make(map[string]bool)
	for _, s := range cfg.ExcludeSenders {
		excludeSet[strings.ToLower(strings.TrimSpace(s))] = true
	}

	var records []ProspectionRecord
	var mu sync.Mutex
	var idx int64
	var totalProcessed int64
	lastProgressLog := time.Now()

	worker := func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			i := int(atomic.AddInt64(&idx, 1) - 1)
			if i >= len(convs) {
				break
			}

			conv := convs[i]
			firstMsg := findFirstMessage(ctx, client, conv.ID, excludeSet)
			if firstMsg != nil && firstMsg.MessageType == 1 {
				if firstMsg.CreatedAt >= cutoff.Unix() {
					sender := firstMsg.Sender
					contact := conv.Meta.Sender

					ts := time.Unix(firstMsg.CreatedAt, 0)
					p := func(n int) string {
						if n < 10 {
							return fmt.Sprintf("0%d", n)
						}
						return fmt.Sprintf("%d", n)
					}

					var contatoID *int
					if contact != nil {
						v := contact.ID
						contatoID = &v
					}

					phone := ""
					if contact != nil {
						phone = strings.ReplaceAll(strings.TrimSpace(contact.PhoneNumber), " ", "")
					}

					senderName := ""
					supervisores := []string{}
					if sender != nil {
						senderName = sender.Name
						if t, ok := agentTeams[senderName]; ok {
							supervisores = t
						}
					}

					record := ProspectionRecord{
						Agente:       senderName,
						Data:         fmt.Sprintf("%d-%s-%s", ts.Year(), p(int(ts.Month())), p(ts.Day())),
						Hora:         fmt.Sprintf("%s:%s", p(ts.Hour()), p(ts.Minute())),
						DiaSemana:    []string{"Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"}[ts.Weekday()],
						ConversaID:   conv.ID,
						Telefone:     phone,
						ContatoID:    contatoID,
						Status:       conv.Status,
						Labels:       conv.Labels,
						Supervisores: supervisores,
					}

					mu.Lock()
					records = append(records, record)
					mu.Unlock()
				}
			}

			current := atomic.AddInt64(&totalProcessed, 1)

			if time.Since(lastProgressLog) > 10*time.Second {
				lastProgressLog = time.Now()
				log.Printf("[prospection] Progresso: %d/%d conversas, %d registros", current, len(convs), len(records))

				// Save partial to the MAIN cache key
				mu.Lock()
				partial := buildPartialResponse(labels, teamNames, agentTeams, records, cfg.CutoffDate)
				mu.Unlock()
				partial.IsPartial = true
				partialBytes, _ := json.Marshal(partial)
				cache.Set(ctx, cacheKey, string(partialBytes), cfg.CacheTTLSeconds)
				log.Printf("[prospection] Cache PARTIAL salvo (key=%s, records=%d)", cacheKey, len(records))
			}
		}
	}

	var wg2 sync.WaitGroup
	for i := 0; i < cfg.FetchConcurrency; i++ {
		wg2.Add(1)
		go func() {
			defer wg2.Done()
			worker()
		}()
	}
	wg2.Wait()

	log.Printf("[prospection] Processamento concluído: %d/%d conversas, %d registros", totalProcessed, len(convs), len(records))

	sort.Slice(records, func(i, j int) bool {
		if records[i].Agente != records[j].Agente {
			return records[i].Agente < records[j].Agente
		}
		return records[i].Data+records[i].Hora < records[j].Data+records[j].Hora
	})

	labelInfos := make([]chatwoot.LabelInfo, len(labels))
	for i, l := range labels {
		labelInfos[i] = chatwoot.LabelInfo{Title: l.Title, Color: l.Color}
	}

	return &ProspectionResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		CutoffDate:  cfg.CutoffDate,
		Labels:      labelInfos,
		Teams:       teamNames,
		AgentTeams:  agentTeams,
		Records:     records,
		IsPartial:   false,
	}, nil
}

func buildPartialResponse(labels []chatwoot.Label, teamNames []string, agentTeams map[string][]string, records []ProspectionRecord, cutoffDate string) *ProspectionResponse {
	labelInfos := make([]chatwoot.LabelInfo, len(labels))
	for i, l := range labels {
		labelInfos[i] = chatwoot.LabelInfo{Title: l.Title, Color: l.Color}
	}
	return &ProspectionResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		CutoffDate:  cutoffDate,
		Labels:      labelInfos,
		Teams:       teamNames,
		AgentTeams:  agentTeams,
		Records:     records,
		IsPartial:   true,
	}
}

// MessageInfo is a simplified message for first-message detection.
type MessageInfo struct {
	ID          int
	MessageType int
	CreatedAt   int64
	Private     bool
	Sender      *chatwoot.MessageSender
}

func findFirstMessage(ctx context.Context, client *chatwoot.Client, convID int, excludeSet map[string]bool) *MessageInfo {
	var earliest *MessageInfo
	before := 0
	guard := 0

	for guard < 50 {
		select {
		case <-ctx.Done():
			return earliest
		default:
		}

		guard++
		var path string
		if before > 0 {
			path = fmt.Sprintf("/conversations/%d/messages?before=%d", convID, before)
		} else {
			path = fmt.Sprintf("/conversations/%d/messages", convID)
		}

		data, err := client.APIGet(ctx, path, 2)
		if err != nil {
			break
		}

		var wrapper struct {
			Payload []struct {
				ID          int                    `json:"id"`
				MessageType int                    `json:"message_type"`
				CreatedAt   int64                  `json:"created_at"`
				Private     bool                   `json:"private"`
				Sender      *chatwoot.MessageSender `json:"sender"`
			} `json:"payload"`
		}
		if err := json.Unmarshal(data, &wrapper); err != nil {
			break
		}

		msgs := wrapper.Payload
		if len(msgs) == 0 {
			break
		}

		oldestID := 0
		for _, m := range msgs {
			if oldestID == 0 || m.ID < oldestID {
				oldestID = m.ID
			}
			if m.Private || (m.MessageType != 0 && m.MessageType != 1) {
				continue
			}
			if m.Sender != nil && excludeSet[strings.ToLower(strings.TrimSpace(m.Sender.Name))] {
				continue
			}
			if earliest == nil || m.CreatedAt < earliest.CreatedAt {
				earliest = &MessageInfo{
					ID:          m.ID,
					MessageType: m.MessageType,
					CreatedAt:   m.CreatedAt,
					Private:     m.Private,
					Sender:      m.Sender,
				}
			}
		}

		if len(msgs) < 20 {
			break
		}
		before = oldestID
	}

	return earliest
}

// HandleDashboardDataDynamic generates dashboard data dynamically.
func HandleDashboardDataDynamic(cfg *config.Config, client *chatwoot.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := os.ReadFile("public/dashboard-data.json")
		if err == nil {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Write(data)
			return
		}
		HandleProspection(cfg, client)(w, r)
	}
}
