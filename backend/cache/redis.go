package cache

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

var (
	baseURL    string
	token      string
	httpClient = &http.Client{Timeout: 10 * time.Second}
	connected  bool

	// In-memory fallback when Redis is not available
	memStore = &memCache{
		items: make(map[string]memItem),
	}
)

type memCache struct {
	mu    sync.RWMutex
	items map[string]memItem
}

type memItem struct {
	value     string
	expiresAt time.Time
}

func (m *memCache) get(key string) (string, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	item, ok := m.items[key]
	if !ok {
		return "", false
	}
	if time.Now().After(item.expiresAt) {
		return "", false
	}
	return item.value, true
}

func (m *memCache) set(key, value string, ttlSeconds int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.items[key] = memItem{
		value:     value,
		expiresAt: time.Now().Add(time.Duration(ttlSeconds) * time.Second),
	}
}

func (m *memCache) delete(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.items, key)
}

// Connect initializes the Upstash REST API client.
func Connect(url, t string) error {
	if url == "" || t == "" {
		return fmt.Errorf("UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN são obrigatórios")
	}

	baseURL = url
	token = t

	// Test connection with PING
	result, err := execCommand(context.Background(), "PING")
	if err != nil {
		connected = false
		return fmt.Errorf("falha ao conectar no Upstash Redis: %w", err)
	}

	if result != "PONG" {
		connected = false
		return fmt.Errorf("resposta inesperada do Redis: %s", result)
	}

	connected = true
	return nil
}

// IsConnected returns whether Redis is connected.
func IsConnected() bool {
	return connected
}

// execCommand executes a Redis command via Upstash REST API.
func execCommand(ctx context.Context, args ...string) (string, error) {
	body, _ := json.Marshal(args)
	req, err := http.NewRequestWithContext(ctx, "POST", baseURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("Upstash HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Result string `json:"result"`
		Error  string `json:"error"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("resposta inválida: %w", err)
	}

	if result.Error != "" {
		return "", fmt.Errorf("redis error: %s", result.Error)
	}

	return result.Result, nil
}

// Get retrieves a cached value by key.
// Returns ("", error) if key doesn't exist or Redis is unavailable.
func Get(ctx context.Context, key string) (string, error) {
	// Try Redis first
	if connected {
		val, err := execCommand(ctx, "GET", key)
		if err != nil {
			// Redis failed, fall through to memory
		} else if val == "" || val == "(nil)" {
			// Key doesn't exist in Redis
			return "", fmt.Errorf("key not found: %s", key)
		} else {
			return val, nil
		}
	}

	// Fallback to in-memory cache
	if val, ok := memStore.get(key); ok {
		return val, nil
	}

	return "", fmt.Errorf("key not found: %s", key)
}

// Set stores a value in cache with the given TTL in seconds.
func Set(ctx context.Context, key, value string, ttlSeconds int) error {
	// Always store in memory (instant cross-request on same server)
	memStore.set(key, value, ttlSeconds)

	// Also store in Redis if connected
	if connected {
		_, err := execCommand(ctx, "SET", key, value, "EX", fmt.Sprintf("%d", ttlSeconds))
		if err != nil {
			// Redis write failed, but memory cache is still valid
			return nil
		}
	}

	return nil
}

// Delete removes a key from cache.
func Delete(ctx context.Context, key string) error {
	memStore.delete(key)

	if connected {
		_, err := execCommand(ctx, "DEL", key)
		return err
	}
	return nil
}

// GetReport retrieves the cached report.
func GetReport() (interface{}, error) {
	raw, err := Get(context.Background(), "chatwoot:report:v1")
	if err != nil || raw == "" {
		return nil, fmt.Errorf("no cached report")
	}

	var result interface{}
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, err
	}
	return result, nil
}

// SetReport caches the report with the given TTL.
func SetReport(data interface{}, ttlSeconds int) error {
	bytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("falha ao serializar para cache: %w", err)
	}
	return Set(context.Background(), "chatwoot:report:v1", string(bytes), ttlSeconds)
}

// InvalidateReport removes the cached report.
func InvalidateReport() error {
	return Delete(context.Background(), "chatwoot:report:v1")
}
