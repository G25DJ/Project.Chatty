
import React from 'react';
import { GroundingSource } from '../types';

interface GroundingSourcesProps {
  sources: GroundingSource[];
  themePrimary: string;
}

const GroundingSources: React.FC<GroundingSourcesProps> = ({ sources, themePrimary }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 animate-fade-in">
      {sources.map((source, idx) => (
        <a
          key={idx}
          href={source.uri}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:border-${themePrimary} hover:bg-white/10 transition-all`}
        >
          <i className="fas fa-link text-[8px]"></i>
          <span className="max-w-[120px] truncate">{source.title || 'Source'}</span>
        </a>
      ))}
    </div>
  );
};

export default GroundingSources;
