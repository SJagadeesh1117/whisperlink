package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"whisperlink-backend/internal/api"
	"whisperlink-backend/internal/config"
	"whisperlink-backend/internal/logger"
	"whisperlink-backend/internal/storage"
	"whisperlink-backend/internal/ws"
)

func main() {
	cfg := config.LoadConfig()
	logger.InitLogger(cfg.Env)

	slog.Info("Starting WhisperLink Backend...", "env", cfg.Env, "port", cfg.Port)

	// Initialize Redis
	redisMgr, err := storage.NewRedisManager(cfg.RedisURL)
	if err != nil {
		slog.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	defer redisMgr.Close()
	slog.Info("Connected to Redis successfully")

	// Initialize WebSocket Manager
	wsManager := ws.NewManager(redisMgr, cfg.RoomTTLSecs)

	// Setup Router
	router := api.SetupRouter(redisMgr, wsManager, cfg.RoomTTLSecs)

	// Setup HTTP Server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	// Run server in a goroutine so it doesn't block
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Listen and Serve error", "error", err)
			os.Exit(1)
		}
	}()

	slog.Info("Server is listening", "port", cfg.Port)

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Server exiting")
}
