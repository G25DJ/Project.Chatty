import React from 'react';
import { MemoryEntry } from '../types';

interface MemoryBankProps {
  memories: MemoryEntry[];
  onRemove: (id: string) => void;
  assistantName: string;
}

const MemoryBank: React.FC<MemoryBankProps> = ({ memories, onRemove, assistantName }) => {
  return (
    <div className="flex flex-col h-full bg-white/5 border-l border-white/10 p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
          <i className="fas fa-brain"></i>
          Memory Bank
        </h3>
        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
          {memories.length} FACTS
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
        {memories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-white/5 rounded-2xl">
            <i className="fas fa-lightbulb text-gray-700 text-3xl mb-3"></i>
            <p className="text-xs text-gray-500 italic">"{assistantName}, remember that I am learning React."</p>
          </div>
        ) : (
          [...memories].reverse().map((m) => (
            <div 
              key={m.id} 
              className="group relative bg-white/10 hover:bg-white/15 border border-white/10 p-3 rounded-xl transition-all duration-300 animate-slide-in-right"
            >
              <p className="text-sm text-gray-200 pr-6 leading-relaxed">{m.fact}</p>
              <button 
                onClick={() => onRemove(m.id)}
                className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <i className="fas fa-trash-alt text-[10px]"></i>
              </button>
              <div className="mt-2 text-[9px] text-gray-500 uppercase flex justify-between">
                <span>ACQUIRED</span>
                <span>{new Date(m.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MemoryBank;