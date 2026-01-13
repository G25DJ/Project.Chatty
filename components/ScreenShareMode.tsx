import React, { useRef, useEffect } from 'react';

interface ScreenShareModeProps {
  isActive: boolean;
  stream: MediaStream;
  onFrame: (base64: string) => void;
  onStop: () => void;
}

const ScreenShareMode: React.FC<ScreenShareModeProps> = ({ isActive, stream, onFrame, onStop }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive || !stream) return;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    const interval = window.setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.videoWidth > 0 && video.readyState >= 2) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          onFrame(base64);
        }
      }
    }, 1000); 

    return () => {
      clearInterval(interval);
    };
  }, [isActive, stream, onFrame]);

  if (!isActive) return null;

  return (
    <div className="relative h-full w-full rounded-[2rem] overflow-hidden border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] bg-black animate-fade-in group">
      {/* Video Feed */}
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-zinc-950" />
      
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* HUD Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Tech Frame */}
        <div className="absolute inset-0 border-[20px] border-white/5 opacity-50"></div>
        <div className="absolute inset-0 border border-cyan-500/10"></div>
        
        {/* Animated Corner Brackets */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-cyan-500/50"></div>
        <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-cyan-500/50"></div>
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-cyan-500/50"></div>
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-cyan-500/50"></div>
      </div>

      {/* Indicators */}
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <div className="bg-cyan-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-cyan-500/20 backdrop-blur-md border border-cyan-400/30">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          Desktop Uplink
        </div>
        <div className="bg-black/60 px-3 py-1 rounded-lg text-[8px] font-mono text-cyan-400/80 uppercase tracking-widest border border-cyan-500/20 backdrop-blur-sm">
            Packet_Flow: Synchronized
        </div>
      </div>

      {/* Simulated Data Readout */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-1 max-w-[200px] opacity-60">
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="w-[80%] h-full bg-cyan-500 animate-[grid-drift_2s_linear_infinite]"></div>
        </div>
        <div className="text-[7px] text-cyan-500/70 font-mono uppercase tracking-tighter">
            INTEGRITY_CHECK: 0x82FF_PASS
        </div>
      </div>

      <div className="absolute bottom-6 right-6 text-[9px] text-cyan-400/40 font-mono bg-black/60 px-3 py-1.5 rounded-xl border border-cyan-500/20 backdrop-blur-md">
        SYNC_STREAM // 1080p_INT
      </div>
    </div>
  );
};

export default ScreenShareMode;