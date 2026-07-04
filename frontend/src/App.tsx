import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

const Home = lazy(() => import('./pages/Home'));
const CreateChat = lazy(() => import('./pages/CreateChat'));
const JoinChat = lazy(() => import('./pages/JoinChat'));
const Chat = lazy(() => import('./pages/Chat'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

// Loader for Suspense fallback
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[50vh]">
    <div className="flex flex-col items-center gap-4 text-emerald-500">
      <Loader2 className="w-12 h-12 animate-spin" />
      <span className="text-sm font-medium tracking-widest uppercase">Initializing...</span>
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col font-sans">
          <main className="flex-1 flex flex-col">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/create" element={<CreateChat />} />
                <Route path="/join/:roomId" element={<JoinChat />} />
                <Route path="/chat/:roomId" element={<Chat />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
