import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import ProjectView from './ProjectView';
import Settings from './Settings';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-50">
        <header className="border-b border-slate-800 p-4 sticky top-0 bg-slate-900/80 backdrop-blur-md z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-500 bg-clip-text text-transparent tracking-tighter uppercase">
                Gemini AutoAgent v2
            </h1>
            <div className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                Autonomous AI Core
            </div>
          </div>
        </header>
        <main className="p-4 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectView />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
