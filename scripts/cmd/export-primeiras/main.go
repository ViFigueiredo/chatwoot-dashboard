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

	fmt.Println("Chatwoot - Relatório de PROSPECÇÃO")
	fmt.Println("Conta prospecção = conversa cuja 1ª mensagem foi enviada pelo agente")
	fmt.Printf("Período: a partir de %s\n", cfg.CutoffDate)
	fmt.Printf("Conta: %s | %s\n", cfg.AccountID, cfg.BaseURL)
	fmt.Println()

	// TODO: Implement full prospection logic (migrated from export-primeiras.js)
	// This follows the same pattern as the original Node.js script:
	// 1. Fetch conversations since cutoff
	// 2. For each conversation, find the first message
	// 3. If first message was outgoing (agent), it's prospection
	// 4. Deduplicate by client (phone number)
	// 5. Write CSV

	labels, err := client.GetLabels(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Etiquetas: %d\n", len(labels))

	fmt.Println("\n=================================================")
	fmt.Println("CONCLUÍDO")
	fmt.Println("=================================================")
}
