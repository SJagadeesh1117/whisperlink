package ws

const (
	EventJoin       = "JOIN"
	EventMessage    = "MESSAGE"
	EventLeave      = "LEAVE"
	EventOnline     = "ONLINE"
	EventTyping     = "TYPING"
	EventDeleteChat  = "DELETE_CHAT"
	EventPing        = "PING"
	EventPong        = "PONG"
	EventKeyExchange = "KEY_EXCHANGE"
	EventRoomDestroyed = "ROOM_DESTROYED"
)

type WsMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}
