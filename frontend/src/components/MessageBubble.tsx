import { memo } from 'react';
import { Check, Copy } from 'lucide-react';
import clsx from 'clsx';
import { AttachmentBubble } from './AttachmentBubble';

export interface MessageProps {
  id: string;
  sender_id: string;
  nickname: string;
  content: string;
  attachment?: {
    id: string;
    name: string;
    mime: string;
    size: number;
    iv: string;
  };
  timestamp: string;
}

interface MessageBubbleProps {
  msg: MessageProps;
  isMe: boolean;
  copiedId: string | null;
  roomId: string;
  onCopy: (id: string, content: string) => void;
}

export const MessageBubble = memo(({ msg, isMe, copiedId, roomId, onCopy }: MessageBubbleProps) => {
  return (
    <div className={clsx("flex group animate-slide-up", isMe ? "justify-end" : "justify-start")}>
      <div className="max-w-[85%] md:max-w-[70%] flex flex-col" style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        <span className="text-[11px] text-gray-500 mb-1 px-2 font-medium">{isMe ? 'You' : msg.nickname}</span>
        
        <div className="flex items-center gap-2">
          {!isMe && (
            <button 
              onClick={() => onCopy(msg.id, msg.content)}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-gray-300 bg-gray-800 rounded-md transition-all shrink-0"
            >
              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          
          <div className="flex flex-col gap-2">
            {msg.content && (
              <div className={clsx(
                "px-4 md:px-5 py-2.5 md:py-3 shadow-sm break-words text-sm leading-relaxed",
                isMe 
                  ? "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-2xl rounded-tr-sm shadow-[0_4px_15px_rgba(16,185,129,0.15)]" 
                  : "bg-gray-800 text-gray-100 border border-gray-700/50 rounded-2xl rounded-tl-sm shadow-[0_4px_15px_rgba(0,0,0,0.2)]"
              )}>
                {msg.content}
              </div>
            )}
            {msg.attachment && (
              <AttachmentBubble attachment={msg.attachment} roomId={roomId!} />
            )}
          </div>
          
          {isMe && (
            <button 
              onClick={() => onCopy(msg.id, msg.content)}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-gray-300 bg-gray-800 rounded-md transition-all shrink-0"
            >
              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        
        <span className="text-[10px] text-gray-600 mt-1 px-2 font-medium">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';
