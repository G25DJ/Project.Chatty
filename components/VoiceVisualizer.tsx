import React, { useRef, useEffect } from 'react';
import { AssistantState } from '../types';

interface VoiceVisualizerProps {
  state: AssistantState;
  analyser?: AnalyserNode;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ state, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyser?.frequencyBinCount || 128;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;
      
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      const barCount = 40;
      const barWidth = width / barCount;
      const gap = 4;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;
        
        if (state === AssistantState.LISTENING || state === AssistantState.SPEAKING) {
           const dataIndex = Math.floor((i / barCount) * bufferLength);
           barHeight = (dataArray[dataIndex] / 255) * (height / 1.5) + 4;
        } else if (state === AssistantState.CONNECTING) {
           barHeight = Math.sin(Date.now() / 200 + i * 0.5) * 15 + 20;
        }

        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        if (state === AssistantState.SPEAKING) {
          gradient.addColorStop(0, '#60a5fa');
          gradient.addColorStop(1, '#a855f7');
        } else if (state === AssistantState.LISTENING) {
          gradient.addColorStop(0, '#34d399');
          gradient.addColorStop(1, '#60a5fa');
        } else {
          gradient.addColorStop(0, '#94a3b8');
          gradient.addColorStop(1, '#cbd5e1');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        // Fallback for older browsers if roundRect is missing
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 4);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [state, analyser]);

  return (
    <div className="w-full h-32 flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={100} 
        className="w-full max-w-md h-full"
      />
    </div>
  );
};

export default VoiceVisualizer;