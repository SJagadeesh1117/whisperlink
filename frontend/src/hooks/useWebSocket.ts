import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { encryptMessage, decryptMessage, importAESKey, importPublicKey, importPrivateKey, deriveAESKeyWithHKDF, exportAESKey } from '../lib/crypto';

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  const sessionCryptoKey = useRef<CryptoKey | null>(null);
  const processedIVs = useRef<Set<string>>(new Set());
  const [isKeyReady, setIsKeyReady] = useState(false);
  
  const { 
    roomId, 
    sessionId, 
    nickname, 
    myPrivateKeyBase64,
    myPublicKeyBase64,
    sessionKeyBase64,
    setSessionKey,
    setPartnerPublicKey,
    setConnectionState,
    addMessage,
    setOnlineCount,
    setTyping
  } = useStore();

  const connect = async () => {
    if (!roomId || !sessionId || !nickname || !myPrivateKeyBase64) return;
    
    // If we already have the session key (e.g. User B who just joined), import it immediately
    if (sessionKeyBase64 && !sessionCryptoKey.current) {
      sessionCryptoKey.current = await importAESKey(sessionKeyBase64);
      setIsKeyReady(true);
    }

    const API_URL = import.meta.env.VITE_API_URL || '';
    
    let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = window.location.host;
    
    if (API_URL) {
      protocol = API_URL.startsWith('https') ? 'wss:' : 'ws:';
      host = API_URL.replace(/^https?:\/\//, '');
    }

    const wsUrl = `${protocol}//${host}/ws/rooms/${roomId}?session_id=${sessionId}&nickname=${encodeURIComponent(nickname)}`;

    ws.current = new WebSocket(wsUrl);
    setConnectionState('connecting');

    ws.current.onopen = () => {
      setConnectionState('connected');
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      
      // Always announce our public key so the other party can derive the session key if they haven't
      if (myPublicKeyBase64) {
        ws.current?.send(JSON.stringify({
          type: 'KEY_EXCHANGE',
          payload: { publicKey: myPublicKeyBase64, sender_id: sessionId }
        }));
      }
    };

    ws.current.onclose = (event) => {
      setConnectionState('disconnected');
      if (event.wasClean) return;
      reconnectTimeout.current = window.setTimeout(connect, 2000);
    };

    ws.current.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'ONLINE':
            setOnlineCount(msg.payload.count);
            break;
          case 'JOIN':
            addMessage({
              id: crypto.randomUUID(),
              sender_id: 'system',
              nickname: 'System',
              content: `${msg.payload.nickname} joined the chat`,
              timestamp: new Date().toISOString(),
              isSystem: true
            });
            break;
          case 'LEAVE':
            addMessage({
              id: crypto.randomUUID(),
              sender_id: 'system',
              nickname: 'System',
              content: `${msg.payload.nickname} left the chat`,
              timestamp: new Date().toISOString(),
              isSystem: true
            });
            break;
          case 'KEY_EXCHANGE': {
            // Ignore our own key exchange broadcast!
            if (msg.payload.sender_id === sessionId) {
              break;
            }
            
            // We received the other party's public key!
            // If we don't have a session key yet, derive it now.
            if (!sessionCryptoKey.current) {
              const partnerPubKeyBase64 = msg.payload.publicKey;
              setPartnerPublicKey(partnerPubKeyBase64);
              
              const myPrivKey = await importPrivateKey(myPrivateKeyBase64);
              const partnerPubKey = await importPublicKey(partnerPubKeyBase64);
              
              const derivedSessionKey = await deriveAESKeyWithHKDF(myPrivKey, partnerPubKey);
              sessionCryptoKey.current = derivedSessionKey;
              
              const derivedSessionKeyBase64 = await exportAESKey(derivedSessionKey);
              setSessionKey(derivedSessionKeyBase64);
              setIsKeyReady(true);
              
              addMessage({
                id: crypto.randomUUID(),
                sender_id: 'system',
                nickname: 'System',
                content: `Secure end-to-end encrypted channel established via ECDH.`,
                timestamp: new Date().toISOString(),
                isSystem: true
              });
            }
            
            // If the sender wasn't an echo, bounce our key back to them to ensure they have it.
            // This fixes race conditions where a client misses the initial broadcast.
            if (!msg.payload.is_echo && myPublicKeyBase64) {
              ws.current?.send(JSON.stringify({
                type: 'KEY_EXCHANGE',
                payload: { publicKey: myPublicKeyBase64, sender_id: sessionId, is_echo: true }
              }));
            }
            break;
          }
          case 'ROOM_DESTROYED':
            alert("The secure room has been permanently destroyed.");
            useStore.getState().clearState();
            if (ws.current) ws.current.close(1000, "Room Destroyed");
            break;
            
          case 'TYPING':
            if (msg.payload.nickname === nickname) break;
            setTyping(msg.payload.nickname, true);
            setTimeout(() => setTyping(msg.payload.nickname, false), 3000);
            break;
          case 'PONG':
            break;
          case 'MESSAGE': {
            if (!sessionCryptoKey.current) {
               console.warn("Received message but session key is not derived yet!");
               return;
            }
            const { iv, encrypted_content } = msg.payload.data;
            
            // Mitigate Replay Attacks: drop if IV was already processed
            if (processedIVs.current.has(iv)) {
              console.warn("Security Alert: Replay attack detected. Dropping duplicate IV.");
              return;
            }
            processedIVs.current.add(iv);

            let parsedPayload: any = { text: "[Failed to decrypt]" };
            try {
              const decrypted = await decryptMessage(sessionCryptoKey.current, iv, encrypted_content);
              try {
                  parsedPayload = JSON.parse(decrypted);
              } catch (e) {
                  // Fallback for older messages
                  parsedPayload = { text: decrypted };
              }
            } catch (e) {
              console.error("Decryption failed", e);
            }
            
            addMessage({
              id: crypto.randomUUID(),
              sender_id: msg.payload.sender_id,
              nickname: msg.payload.nickname,
              content: parsedPayload.text || "",
              attachment: parsedPayload.attachment,
              timestamp: msg.payload.timestamp
            });

            // Trigger Push Notification if tab is hidden
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              // Ensure we don't notify for our own messages (though document.hidden usually implies we aren't sending)
              if (msg.payload.sender_id !== sessionId) {
                const notification = new Notification("New message", {
                  icon: "/icon-192x192.png",
                });
                notification.onclick = function() {
                  window.focus();
                  this.close();
                };
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error("Failed to parse or decrypt message", err);
      }
    };
  };

  useEffect(() => {
    connect();
    
    const pingInterval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        ws.current.close(1000, "Clean unmount");
      }
    };
  }, [roomId, sessionId, myPrivateKeyBase64]);

  const sendMessage = async (text: string, attachment?: any) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !sessionCryptoKey.current) return;
    
    const innerPayload = JSON.stringify({ text, attachment });
    const { iv, ciphertext } = await encryptMessage(sessionCryptoKey.current, innerPayload);
    ws.current.send(JSON.stringify({
      type: 'MESSAGE',
      payload: { iv, encrypted_content: ciphertext }
    }));
  };

  const sendTyping = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: 'TYPING' }));
  };

  const deleteChat = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: 'DELETE_CHAT' }));
  };

  return { sendMessage, sendTyping, deleteChat, isKeyReady };
}
