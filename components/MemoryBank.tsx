import React, { useState } from 'react';
import { MemoryEntry } from '../types';

interface MemoryBankProps {
  memories: MemoryEntry[];
  onRemove: (id: string) => void;
  onAdd: (fact: string) => void;
  onPurge: () => void;
  assistantName: string;
}

const MemoryBank: React.FC<MemoryBankProps> = ({ memories, onRemove, onAdd, onPurge, assistantName }) => {
  const [filter, setFilter] = useState('');
  const [manualInput, setManualInput] = useState('');

  const filteredMemories = memories.filter(m => 
    m.fact.toLowerCase().includes(filter.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onAdd(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="flex flex-col h-full glass rounded-[var(--ui-radius)] border border-white/10 p-6 lg:p-8 animate-fade-in relative overflow-hidden shadow-2xl">
      {/* HUD Accent */}
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <i className="fas fa-brain text-8xl"></i>
      </div>

      <div className="relative z-10 flex flex-col h-full gap-6">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Bio-Core Memory
            </h3>
            <button 
              onClick={onPurge}
              className="text-[8px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-widest transition-colors"
            >
              Purge Core
            </button>
          </div>
          
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-[10px]"></i>
            <input 
              type="text" 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter recall segment..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-[10px] text-white font-bold outline-none focus:border-emerald-500/30 transition-all"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {filteredMemories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-white/5 rounded-[2rem] opacity-30">
              <i className="fas fa-microchip text-4xl mb-4"></i>
              <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                {filter ? "Recall Failure: No matches found" : "Neural matrix empty. Record data to begin learning cycle."}
              </p>
            </div>
          ) : (
            [...filteredMemories].reverse().map((m) => (
              <div 
                key={m.id} 
                className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 p-4 lg:p-5 rounded-2xl transition-all duration-300 animate-slide-in-right-bounce"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/20 group-hover:bg-emerald-500 transition-colors"></div>
                <p className="text-xs lg:text-sm text-gray-200 leading-relaxed font-bold">{m.fact}</p>
                <button 
                  onClick={() => onRemove(m.id)}
                  className="absolute top-4 right-4 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                >
                  <i className="fas fa-times-circle text-xs"></i>
                </button>
                <div className="mt-3 flex items-center justify-between opacity-30 group-hover:opacity-60 transition-opacity">
                  <span className="text-[8px] font-black uppercase tracking-tighter">Segment_ID: {m.id}</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter">{new Date(m.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="pt-4 border-t border-white/5">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input 
              type="text" 
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Inject manual fact..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-[10px] text-white font-black uppercase tracking-widest outline-none focus:border-emerald-500/50"
            />
            <button 
              type="submit"
              disabled={!manualInput.trim()}
              className="w-12 h-12 rounded-xl bg-emerald-500 text-black flex items-center justify-center transition-all hover:scale-105 active:scale-90 disabled:opacity-30 disabled:grayscale"
            >
              <i className="fas fa-plus"></i>
            </button>
          </form>
          <p className="mt-3 text-[7px] text-center text-gray-600 font-black uppercase tracking-[0.3em]">
            Stored data is encrypted & keyed to biological signature
          </p>
        </footer>
      </div>
    </div>
  );
};

export default MemoryBank;