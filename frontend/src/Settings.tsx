import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const [config, setConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data));
  }, []);

  const saveConfig = async () => {
    setIsSaving(true);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    setIsSaving(false);
    alert('Settings saved successfully!');
  };

  if (!config) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><ArrowLeft className="w-5 h-5"/></button>
            <h1 className="text-xl font-bold">Global Agent Settings</h1>
          </div>
          <button 
            onClick={saveConfig} 
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4"/> {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
      </div>

      <div className="space-y-6">
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-lg font-semibold text-blue-400 border-b border-slate-700 pb-2">Planning Prompts</h2>
            <div>
                <label className="block text-sm text-slate-400 mb-2 font-mono">system_prompt</label>
                <textarea 
                    value={config.prompts.system_prompt}
                    onChange={e => setConfig({...config, prompts: {...config.prompts, system_prompt: e.target.value}})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-slate-100 font-mono text-sm h-24 outline-none focus:border-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm text-slate-400 mb-2 font-mono">plan_generation</label>
                <textarea 
                    value={config.prompts.plan_generation}
                    onChange={e => setConfig({...config, prompts: {...config.prompts, plan_generation: e.target.value}})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-slate-100 font-mono text-sm h-64 outline-none focus:border-blue-500"
                />
            </div>
        </section>

        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400 border-b border-slate-700 pb-2">Worker / Coder Prompts</h2>
            <div>
                <label className="block text-sm text-slate-400 mb-2 font-mono">worker_prompt</label>
                <p className="text-[10px] text-slate-500 mb-2 italic">Use {'{TASK_GOAL}'} as placeholder for the current plan step.</p>
                <textarea 
                    value={config.prompts.worker_prompt}
                    onChange={e => setConfig({...config, prompts: {...config.prompts, worker_prompt: e.target.value}})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-slate-100 font-mono text-sm h-48 outline-none focus:border-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm text-slate-400 mb-2 font-mono">reviewer_prompt</label>
                <textarea 
                    value={config.prompts.reviewer_prompt || ''}
                    onChange={e => setConfig({...config, prompts: {...config.prompts, reviewer_prompt: e.target.value}})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-slate-100 font-mono text-sm h-32 outline-none focus:border-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm text-slate-400 mb-2 font-mono">recovery_prompt</label>
                <p className="text-[10px] text-slate-500 mb-2 italic">Use {'{ERROR_LOG}'} as placeholder for the failure context.</p>
                <textarea 
                    value={config.prompts.recovery_prompt || ''}
                    onChange={e => setConfig({...config, prompts: {...config.prompts, recovery_prompt: e.target.value}})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-slate-100 font-mono text-sm h-32 outline-none focus:border-blue-500"
                />
            </div>
        </section>

        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-lg font-semibold text-amber-400 border-b border-slate-700 pb-2">Active Features & Safety</h2>
            
            <div className="flex flex-col gap-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={config.features?.enable_reviewer || false} 
                            onChange={e => setConfig({...config, features: {...(config.features || {}), enable_reviewer: e.target.checked}})}
                        />
                        <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-emerald-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </div>
                    <div>
                        <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Enable Reviewer Agent</span>
                        <p className="text-xs text-slate-500">Spawns a second agent to review and approve the coder's work before moving to the next step.</p>
                    </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={config.features?.enable_recovery || false} 
                            onChange={e => setConfig({...config, features: {...(config.features || {}), enable_recovery: e.target.checked}})}
                        />
                        <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-amber-500 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </div>
                    <div>
                        <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Enable Auto-Recovery</span>
                        <p className="text-xs text-slate-500">If the agent fails to complete a task, a recovery agent will analyze the logs and try to fix it automatically.</p>
                    </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group pt-4 border-t border-slate-700">
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={config.safty?.force_formating || false} 
                            onChange={e => setConfig({...config, safty: {...(config.safty || {}), force_formating: e.target.checked}})}
                        />
                        <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </div>
                    <span className="text-sm text-slate-300">Force structure-aware formatting (experimental)</span>
                </label>
            </div>
        </section>
      </div>
    </div>
  );
}
