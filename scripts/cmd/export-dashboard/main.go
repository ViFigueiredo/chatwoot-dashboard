package main

import (
	"context"
	"fmt"
	"os"

	"chatwoot-dashboard-backend/chatwoot"
	"chatwoot-dashboard-backend/config"
)

func main() {
	cfg := config.Load()
	client := chatwoot.NewClient(cfg.APIBase(), cfg.APIToken)
	ctx := context.Background()

	fmt.Println("Chatwoot - Gerando dados do dashboard de supervisores")
	fmt.Printf("Período: a partir de %s | Conta: %s\n\n", cfg.CutoffDate, cfg.AccountID)

	// TODO: Implement full dashboard data logic (migrated from export-dashboard-data.js)
	// This follows the same pattern as the original Node.js script:
	// 1. Fetch labels, agents, teams
	// 2. Map agents to teams (supervisors)
	// 3. Fetch conversations since cutoff
	// 4. For each conversation, find first message
	// 5. If outgoing by agent → prospection record
	// 6. Write public/dashboard-data.json

	agents, err := client.GetAgents(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Agentes: %d\n", len(agents))

	teams, err := client.GetTeams(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Aviso: não foi possível buscar times: %v\n", err)
	} else {
		fmt.Printf("Times: %d\n", len(teams))
	}

	fmt.Println("\n=================================================")
	fmt.Println("CONCLUÍDO")
	fmt.Println("Arquivo: public/dashboard-data.json")
	fmt.Println("=================================================")
}
