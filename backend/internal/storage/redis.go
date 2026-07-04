package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisManager struct {
	client *redis.Client
}

func NewRedisManager(redisURL string) (*RedisManager, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	// Ping to verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}

	return &RedisManager{client: client}, nil
}

func (rm *RedisManager) Close() error {
	return rm.client.Close()
}

func (rm *RedisManager) GetClient() *redis.Client {
	return rm.client
}
