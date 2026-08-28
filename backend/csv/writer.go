package csv

import (
	"fmt"
	"io"
	"strings"
)

// BOM is the UTF-8 BOM for Excel compatibility.
var BOM = "\uFEFF"

// Write writes a CSV with the given header and rows to the writer.
// Uses semicolon separator (Brazilian Excel default).
func Write(w io.Writer, header []string, rows [][]string) {
	// BOM
	fmt.Fprint(w, BOM)

	// Header
	fmt.Fprint(w, joinCSVRow(header))

	// Rows
	for _, row := range rows {
		fmt.Fprint(w, joinCSVRow(row))
	}
}

// joinCSVRow joins a row with semicolons and proper escaping.
func joinCSVRow(fields []string) string {
	parts := make([]string, len(fields))
	for i, field := range fields {
		parts[i] = escapeCSV(field)
	}
	return strings.Join(parts, ";") + "\r\n"
}

// escapeCSV escapes a CSV field if it contains special characters.
func escapeCSV(s string) string {
	if strings.ContainsAny(s, "\";\n\r") {
		escaped := strings.ReplaceAll(s, "\"", "\"\"")
		return "\"" + escaped + "\""
	}
	return s
}

// Field converts a value to a string for CSV output.
func Field(v interface{}) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}
