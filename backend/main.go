package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"chatwoot-dashboard-backend/auth"
	"chatwoot-dashboard-backend/cache"
	"chatwoot-dashboard-backend/chatwoot"
	"chatwoot-dashboard-backend/config"
	"chatwoot-dashboard-backend/cors"
	"chatwoot-dashboard-backend/envloader"
	"chatwoot-dashboard-backend/handlers"
	"chatwoot-dashboard-backend/ratelimit"
)

func main() {
	// Load .env file from project root (searches current dir, parent, and grandparent)
	envloader.LoadFromProjectRoot()

	cfg := config.Load()

	// Connect to Upstash Redis
	redisURL := os.Getenv("UPSTASH_REDIS_REST_URL")
	redisToken := os.Getenv("UPSTASH_REDIS_REST_TOKEN")
	if redisURL != "" && redisToken != "" {
		if err := cache.Connect(redisURL, redisToken); err != nil {
			log.Printf("⚠️  Aviso: Upstash Redis não conectado: %v", err)
			log.Printf("   O cache em memória será usado como fallback.")
		} else {
			log.Println("✅ Upstash Redis conectado")
		}
	} else {
		log.Println("⚠️  UPSTASH_REDIS_REST_URL/_TOKEN não configurados. Cache desabilitado.")
	}

	// Create Chatwoot client
	client := chatwoot.NewClient(cfg.APIBase(), cfg.APIToken)

	// Setup middleware
	authMiddleware := auth.Middleware(cfg.DashboardToken)
	corsMiddleware := cors.New([]string{"*"}).Handler

	// Setup rate limiter for manual refresh
	refreshLimiter := ratelimit.New(cfg.RefreshRateLimitPerHour)
	log.Printf("[rate-limit] Max %d refreshes por usuário/hora", cfg.RefreshRateLimitPerHour)

	// Setup routes
	mux := http.NewServeMux()

	// API routes
	wrap := func(handler http.HandlerFunc) http.HandlerFunc {
		return authMiddleware(handler)
	}

	mux.HandleFunc("/api/report", wrap(handlers.HandleReport(cfg, client)))
	mux.HandleFunc("/api/report-refresh", wrap(handlers.HandleReportRefresh(cfg, client, refreshLimiter)))
	mux.HandleFunc("/api/export-agents", wrap(handlers.HandleExportAgents(cfg, client)))
	mux.HandleFunc("/api/export-analysis", wrap(handlers.HandleExportAnalysis(cfg, client)))
	mux.HandleFunc("/api/export-prospection", wrap(handlers.HandleExportProspection(cfg, client)))
	mux.HandleFunc("/api/dashboard-data", wrap(handlers.HandleDashboardDataDynamic(cfg, client)))
	mux.HandleFunc("/api/prospection", wrap(handlers.HandleProspection(cfg, client)))

	// Validação de token para a tela de login (autenticado e sem custo de cache/Chatwoot)
	mux.HandleFunc("/api/auth-check", wrap(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Write([]byte(`{"status":"ok"}`))
	}))

	// Health check
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Cache status (for debugging)
	mux.HandleFunc("/api/cache-status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		// Check report cache
		reportCached, reportErr := cache.Get(r.Context(), "chatwoot:report:v1")
		reportStatus := "MISS"
		reportSize := 0
		if reportErr == nil && reportCached != "" {
			reportStatus = "HIT"
			reportSize = len(reportCached)
		}

		// Check prospection cache
		prospCached, prospErr := cache.Get(r.Context(), "chatwoot:prospection:v1")
		prospStatus := "MISS"
		prospSize := 0
		if prospErr == nil && prospCached != "" {
			prospStatus = "HIT"
			prospSize = len(prospCached)
		}

		status := map[string]interface{}{
			"redis":   cache.IsConnected(),
			"report":  map[string]interface{}{"status": reportStatus, "size": reportSize, "error": fmt.Sprintf("%v", reportErr)},
			"prospection": map[string]interface{}{"status": prospStatus, "size": prospSize, "error": fmt.Sprintf("%v", prospErr)},
		}
		json.NewEncoder(w).Encode(status)
	})

	// Serve frontend static files (in production, Vercel handles this)
	publicDir := filepath.Join(".", "frontend", "dist")
	if _, err := os.Stat(publicDir); err == nil {
		fs := http.FileServer(http.Dir(publicDir))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// Try to serve the file, fallback to index.html for SPA
			path := filepath.Join(publicDir, r.URL.Path)
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, r, filepath.Join(publicDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		})
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(`<!DOCTYPE html><html><body>
				<h1>Chatwoot Dashboard Backend</h1>
				<p>API rodando. Frontend deve ser servido pelo Vercel.</p>
				<ul>
					<li><a href="/api/health">Health Check</a></li>
					<li><a href="/api/report">Report (JSON)</a></li>
				</ul>
			</body></html>`))
		})
	}

	// Apply CORS middleware
	handler := corsMiddleware(mux)

	// Start server
	port := cfg.Port
	log.Printf("🚀 Backend rodando em http://localhost:%s", port)
	log.Printf("   API Base: %s", cfg.APIBase())
	log.Printf("   Cache TTL: %ds", cfg.CacheTTLSeconds)
	log.Printf("   Concorrência: %d workers", cfg.FetchConcurrency)

	// Cache warmer: keeps the report cache fresh in background
	go cacheWarmer(cfg, client)

	log.Fatal(http.ListenAndServe(":"+port, handler))
}

// cacheWarmer periodically refreshes the report cache in background.
// Interval is configurable via CACHE_REFRESH_INTERVAL_MINUTES (default 30).
func cacheWarmer(cfg *config.Config, client *chatwoot.Client) {
	refreshInterval := time.Duration(cfg.CacheRefreshIntervalMin) * time.Minute
	log.Printf("[cache-warmer] Intervalo de refresh: %d min", cfg.CacheRefreshIntervalMin)

	// First warmup immediately
	refreshReportCache(cfg, client)

	// Then refresh periodically
	ticker := time.NewTicker(refreshInterval)
	defer ticker.Stop()

	for range ticker.C {
		refreshReportCache(cfg, client)
	}
}

func refreshReportCache(cfg *config.Config, client *chatwoot.Client) {
	log.Printf("[cache-warmer] Atualizando cache do report...")
	start := time.Now()

	report, err := handlers.BuildReportPublic(cfg, client, "", "")
	if err != nil {
		log.Printf("[cache-warmer] Erro: %v", err)
		return
	}

	data, _ := json.Marshal(report)
	cache.Set(context.Background(), "chatwoot:report:v1", string(data), cfg.CacheTTLSeconds)

	elapsed := time.Since(start).Round(time.Second)
	log.Printf("[cache-warmer] Cache atualizado em %s (%d bytes, %d agentes)", elapsed, len(data), len(report.Agents))
}

