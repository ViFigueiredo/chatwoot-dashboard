package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"chatwoot-dashboard-backend/cache"
	"chatwoot-dashboard-backend/chatwoot"
	"chatwoot-dashboard-backend/config"
)

func main() {
	cfg := config.Load()

	// Try connect to cache
	redisURL := os.Getenv("UPSTASH_REDIS_REST_URL")
	redisToken := os.Getenv("UPSTASH_REDIS_REST_TOKEN")
	if redisURL != "" && redisToken != "" {
		cache.Connect(redisURL, redisToken)
	}

	client := chatwoot.NewClient(cfg.APIBase(), cfg.APIToken)
	ctx := context.Background()

	fmt.Println("Chatwoot - Exportando dados por agente para CSV")
	fmt.Printf("Conta: %s | %s\n\n", cfg.AccountID, cfg.BaseURL)

	// Fetch agents and labels
	agents, err := client.GetAgents(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro ao buscar agentes: %v\n", err)
		os.Exit(1)
	}
	labels, err := client.GetLabels(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro ao buscar etiquetas: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("OK (%d agentes, %d etiquetas)\n", len(agents), len(labels))
	fmt.Println("Baixando conversas (isso pode demorar)...")

	// Fetch all conversations
	fetched, err := client.FetchAllConversations(ctx, cfg.FetchConcurrency)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro ao buscar conversas: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nConversas processadas: %d de %d\n", len(fetched.Conversations), fetched.Expected)

	// Build label names
	labelNames := make([]string, len(labels))
	for i, l := range labels {
		labelNames[i] = l.Title
	}

	// Aggregate by agent
	type agentData struct {
		Name, Email, Role, Availability string
		Total, Open, Resolved, Pending, Snoozed int
		Labels map[string]int
	}

	byAgent := make(map[int]*agentData)
	for _, a := range agents {
		byAgent[a.ID] = &agentData{
			Name: a.Name, Email: a.Email, Role: a.Role,
			Availability: a.AvailabilityStatus,
			Labels: make(map[string]int),
		}
	}
	unassigned := &agentData{Name: "Sem responsável", Labels: make(map[string]int)}

	for _, c := range fetched.Conversations {
		var b *agentData
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

	// Write CSV
	f, _ := os.Create("dados-agentes.csv")
	defer f.Close()
	fmt.Fprint(f, "\uFEFF") // BOM

	// Header
	header := []string{"Agente", "Email", "Perfil", "Status", "Total", "Abertas", "Pendentes", "Resolvidas", "Adiadas"}
	header = append(header, labelNames...)
	fmt.Fprint(f, csvRow(header))

	// Rows
	for _, b := range byAgent {
		if b.Total == 0 {
			continue
		}
		row := []string{b.Name, b.Email, b.Role, b.Availability,
			strconv.Itoa(b.Total), strconv.Itoa(b.Open),
			strconv.Itoa(b.Pending), strconv.Itoa(b.Resolved),
			strconv.Itoa(b.Snoozed)}
		for _, name := range labelNames {
			row = append(row, strconv.Itoa(b.Labels[name]))
		}
		fmt.Fprint(f, csvRow(row))
	}
	if unassigned.Total > 0 {
		row := []string{unassigned.Name, "", "", "",
			strconv.Itoa(unassigned.Total), strconv.Itoa(unassigned.Open),
			strconv.Itoa(unassigned.Pending), strconv.Itoa(unassigned.Resolved),
			strconv.Itoa(unassigned.Snoozed)}
		for _, name := range labelNames {
			row = append(row, strconv.Itoa(unassigned.Labels[name]))
		}
		fmt.Fprint(f, csvRow(row))
	}

	fmt.Println("\n=================================================")
	fmt.Println("CONCLUÍDO - 100%")
	fmt.Println("Arquivo gerado: dados-agentes.csv")
	fmt.Println("=================================================")
}

func csvRow(fields []string) string {
	parts := make([]string, len(fields))
	for i, f := range fields {
		if strings.ContainsAny(f, "\";\n\r") {
			parts[i] = "\"" + strings.ReplaceAll(f, "\"", "\"\"") + "\""
		} else {
			parts[i] = f
		}
	}
	return strings.Join(parts, ";") + "\r\n"
}
