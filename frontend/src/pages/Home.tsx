import { Link } from 'react-router-dom';
import { Shield, Lock, Zap, Ghost } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100 overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 animate-fade-in">
        <div className="max-w-3xl w-full text-center space-y-8 animate-slide-up">
          <div className="inline-flex items-center justify-center p-4 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl mb-4 relative group">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-3xl group-hover:bg-emerald-400/30 transition-colors"></div>
            <Ghost className="w-12 h-12 text-emerald-400 relative z-10" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Whisper<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Link</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-light">
            The most secure, ephemeral, and anonymous chat platform. No sign-ups. No footprints. 
            Mathematically guaranteed end-to-end encryption.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link 
              to="/create" 
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl transition-all hover:scale-[1.03] active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-lg"
            >
              Start Secure Chat
            </Link>
            <a 
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 font-semibold rounded-xl transition-all hover:scale-[1.03] active:scale-95 text-lg"
            >
              How it works
            </a>
          </div>
        </div>

        {/* Feature Grid */}
        <div id="how-it-works" className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-32 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="p-8 rounded-[2rem] bg-gray-900/40 border border-gray-800/50 backdrop-blur-md hover:bg-gray-900/60 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Absolute Anonymity</h3>
            <p className="text-gray-400 text-sm leading-relaxed">No emails, passwords, or cookies. We don't know who you are, and neither does the server.</p>
          </div>
          <div className="p-8 rounded-[2rem] bg-gray-900/40 border border-gray-800/50 backdrop-blur-md hover:bg-gray-900/60 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20">
              <Lock className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3">ECDH + AES-GCM</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Keys are negotiated directly in your browser. The server only sees AES-encrypted ciphertext.</p>
          </div>
          <div className="p-8 rounded-[2rem] bg-gray-900/40 border border-gray-800/50 backdrop-blur-md hover:bg-gray-900/60 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-6 border border-yellow-500/20">
              <Zap className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Self-Destructing</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Chats are stored strictly in RAM and completely vanish after 60 minutes of inactivity.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-gray-600 relative z-10">
        <p>WhisperLink Protocol &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
