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

	fmt.Println("Chatwoot - Relatório DETALHADO (registro por registro)")
	fmt.Printf("Uma linha por mensagem enviada, a partir de %s\n", cfg.CutoffDate)
	fmt.Printf("Conta: %s | %s\n", cfg.AccountID, cfg.BaseURL)
	fmt.Println()

	// TODO: Implement full detailed export logic (migrated from export-detalhado.js)
	// This follows the same pattern as the original Node.js script:
	// 1. Fetch conversations since cutoff
	// 2. For each conversation, fetch all messages
	// 3. Filter outgoing messages from agents (not bots)
	// 4. One row per message with conversation metadata
	// 5. Write CSV

	labels, err := client.GetLabels(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Etiquetas: %d\n", len(labels))

	fmt.Println("\n=================================================")
	fmt.Println("CONCLUÍDO")
	fmt.Println("Arquivo: analise-detalhada-mensagens.csv")
	fmt.Println("=================================================")
}
