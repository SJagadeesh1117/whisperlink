import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { generateECDHKeyPair, exportPrivateKey, exportPublicKey } from '../lib/crypto';
import { useStore } from '../store/useStore';
import { Copy, ArrowRight, Share2, Loader2, ShieldCheck, Check } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function CreateChat() {
  const [nickname, setNickname] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const { setRoomState, setMyKeys } = useStore();
  const navigate = useNavigate();

  const createRoomMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/room/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      if (!res.ok) throw new Error('Failed to create room');
      return res.json();
    }
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    
    try {
      const sessionId = crypto.randomUUID();
      const { room_id, join_token } = await createRoomMutation.mutateAsync(sessionId);
      
      const keyPair = await generateECDHKeyPair();
      const privateKeyB64 = await exportPrivateKey(keyPair.privateKey);
      const publicKeyB64 = await exportPublicKey(keyPair.publicKey);
      
      setRoomState(room_id, sessionId, nickname);
      setMyKeys(privateKeyB64, publicKeyB64);
      
      const link = `${window.location.origin}/join/${room_id}?token=${join_token}#${publicKeyB64}`;
      setInviteLink(link);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my secure chat',
          text: 'Click the link to join a fully encrypted, anonymous chat room.',
          url: inviteLink,
        });
      } catch (e) {
        console.log("Share failed", e);
      }
    } else {
      handleCopy();
    }
  };

  if (inviteLink) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-950 items-center justify-center p-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-[2rem] shadow-2xl p-8 relative z-10 animate-slide-up">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2 text-center text-gray-100">Room Secured</h2>
          <p className="text-sm text-gray-400 text-center mb-6 leading-relaxed">Share this one-time link. The cryptographic anchor is embedded securely in the URL.</p>
          
          <div className="flex justify-center mb-6">
            <div className="bg-white p-3 rounded-2xl shadow-lg border-4 border-gray-950">
              <QRCode value={inviteLink} size={150} fgColor="#030712" />
            </div>
          </div>
          
          <div className="relative group mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl opacity-20 blur group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-gray-950 p-4 rounded-xl border border-gray-800 flex items-center justify-between gap-4">
              <div className="truncate text-sm text-emerald-400/90 font-mono select-all">
                {inviteLink}
              </div>
              <button 
                onClick={handleCopy}
                className="shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1"
                title="Copy Link"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={handleShare}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white py-4 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Share Link via App
            </button>
            
            <button 
              onClick={() => navigate(`/chat/${useStore.getState().roomId}`)}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-gray-950 py-4 px-4 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2"
            >
              Enter Room <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 items-center justify-center p-6 relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-[2rem] shadow-2xl p-8 relative z-10 animate-slide-up">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-100">Create Identity</h2>
        <p className="text-sm text-gray-400 text-center mb-8">You are fully anonymous. Just pick a nickname for this session.</p>
        
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-400 mb-2">Display Name</label>
            <input 
              type="text" 
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Satoshi"
              autoComplete="off"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner" 
            />
          </div>
          
          <button 
            type="submit"
            disabled={!nickname.trim() || createRoomMutation.isPending}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-gray-950 py-4 px-4 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            {createRoomMutation.isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Generating Keys...</>
            ) : (
              'Generate Secure Link'
            )}
          </button>
          
          {createRoomMutation.isError && (
            <p className="text-red-400 text-sm text-center bg-red-400/10 py-3 rounded-xl border border-red-400/20">
              Failed to create room. Please try again.
            </p>
          )}
          
          <div className="text-center pt-2">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Cancel & Return</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
