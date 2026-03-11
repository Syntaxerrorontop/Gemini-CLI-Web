import { useState, useEffect } from 'react';
import { Folder, ChevronLeft, Search, X } from 'lucide-react';

interface FolderPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export default function FolderPicker({ onSelect, onClose }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');

  const loadPath = async (path: string) => {
    try {
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.error) {
          setError(data.error);
      } else {
          setCurrentPath(data.current_path);
          setParentPath(data.parent_path);
          setItems(data.items);
          setError('');
      }
    } catch (e) {
      setError('Could not access filesystem');
    }
  };

  useEffect(() => {
    loadPath('');
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2 text-blue-400"><Search className="w-4 h-4"/> Select Project Folder</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition-colors"><X className="w-5 h-5"/></button>
        </div>

        <div className="p-3 bg-slate-900 border-b border-slate-700 flex items-center gap-2">
            <button onClick={() => loadPath(parentPath)} className="p-1.5 hover:bg-slate-700 rounded transition-colors"><ChevronLeft className="w-4 h-4"/></button>
            <input 
                type="text" 
                value={currentPath}
                readOnly
                className="flex-1 bg-transparent text-xs text-slate-400 font-mono overflow-hidden whitespace-nowrap"
            />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {error && <div className="p-4 text-rose-500 text-sm text-center font-bold">Error: {error}</div>}
            
            {items.map(item => (
                <button 
                    key={item.path}
                    onClick={() => loadPath(item.path)}
                    className="w-full text-left p-3 hover:bg-slate-700/50 rounded flex items-center gap-3 transition-colors group"
                >
                    <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20 group-hover:fill-amber-500/40 transition-all"/>
                    <span className="text-sm font-medium text-slate-300">{item.name}</span>
                </button>
            ))}
        </div>

        <div className="p-4 border-t border-slate-700 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold text-sm transition-colors">Cancel</button>
            <button onClick={() => onSelect(currentPath)} className="flex-2 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm transition-colors shadow-lg">Select Current Folder</button>
        </div>
      </div>
    </div>
  );
}
