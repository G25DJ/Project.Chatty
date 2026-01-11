import React, { useRef, useEffect } from 'react';
import { AssistantState } from '../types';

interface VoiceVisualizerProps {
  state: AssistantState;
  analyser?: AnalyserNode;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ state, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle initial size and resizing
    const updateSize = () => {
      canvas.width = container.clientWidth * window.devicePixelRatio;
      canvas.height = container.clientHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    let animationId: number;
    const bufferLength = analyser?.frequencyBinCount || 128;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, width, height);
      
      const centerY = height / 2;
      
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      // Responsive bar counts
      const barCount = width < 200 ? 20 : width < 400 ? 40 : 60;
      const gap = width < 300 ? 2 : 4;
      const barWidth = (width - (barCount - 1) * gap) / barCount;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;
        
        if (state === AssistantState.LISTENING || state === AssistantState.SPEAKING) {
           const dataIndex = Math.floor((i / barCount) * bufferLength);
           barHeight = (dataArray[dataIndex] / 255) * (height / 1.5) + 4;
        } else if (state === AssistantState.CONNECTING) {
           barHeight = Math.sin(Date.now() / 200 + i * 0.5) * (height / 6) + (height / 5);
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
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [state, analyser]);

  return (
    <div ref={containerRef} className="w-full h-24 lg:h-32 flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
      />
    </div>
  );
};

export default VoiceVisualizer;