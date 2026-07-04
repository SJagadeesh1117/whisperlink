package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"whisperlink-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

func generateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

type CreateRoomRequest struct {
	SessionID string `json:"session_id" binding:"required"`
}

type JoinRoomRequest struct {
	RoomID    string `json:"room_id" binding:"required"`
	JoinToken string `json:"join_token" binding:"required"`
	SessionID string `json:"session_id" binding:"required"`
}

func CreateRoom(redisMgr *storage.RedisManager, roomTTLSecs int) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateRoomRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		roomID, err := generateSecureToken(16) // 32 hex chars
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate room ID"})
			return
		}

		joinToken, err := generateSecureToken(16)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate join token"})
			return
		}

		ctx := context.Background()
		rClient := redisMgr.GetClient()
		ttl := time.Duration(roomTTLSecs) * time.Second

		pipe := rClient.Pipeline()
		pipe.HSet(ctx, "room:"+roomID+":meta", "created_at", time.Now().Unix(), "status", "waiting")
		pipe.Set(ctx, "room:"+roomID+":token", joinToken, ttl)
		pipe.SAdd(ctx, "room:"+roomID+":sessions", req.SessionID)
		
		// Set TTLs
		pipe.Expire(ctx, "room:"+roomID+":meta", ttl)
		pipe.Expire(ctx, "room:"+roomID+":sessions", ttl)
		
		if _, err := pipe.Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save room"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"room_id":    roomID,
			"join_token": joinToken,
		})
	}
}

func JoinRoom(redisMgr *storage.RedisManager, roomTTLSecs int) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req JoinRoomRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		ctx := context.Background()
		rClient := redisMgr.GetClient()

		// Check token
		tokenKey := "room:" + req.RoomID + ":token"
		storedToken, err := rClient.Get(ctx, tokenKey).Result()
		if err != nil || storedToken != req.JoinToken {
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid or expired invite link"})
			return
		}

		// Ensure room isn't full
		sessionsKey := "room:" + req.RoomID + ":sessions"
		count, err := rClient.SCard(ctx, sessionsKey).Result()
		if err != nil || count >= 2 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Room is full or unavailable"})
			return
		}

		// Token is valid and room has space. Add session and invalidate token.
		pipe := rClient.Pipeline()
		pipe.SAdd(ctx, sessionsKey, req.SessionID)
		pipe.Del(ctx, tokenKey) // Invalidate invite link
		
		// Extend TTLs since room is now active
		ttl := time.Duration(roomTTLSecs) * time.Second
		pipe.Expire(ctx, "room:"+req.RoomID+":meta", ttl)
		pipe.Expire(ctx, sessionsKey, ttl)
		pipe.Expire(ctx, "room:"+req.RoomID+":messages", ttl)
		
		if _, err := pipe.Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join room"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success"})
	}
}
