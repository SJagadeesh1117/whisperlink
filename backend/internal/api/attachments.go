package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"time"

	"whisperlink-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

const maxFileSize = 25 * 1024 * 1024 // 25 MB

func generateAttachmentID(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func authorizeSession(redisMgr *storage.RedisManager, roomID, sessionID string) bool {
	ctx := context.Background()
	rClient := redisMgr.GetClient()
	isMember, err := rClient.SIsMember(ctx, "room:"+roomID+":sessions", sessionID).Result()
	return err == nil && isMember
}

func UploadAttachment(redisMgr *storage.RedisManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("roomId")
		sessionID := c.PostForm("session_id")

		if !authorizeSession(redisMgr, roomID, sessionID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized session"})
			return
		}

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFileSize+1024)

		fileHeader, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File upload failed or file too large"})
			return
		}
		
		if fileHeader.Size > maxFileSize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "File exceeds 25MB limit"})
			return
		}

		attachmentID, err := generateAttachmentID(16)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate ID"})
			return
		}

		fileData, err := fileHeader.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
			return
		}
		defer fileData.Close()

		fileBytes, err := io.ReadAll(fileData)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read uploaded file"})
			return
		}

		ctx := context.Background()
		rClient := redisMgr.GetClient()
		// Store encrypted file blob directly in Redis RAM (TTL 1 hour)
		err = rClient.Set(ctx, "room:"+roomID+":attachment:"+attachmentID, fileBytes, 1*time.Hour).Err()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file to Redis"})
			return
		}
		
		// Track this attachment in the room's set so it can be destroyed if the chat is destroyed
		rClient.SAdd(ctx, "room:"+roomID+":attachments", attachmentID)
		rClient.Expire(ctx, "room:"+roomID+":attachments", 1*time.Hour)
		
		// Extend TTL when user interacts
		rClient.Expire(ctx, "room:"+roomID+":meta", 1*time.Hour)

		c.JSON(http.StatusOK, gin.H{"attachment_id": attachmentID})
	}
}

func DownloadAttachment(redisMgr *storage.RedisManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("roomId")
		attachmentID := c.Param("attachmentId")
		sessionID := c.Query("session_id")

		if !authorizeSession(redisMgr, roomID, sessionID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized session"})
			return
		}

		ctx := context.Background()
		rClient := redisMgr.GetClient()
		
		// Retrieve encrypted blob directly from Redis RAM
		fileBytes, err := rClient.Get(ctx, "room:"+roomID+":attachment:"+attachmentID).Bytes()
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Attachment not found or expired"})
			return
		}

		c.Header("Content-Type", "application/octet-stream")
		c.Writer.Write(fileBytes)
	}
}
