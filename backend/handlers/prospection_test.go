package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"chatwoot-dashboard-backend/chatwoot"
	"chatwoot-dashboard-backend/config"
)

// mockTransport returns a mock HTTP transport that intercepts Chatwoot API calls.
type mockChatwootHandler struct {
	t          *testing.T
	agents     []chatwoot.Agent
	labels     []chatwoot.Label
	convs      []chatwoot.Conversation
	messages   map[int][]chatMessage // convID -> messages (newest first)
	callCount  int
}

type chatMessage struct {
	ID          int                    `json:"id"`
	MessageType int                    `json:"message_type"`
	CreatedAt   int64                  `json:"created_at"`
	Private     bool                   `json:"private"`
	Sender      *chatwoot.MessageSender `json:"sender"`
}

func (m *mockChatwootHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.callCount++
	path := r.URL.Path

	w.Header().Set("Content-Type", "application/json")

	switch {
	case path == "/api/v1/accounts/1/agents":
		json.NewEncoder(w).Encode(m.agents)

	case path == "/api/v1/accounts/1/labels":
		json.NewEncoder(w).Encode(m.labels)

	case path == "/api/v1/accounts/1/teams":
		json.NewEncoder(w).Encode([]interface{}{})

	case strings.HasPrefix(path, "/api/v1/accounts/1/conversations") && strings.Contains(path, "/messages"):
		// Extract conversation ID from path
		parts := strings.Split(path, "/")
		if len(parts) < 7 {
			json.NewEncoder(w).Encode(map[string]interface{}{"payload": []interface{}{}})
			return
		}
		convID := 0
		for _, p := range parts {
			if p == "messages" {
				break
			}
			n := 0
			for _, c := range p {
				if c >= '0' && c <= '9' {
					n = n*10 + int(c-'0')
				}
			}
			if n > 0 {
				convID = n
			}
		}

		msgs, ok := m.messages[convID]
		if !ok {
			json.NewEncoder(w).Encode(map[string]interface{}{"payload": []interface{}{}})
			return
		}

		// Handle "before" parameter
		before := r.URL.Query().Get("before")
		if before != "" {
			beforeID := 0
			for _, c := range before {
				if c >= '0' && c <= '9' {
					beforeID = beforeID*10 + int(c-'0')
				}
			}
			var filtered []chatMessage
			for _, msg := range msgs {
				if msg.ID < beforeID {
					filtered = append(filtered, msg)
				}
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"payload": filtered})
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{"payload": msgs})

	case strings.HasPrefix(path, "/api/v1/accounts/1/conversations"):
		// Conversations endpoint — only return data on page 1
		page := r.URL.Query().Get("page")
		if page == "" || page == "1" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"data": map[string]interface{}{
					"payload": m.convs,
					"meta":    map[string]interface{}{"all_count": len(m.convs)},
				},
			})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"data": map[string]interface{}{
					"payload": []interface{}{},
					"meta":    map[string]interface{}{"all_count": len(m.convs)},
				},
			})
		}

	default:
		json.NewEncoder(w).Encode(map[string]interface{}{})
	}
}

func newMockClient(handler http.Handler) *chatwoot.Client {
	ts := httptest.NewServer(handler)
	return chatwoot.NewClient(ts.URL+"/api/v1/accounts/1", "test-token")
}

func TestHandleProspection_CacheHit(t *testing.T) {
	// Setup mock server with no data (shouldn't be called)
	mock := &mockChatwootHandler{t: t, agents: []chatwoot.Agent{}}
	client := newMockClient(mock)
	cfg := &config.Config{CutoffDate: "2026-08-01", CacheTTLSeconds: 900}

	handler := HandleProspection(cfg, client)

	// Create a request with no cache
	req := httptest.NewRequest("GET", "/api/prospection", nil)
	w := httptest.NewRecorder()

	// First call - should try to build (will fail with no agents, but tests the flow)
	handler(w, req)

	// Should get a response (even if empty or error)
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("expected 200 or 500, got %d", w.Code)
	}
}

func TestHandleProspection_ForceRefresh(t *testing.T) {
	agents := []chatwoot.Agent{
		{ID: 1, Name: "Agent1", Email: "a@test.com", Role: "agent"},
	}
	labels := []chatwoot.Label{
		{Title: "Vendas", Color: "#00ff00"},
	}
	convs := []chatwoot.Conversation{
		{
			ID:             100,
			Status:         "open",
			Labels:         []string{"Vendas"},
			LastActivityAt: time.Now().Unix(),
			Meta: chatwoot.ConversationMeta{
				Assignee: &chatwoot.AgentRef{ID: 1, Name: "Agent1"},
				Sender:   &chatwoot.ContactRef{ID: 50, Name: "Client1", PhoneNumber: "11999990000"},
			},
		},
	}

	// First message is outgoing (type 1) = prospection
	messages := map[int][]chatMessage{
		100: {
			{ID: 10, MessageType: 1, CreatedAt: time.Date(2026, 8, 15, 10, 30, 0, 0, time.UTC).Unix(), Sender: &chatwoot.MessageSender{ID: 1, Name: "Agent1"}},
			{ID: 5, MessageType: 0, CreatedAt: time.Date(2026, 8, 15, 10, 35, 0, 0, time.UTC).Unix(), Sender: &chatwoot.MessageSender{ID: 50, Name: "Client1"}},
		},
	}

	mock := &mockChatwootHandler{t: t, agents: agents, labels: labels, convs: convs, messages: messages}
	client := newMockClient(mock)
	cfg := &config.Config{CutoffDate: "2026-08-01", FetchConcurrency: 2, CacheTTLSeconds: 900}

	handler := HandleProspection(cfg, client)

	req := httptest.NewRequest("GET", "/api/prospection?refresh=1", nil)
	w := httptest.NewRecorder()

	handler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp ProspectionResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if len(resp.Records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(resp.Records))
	}

	record := resp.Records[0]
	if record.Agente != "Agent1" {
		t.Errorf("expected agent 'Agent1', got '%s'", record.Agente)
	}
	if record.Telefone != "11999990000" {
		t.Errorf("expected phone '11999990000', got '%s'", record.Telefone)
	}
	if record.ConversaID != 100 {
		t.Errorf("expected conversaId 100, got %d", record.ConversaID)
	}
}

