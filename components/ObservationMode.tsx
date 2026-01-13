import React, { useRef, useEffect, useState } from 'react';

interface ObservationModeProps {
  isActive: boolean;
  onFrame: (base64: string) => void;
}

const ObservationMode: React.FC<ObservationModeProps> = ({ isActive, onFrame }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLowLight, setIsLowLight] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: number | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        interval = window.setInterval(() => {
          if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx && video.readyState >= 2) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              
              if (isLowLight) {
                ctx.filter = 'brightness(1.8) contrast(1.2) saturate(0.7)';
              } else {
                ctx.filter = 'none';
              }
              
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              ctx.filter = 'none';
              
              const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
              onFrame(base64);
            }
          }
        }, 1000);
      } catch (err) {
        console.error("Camera access failed", err);
      }
    };

    if (isActive) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isActive, onFrame, isLowLight]);

  if (!isActive) return null;

  return (
    <div className="relative h-full w-full rounded-[2rem] overflow-hidden border border-white/20 shadow-2xl bg-black animate-fade-in group transition-all duration-500">
      {/* HUD Scan Line */}
      <div className="optic-scan-line"></div>
      
      {/* Video Feed */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className={`w-full h-full object-cover transition-all duration-700 ${isLowLight ? 'grayscale brightness-[1.4] contrast-[1.2] sepia-[.3] hue-rotate-[100deg]' : ''}`} 
      />
      
      {/* Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Scanning HUD Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Vignette & Grain */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
        
        {/* Tactical Corners */}
        <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-[var(--theme-primary)] opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all duration-500"></div>
        <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-[var(--theme-primary)] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-500"></div>
        <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-[var(--theme-primary)] opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 group-hover:translate-y-1 transition-all duration-500"></div>
        <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-[var(--theme-primary)] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 group-hover:translate-y-1 transition-all duration-500"></div>

        {/* Center Reticle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center opacity-20">
            <div className="w-1 h-1 bg-[var(--theme-primary)] rounded-full"></div>
            <div className="absolute w-8 h-[1px] bg-[var(--theme-primary)]"></div>
            <div className="absolute h-8 w-[1px] bg-[var(--theme-primary)]"></div>
        </div>
      </div>

      {/* Interface Elements */}
      <div className="absolute top-6 left-6 flex gap-3">
        <div className="bg-red-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse shadow-lg shadow-red-500/30 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-white"></div>
          Optic Active
        </div>
        {isLowLight && (
          <div className="bg-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pop shadow-lg shadow-emerald-500/30 backdrop-blur-md">
            <i className="fas fa-eye text-[8px]"></i>
            Lumen Boost
          </div>
        )}
      </div>

      <div className="absolute bottom-6 right-6 flex gap-2">
        <button 
          onClick={() => setIsLowLight(!isLowLight)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 backdrop-blur-xl ${isLowLight ? 'bg-emerald-500 text-white shadow-lg' : 'bg-black/40 text-white/70 hover:bg-black/60 border border-white/10'}`}
          title={isLowLight ? "Disable Dark Vision" : "Enable Dark Vision"}
        >
          <i className={`fas ${isLowLight ? 'fa-lightbulb' : 'fa-moon'}`}></i>
        </button>
      </div>

      <div className="absolute bottom-6 left-6 flex flex-col gap-1">
        <div className="flex items-center gap-3">
            <div className="w-1 h-12 bg-white/10 rounded-full overflow-hidden">
                <div className="w-full h-1/2 bg-[var(--theme-primary)] animate-pulse"></div>
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] text-white/40 font-black uppercase tracking-widest">Signal_Str</span>
                <span className="text-[11px] text-white/80 font-mono">CHTY_OPT_01</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ObservationMode;