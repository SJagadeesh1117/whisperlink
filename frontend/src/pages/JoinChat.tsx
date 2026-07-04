import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import { generateECDHKeyPair, exportPrivateKey, exportPublicKey, importPublicKey, deriveAESKeyWithHKDF, exportAESKey } from '../lib/crypto';
import { ShieldAlert, Loader2, ArrowRight } from 'lucide-react';

export default function JoinChat() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [partnerPublicKeyB64, setPartnerPublicKeyB64] = useState('');
  const { setRoomState, setMyKeys, setPartnerPublicKey, setSessionKey } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const hash = window.location.hash.substring(1);
    
    if (token) setJoinToken(token);
    if (hash) setPartnerPublicKeyB64(hash);
    
    // Scrub URL parameters entirely to prevent token leakage in browser history
    window.history.replaceState(null, '', window.location.pathname);
  }, [searchParams]);

  const joinRoomMutation = useMutation({
    mutationFn: async (payload: { roomId: string, joinToken: string, sessionId: string }) => {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/room/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          room_id: payload.roomId, 
          join_token: payload.joinToken, 
          session_id: payload.sessionId 
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to join room');
      }
      return res.json();
    }
  });

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomId || !joinToken || !partnerPublicKeyB64) return;
    
    try {
      const sessionId = crypto.randomUUID();
      
      const myKeyPair = await generateECDHKeyPair();
      const myPrivateKeyB64 = await exportPrivateKey(myKeyPair.privateKey);
      const myPublicKeyB64 = await exportPublicKey(myKeyPair.publicKey);
      
      const partnerPubKey = await importPublicKey(partnerPublicKeyB64);
      const sessionKey = await deriveAESKeyWithHKDF(myKeyPair.privateKey, partnerPubKey);
      const sessionKeyB64 = await exportAESKey(sessionKey);
      
      setRoomState(roomId, sessionId, nickname);
      setMyKeys(myPrivateKeyB64, myPublicKeyB64);
      setPartnerPublicKey(partnerPublicKeyB64);
      setSessionKey(sessionKeyB64);
      
      await joinRoomMutation.mutateAsync({ roomId, joinToken, sessionId });
      
      navigate(`/chat/${roomId}`);
    } catch (err) {
      console.error(err);
    }
  };

  if (!joinToken || (!partnerPublicKeyB64 && !window.location.hash)) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-950 items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl p-8 text-center animate-slide-up">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-4 text-red-400">Invalid Invite Link</h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">This link is missing the required cryptographic token or has been malformed.</p>
          <Link to="/" className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-medium transition-colors">Return to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 items-center justify-center p-6 relative">
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-[2rem] shadow-2xl p-8 relative z-10 animate-slide-up">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-100">Join Secure Chat</h2>
        <div className="flex justify-center mb-8">
          <p className="text-xs text-gray-500 font-mono bg-gray-950/80 py-2 px-4 rounded-full border border-gray-800 shadow-inner flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
            Room: {roomId?.substring(0, 8)}...
          </p>
        </div>
        
        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-400 mb-2">Your Display Name</label>
            <input 
              type="text" 
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Alice"
              autoComplete="off"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-inner" 
            />
          </div>
          
          <button 
            type="submit"
            disabled={!nickname.trim() || joinRoomMutation.isPending}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500 text-gray-950 py-4 px-4 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center justify-center gap-2"
          >
            {joinRoomMutation.isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Deriving Keys...</>
            ) : (
              <>Join Securely <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
          
          {joinRoomMutation.isError && (
            <p className="text-red-400 text-sm text-center bg-red-400/10 py-3 rounded-xl border border-red-400/20">
              {joinRoomMutation.error.message}
            </p>
          )}
          
          <div className="text-center pt-2">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
