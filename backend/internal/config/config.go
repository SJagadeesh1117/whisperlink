package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	RedisURL     string
	Env          string
	RoomTTLSecs  int
}

func LoadConfig() *Config {
	_ = godotenv.Load() // Ignore error if .env doesn't exist

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	roomTTLStr := os.Getenv("ROOM_TTL_SECS")
	roomTTL := 3600 // Default 1 hour
	if roomTTLStr != "" {
		if parsed, err := strconv.Atoi(roomTTLStr); err == nil {
			roomTTL = parsed
		} else {
			log.Printf("Invalid ROOM_TTL_SECS %s, using default 3600", roomTTLStr)
		}
	}

	return &Config{
		Port:         port,
		RedisURL:     redisURL,
		Env:          env,
		RoomTTLSecs:  roomTTL,
	}
}
