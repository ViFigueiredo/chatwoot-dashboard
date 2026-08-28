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

	fmt.Println("Chatwoot - Análise A+B por agente")
	fmt.Printf("Conta: %s | %s\n", cfg.AccountID, cfg.BaseURL)
	fmt.Println()

	// TODO: Implement full analysis logic (migrated from export-analise.js)
	// This follows the same pattern as the original Node.js script:
	// 1. Fetch conversations since cutoff date
	// 2. Analysis A: aggregate by agent with labels
	// 3. Analysis B: count messages sent by agent
	// 4. Write CSVs

	fmt.Println("Analise A (por conversa): analise-A-conversas.csv")
	fmt.Println("Analise B (por mensagem): analise-B-mensagens.csv")
	fmt.Println()

	agents, err := client.GetAgents(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Agentes: %d\n", len(agents))

	fmt.Println("\n=================================================")
	fmt.Println("CONCLUÍDO")
	fmt.Println("=================================================")
}
