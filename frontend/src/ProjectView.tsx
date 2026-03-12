import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Send, Terminal, Settings, CheckCircle2, Circle, History, Clock, RotateCcw, Folder, File as FileIcon, ChevronLeft, Code, Bug } from 'lucide-react';

export default function ProjectView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [planText, setPlanText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'roadmap' | 'history' | 'debugging'>('roadmap');
  const [debugPrompt, setDebugPrompt] = useState('');
  
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [terminalInput, setTerminalInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [autoContinue, setAutoContinue] = useState(true);
  const terminalRef = useRef<HTMLPreElement>(null);

  // File Explorer State
  const [fsItems, setFsItems] = useState<any[]>([]);
  const [currentFsPath, setCurrentFsPath] = useState('');
  const [parentFsPath, setParentFsPath] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  const loadProject = async () => {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    setProject(data);
    if (data.plan && !isEditing) {
        setPlanText(JSON.stringify(data.plan, null, 2));
    }
    if (!currentFsPath && data.path) {
        loadFs(data.path);
    }
  };

  const loadFs = async (path: string) => {
      try {
          const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          if (!data.error) {
              setFsItems(data.items);
              setCurrentFsPath(data.current_path);
              setParentFsPath(data.parent_path);
          }
      } catch (e) {}
  };

  const loadFile = async (path: string) => {
      try {
          const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          if (!data.error) {
              setSelectedFile(path);
              setFileContent(data.content);
          }
      } catch(e) {}
  };

  useEffect(() => {
    loadProject();
    const interval = setInterval(() => { 
        if (!ws) {
            loadProject();
            if (currentFsPath) loadFs(currentFsPath);
            if (selectedFile) loadFile(selectedFile);
        }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, ws, currentFsPath, selectedFile]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalOutput]);

  const generatePlan = async () => {
    setIsGenerating(true);
    const res = await fetch(`/api/projects/${id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    await res.json();
    setPrompt('');
    loadProject();
    setIsGenerating(false);
  };

  const savePlan = async () => {
    try {
        const parsed = JSON.parse(planText);
        await fetch(`/api/projects/${id}/plan`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
        });
        loadProject();
    } catch(e) { alert('Invalid JSON'); }
  };

  const restorePlan = async (historyId: string) => {
    await fetch(`/api/projects/${id}/restore-plan/${historyId}`, { method: 'POST' });
    loadProject();
  };

  const startExecution = (execMode: string = 'roadmap', directPrompt: string = '') => {
    if (ws) ws.close();
    setTerminalOutput('');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
        auto_continue: autoContinue.toString(),
        mode: execMode,
        direct_prompt: directPrompt
    });
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/execute/${id}?${params.toString()}`);
    
    socket.onmessage = (event) => {
        if (event.data === '[DB_UPDATE]') { loadProject(); return; }
        setTerminalOutput(prev => prev + event.data);
    };
    socket.onclose = () => { setWs(null); loadProject(); };
    setWs(socket);
  };

  if (!project) return <div className="p-8">Loading project...</div>;

  const steps = project.plan ? Object.entries(project.plan)
    .filter(([k]) => !isNaN(parseInt(k)))
    .sort(([a], [b]) => parseInt(a) - parseInt(b)) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{project.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">{project.status}</span>
                <span className="text-slate-500">Step {project.current_step} / {steps.length}</span>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button onClick={() => setActiveTab('roadmap')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${activeTab === 'roadmap' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Roadmap</button>
                <button onClick={() => setActiveTab('debugging')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${activeTab === 'debugging' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>Debugging</button>
                <button onClick={() => setActiveTab('history')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>History</button>
            </div>
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors text-sm">← Back</button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Column 1: File Explorer */}
          <div className="bg-[#05080f] rounded-xl border border-slate-800 flex flex-col h-full min-h-0 shadow-xl overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Code className="w-3.5 h-3.5"/> Workspace Explorer</h2>
              </div>
              
              {selectedFile ? (
                  <div className="flex flex-col h-full min-h-0">
                      <div className="p-2 border-b border-slate-800 bg-slate-900/80 flex items-center gap-2">
                          <button onClick={() => setSelectedFile(null)} className="p-1 hover:bg-slate-700 rounded"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                          <span className="text-xs font-mono text-slate-300 truncate" title={selectedFile}>{selectedFile.split('/').pop()}</span>
                      </div>
                      <pre className="flex-1 p-3 overflow-auto text-[10px] font-mono text-emerald-400/90 leading-relaxed custom-scrollbar">
                          {fileContent}
                      </pre>
                  </div>
              ) : (
                  <div className="flex flex-col h-full min-h-0">
                      <div className="p-2 border-b border-slate-800 bg-slate-900/80 flex items-center gap-2">
                          <button onClick={() => loadFs(parentFsPath)} className="p-1 hover:bg-slate-700 rounded"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                          <span className="text-[10px] font-mono text-slate-500 truncate">{currentFsPath}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                          {fsItems.map(item => (
                              <div 
                                key={item.path} 
                                onClick={() => item.is_dir ? loadFs(item.path) : loadFile(item.path)}
                                className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer group"
                              >
                                  {item.is_dir ? <Folder className="w-4 h-4 text-blue-400 fill-blue-400/20"/> : <FileIcon className="w-4 h-4 text-slate-400"/>}
                                  <span className="text-xs font-mono text-slate-300 group-hover:text-white truncate">{item.name}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>

          {/* Column 2: Planning & Roadmap */}
          <div className="flex flex-col space-y-4 h-full min-h-0">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-300"><Settings className="w-4 h-4 text-blue-400"/> Ask Agent</h2>
                  <div className="flex gap-2">
                    <input 
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-4 py-2 text-slate-100 outline-none focus:border-blue-500 transition-all text-sm"
                        placeholder="What should I do next?"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && generatePlan()}
                    />
                    <button onClick={generatePlan} disabled={isGenerating || !prompt} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-all">
                        {isGenerating ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/> : <Send className="w-4 h-4"/>}
                    </button>
                  </div>
              </div>

              {activeTab === 'roadmap' ? (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col flex-1 min-h-0 shadow-md overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-200">Current Roadmap</h2>
                        <button onClick={() => { if (isEditing) savePlan(); setIsEditing(!isEditing); }} className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 uppercase font-bold">
                            {isEditing ? 'Save JSON' : 'Edit JSON'}
                        </button>
                    </div>
                    {isEditing ? (
                        <textarea className="flex-1 w-full bg-slate-900 border border-slate-700 rounded p-3 text-emerald-400 font-mono text-xs outline-none resize-none" value={planText} onChange={e => setPlanText(e.target.value)}/>
                    ) : (
                        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                            {steps.map(([key, step]: any) => {
                                const stepNum = parseInt(key);
                                const isCompleted = stepNum <= project.current_step;
                                const isCurrent = stepNum === project.current_step + 1;
                                return (
                                    <div key={key} onClick={() => fetch(`/api/projects/${id}/step/${isCompleted ? stepNum - 1 : stepNum}`, {method: 'PUT'}).then(loadProject)} className={`p-4 rounded-lg border transition-all cursor-pointer group ${isCompleted ? 'bg-slate-700/30 border-emerald-500/30' : isCurrent ? 'bg-blue-900/10 border-blue-500/50' : 'bg-slate-900 border-slate-700 opacity-40'}`}>
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex items-center gap-2">
                                                {isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <Circle className={`w-4 h-4 ${isCurrent ? 'text-blue-500 animate-pulse' : 'text-slate-600'}`}/>}
                                                <h3 className={`font-bold text-sm ${isCurrent ? 'text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-slate-300'}`}>{step.title}</h3>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 pl-6 leading-relaxed">{step.goal}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    <div className="mt-4 flex flex-col gap-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input type="checkbox" className="sr-only peer" checked={autoContinue} onChange={() => setAutoContinue(!autoContinue)}/>
                                <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-emerald-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-widest">Auto-continue with next step</span>
                        </label>
                        <button onClick={() => startExecution()} disabled={!!ws || steps.length === 0} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-bold transition-all shadow-lg active:scale-95">
                            {ws ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"/> : <Play className="w-5 h-5" />} 
                            {ws ? 'AGENT IS CODING...' : 'START AUTONOMOUS EXECUTION'}
                        </button>
                    </div>
                </div>
              ) : activeTab === 'debugging' ? (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col flex-1 min-h-0 shadow-md">
                    <h2 className="text-lg font-semibold text-rose-400 mb-4 flex items-center gap-2 tracking-tighter uppercase italic"><Bug className="w-5 h-5"/> Direct Debugging</h2>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        Send direct instructions or error logs to the specialized Worker. This bypasses the Planner and executes immediately in your workspace.
                    </p>
                    <textarea 
                        className="flex-1 w-full bg-slate-900 border border-slate-700 rounded p-4 text-slate-100 text-sm outline-none focus:border-rose-500 transition-all resize-none font-mono"
                        placeholder="Paste error message or direct instruction here..."
                        value={debugPrompt}
                        onChange={e => setDebugPrompt(e.target.value)}
                    />
                    <button 
                        onClick={() => { startExecution('debugging', debugPrompt); setDebugPrompt(''); }}
                        disabled={!!ws || !debugPrompt}
                        className="mt-4 w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-bold transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs"
                    >
                        {ws ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Play className="w-4 h-4" />} 
                        Run Direct Fix
                    </button>
                </div>
              ) : (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col flex-1 min-h-0 shadow-md overflow-hidden">
                    <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2"><History className="w-5 h-5 text-amber-500"/> Project History</h2>
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                        <section>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Previous Prompts</h3>
                            <div className="space-y-2">
                                {project.prompts?.slice().reverse().map((p: any, i: number) => (
                                    <div key={i} className="bg-slate-900 p-3 rounded border border-slate-700">
                                        <p className="text-sm text-slate-200">{p.text}</p>
                                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500"><Clock className="w-3 h-3"/> {new Date(p.timestamp).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        <section>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Archived Plans</h3>
                            <div className="space-y-3">
                                {project.plan_history?.slice().reverse().map((h: any, i: number) => (
                                    <div key={i} className="bg-slate-900 p-4 rounded-lg border border-slate-700 flex justify-between items-center group">
                                        <div>
                                            <p className="text-sm font-bold text-slate-300">Plan from {new Date(h.archived_at).toLocaleDateString()}</p>
                                            <p className="text-xs text-slate-500">Completed: {h.completed_steps} steps</p>
                                        </div>
                                        <button onClick={() => restorePlan(h.id)} className="bg-slate-800 hover:bg-amber-600/20 hover:text-amber-400 p-2 rounded transition-all flex items-center gap-2 text-xs font-bold text-slate-400">
                                            <RotateCcw className="w-4 h-4"/> Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
              )}
          </div>

          <div className="bg-[#0a0f18] rounded-xl border border-slate-800 flex flex-col h-full min-h-0 shadow-2xl overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-500"/>
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Agent Console</h2>
                  </div>
                  {ws && <span className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"/> STREAMING</span>}
              </div>
              <pre ref={terminalRef} className="flex-1 p-4 overflow-y-auto text-gray-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap selection:bg-blue-500/30">
                  {terminalOutput || 'Agent output will appear here...'}
              </pre>
              <form onSubmit={(e) => { e.preventDefault(); if (ws && terminalInput) { ws.send(terminalInput + '\n'); setTerminalOutput(prev => prev + terminalInput + '\n'); setTerminalInput(''); } }} className="p-3 border-t border-slate-800 bg-slate-900/30 flex gap-2">
                  <input type="text" value={terminalInput} onChange={e => setTerminalInput(e.target.value)} placeholder="Interact with agent..." className="flex-1 bg-black/40 border border-slate-700 rounded px-3 py-1.5 text-white outline-none focus:border-blue-500 font-mono text-xs"/>
                  <button type="submit" disabled={!ws} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 px-3 py-1.5 rounded transition-all">
                      <Send className="w-3.5 h-3.5 text-slate-300"/>
                  </button>
              </form>
          </div>
      </div>
    </div>
  );
}
