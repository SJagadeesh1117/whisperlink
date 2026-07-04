import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AttachmentMetadata {
  id: string;
  name: string;
  mime: string;
  size: number;
  iv: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  nickname: string;
  content: string;
  timestamp: string;
  isSystem?: boolean;
  attachment?: AttachmentMetadata;
}

interface WhisperState {
  roomId: string | null;
  sessionId: string | null;
  nickname: string | null;
  
  // Cryptographic Keys (Base64 encoded for persistence)
  myPrivateKeyBase64: string | null;
  myPublicKeyBase64: string | null;
  partnerPublicKeyBase64: string | null;
  sessionKeyBase64: string | null; // The final AES-GCM key derived via HKDF
  
  messages: ChatMessage[];
  onlineCount: number;
  isTyping: Record<string, boolean>;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  setRoomState: (roomId: string, sessionId: string, nickname: string) => void;
  setMyKeys: (privateKey: string, publicKey: string) => void;
  setPartnerPublicKey: (publicKey: string) => void;
  setSessionKey: (sessionKey: string) => void;
  clearState: () => void;
  
  addMessage: (msg: ChatMessage) => void;
  setOnlineCount: (count: number) => void;
  setTyping: (nickname: string, typing: boolean) => void;
  setConnectionState: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export const useStore = create<WhisperState>()(
  persist(
    (set) => ({
      roomId: null,
      sessionId: null,
      nickname: null,
      myPrivateKeyBase64: null,
      myPublicKeyBase64: null,
      partnerPublicKeyBase64: null,
      sessionKeyBase64: null,
      
      messages: [],
      onlineCount: 0,
      isTyping: {},
      connectionState: 'disconnected',
      
      setRoomState: (roomId, sessionId, nickname) => set({
        roomId,
        sessionId,
        nickname
      }),
      
      setMyKeys: (privateKey, publicKey) => set({
        myPrivateKeyBase64: privateKey,
        myPublicKeyBase64: publicKey
      }),
      
      setPartnerPublicKey: (publicKey) => set({ partnerPublicKeyBase64: publicKey }),
      
      setSessionKey: (sessionKey) => set({ sessionKeyBase64: sessionKey }),
      
      clearState: () => set({
        roomId: null,
        sessionId: null,
        nickname: null,
        myPrivateKeyBase64: null,
        myPublicKeyBase64: null,
        partnerPublicKeyBase64: null,
        sessionKeyBase64: null,
        messages: [],
        onlineCount: 0,
        isTyping: {},
        connectionState: 'disconnected'
      }),
      
      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
      setOnlineCount: (count) => set({ onlineCount: count }),
      setTyping: (nickname, typing) => set((state) => ({
        isTyping: { ...state.isTyping, [nickname]: typing }
      })),
      setConnectionState: (connectionState) => set({ connectionState })
    }),
    {
      name: 'whisperlink-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        roomId: state.roomId,
        sessionId: state.sessionId,
        nickname: state.nickname,
        myPrivateKeyBase64: state.myPrivateKeyBase64,
        myPublicKeyBase64: state.myPublicKeyBase64,
        partnerPublicKeyBase64: state.partnerPublicKeyBase64,
        sessionKeyBase64: state.sessionKeyBase64,
      }),
    }
  )
);
