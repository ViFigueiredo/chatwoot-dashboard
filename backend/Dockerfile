# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .

# API binary
FROM builder AS api-build
RUN CGO_ENABLED=0 go build -o /api ./cmd/api

# Worker binary
FROM builder AS worker-build
RUN CGO_ENABLED=0 go build -o /worker ./cmd/worker

# API runtime
FROM alpine:3.19 AS api
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=api-build /api .
EXPOSE 8080
CMD ["./api"]

# Worker runtime
FROM alpine:3.19 AS worker
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=worker-build /worker .
CMD ["./worker"]
