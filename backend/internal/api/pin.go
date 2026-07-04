package api

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"math/big"
	"net/http"
	"time"

	"whisperlink-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

type PinCreateRequest struct {
	RoomID    string `json:"room_id" binding:"required"`
	JoinToken string `json:"join_token" binding:"required"`
	PubKey    string `json:"pubkey" binding:"required"`
}

type PinData struct {
	RoomID    string `json:"room_id"`
	JoinToken string `json:"join_token"`
	PubKey    string `json:"pubkey"`
}

// Generate a random 6-digit string
func generate6DigitPin() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	// Add 100000 to ensure it's always 6 digits
	n.Add(n, big.NewInt(100000))
	return n.String(), nil
}

func CreatePin(redisMgr *storage.RedisManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req PinCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		ctx := context.Background()
		rClient := redisMgr.GetClient()

		var pin string
		var err error
		maxRetries := 10

		for i := 0; i < maxRetries; i++ {
			pin, err = generate6DigitPin()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate pin"})
				return
			}

			exists, err := rClient.Exists(ctx, "pin:"+pin).Result()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Redis error"})
				return
			}

			if exists == 0 {
				break
			}
			
			if i == maxRetries-1 {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "System too busy, cannot generate pin"})
				return
			}
		}

		data := PinData{
			RoomID:    req.RoomID,
			JoinToken: req.JoinToken,
			PubKey:    req.PubKey,
		}

		jsonData, _ := json.Marshal(data)

		err = rClient.Set(ctx, "pin:"+pin, jsonData, time.Hour).Err()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save pin"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"pin": pin})
	}
}

func GetPin(redisMgr *storage.RedisManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		pin := c.Param("pin")
		if len(pin) != 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid pin format"})
			return
		}

		ctx := context.Background()
		rClient := redisMgr.GetClient()

		jsonData, err := rClient.Get(ctx, "pin:"+pin).Result()
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pin not found or expired"})
			return
		}

		rClient.Del(ctx, "pin:"+pin)

		var data PinData
		json.Unmarshal([]byte(jsonData), &data)

		c.JSON(http.StatusOK, data)
	}
}