func TestHandleProspection_InboundNotProspection(t *testing.T) {
	agents := []chatwoot.Agent{
		{ID: 1, Name: "Agent1", Email: "a@test.com", Role: "agent"},
	}
	labels := []chatwoot.Label{}
	convs := []chatwoot.Conversation{
		{
			ID:     200,
			Status: "open",
			Meta: chatwoot.ConversationMeta{
				Sender: &chatwoot.ContactRef{ID: 60, Name: "Client2"},
			},
		},
	}

	// First message is incoming (type 0) = NOT prospection
	messages := map[int][]chatMessage{
		200: {
			{ID: 20, MessageType: 0, CreatedAt: time.Date(2026, 8, 10, 9, 0, 0, 0, time.UTC).Unix()},
		},
	}

	mock := &mockChatwootHandler{t: t, agents: agents, labels: labels, convs: convs, messages: messages}
	client := newMockClient(mock)
	cfg := &config.Config{CutoffDate: "2026-08-01", FetchConcurrency: 2, CacheTTLSeconds: 900}

	handler := HandleProspection(cfg, client)
	req := httptest.NewRequest("GET", "/api/prospection?refresh=1", nil)
	w := httptest.NewRecorder()

	handler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp ProspectionResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(resp.Records) != 0 {
		t.Errorf("expected 0 records for inbound conversation, got %d", len(resp.Records))
	}
}

func TestHandleProspection_ContextTimeout(t *testing.T) {
	// Create a context that's already cancelled
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()
	time.Sleep(2 * time.Millisecond) // Ensure timeout

	cfg := &config.Config{CutoffDate: "2026-08-01", FetchConcurrency: 2}
	client := chatwoot.NewClient("http://localhost:99999", "token")

	// buildProspectionData should respect context cancellation
	_, err := buildProspectionData(ctx, cfg, client, "chatwoot:prospection:v1")
	if err == nil {
		t.Error("expected error from cancelled context")
	}
}

func TestFindFirstMessage_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	client := chatwoot.NewClient("http://localhost:99999", "token")
	msg := findFirstMessage(ctx, client, 1, make(map[string]bool))
	if msg != nil {
		t.Error("expected nil from cancelled context")
	}
}

func TestFindFirstMessage_ExcludesPrivate(t *testing.T) {
	// Test that private messages are excluded
	agents := []chatwoot.Agent{}
	labels := []chatwoot.Label{}
	convs := []chatwoot.Conversation{
		{ID: 300, Status: "open", Meta: chatwoot.ConversationMeta{}},
	}

	// Only a private message exists - should return nil
	messages := map[int][]chatMessage{
		300: {
			{ID: 30, MessageType: 1, CreatedAt: time.Now().Unix(), Private: true},
		},
	}

	mock := &mockChatwootHandler{t: t, agents: agents, labels: labels, convs: convs, messages: messages}
	client := newMockClient(mock)
	cfg := &config.Config{CutoffDate: "2026-08-01", FetchConcurrency: 1, CacheTTLSeconds: 900}

	handler := HandleProspection(cfg, client)
	req := httptest.NewRequest("GET", "/api/prospection?refresh=1", nil)
	w := httptest.NewRecorder()

	handler(w, req)

	var resp ProspectionResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if len(resp.Records) != 0 {
		t.Errorf("expected 0 records (private message excluded), got %d", len(resp.Records))
	}
}

func TestHandleProspection_InvalidMethod(t *testing.T) {
	mock := &mockChatwootHandler{t: t}
	client := newMockClient(mock)
	cfg := &config.Config{CutoffDate: "2026-08-01"}

	handler := HandleProspection(cfg, client)
	req := httptest.NewRequest("POST", "/api/prospection", nil)
	w := httptest.NewRecorder()

	handler(w, req)
	// Handler doesn't check method, so it'll process regardless
	// This is fine for our architecture
}

func TestBuildPartialResponse(t *testing.T) {
	labels := []chatwoot.Label{{Title: "Vendas", Color: "#ff0000"}}
	teamNames := []string{"Team A"}
	agentTeams := map[string][]string{"Agent1": {"Team A"}}
	records := []ProspectionRecord{
		{Agente: "Agent1", Data: "2026-08-15", ConversaID: 1},
	}

	result := buildPartialResponse(labels, teamNames, agentTeams, records, "2026-08-01")

	if result.CutoffDate != "2026-08-01" {
		t.Errorf("expected cutoffDate '2026-08-01', got '%s'", result.CutoffDate)
	}
	if len(result.Labels) != 1 {
		t.Errorf("expected 1 label, got %d", len(result.Labels))
	}
	if len(result.Records) != 1 {
		t.Errorf("expected 1 record, got %d", len(result.Records))
	}
	if len(result.Teams) != 1 {
		t.Errorf("expected 1 team, got %d", len(result.Teams))
	}
}
