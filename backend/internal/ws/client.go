package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
	"whisperlink-backend/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		// Prevent Cross-Site WebSocket Hijacking (CSWSH)
		if origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173" {
			return true
		}
		return false
	},
}

type Client struct {
	sessionID string
	nickname  string
	room      *Room
	conn      *websocket.Conn
	send      chan []byte
}

func HandleConnections(manager *Manager, redisMgr *storage.RedisManager, c *gin.Context) {
	roomID := c.Param("roomId")
	sessionID := c.Query("session_id")
	nickname := c.Query("nickname")

	if roomID == "" || sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "roomId and session_id are required"})
		return
	}

	ctx := context.Background()
	rClient := redisMgr.GetClient()

	sessionsKey := "room:" + roomID + ":sessions"
	
	isMember, err := rClient.SIsMember(ctx, sessionsKey, sessionID).Result()
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized session"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("Failed to upgrade connection", "error", err)
		return
	}

	room := manager.GetOrCreateRoom(roomID)

	client := &Client{
		sessionID: sessionID,
		nickname:  nickname,
		room:      room,
		conn:      ws,
		send:      make(chan []byte, 256),
	}

	// Register client locally
	room.mutex.Lock()
	room.clients[sessionID] = client
	room.mutex.Unlock()

	manager.ExtendTTL(ctx, roomID)

	// Global online tracking
	rClient.SAdd(ctx, "room:"+roomID+":online", sessionID)
	rClient.Expire(ctx, "room:"+roomID+":online", time.Duration(manager.roomTTL)*time.Second)
	onlineCount, _ := rClient.SCard(ctx, "room:"+roomID+":online").Result()

	// Broadcast JOIN and ONLINE via Pub/Sub
	joinMsg, _ := json.Marshal(WsMessage{Type: EventJoin, Payload: map[string]string{"nickname": nickname}})
	rClient.Publish(ctx, "room:"+roomID+":pubsub", string(joinMsg))
	
	onlineMsg, _ := json.Marshal(WsMessage{Type: EventOnline, Payload: map[string]int{"count": int(onlineCount)}})
	rClient.Publish(ctx, "room:"+roomID+":pubsub", string(onlineMsg))

	// Send chat history
	history, _ := rClient.LRange(ctx, "room:"+roomID+":messages", 0, -1).Result()
	for _, msg := range history {
		client.send <- []byte(msg)
	}

	// Start pump routines
	go client.writePump()
	go client.readPump(manager)
}

func (c *Client) readPump(manager *Manager) {
	defer func() {
		ctx := context.Background()
		rClient := manager.redis.GetClient()
		
		c.room.mutex.Lock()
		delete(c.room.clients, c.sessionID)
		localCount := len(c.room.clients)
		c.room.mutex.Unlock()

		// Global online tracking
		rClient.SRem(ctx, "room:"+c.room.ID+":online", c.sessionID)
		onlineCount, _ := rClient.SCard(ctx, "room:"+c.room.ID+":online").Result()

		leaveMsg, _ := json.Marshal(WsMessage{Type: EventLeave, Payload: map[string]string{"nickname": c.nickname}})
		rClient.Publish(ctx, "room:"+c.room.ID+":pubsub", string(leaveMsg))
		
		onlineMsg, _ := json.Marshal(WsMessage{Type: EventOnline, Payload: map[string]int{"count": int(onlineCount)}})
		rClient.Publish(ctx, "room:"+c.room.ID+":pubsub", string(onlineMsg))

		if localCount == 0 {
			c.room.cancel()
			manager.RemoveRoom(c.room.ID)
		}

		c.conn.Close()
	}()

	c.conn.SetReadLimit(1024 * 64) // 64KB max message size

	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Error("Unexpected close error", "error", err)
			}
			break
		}

		var incoming WsMessage
		if err := json.Unmarshal(msg, &incoming); err != nil {
			continue
		}

		ctx := context.Background()
		manager.ExtendTTL(ctx, c.room.ID)

		switch incoming.Type {
		case EventPing:
			pongMsg, _ := json.Marshal(WsMessage{Type: EventPong})
			c.send <- pongMsg
			
		case EventMessage:
			outMsg, _ := json.Marshal(WsMessage{
				Type: EventMessage,
				Payload: map[string]interface{}{
					"sender_id": c.sessionID,
					"nickname":  c.nickname,
					"data":      incoming.Payload,
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				},
			})
			rClient := manager.redis.GetClient()
			rClient.Publish(ctx, "room:"+c.room.ID+":pubsub", string(outMsg))
			
			pipe := rClient.Pipeline()
			pipe.RPush(ctx, "room:"+c.room.ID+":messages", string(outMsg))
			pipe.LTrim(ctx, "room:"+c.room.ID+":messages", -200, -1) // Cap at 200 messages
			_, _ = pipe.Exec(ctx)

		case EventTyping:
			outMsg, _ := json.Marshal(WsMessage{
				Type: EventTyping,
				Payload: map[string]string{"nickname": c.nickname},
			})
			rClient := manager.redis.GetClient()
			rClient.Publish(ctx, "room:"+c.room.ID+":pubsub", string(outMsg))
			
		case EventKeyExchange:
			// Simply broadcast the public key to the other client
			outMsg, _ := json.Marshal(WsMessage{
				Type: EventKeyExchange,
				Payload: incoming.Payload,
			})
			rClient := manager.redis.GetClient()
			rClient.Publish(ctx, "room:"+c.room.ID+":pubsub", string(outMsg))

		case EventDeleteChat:
			manager.DeleteRoomCompletely(ctx, c.room.ID)
			return
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(50 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// broadcastToRoom and broadcastToOtherClients removed as Pub/Sub is now used
