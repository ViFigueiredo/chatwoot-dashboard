package ratelimit

import (
	"net/http"
	"sync"
	"time"
)

// Limiter tracks request counts per IP within a time window.
type Limiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	limit    int
	window   time.Duration
}

type visitor struct {
	count    int
	lastSeen time.Time
}

// New creates a rate limiter with the given limit per window.
func New(limitPerHour int) *Limiter {
	l := &Limiter{
		visitors: make(map[string]*visitor),
		limit:    limitPerHour,
		window:   1 * time.Hour,
	}
	// Cleanup stale entries every 10 minutes
	go l.cleanup()
	return l
}

// Allow checks if a request from the given IP is allowed.
func (l *Limiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	v, exists := l.visitors[ip]
	if !exists {
		l.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
		return true
	}

	// Reset window if it has expired
	if time.Since(v.lastSeen) > l.window {
		v.count = 1
		v.lastSeen = time.Now()
		return true
	}

	if v.count >= l.limit {
		return false
	}

	v.count++
	v.lastSeen = time.Now()
	return true
}

// Remaining returns how many requests are left in the current window.
func (l *Limiter) Remaining(ip string) int {
	l.mu.Lock()
	defer l.mu.Unlock()

	v, exists := l.visitors[ip]
	if !exists {
		return l.limit
	}

	if time.Since(v.lastSeen) > l.window {
		return l.limit
	}

	remaining := l.limit - v.count
	if remaining < 0 {
		return 0
	}
	return remaining
}

func (l *Limiter) cleanup() {
	for {
		time.Sleep(10 * time.Minute)
		l.mu.Lock()
		for ip, v := range l.visitors {
			if time.Since(v.lastSeen) > l.window {
				delete(l.visitors, ip)
			}
		}
		l.mu.Unlock()
	}
}

// GetClientIP extracts the client IP from the request.
func GetClientIP(r *http.Request) string {
	// Check X-Forwarded-For first (for proxied requests)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP
		for i, c := range xff {
			if c == ',' {
				return xff[:i]
			}
		}
		return xff
	}
	// Check X-Real-IP
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	// Fall back to RemoteAddr
	ip := r.RemoteAddr
	// Strip port
	for i := len(ip) - 1; i >= 0; i-- {
		if ip[i] == ':' {
			return ip[:i]
		}
	}
	return ip
}
