package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	// Clear env vars to test defaults
	os.Unsetenv("CHATWOOT_BASE_URL")
	os.Unsetenv("CHATWOOT_ACCOUNT_ID")
	os.Unsetenv("CHATWOOT_API_TOKEN")
	os.Unsetenv("PORT")
	os.Unsetenv("CACHE_TTL_SECONDS")
	os.Unsetenv("FETCH_CONCURRENCY")
	os.Unsetenv("DASHBOARD_TOKEN")
	os.Unsetenv("CUTOFF_DATE")
	os.Unsetenv("EXCLUDE_SENDERS")

	cfg := Load()

	if cfg.BaseURL != "https://atendimento.grupoavantti.com.br" {
		t.Errorf("expected default BaseURL, got %s", cfg.BaseURL)
	}
	if cfg.AccountID != "3" {
		t.Errorf("expected default AccountID '3', got %s", cfg.AccountID)
	}
	if cfg.Port != "8080" {
		t.Errorf("expected default Port '8080', got %s", cfg.Port)
	}
	if cfg.CacheTTLSeconds != 86400 {
		t.Errorf("expected default CacheTTLSeconds 86400, got %d", cfg.CacheTTLSeconds)
	}
	if cfg.FetchConcurrency != 8 {
		t.Errorf("expected default FetchConcurrency 8, got %d", cfg.FetchConcurrency)
	}
	if cfg.CutoffDate != "2026-08-17" {
		t.Errorf("expected default CutoffDate, got %s", cfg.CutoffDate)
	}
}

func TestLoadFromEnv(t *testing.T) {
	os.Setenv("CHATWOOT_BASE_URL", "https://custom.example.com")
	os.Setenv("CHATWOOT_ACCOUNT_ID", "42")
	os.Setenv("PORT", "9999")
	os.Setenv("CACHE_TTL_SECONDS", "600")
	os.Setenv("FETCH_CONCURRENCY", "16")
	os.Setenv("DASHBOARD_TOKEN", "secret123")
	os.Setenv("CUTOFF_DATE", "2026-01-01")
	defer func() {
		os.Unsetenv("CHATWOOT_BASE_URL")
		os.Unsetenv("CHATWOOT_ACCOUNT_ID")
		os.Unsetenv("PORT")
		os.Unsetenv("CACHE_TTL_SECONDS")
		os.Unsetenv("FETCH_CONCURRENCY")
		os.Unsetenv("DASHBOARD_TOKEN")
		os.Unsetenv("CUTOFF_DATE")
	}()

	cfg := Load()

	if cfg.BaseURL != "https://custom.example.com" {
		t.Errorf("expected custom BaseURL, got %s", cfg.BaseURL)
	}
	if cfg.AccountID != "42" {
		t.Errorf("expected custom AccountID '42', got %s", cfg.AccountID)
	}
	if cfg.Port != "9999" {
		t.Errorf("expected custom Port '9999', got %s", cfg.Port)
	}
	if cfg.CacheTTLSeconds != 600 {
		t.Errorf("expected custom CacheTTLSeconds 600, got %d", cfg.CacheTTLSeconds)
	}
	if cfg.FetchConcurrency != 16 {
		t.Errorf("expected custom FetchConcurrency 16, got %d", cfg.FetchConcurrency)
	}
	if cfg.DashboardToken != "secret123" {
		t.Errorf("expected custom DashboardToken, got %s", cfg.DashboardToken)
	}
}

func TestAPIBase(t *testing.T) {
	cfg := &Config{
		BaseURL:   "https://chat.example.com",
		AccountID: "5",
	}
	expected := "https://chat.example.com/api/v1/accounts/5"
	if cfg.APIBase() != expected {
		t.Errorf("expected APIBase %s, got %s", expected, cfg.APIBase())
	}
}

func TestLoadExcludeSenders(t *testing.T) {
	os.Setenv("EXCLUDE_SENDERS", "Bot1, Bot2, Bot3")
	defer os.Unsetenv("EXCLUDE_SENDERS")

	cfg := Load()
	if len(cfg.ExcludeSenders) != 3 {
		t.Errorf("expected 3 exclude senders, got %d", len(cfg.ExcludeSenders))
	}
	if cfg.ExcludeSenders[0] != "Bot1" {
		t.Errorf("expected 'Bot1', got %s", cfg.ExcludeSenders[0])
	}
}
