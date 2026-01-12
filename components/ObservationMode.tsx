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
              
              // Apply lighting adjustments for the assistant's frame
              if (isLowLight) {
                // Boost brightness and contrast for the model to see better in dark rooms
                ctx.filter = 'brightness(1.8) contrast(1.2) saturate(0.7)';
              } else {
                ctx.filter = 'none';
              }
              
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Reset filter for next draw or other canvas uses
              ctx.filter = 'none';
              
              const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
              onFrame(base64);
            }
          }
        }, 1000); // 1 FPS for efficiency
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
    <div className="relative rounded-[2rem] overflow-hidden border border-white/20 shadow-2xl bg-black animate-fade-in group transition-all duration-500">
      {/* Video Feed with optional post-processing for user preview */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className={`w-full aspect-video object-cover transition-all duration-700 ${isLowLight ? 'brightness-[1.3] contrast-[1.1] hue-rotate-[-10deg]' : ''}`} 
      />
      
      {/* Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Scanning/Chatty Aesthetic Overlay */}
      <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"></div>
      
      {/* Low Light Overlay */}
      {isLowLight && (
        <div className="absolute inset-0 pointer-events-none bg-emerald-500/5 animate-pulse mix-blend-overlay"></div>
      )}

      {/* Interface Elements */}
      <div className="absolute top-4 left-4 flex gap-2">
        <div className="bg-red-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse shadow-lg shadow-red-500/20">
          <div className="w-2 h-2 rounded-full bg-white"></div>
          Live Optics
        </div>
        {isLowLight && (
          <div className="bg-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fade-in shadow-lg shadow-emerald-500/20">
            <i className="fas fa-moon text-[8px]"></i>
            Lumen Boost
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 flex gap-2">
        <button 
          onClick={() => setIsLowLight(!isLowLight)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isLowLight ? 'bg-emerald-500 text-white shadow-lg' : 'bg-black/40 text-white/70 hover:bg-black/60 border border-white/10'}`}
          title={isLowLight ? "Disable Lumen Boost" : "Enable Dark Room Enhancement"}
        >
          <i className={`fas ${isLowLight ? 'fa-lightbulb' : 'fa-moon'}`}></i>
        </button>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <div className="text-[8px] text-white/50 font-mono tracking-tighter bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
          SENS_LEVEL: {isLowLight ? 'BOOSTED_EXT' : 'NOMINAL'}
        </div>
        <div className="text-[10px] text-white/50 font-mono tracking-widest">
          OPTIC_FEED_01 // GRND_ACTV
        </div>
      </div>

      <div className="absolute bottom-4 right-4 w-12 h-12 border-b border-r border-white/20 rounded-br-lg pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
      <div className="absolute top-4 left-4 w-12 h-12 border-t border-l border-white/20 rounded-tl-lg pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
    </div>
  );
};

export default ObservationMode;