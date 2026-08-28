package chatwoot

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
)

// FetchAllResult contains the result of fetching all conversations.
type FetchAllResult struct {
	Conversations []Conversation
	TotalPages    int
	FailedPages   []int
	Expected      int
}

// FetchAllConversations fetches all conversations from Chatwoot with parallel pagination.
func (c *Client) FetchAllConversations(ctx context.Context, concurrency int) (*FetchAllResult, error) {
	// First page: discover total count
	firstData, err := c.APIGet(ctx, "/conversations?status=all&page=1", 4)
	if err != nil {
		return nil, fmt.Errorf("falha ao buscar primeira página: %w", err)
	}

	// Parse first page response: {"data": {"payload": [...], "meta": {"all_count": N}}}
	var firstWrapper struct {
		Data struct {
			Payload []json.RawMessage `json:"payload"`
			Meta    struct {
				AllCount int `json:"all_count"`
			} `json:"meta"`
		} `json:"data"`
	}
	if err := json.Unmarshal(firstData, &firstWrapper); err != nil {
		return nil, fmt.Errorf("falha ao parsear primeira página: %w", err)
	}

	total := firstWrapper.Data.Meta.AllCount
	perPage := len(firstWrapper.Data.Payload)
	if perPage == 0 {
		perPage = 25
	}
	totalPages := total / perPage
	if total%perPage != 0 {
		totalPages++
	}
	if totalPages < 1 {
		totalPages = 1
	}

	log.Printf("[fetch] Total: %d conversas, %d páginas, %d por página", total, totalPages, perPage)

	// Parse first page conversations
	var all []Conversation
	for _, raw := range firstWrapper.Data.Payload {
		var conv Conversation
		if err := json.Unmarshal(raw, &conv); err == nil {
			all = append(all, conv)
		}
	}

	// Parallel fetch remaining pages
	var mu sync.Mutex
	var failedPages []int
	var nextPage int64 = 2

	worker := func() {
		for {
			page := int(atomic.AddInt64(&nextPage, 1) - 1)
			if page > totalPages {
				break
			}

			path := fmt.Sprintf("/conversations?status=all&page=%d", page)
			data, err := c.APIGet(ctx, path, 4)
			if err != nil {
				mu.Lock()
				failedPages = append(failedPages, page)
				mu.Unlock()
				continue
			}

			var wrapper struct {
				Data struct {
					Payload []Conversation `json:"payload"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &wrapper); err == nil {
				mu.Lock()
				all = append(all, wrapper.Data.Payload...)
				mu.Unlock()
			}
		}
	}

	// Launch workers
	var wg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			worker()
		}()
	}
	wg.Wait()

	log.Printf("[fetch] Primeira passada concluída: %d conversas, %d páginas com falha", len(all), len(failedPages))

	// Second pass: retry failed pages sequentially
	if len(failedPages) > 0 {
		var stillFailed []int
		for _, page := range failedPages {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
			}

			path := fmt.Sprintf("/conversations?status=all&page=%d", page)
			data, err := c.APIGet(ctx, path, 5)
			if err != nil {
				stillFailed = append(stillFailed, page)
				continue
			}

			var wrapper struct {
				Data struct {
					Payload []Conversation `json:"payload"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &wrapper); err == nil {
				mu.Lock()
				all = append(all, wrapper.Data.Payload...)
				mu.Unlock()
			}
		}
		failedPages = stillFailed
	}

	log.Printf("[fetch] Concluído: %d conversas totais, %d páginas com falha permanente", len(all), len(failedPages))

	return &FetchAllResult{
		Conversations: all,
		TotalPages:    totalPages,
		FailedPages:   failedPages,
		Expected:      total,
	}, nil
}
