import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { MessageBubble } from '../components/MessageBubble';
import { encryptFile, importAESKey } from '../lib/crypto';
import axios from 'axios';
import clsx from 'clsx';
import { Shield, Send, PowerOff, ChevronDown, Paperclip, X } from 'lucide-react';

export default function Chat() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isTabActive = useRef(true);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCancelToken, setUploadCancelToken] = useState<AbortController | null>(null);

  const { sessionId, messages, onlineCount, isTyping, connectionState, sessionKeyBase64 } = useStore();
  const { sendMessage, sendTyping, deleteChat, isKeyReady } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll logic
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledUp(false);
    setUnreadCount(0);
  };

  useEffect(() => {
    if (!isScrolledUp) {
      scrollToBottom();
    } else {
      setUnreadCount(prev => prev + 1);
    }
    
    if (!isTabActive.current) {
      document.title = `(${unreadCount + 1}) New Message - WhisperLink`;
    }
  }, [messages.length]);

  // Scroll detection
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsScrolledUp(!isAtBottom);
    if (isAtBottom) {
      setUnreadCount(0);
    }
  };

  // Tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabActive.current = !document.hidden;
      if (isTabActive.current) {
        document.title = 'WhisperLink';
        setUnreadCount(0);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Notification Permission Request
  useEffect(() => {
    if (isKeyReady && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [isKeyReady]);

  // Handle kick if room deleted or not joined properly
  useEffect(() => {
    if (!sessionId) navigate('/');
  }, [sessionId, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 25 * 1024 * 1024) {
      alert("File exceeds maximum size of 25MB.");
      return;
    }

    if (!sessionKeyBase64) {
      alert("Cannot upload file: Encryption key not established yet.");
      return;
    }

    setUploadFile(file);
    setUploadProgress(0);
    const controller = new AbortController();
    setUploadCancelToken(controller);

    try {
      const cryptoKey = await importAESKey(sessionKeyBase64);
      const fileBuffer = await file.arrayBuffer();
      const { iv, ciphertext } = await encryptFile(cryptoKey, fileBuffer);

      const blob = new Blob([ciphertext]);
      const formData = new FormData();
      formData.append('file', blob);
      formData.append('session_id', sessionId!);

      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await axios.post(
        `${API_URL}/api/room/${roomId}/attachments`,
        formData,
        {
          signal: controller.signal,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            }
          }
        }
      );

      const attachmentId = response.data.attachment_id;

      const attachmentMeta = {
        id: attachmentId,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        iv: iv
      };

      await sendMessage("", attachmentMeta);
      
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Upload cancelled");
      } else {
        console.error("Upload failed", error);
        alert("Upload failed. Please try again.");
      }
    } finally {
      setUploadFile(null);
      setUploadCancelToken(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const lastTypingTime = useRef(0);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    } else {
      const now = Date.now();
      if (now - lastTypingTime.current > 1000) {
        sendTyping();
        lastTypingTime.current = now;
      }
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const typingNicknames = Object.entries(isTyping)
    .filter(([_, typing]) => typing)
    .map(([nick]) => nick);

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-950 relative overflow-hidden">
      <header className="bg-gray-900/90 backdrop-blur-xl border-b border-gray-800/60 px-4 md:px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 hidden sm:flex">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-gray-100 flex items-center gap-2">
              Secure Channel
            </h2>
            <div className="text-[10px] md:text-xs text-emerald-400/70 font-mono tracking-wider uppercase mt-0.5 hidden sm:block">
              {roomId?.substring(0,8)} • ECDH + AES-256-GCM
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 bg-gray-950/50 px-3 py-1.5 rounded-full border border-gray-800">
            <span className="flex h-2 w-2 relative">
              <span className={clsx("absolute inline-flex h-full w-full rounded-full opacity-75", {
                "animate-ping bg-emerald-400": connectionState === 'connected',
                "bg-yellow-400 animate-pulse": connectionState === 'connecting',
                "bg-red-400": connectionState === 'disconnected'
              })}></span>
              <span className={clsx("relative inline-flex rounded-full h-2 w-2", {
                "bg-emerald-500": connectionState === 'connected',
                "bg-yellow-500": connectionState === 'connecting',
                "bg-red-500": connectionState === 'disconnected'
              })}></span>
            </span>
            <span className="text-[10px] md:text-xs text-gray-300 font-medium whitespace-nowrap">
              {onlineCount} / 2 Online
            </span>
          </div>
          
          <button 
            onClick={deleteChat}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 px-3 md:px-4 py-2 rounded-lg transition-colors font-medium border border-red-900/30"
            title="Destroy Room Permanently"
          >
            <PowerOff className="w-4 h-4" />
            <span className="hidden sm:inline">Destroy</span>
          </button>
        </div>
      </header>

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 z-10 scroll-smooth relative"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in opacity-50">
            <Shield className="w-12 h-12 text-gray-600 mb-4" />
            <div className="bg-gray-900/50 border border-gray-800 text-sm text-gray-400 px-6 py-3 rounded-full">
              {isKeyReady ? "Waiting for the other participant to join..." : "Deriving cryptographic keys..."}
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => {
          if (msg.isSystem) {
            return (
              <div key={idx} className="flex justify-center py-2 animate-slide-up">
                <span className="bg-gray-900/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-gray-800 shadow-sm text-[11px] md:text-xs text-gray-400">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isMe = msg.sender_id === sessionId;
          
          return (
            <MessageBubble 
              key={idx}
              msg={msg}
              isMe={isMe}
              copiedId={copiedId}
              roomId={roomId!}
              onCopy={handleCopy}
            />
          );
        })}
        
        {typingNicknames.length > 0 && (
          <div className="flex justify-start animate-fade-in pl-2">
            <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl rounded-tl-sm px-4 py-3 flex flex-col gap-1 shadow-sm">
               <span className="text-[10px] text-gray-500 font-medium">{typingNicknames.join(', ')} is typing</span>
               <div className="flex gap-1.5 pt-0.5">
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce-subtle" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce-subtle" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce-subtle" style={{ animationDelay: '300ms' }}></span>
               </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Floating Unread Indicator */}
      {isScrolledUp && unreadCount > 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 animate-slide-up">
          <button 
            onClick={scrollToBottom}
            className="bg-gray-800 hover:bg-gray-700 text-gray-100 text-xs font-semibold px-4 py-2 rounded-full border border-gray-700 shadow-xl flex items-center gap-2 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {unreadCount} new message{unreadCount > 1 ? 's' : ''}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/80 p-3 md:p-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-20 pb-safe">
        {uploadFile && (
          <div className="max-w-4xl mx-auto mb-3 px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl flex items-center justify-between">
            <div className="flex-1 mr-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span className="truncate max-w-[200px]">Encrypting & Uploading: {uploadFile.name}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
            <button 
              onClick={() => { uploadCancelToken?.abort(); }}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex gap-2 items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!uploadFile || !isKeyReady}
            className="p-3.5 bg-gray-950 border border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-2xl transition-all disabled:opacity-50 shrink-0"
            title="Attach File (Max 25MB)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <div className="relative flex-1">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={connectionState !== 'connected' || !isKeyReady}
              placeholder={connectionState === 'connected' ? (isKeyReady ? "Type a secure message..." : "Waiting for key exchange...") : "Connecting..."}
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl pl-5 pr-14 py-4 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all shadow-inner disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={(!inputText.trim() && !uploadFile) || connectionState !== 'connected' || !isKeyReady}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 rounded-xl h-10 w-10 flex shrink-0 items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:hover:scale-100 disabled:bg-gray-800 disabled:text-gray-500"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
