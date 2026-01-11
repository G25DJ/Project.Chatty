
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
          // Maintaining resolution for text legibility in screen share
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
    <div className="relative rounded-[2rem] overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)] bg-black animate-fade-in group">
      <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-contain bg-zinc-900" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 pointer-events-none border-[10px] border-cyan-500/5"></div>
      <div className="absolute top-4 left-4 bg-cyan-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
        Desktop Uplink
      </div>
      <div className="absolute bottom-4 right-4 text-[9px] text-cyan-400/50 font-mono bg-black/40 px-2 py-1 rounded">
        SYNC_STREAM // 1080p_MODIFIED
      </div>
    </div>
  );
};

export default ScreenShareMode;
