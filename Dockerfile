# Build Stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install git for any necessary dependencies
RUN apk add --no-cache git

# Download Go modules from the backend directory
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy the backend source code
COPY backend/ ./

# Build an optimized, statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o whisperlink-backend ./cmd/server/main.go

# Production Stage
FROM alpine:latest

WORKDIR /app

# Add tzdata and ca-certificates
RUN apk --no-cache add ca-certificates tzdata

# Copy only the compiled binary from the builder stage
COPY --from=builder /app/whisperlink-backend .

# Expose the Go server port
EXPOSE 8080

CMD ["./whisperlink-backend"]
