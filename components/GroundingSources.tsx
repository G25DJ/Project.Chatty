import React from 'react';
import { GroundingSource } from '../types';

interface GroundingSourcesProps {
  sources: GroundingSource[];
  themePrimary: string;
}

const GroundingSources: React.FC<GroundingSourcesProps> = ({ sources, themePrimary }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2 animate-fade-in">
      <div className="w-full mb-1">
        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-600">Verified Intelligence Sources</span>
      </div>
      {sources.map((source, idx) => (
        <a
          key={idx}
          href={source.uri}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:border-${themePrimary} hover:bg-white/10 transition-all group`}
        >
          <i className="fas fa-link text-[8px] group-hover:scale-110 transition-transform"></i>
          <span className="max-w-[140px] truncate">{source.title || 'Uplink Source'}</span>
        </a>
      ))}
    </div>
  );
};

export default GroundingSources;