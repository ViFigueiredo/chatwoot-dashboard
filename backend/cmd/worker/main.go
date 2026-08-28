// Worker Service — background process that keeps the cache warm.
// Connects to Chatwoot API, processes data, and saves to Redis cache.
// Does NOT serve HTTP requests. The API Service handles that.
package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"chatwoot-dashboard-backend/cache"
	"chatwoot-dashboard-backend/chatwoot"
	"chatwoot-dashboard-backend/config"
	"chatwoot-dashboard-backend/envloader"
	"chatwoot-dashboard-backend/handlers"
)

func main() {
	envloader.LoadFromProjectRoot()
	cfg := config.Load()

	// Connect to Upstash Redis
	redisURL := os.Getenv("UPSTASH_REDIS_REST_URL")
	redisToken := os.Getenv("UPSTASH_REDIS_REST_TOKEN")
	if redisURL == "" || redisToken == "" {
		log.Fatal("❌ UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN são obrigatórios para o Worker")
	}
	if err := cache.Connect(redisURL, redisToken); err != nil {
		log.Fatalf("❌ Falha ao conectar no Upstash Redis: %v", err)
	}
	log.Println("✅ Upstash Redis conectado")

	// Chatwoot client
	client := chatwoot.NewClient(cfg.APIBase(), cfg.APIToken)

	log.Printf("🔧 Worker Service iniciado")
	log.Printf("   API Base: %s", cfg.APIBase())
	log.Printf("   Refresh intervalo: %d min", cfg.CacheRefreshIntervalMin)
	log.Printf("   Cache TTL: %ds", cfg.CacheTTLSeconds)
	log.Printf("   Concorrência: %d workers", cfg.FetchConcurrency)

	// Initial warmup
	refreshReportCache(cfg, client)

	// Periodic refresh
	refreshInterval := time.Duration(cfg.CacheRefreshIntervalMin) * time.Minute
	ticker := time.NewTicker(refreshInterval)
	defer ticker.Stop()

	log.Printf("⏰ Worker aguardando próximo refresh em %d min...", cfg.CacheRefreshIntervalMin)

	for range ticker.C {
		refreshReportCache(cfg, client)
	}
}

func refreshReportCache(cfg *config.Config, client *chatwoot.Client) {
	log.Printf("[worker] Atualizando cache do report...")
	start := time.Now()

	report, err := handlers.BuildReportPublic(cfg, client, "", "")
	if err != nil {
		log.Printf("[worker] Erro ao buscar report: %v", err)
		return
	}

	data, _ := json.Marshal(report)
	if err := cache.Set(context.Background(), "chatwoot:report:v1", string(data), cfg.CacheTTLSeconds); err != nil {
		log.Printf("[worker] Erro ao salvar no cache: %v", err)
		return
	}

	elapsed := time.Since(start).Round(time.Second)
	log.Printf("[worker] Cache atualizado em %s (%d bytes, %d agentes)", elapsed, len(data), len(report.Agents))
	log.Printf("⏰ Próximo refresh em %d min", cfg.CacheRefreshIntervalMin)
}
