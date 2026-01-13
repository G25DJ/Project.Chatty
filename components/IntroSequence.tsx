import React, { useEffect, useState } from 'react';

interface IntroSequenceProps {
  onComplete: () => void;
}

const LOGS = [
  "LINKING NEURAL PATHWAYS...",
  "SYNCHRONIZING BIO-SEGMENT...",
  "BYPASSING SECURITY OVERRIDE...",
  "CHARTING TEMPORAL COORDINATES...",
  "PROJECT CHATTY ONLINE."
];

const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  const [currentLog, setCurrentLog] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),   // Singularity ignition
      setTimeout(() => setStage(2), 2000),  // Typography focus
      setTimeout(() => setStage(3), 4000),  // System logs begin
      setTimeout(() => setStage(4), 6500),  // White-out burst
      setTimeout(() => onComplete(), 7200)  // Exit to app
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  useEffect(() => {
    if (stage === 3) {
      const logInterval = setInterval(() => {
        setCurrentLog(prev => (prev < LOGS.length - 1 ? prev + 1 : prev));
      }, 400);
      return () => clearInterval(logInterval);
    }
  }, [stage]);

  return (
    <div className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 bg-[#02020a]`}>
      
      {/* Radiant Singularity Core */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className={`relative transition-all duration-[2000ms] ease-out
            ${stage >= 1 ? 'w-[60vw] h-[60vw] opacity-100' : 'w-0 h-0 opacity-0'}
          `}
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.8) 0%, rgba(139,92,246,0.4) 30%, transparent 70%)',
            filter: 'blur(60px)',
            animation: stage >= 1 ? 'singularity-expand 4s forwards, core-pulse 2s infinite alternate ease-in-out' : 'none'
          }}
        />
        {/* Secondary radiant layer */}
        <div 
          className={`absolute transition-all duration-[3000ms] ease-out
            ${stage >= 1 ? 'w-[40vw] h-[40vw] opacity-60 scale-150' : 'w-0 h-0 opacity-0'}
          `}
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.5) 0%, transparent 60%)',
            filter: 'blur(80px)',
            animation: stage >= 1 ? 'core-pulse 3s infinite alternate-reverse ease-in-out' : 'none'
          }}
        />
      </div>

      {/* Radiant Typography */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <h1 
          className={`text-3xl md:text-5xl lg:text-7xl font-black uppercase transition-all duration-[1500ms]
            ${stage >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-110'}
          `}
          style={{
            animation: stage >= 2 ? 'text-focus-in 1.5s ease-out forwards' : 'none',
            letterSpacing: '0.5em',
            textShadow: '0 0 30px rgba(255,255,255,0.4)'
          }}
        >
          PROJECT <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-white to-emerald-400">CHATTY</span>
        </h1>
        
        <div className={`mt-12 overflow-hidden transition-opacity duration-500 ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex flex-col gap-2 items-center">
             <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
             <p className="text-[10px] lg:text-[12px] font-mono text-white/50 tracking-[0.4em] h-4">
                {LOGS[currentLog]}
             </p>
          </div>
        </div>
      </div>

      {/* Supernova White-out Transition */}
      <div 
        className={`absolute inset-0 bg-white z-[1100] transition-opacity duration-[1000ms] pointer-events-none
          ${stage === 4 ? 'opacity-100' : 'opacity-0'}
        `}
      />

      {/* CRT Overlay Effect */}
      <div className="absolute inset-0 pointer-events-none z-[1050] opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
    </div>
  );
};

export default IntroSequence;