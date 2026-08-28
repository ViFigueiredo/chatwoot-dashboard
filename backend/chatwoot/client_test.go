package chatwoot

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewClient(t *testing.T) {
	client := NewClient("https://chat.example.com/api/v1/accounts/3", "token123")
	if client.apiBase != "https://chat.example.com/api/v1/accounts/3" {
		t.Errorf("expected apiBase, got %s", client.apiBase)
	}
	if client.apiToken != "token123" {
		t.Errorf("expected apiToken, got %s", client.apiToken)
	}
}

func TestAPIGetSuccess(t *testing.T) {
	// Mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify auth header
		if r.Header.Get("api_access_token") != "test-token" {
			t.Errorf("expected api_access_token header, got %s", r.Header.Get("api_access_token"))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"payload": []map[string]interface{}{
				{"id": 1, "name": "Agent 1"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token")
	data, err := client.APIGet(context.Background(), "/agents", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var result struct {
		Payload []struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		} `json:"payload"`
	}
	json.Unmarshal(data, &result)

	if len(result.Payload) != 1 {
		t.Errorf("expected 1 agent, got %d", len(result.Payload))
	}
	if result.Payload[0].Name != "Agent 1" {
		t.Errorf("expected 'Agent 1', got %s", result.Payload[0].Name)
	}
}

func TestAPIGetRetriesOnError(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token")
	_, err := client.APIGet(context.Background(), "/test", 3)
	if err != nil {
		t.Fatalf("expected success after retries, got: %v", err)
	}
	if attempts != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
}

func TestAPIGetFailsAfterMaxRetries(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token")
	_, err := client.APIGet(context.Background(), "/test", 2)
	if err == nil {
		t.Error("expected error after max retries, got nil")
	}
}

func TestGetAgentsDirectArray(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// Chatwoot returns agents as a direct array
		json.NewEncoder(w).Encode([]map[string]interface{}{
			{"id": 1, "name": "Agent 1", "email": "a1@test.com"},
			{"id": 2, "name": "Agent 2", "email": "a2@test.com"},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token")
	agents, err := client.GetAgents(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(agents) != 2 {
		t.Errorf("expected 2 agents, got %d", len(agents))
	}
}

func TestGetAgentsWrappedPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"payload": []map[string]interface{}{
				{"id": 1, "name": "Agent 1"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token")
	agents, err := client.GetAgents(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(agents) != 1 {
		t.Errorf("expected 1 agent, got %d", len(agents))
	}
}

func TestGetLabels(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"payload": []map[string]interface{}{
				{"title": "Suporte", "color": "#ff0000"},
				{"title": "Vendas", "color": "#00ff00"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token")
	labels, err := client.GetLabels(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(labels) != 2 {
		t.Errorf("expected 2 labels, got %d", len(labels))
	}
	if labels[0].Title != "Suporte" {
		t.Errorf("expected 'Suporte', got %s", labels[0].Title)
	}
}
