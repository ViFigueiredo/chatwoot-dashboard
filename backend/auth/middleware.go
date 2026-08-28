package auth

import (
	"net/http"
	"strings"
)

// Middleware validates the Bearer token from the Authorization header.
// If DASHBOARD_TOKEN is empty, all requests are allowed (development mode).
func Middleware(dashboardToken string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// No token configured = open access (dev mode)
			if dashboardToken == "" {
				next(w, r)
				return
			}

			auth := r.Header.Get("Authorization")
			token := strings.TrimPrefix(auth, "Bearer ")
			token = strings.TrimSpace(token)

			if token == "" {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"Token de autenticação necessário"}`))
				return
			}

			if token != dashboardToken {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"Token inválido"}`))
				return
			}

			next(w, r)
		}
	}
}
