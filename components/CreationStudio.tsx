import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GeneratedAsset } from '../types';

interface CreationStudioProps {
  onClose: () => void;
  onAssetGenerated: (asset: GeneratedAsset) => void;
  themePrimary: string;
}

const CreationStudio: React.FC<CreationStudioProps> = ({ onClose, onAssetGenerated, themePrimary }) => {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [quality, setQuality] = useState<'flash' | 'pro'>('flash');

  const checkApiKey = async () => {
    const needsPro = quality === 'pro' || activeTab === 'video';
    if (needsPro && window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setStatusMessage('Initializing chatty link...');

    try {
      await checkApiKey();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      if (activeTab === 'image') {
        setStatusMessage('Synthesizing pixels...');
        const model = quality === 'flash' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
        const response = await ai.models.generateContent({
          model,
          contents: { parts: [{ text: prompt }] },
          config: { imageConfig: { aspectRatio: "1:1" } }
        });

        // Iterating through all parts as recommended in SDK guidelines
        let imageUrl = null;
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              break;
            }
          }
        }

        if (imageUrl) {
          onAssetGenerated({
            id: Math.random().toString(36).substr(2, 9),
            type: 'image',
            url: imageUrl,
            prompt,
            timestamp: new Date()
          });
        }
      } else {
        setStatusMessage('Compiling motion sequence...');
        let operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt,
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });

        while (!operation.done) {
          setStatusMessage(`Rendering sequence... [${new Date().toLocaleTimeString()}]`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
          const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
          const blob = await videoResponse.blob();
          const url = URL.createObjectURL(blob);
          onAssetGenerated({
            id: Math.random().toString(36).substr(2, 9),
            type: 'video',
            url,
            prompt,
            timestamp: new Date()
          });
        }
      }
    } catch (err: any) {
      console.error('Forge Error:', err);
      const errorMsg = err.message || JSON.stringify(err);
      
      if (errorMsg.includes("Requested entity was not found")) {
        setStatusMessage('Access restricted. Updating link...');
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
        }
      } else {
        setStatusMessage(`Forge Error: ${errorMsg}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-4xl bg-[#05050f] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col h-[80vh] shadow-2xl shadow-blue-500/5">
        <div className="flex items-center justify-between p-8 border-b border-white/5">
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('image')} 
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'image' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
              style={activeTab === 'image' ? { backgroundColor: themePrimary } : {}}
            >
              Visual Forge
            </button>
            <button 
              onClick={() => setActiveTab('video')} 
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'video' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Motion Engine
            </button>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><i className="fas fa-times text-xl"></i></button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-thin">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Forge Command</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={activeTab === 'image' ? "Envision the visual link..." : "Envision the motion..."}
              className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-medium focus:outline-none focus:border-[var(--theme-primary)]/50 resize-none transition-all"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              {activeTab === 'image' && (
                <div className="flex bg-white/5 rounded-xl p-1 w-fit">
                  <button 
                    onClick={() => setQuality('flash')} 
                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter ${quality === 'flash' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                  >
                    Draft
                  </button>
                  <button 
                    onClick={() => setQuality('pro')} 
                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-colors ${quality === 'pro' ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500'}`}
                    style={quality === 'pro' ? { color: themePrimary, backgroundColor: `${themePrimary}1A` } : {}}
                  >
                    High Fidelity
                  </button>
                </div>
              )}
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[8px] text-gray-500 hover:text-blue-400 font-black uppercase tracking-widest transition-colors"
              >
                <i className="fas fa-info-circle mr-1"></i> Billing & Quota info
              </a>
            </div>
            
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className={`px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 transition-all ${isGenerating ? 'bg-white/10 text-gray-500 cursor-not-allowed' : 'bg-white text-black hover:scale-105 active:scale-95 shadow-lg shadow-white/5'}`}
            >
              {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>}
              {isGenerating ? 'Synthesizing...' : 'Ignite Forge'}
            </button>
          </div>

          {isGenerating && (
            <div className="p-8 border border-white/5 bg-white/[0.02] rounded-[2rem] animate-pulse">
              <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: themePrimary }}>
                <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: themePrimary }}></div>
                {statusMessage}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-black/40 border-t border-white/5 text-center">
          <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.5em]">
            Powered by {activeTab === 'video' ? 'VEO 3.1' : quality === 'pro' ? 'Gemini 3 Pro' : 'Gemini 2.5 Flash'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreationStudio;