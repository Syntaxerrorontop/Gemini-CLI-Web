import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Activity, Settings, Trash2, FolderSearch } from 'lucide-react';
import FolderPicker from './FolderPicker';

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_tokens: 0, total_requests: 0, models: {} });
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const navigate = useNavigate();

  const loadProjects = () => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data));
      
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const deleteProject = async (e: React.MouseEvent, project_id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    await fetch(`/api/projects/${project_id}`, { method: 'DELETE' });
    loadProjects();
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectPath.trim()) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: newProjectName, 
        description: 'New AI Project',
        path: newProjectPath
      })
    });
    const data = await res.json();
    navigate(`/project/${data.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link to="/settings" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm transition-colors border border-slate-700">
            <Settings className="w-4 h-4" /> Global Settings
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-sm">Total API Requests</p>
                <p className="text-2xl font-bold">{stats.total_requests}</p>
            </div>
            <Activity className="text-blue-400 w-8 h-8"/>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-sm">Total Tokens Used</p>
                <p className="text-2xl font-bold">{stats.total_tokens.toLocaleString()}</p>
            </div>
            <Activity className="text-emerald-400 w-8 h-8"/>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Your Projects</h2>
            <div className="space-y-3">
                {projects.map((p: any) => (
                    <Link to={`/project/${p.id}`} key={p.id} className="group block p-4 bg-slate-900 rounded-lg hover:bg-slate-700/50 border border-slate-700 transition-all relative">
                        <div className="flex justify-between items-center pr-10">
                            <h3 className="font-medium text-lg text-slate-200">{p.name}</h3>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded-full text-slate-400 border border-slate-700 uppercase font-bold tracking-widest">
                                {p.status}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Path: <span className="font-mono">{p.path}</span></p>
                        <p className="text-[10px] text-slate-600 mt-0.5 italic">Last activity: {new Date(p.updated_at).toLocaleString()}</p>
                        
                        <button 
                            onClick={(e) => deleteProject(e, p.id)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete Project"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </Link>
                ))}
                {projects.length === 0 && <p className="text-slate-500">No projects yet. Create one!</p>}
            </div>
        </div>

        <div className="w-80 bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">New Project</h2>
            <form onSubmit={createProject} className="space-y-4">
                <div>
                    <label className="block text-sm text-slate-400 mb-1">Project Name</label>
                    <input 
                        type="text" 
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500 text-sm"
                        placeholder="e.g. AI Character App"
                    />
                </div>
                <div>
                    <label className="block text-sm text-slate-400 mb-1">Project Workspace</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newProjectPath}
                            onChange={e => setNewProjectPath(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500 text-sm font-mono"
                            placeholder="/home/user/my-project"
                        />
                        <button 
                            type="button" 
                            onClick={() => setIsPickingFolder(true)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 transition-colors"
                        >
                            <FolderSearch className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {isPickingFolder && (
                    <FolderPicker 
                        onSelect={(path) => {
                            setNewProjectPath(path);
                            setIsPickingFolder(false);
                        }}
                        onClose={() => setIsPickingFolder(false)}
                    />
                )}
                <button type="submit" className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium transition-colors">
                    <PlusCircle className="w-4 h-4" /> Create
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}
