package api

import (
	"whisperlink-backend/internal/storage"
	"whisperlink-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

func SetupRouter(redisMgr *storage.RedisManager, wsManager *ws.Manager, roomTTLSecs int) *gin.Engine {
	r := gin.New()
	
	SetupMiddleware(r)

	// API Routes
	api := r.Group("/api")
	{
		api.GET("/health", HealthCheck)
		api.POST("/room/create", CreateRoom(redisMgr, roomTTLSecs))
		api.POST("/room/join", JoinRoom(redisMgr, roomTTLSecs))
		api.POST("/room/:roomId/attachments", UploadAttachment(redisMgr))
		api.GET("/room/:roomId/attachments/:attachmentId", DownloadAttachment(redisMgr))
	}

	// WebSocket Routes
	r.GET("/ws/rooms/:roomId", func(c *gin.Context) {
		ws.HandleConnections(wsManager, redisMgr, c)
	})

	return r
}
