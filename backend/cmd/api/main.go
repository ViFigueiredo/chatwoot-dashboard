// API Service — lightweight HTTP server that only reads from cache.
// Does NOT fetch from Chatwoot API or warm the cache.
// The Worker Service handles cache warming separately.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

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
	envloader.LoadFromProjectRoot()
	cfg := config.Load()

	// Connect to Upstash Redis
	redisURL := os.Getenv("UPSTASH_REDIS_REST_URL")
	redisToken := os.Getenv("UPSTASH_REDIS_REST_TOKEN")
	if redisURL != "" && redisToken != "" {
		if err := cache.Connect(redisURL, redisToken); err != nil {
			log.Printf("⚠️  Upstash Redis não conectado: %v", err)
			log.Printf("   O cache em memória será usado como fallback.")
		} else {
			log.Println("✅ Upstash Redis conectado")
		}
	} else {
		log.Println("⚠️  UPSTASH não configurado. Cache desabilitado.")
	}

	// Chatwoot client (used for exports and on-demand builds when cache is empty)
	client := chatwoot.NewClient(cfg.APIBase(), cfg.APIToken)

	// Middleware
	authMiddleware := auth.Middleware(cfg.DashboardToken)
	corsMiddleware := cors.New([]string{"*"}).Handler
	refreshLimiter := ratelimit.New(cfg.RefreshRateLimitPerHour)

	log.Printf("🚀 API Service rodando em http://localhost:%s", cfg.Port)
	log.Printf("   Modo: somente leitura do cache (Worker Service aquece o cache)")
	log.Printf("   Cache TTL: %ds | Rate limit: %d/hora", cfg.CacheTTLSeconds, cfg.RefreshRateLimitPerHour)

	// Routes
	mux := http.NewServeMux()
	wrap := func(h http.HandlerFunc) http.HandlerFunc { return authMiddleware(h) }

	mux.HandleFunc("/api/report", wrap(handlers.HandleReport(cfg, client)))
	mux.HandleFunc("/api/report-refresh", wrap(handlers.HandleReportRefresh(cfg, client, refreshLimiter)))
	mux.HandleFunc("/api/export-agents", wrap(handlers.HandleExportAgents(cfg, client)))
	mux.HandleFunc("/api/export-analysis", wrap(handlers.HandleExportAnalysis(cfg, client)))
	mux.HandleFunc("/api/export-prospection", wrap(handlers.HandleExportProspection(cfg, client)))
	mux.HandleFunc("/api/dashboard-data", wrap(handlers.HandleDashboardDataDynamic(cfg, client)))
	mux.HandleFunc("/api/prospection", wrap(handlers.HandleProspection(cfg, client)))

	// Health check
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"api"}`))
	})

	// Cache status
	mux.HandleFunc("/api/cache-status", handleCacheStatus)

	// Static files (production)
	serveStatic(mux)

	log.Fatal(http.ListenAndServe(":"+cfg.Port, corsMiddleware(mux)))
}

func handleCacheStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	reportCached, reportErr := cache.Get(r.Context(), "chatwoot:report:v1")
	reportStatus, reportSize := "MISS", 0
	if reportErr == nil && reportCached != "" {
		reportStatus, reportSize = "HIT", len(reportCached)
	}

	prospCached, prospErr := cache.Get(r.Context(), "chatwoot:prospection:v1")
	prospStatus, prospSize := "MISS", 0
	if prospErr == nil && prospCached != "" {
		prospStatus, prospSize = "HIT", len(prospCached)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "api",
		"redis":   cache.IsConnected(),
		"report":  map[string]interface{}{"status": reportStatus, "size": reportSize, "error": fmt.Sprintf("%v", reportErr)},
		"prospection": map[string]interface{}{"status": prospStatus, "size": prospSize, "error": fmt.Sprintf("%v", prospErr)},
	})
}

func serveStatic(mux *http.ServeMux) {
	publicDir := filepath.Join(".", "frontend", "dist")
	if _, err := os.Stat(publicDir); err == nil {
		fs := http.FileServer(http.Dir(publicDir))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
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
				<h1>Chatwoot BI API</h1>
				<p>API Service rodando. Use o frontend via Vercel.</p>
				<ul>
					<li><a href="/api/health">Health Check</a></li>
					<li><a href="/api/cache-status">Cache Status</a></li>
				</ul>
			</body></html>`))
		})
	}
}
