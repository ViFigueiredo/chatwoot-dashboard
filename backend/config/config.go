package config

import (
	"os"
	"strconv"
)

type Config struct {
	// Chatwoot API
	BaseURL        string
	AccountID      string
	APIToken       string

	// Server
	Port string

	// Cache
	CacheTTLSeconds          int
	CacheRefreshIntervalMin  int // minutes between background refreshes

	// Rate limiting
	RefreshRateLimitPerHour int // max manual refreshes per user per hour

	// Fetch
	FetchConcurrency int

	// Auth
	DashboardToken string

	// Business
	CutoffDate    string
	ExcludeSenders []string
}

func Load() *Config {
	return &Config{
		BaseURL:          getEnv("CHATWOOT_BASE_URL", "https://atendimento.grupoavantti.com.br"),
		AccountID:        getEnv("CHATWOOT_ACCOUNT_ID", "3"),
		APIToken:         getEnv("CHATWOOT_API_TOKEN", ""),
		Port:             getEnv("PORT", "8080"),
		CacheTTLSeconds:          getEnvInt("CACHE_TTL_SECONDS", 86400),
		CacheRefreshIntervalMin:  getEnvInt("CACHE_REFRESH_INTERVAL_MINUTES", 30),
		RefreshRateLimitPerHour:  getEnvInt("REFRESH_RATE_LIMIT_PER_HOUR", 10),
		FetchConcurrency: getEnvInt("FETCH_CONCURRENCY", 8),
		DashboardToken:   getEnv("DASHBOARD_TOKEN", ""),
		CutoffDate:       getEnv("CUTOFF_DATE", "2026-08-17"),
		ExcludeSenders:   getEnvSlice("EXCLUDE_SENDERS", []string{"Figcodes Automações"}),
	}
}

func (c *Config) APIBase() string {
	return c.BaseURL + "/api/v1/accounts/" + c.AccountID
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvSlice(key string, fallback []string) []string {
	if v := os.Getenv(key); v != "" {
		result := []string{}
		for _, s := range splitAndTrim(v) {
			if s != "" {
				result = append(result, s)
			}
		}
		if len(result) > 0 {
			return result
		}
	}
	return fallback
}

func splitAndTrim(s string) []string {
	parts := []string{}
	current := ""
	for _, c := range s {
		if c == ',' {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	parts = append(parts, current)
	result := []string{}
	for _, p := range parts {
		trimmed := ""
		for _, c := range p {
			if c != ' ' && c != '\t' {
				trimmed += string(c)
			}
		}
		result = append(result, trimmed)
	}
	return result
}
