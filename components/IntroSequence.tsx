import React, { useEffect, useState } from 'react';

interface IntroSequenceProps {
  onComplete: () => void;
}

const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),   // Bubbles appear
      setTimeout(() => setStage(2), 1500),  // "PROJECT CHATTY" appears
      setTimeout(() => setStage(3), 3500),  // Full logo + dots
      setTimeout(() => setStage(4), 5000),  // Transition to black
      setTimeout(() => onComplete(), 5800)  // Exit
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden font-sans transition-colors duration-1000 ${stage === 4 ? 'bg-[#02020a]' : 'bg-[#f8f9fa]'}`}>
      {/* Floating Background Bubbles */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-[20%] left-[15%] w-12 h-12 bg-blue-400/20 rounded-full blur-xl animate-bounce"></div>
        <div className="absolute bottom-[25%] right-[20%] w-24 h-24 bg-purple-400/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute top-[60%] left-[40%] w-8 h-8 bg-orange-400/20 rounded-full blur-lg animate-bounce delay-700"></div>
      </div>

      <div className="relative flex flex-col items-center">
        {/* Animated Speech Bubbles */}
        <div className={`flex gap-6 mb-12 transition-all duration-1000 transform ${stage >= 1 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-10'}`}>
          <div className="relative w-28 h-24 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-[2.5rem] shadow-2xl flex items-center justify-center animate-float">
            <div className="w-14 h-1.5 bg-white/30 rounded-full mb-1"></div>
            <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-indigo-600 rounded-bl-full shadow-lg"></div>
            <i className="fas fa-comment text-white/10 absolute text-5xl"></i>
          </div>
          <div className="relative w-24 h-20 bg-gradient-to-tr from-rose-400 to-orange-500 rounded-[2rem] shadow-xl mt-6 flex items-center justify-center animate-float [animation-delay:1s]">
            <div className="w-10 h-1 bg-white/30 rounded-full"></div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-br-full shadow-lg"></div>
          </div>
        </div>

        {/* Logo Text */}
        <div className="relative flex flex-col items-center">
          <div className={`flex items-baseline transition-all duration-1000 transform ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
            <span className="text-6xl md:text-9xl font-black tracking-tighter text-gray-500/80 drop-shadow-2xl uppercase">PROJECT</span>
            <div className="flex ml-6">
              {'CHATTY'.split('').map((char, i) => {
                const colors = ['text-blue-500', 'text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-500', 'text-red-500'];
                return (
                  <span 
                    key={i} 
                    className={`${colors[i % colors.length]} text-6xl md:text-9xl font-black transition-all duration-700 transform ${stage >= 2 ? 'scale-100 rotate-0' : 'scale-0 rotate-12'}`}
                    style={{ transitionDelay: `${i * 100}ms` }}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          </div>
          
          <div className={`mt-4 transition-all duration-1000 ${stage >= 3 ? 'opacity-100 scale-110' : 'opacity-0 scale-50'}`}>
            <span className="text-5xl md:text-7xl font-black text-gray-400 tracking-[0.5em] animate-pulse">...</span>
          </div>
        </div>

        {/* Floating Particles/Bubbles like in video */}
        {stage >= 2 && (
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            <div className="absolute -top-20 -right-40 w-12 h-12 rounded-full bg-blue-300/30 blur-md animate-ping"></div>
            <div className="absolute top-40 -left-48 w-16 h-16 rounded-full bg-red-300/20 blur-lg animate-pulse"></div>
            <div className="absolute -bottom-20 left-20 w-8 h-8 rounded-full bg-green-300/30 blur-sm animate-bounce"></div>
            <div className="absolute bottom-40 right-40 w-10 h-10 rounded-full bg-yellow-300/20 blur-md animate-pulse [animation-delay:0.5s]"></div>
          </div>
        )}
      </div>

      {/* Screen Overlay for final transition */}
      <div className={`absolute inset-0 bg-[#02020a] transition-opacity duration-1000 pointer-events-none ${stage === 4 ? 'opacity-100' : 'opacity-0'}`}></div>
    </div>
  );
};

export default IntroSequence;