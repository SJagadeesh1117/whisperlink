import { Link } from 'react-router-dom';
import { Ghost, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-950 items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 text-center animate-slide-up max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-[2rem] shadow-2xl p-12">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gray-800 rounded-3xl flex items-center justify-center border border-gray-700 shadow-inner relative group">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-3xl group-hover:bg-red-400/30 transition-colors"></div>
            <Ghost className="w-10 h-10 text-gray-400 relative z-10" />
          </div>
        </div>
        
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-gray-100 to-gray-500 mb-4 tracking-tighter">
          404
        </h1>
        <h2 className="text-xl font-bold text-gray-200 mb-3">Room Not Found</h2>
        
        <p className="text-sm text-gray-400 mb-8 leading-relaxed">
          This link has evaporated into the void. In our zero-knowledge architecture, what is gone is gone forever.
        </p>
        
        <Link 
          to="/" 
          className="inline-flex items-center justify-center gap-2 w-full bg-gray-800 hover:bg-gray-700 text-white py-4 px-6 rounded-xl font-medium transition-colors border border-gray-700 hover:border-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Safety
        </Link>
      </div>
    </div>
  );
}
