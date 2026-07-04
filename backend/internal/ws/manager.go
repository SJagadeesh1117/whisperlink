package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"
	"whisperlink-backend/internal/storage"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

type Manager struct {
	rooms   sync.Map // string -> *Room
	redis   *storage.RedisManager
	roomTTL int
}

type Room struct {
	ID        string
	clients   map[string]*Client // session_id -> Client
	manager   *Manager
	mutex     sync.RWMutex
	cancel    context.CancelFunc
}

func NewManager(redisMgr *storage.RedisManager, ttlSecs int) *Manager {
	return &Manager{
		redis:   redisMgr,
		roomTTL: ttlSecs,
	}
}

func (r *Room) subscribeToRedis(ctx context.Context) {
	rClient := r.manager.redis.GetClient()
	pubsub := rClient.Subscribe(ctx, "room:"+r.ID+":pubsub")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			r.mutex.RLock()
			for _, client := range r.clients {
				select {
				case client.send <- []byte(msg.Payload):
				default:
					close(client.send)
					delete(r.clients, client.sessionID)
				}
			}
			r.mutex.RUnlock()
		}
	}
}

func (m *Manager) GetOrCreateRoom(roomID string) *Room {
	ctx, cancel := context.WithCancel(context.Background())
	newRoom := &Room{
		ID:      roomID,
		clients: make(map[string]*Client),
		manager: m,
		cancel:  cancel,
	}
	actual, loaded := m.rooms.LoadOrStore(roomID, newRoom)
	if !loaded {
		go actual.(*Room).subscribeToRedis(ctx)
	} else {
		cancel() // If already loaded, discard this context
	}
	return actual.(*Room)
}

func (m *Manager) RemoveRoom(roomID string) {
	m.rooms.Delete(roomID)
}

func (m *Manager) DeleteRoomCompletely(ctx context.Context, roomID string) {
	slog.Info("Deleting room completely", "room_id", roomID)
	
	// Delete from Redis
	rClient := m.redis.GetClient()
	pipe := rClient.Pipeline()
	pipe.Del(ctx, "room:"+roomID+":meta")
	pipe.Del(ctx, "room:"+roomID+":sessions")
	pipe.Del(ctx, "room:"+roomID+":messages")
	_, err := pipe.Exec(ctx)
	if err != nil {
		slog.Error("Failed to delete room from Redis", "error", err)
	}

	// Disconnect all clients in memory and remove room
	roomObj, exists := m.rooms.Load(roomID)

	if exists {
		room := roomObj.(*Room)
		room.mutex.Lock()
		
		outMsg, _ := json.Marshal(map[string]interface{}{
			"type": EventRoomDestroyed,
		})
		
		for _, client := range room.clients {
			// Write the destruction message safely through the channel
			// to avoid concurrent write panics with writePump.
			select {
			case client.send <- outMsg:
			default:
			}
			// Let writePump drain it and close safely. If we close the channel, writePump will execute conn.Close() cleanly.
			close(client.send)
		}
		// Clear clients map before unlocking
		room.clients = make(map[string]*Client)
		room.mutex.Unlock()
		
		room.cancel() // Stop pubsub
		m.RemoveRoom(roomID)
	}
}

// ExtendTTL updates the TTL of all room keys in Redis
func (m *Manager) ExtendTTL(ctx context.Context, roomID string) {
	rClient := m.redis.GetClient()
	ttl := m.roomTTL

	pipe := rClient.Pipeline()
	pipe.Expire(ctx, "room:"+roomID+":meta", redis.Duration(ttl)*1000*1000*1000)
	pipe.Expire(ctx, "room:"+roomID+":sessions", redis.Duration(ttl)*1000*1000*1000)
	pipe.Expire(ctx, "room:"+roomID+":messages", redis.Duration(ttl)*1000*1000*1000)
	_, _ = pipe.Exec(ctx) 
}
