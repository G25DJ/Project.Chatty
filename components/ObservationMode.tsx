import React, { useRef, useEffect, useState } from 'react';

interface ObservationModeProps {
  isActive: boolean;
  onFrame: (base64: string) => void;
}

const ObservationMode: React.FC<ObservationModeProps> = ({ isActive, onFrame }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLowLight, setIsLowLight] = useState(false);
  const [biometricSync, setBiometricSync] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: number | null = null;
    let bioInterval: number | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user', 
            width: { ideal: 640 }, 
            height: { ideal: 480 } 
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Dedicated capture loop - simple and robust
        interval = window.setInterval(() => {
          if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            // Wait for video to be actually playing with valid dimensions
            if (ctx && video.readyState >= 2 && video.videoWidth > 0) {
              const width = 640;
              const height = (video.videoHeight / video.videoWidth) * width;

              canvas.width = width;
              canvas.height = height;

              if (isLowLight) {
                ctx.filter = 'brightness(1.5) contrast(1.2) saturate(0.8) hue-rotate(120deg)';
              } else {
                ctx.filter = 'none';
              }

              ctx.drawImage(video, 0, 0, width, height);
              ctx.filter = 'none';

              const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
              onFrame(base64);
            }
          }
        }, 800);

        bioInterval = window.setInterval(() => {
          setBiometricSync(Math.floor(Math.random() * 100));
        }, 2000);
      } catch (err) { 
        console.error("Optic Hardware Error:", err); 
      }
    };

    if (isActive) {
      startCamera();
    }
    
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (interval) clearInterval(interval);
      if (bioInterval) clearInterval(bioInterval);
    };
  }, [isActive, isLowLight]); // Only restart on active state or filter change

  if (!isActive) return null;

  return (
    <div className="relative h-full w-full rounded-[var(--ui-radius)] overflow-hidden border border-red-500/20 shadow-2xl bg-black animate-fade-in group">
      {/* HUD Scan Line */}
      <div className="absolute left-0 right-0 h-1 bg-red-500/40 shadow-[0_0_15px_red] z-20 animate-scanline-pass pointer-events-none"></div>
      
      {/* Video Feed */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className={`w-full h-full object-cover transition-all duration-700 ${isLowLight ? 'grayscale brightness-[1.4]' : ''}`} 
      />
      
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Scanning HUD Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
        <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-red-500 opacity-40 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-red-500 opacity-40 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-red-500 opacity-40 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-red-500 opacity-40 group-hover:opacity-100 transition-all duration-500"></div>
      </div>

      {/* Interface Elements */}
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <div className="bg-red-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse shadow-lg backdrop-blur-md border border-red-400/30">
          <div className="w-2 h-2 rounded-full bg-white"></div>
          OPTIC_FEED_LIVE
        </div>
        <div className="bg-black/60 px-4 py-1.5 rounded-lg border border-red-500/10 text-[8px] font-mono text-red-400 uppercase tracking-widest">
           BIO_METRIC: {biometricSync}%
        </div>
      </div>

      <div className="absolute bottom-6 right-6 flex gap-2">
        <button 
          onClick={() => setIsLowLight(!isLowLight)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 backdrop-blur-xl ${isLowLight ? 'bg-emerald-500 text-white shadow-lg' : 'bg-black/40 text-white/70 hover:bg-black/60 border border-white/10'}`}
          title="Toggle Night Vision"
        >
          <i className={`fas ${isLowLight ? 'fa-eye' : 'fa-moon'} text-lg`}></i>
        </button>
      </div>
    </div>
  );
};

export default ObservationMode;
