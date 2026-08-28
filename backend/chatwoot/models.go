package chatwoot

// Agent represents a Chatwoot agent/user.
type Agent struct {
	ID                 int    `json:"id"`
	Name               string `json:"name"`
	Email              string `json:"email"`
	Role               string `json:"role"`
	AvailabilityStatus string `json:"availability_status"`
}

// Label represents a Chatwoot label.
type Label struct {
	Title string `json:"title"`
	Color string `json:"color"`
}

// Conversation represents a Chatwoot conversation.
type Conversation struct {
	ID               int              `json:"id"`
	Status           string           `json:"status"`
	Labels           []string         `json:"labels"`
	LastActivityAt   int64            `json:"last_activity_at"`
	Meta             ConversationMeta `json:"meta"`
}

// ConversationMeta holds conversation metadata including assignee info.
type ConversationMeta struct {
	Assignee *AgentRef  `json:"assignee"`
	Sender   *ContactRef `json:"sender"`
}

// AgentRef is a lightweight agent reference in conversation meta.
type AgentRef struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// ContactRef is a contact reference in conversation meta.
type ContactRef struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	PhoneNumber string `json:"phone_number"`
}

// Message represents a Chatwoot message.
type Message struct {
	ID          int         `json:"id"`
	MessageType int         `json:"message_type"` // 0=incoming, 1=outgoing
	Private     bool        `json:"private"`
	CreatedAt   int64       `json:"created_at"`
	Sender      *MessageSender `json:"sender"`
}

// MessageSender is the sender of a message.
type MessageSender struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"` // "user", "contact", etc.
}

// AgentReport is the aggregated report for a single agent.
type AgentReport struct {
	ID           int              `json:"id"`
	Name         string           `json:"name"`
	Email        string           `json:"email"`
	Role         string           `json:"role"`
	Availability string           `json:"availability"`
	Total        int              `json:"total"`
	Open         int              `json:"open"`
	Resolved     int              `json:"resolved"`
	Pending      int              `json:"pending"`
	Snoozed      int              `json:"snoozed"`
	Labels       map[string]int   `json:"labels"`
}

// Report is the final aggregated report returned by the API.
type Report struct {
	GeneratedAt          string        `json:"generatedAt"`
	TotalConversations   int           `json:"totalConversations"`
	ExpectedConversations int          `json:"expectedConversations"`
	FailedPages          []int         `json:"failedPages"`
	Labels               []LabelInfo   `json:"labels"`
	Agents               []AgentReport `json:"agents"`
}

// LabelInfo is a label with its color for the frontend.
type LabelInfo struct {
	Title string `json:"title"`
	Color string `json:"color"`
}
