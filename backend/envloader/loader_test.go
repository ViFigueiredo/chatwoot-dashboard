package envloader

import (
	"os"
	"testing"
)

func TestLoadSimpleEnv(t *testing.T) {
	// Create temp .env file
	tmpFile := t.TempDir() + "/.env"
	content := `# Comment
KEY1=value1
KEY2="quoted value"
KEY3='single quoted'
EMPTY=
`
	os.WriteFile(tmpFile, []byte(content), 0644)

	os.Unsetenv("KEY1")
	os.Unsetenv("KEY2")
	os.Unsetenv("KEY3")
	os.Unsetenv("EMPTY")

	err := Load(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if os.Getenv("KEY1") != "value1" {
		t.Errorf("expected KEY1='value1', got '%s'", os.Getenv("KEY1"))
	}
	if os.Getenv("KEY2") != "quoted value" {
		t.Errorf("expected KEY2='quoted value', got '%s'", os.Getenv("KEY2"))
	}
	if os.Getenv("KEY3") != "single quoted" {
		t.Errorf("expected KEY3='single quoted', got '%s'", os.Getenv("KEY3"))
	}
	if os.Getenv("EMPTY") != "" {
		t.Errorf("expected EMPTY='', got '%s'", os.Getenv("EMPTY"))
	}
}

func TestLoadSkipsComments(t *testing.T) {
	tmpFile := t.TempDir() + "/.env"
	content := `# This is a comment
KEY1=value1
# Another comment
KEY2=value2
`
	os.WriteFile(tmpFile, []byte(content), 0644)
	os.Unsetenv("KEY1")
	os.Unsetenv("KEY2")

	err := Load(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if os.Getenv("KEY1") != "value1" {
		t.Errorf("expected KEY1='value1', got '%s'", os.Getenv("KEY1"))
	}
	if os.Getenv("KEY2") != "value2" {
		t.Errorf("expected KEY2='value2', got '%s'", os.Getenv("KEY2"))
	}
}

func TestLoadDoesNotOverwrite(t *testing.T) {
	tmpFile := t.TempDir() + "/.env"
	content := `KEY1=new-value
`
	os.WriteFile(tmpFile, []byte(content), 0644)

	os.Setenv("KEY1", "existing-value")
	defer os.Unsetenv("KEY1")

	err := Load(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if os.Getenv("KEY1") != "existing-value" {
		t.Errorf("expected KEY1 to keep existing value, got '%s'", os.Getenv("KEY1"))
	}
}

func TestLoadSkipsEmptyLines(t *testing.T) {
	tmpFile := t.TempDir() + "/.env"
	content := `

KEY1=value1

KEY2=value2

`
	os.WriteFile(tmpFile, []byte(content), 0644)
	os.Unsetenv("KEY1")
	os.Unsetenv("KEY2")

	err := Load(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if os.Getenv("KEY1") != "value1" {
		t.Errorf("expected KEY1='value1', got '%s'", os.Getenv("KEY1"))
	}
}

func TestLoadHandlesMissingFile(t *testing.T) {
	err := Load("/nonexistent/.env")
	if err == nil {
		t.Error("expected error for missing file, got nil")
	}
}
