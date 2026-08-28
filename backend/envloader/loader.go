package envloader

import (
	"bufio"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// Load reads a .env file and sets environment variables.
// It does NOT overwrite existing env vars.
func Load(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err // file not found is OK, we just skip
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Find the first =
		idx := strings.Index(line, "=")
		if idx == -1 {
			continue
		}

		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])

		// Remove surrounding quotes
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') ||
				(value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}

		// Only set if not already set (env vars take precedence)
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}

	return scanner.Err()
}

// LoadFromProjectRoot tries to find and load .env files from the project root.
// Searches: current dir, parent dir, and two levels up.
func LoadFromProjectRoot() {
	dirs := []string{".", "..", "../.."}
	files := []string{".env.local", ".env"}

	loaded := false
	for _, dir := range dirs {
		if loaded {
			break
		}
		for _, file := range files {
			path := filepath.Join(dir, file)
			if _, err := os.Stat(path); err == nil {
				if err := Load(path); err == nil {
					log.Printf("📄 Carregado: %s", path)
					loaded = true
					break
				}
			}
		}
	}

	if !loaded {
		log.Println("⚠️  Nenhum arquivo .env ou .env.local encontrado")
	}
}
