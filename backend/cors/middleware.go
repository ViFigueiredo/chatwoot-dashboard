package cors

import (
	"github.com/rs/cors"
)

// New returns a CORS middleware configured for the Chatwoot Dashboard.
// Allows the Vercel frontend and Chatwoot iframe embedding.
func New(allowedOrigins []string) *cors.Cors {
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"*"}
	}

	return cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "Accept"},
		ExposedHeaders:   []string{"Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}
