import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Activity, Settings } from 'lucide-react';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({ total_tokens: 0, total_requests: 0, models: {} });
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data));
      
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data));
  }, []);

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
                    <Link to={`/project/${p.id}`} key={p.id} className="block p-4 bg-slate-900 rounded-lg hover:bg-slate-700 border border-slate-700 transition-colors">
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium text-lg">{p.name}</h3>
                            <span className="text-xs px-2 py-1 bg-slate-800 rounded-full text-slate-300 border border-slate-600">
                                {p.status}
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">Last updated: {new Date(p.updated_at).toLocaleString()}</p>
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
                    <label className="block text-sm text-slate-400 mb-1">Absolute Path</label>
                    <input 
                        type="text" 
                        value={newProjectPath}
                        onChange={e => setNewProjectPath(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500 text-sm"
                        placeholder="/home/user/my-project"
                    />
                </div>
                <button type="submit" className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium transition-colors">
                    <PlusCircle className="w-4 h-4" /> Create
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}
