package chatwoot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"time"
)

// Client is an HTTP client for the Chatwoot API.
type Client struct {
	apiBase    string
	apiToken   string
	httpClient *http.Client
}

// NewClient creates a new Chatwoot API client.
func NewClient(apiBase, apiToken string) *Client {
	return &Client{
		apiBase:  apiBase,
		apiToken: apiToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// apiGetOnce performs a single GET request and returns raw JSON bytes.
func (c *Client) apiGetOnce(ctx context.Context, pathname string) ([]byte, error) {
	url := c.apiBase + pathname

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("falha ao criar request: %w", err)
	}

	req.Header.Set("api_access_token", c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha na conexão: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d em %s: %s", resp.StatusCode, pathname, string(body))
	}

	return io.ReadAll(resp.Body)
}

// APIGet performs a GET request with retry and exponential backoff.
func (c *Client) APIGet(ctx context.Context, pathname string, retries int) ([]byte, error) {
	var lastErr error
	for i := 0; i <= retries; i++ {
		result, err := c.apiGetOnce(ctx, pathname)
		if err == nil {
			return result, nil
		}
		lastErr = err
		if i < retries {
			wait := time.Duration(500*math.Pow(2, float64(i))) * time.Millisecond
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(wait):
			}
		}
	}
	return nil, lastErr
}

// GetAgents retrieves the list of agents.
// Chatwoot returns agents as a JSON array directly: [{...}, {...}]
func (c *Client) GetAgents(ctx context.Context) ([]Agent, error) {
	data, err := c.APIGet(ctx, "/agents", 4)
	if err != nil {
		return nil, err
	}

	var agents []Agent
	if err := json.Unmarshal(data, &agents); err != nil {
		// Try as object with payload key
		var wrapper struct {
			Payload []Agent `json:"payload"`
		}
		if err2 := json.Unmarshal(data, &wrapper); err2 == nil && len(wrapper.Payload) > 0 {
			return wrapper.Payload, nil
		}
		return nil, fmt.Errorf("falha ao parsear agentes: %w", err)
	}

	return agents, nil
}

// GetLabels retrieves the list of labels.
func (c *Client) GetLabels(ctx context.Context) ([]Label, error) {
	data, err := c.APIGet(ctx, "/labels", 4)
	if err != nil {
		return nil, err
	}

	// Try as object with payload key first
	var wrapper struct {
		Payload []Label `json:"payload"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Payload) > 0 {
		return wrapper.Payload, nil
	}

	// Try as direct array
	var labels []Label
	if err := json.Unmarshal(data, &labels); err == nil {
		return labels, nil
	}

	return nil, fmt.Errorf("falha ao parsear labels")
}

// GetTeams retrieves the list of teams.
func (c *Client) GetTeams(ctx context.Context) ([]map[string]interface{}, error) {
	data, err := c.APIGet(ctx, "/teams", 4)
	if err != nil {
		return nil, err
	}

	// Try as object with payload key
	var wrapper struct {
		Payload []map[string]interface{} `json:"payload"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Payload) > 0 {
		return wrapper.Payload, nil
	}

	// Try as direct array
	var teams []map[string]interface{}
	if err := json.Unmarshal(data, &teams); err == nil {
		return teams, nil
	}

	return nil, fmt.Errorf("falha ao parsear teams")
}

// GetMessages retrieves messages for a conversation, optionally before a given ID.
func (c *Client) GetMessages(ctx context.Context, convID int, before *int) ([]Message, error) {
	path := fmt.Sprintf("/conversations/%d/messages", convID)
	if before != nil {
		path = fmt.Sprintf("/conversations/%d/messages?before=%d", convID, *before)
	}

	data, err := c.APIGet(ctx, path, 4)
	if err != nil {
		return nil, err
	}

	// Messages are wrapped in: {"payload": [...]}
	var wrapper struct {
		Payload []Message `json:"payload"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil {
		return wrapper.Payload, nil
	}

	return []Message{}, nil
}
