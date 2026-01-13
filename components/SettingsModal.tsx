import React, { useState } from 'react';
import { UserPreferences, PersonalityType, BackgroundStyle } from '../types';

interface Voice { id: string; name: string; tone: string; gender: string; }

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: UserPreferences;
  setPrefs: React.Dispatch<React.SetStateAction<UserPreferences>>;
  voices: Voice[];
  personalities: Record<PersonalityType, string>;
  isTV: boolean;
  isWearable: boolean;
  onPreviewVoice?: (voiceId: string) => void;
  previewingVoiceId?: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, prefs, setPrefs, voices, personalities, isTV, isWearable, onPreviewVoice, previewingVoiceId,
}) => {
  const [activeTab, setActiveTab] = useState<'IDENTITY' | 'VISUALS' | 'AUDIO' | 'SYSTEM'>('IDENTITY');
  if (!isOpen) return null;

  const FONTS: UserPreferences['fontFamily'][] = ['Inter', 'Outfit', 'Roboto Mono', 'Bebas Neue'];
  const BG_STYLES: BackgroundStyle[] = ['grid', 'aurora', 'noise', 'solid'];

  const tabClass = (tab: typeof activeTab) => `px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-gray-500 hover:text-white'}`;

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 lg:p-8 animate-fade-in">
      <div className="w-full max-w-5xl bg-[#02020a] border border-white/10 rounded-[3rem] lg:rounded-[4rem] relative flex flex-col h-[85vh] shadow-2xl overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between p-8 border-b border-white/5 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('IDENTITY')} className={tabClass('IDENTITY')}>Identity</button>
            <button onClick={() => setActiveTab('VISUALS')} className={tabClass('VISUALS')}>Visuals</button>
            <button onClick={() => setActiveTab('AUDIO')} className={tabClass('AUDIO')}>Audio Tuning</button>
            <button onClick={() => setActiveTab('SYSTEM')} className={tabClass('SYSTEM')}>Directives</button>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2"><i className="fas fa-times text-xl"></i></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-thin space-y-12">
          
          {activeTab === 'IDENTITY' && (
            <div className="space-y-10 animate-slide-up-reveal">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Assistant Name</label>
                  <input type="text" value={prefs.assistantName} onChange={(e) => setPrefs(p => ({ ...p, assistantName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-xl focus:border-[var(--theme-primary)] outline-none" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Assistant Profile (URL)</label>
                  <input type="text" value={prefs.assistantProfilePic || ''} onChange={(e) => setPrefs(p => ({ ...p, assistantProfilePic: e.target.value }))} placeholder="https://..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-sm focus:border-[var(--theme-primary)] outline-none" />
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Behavioral Archetype</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(Object.keys(personalities) as PersonalityType[]).map(p => (
                    <button key={p} onClick={() => setPrefs(pr => ({ ...pr, personality: p }))} className={`py-4 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${prefs.personality === p ? 'bg-[var(--theme-primary)]/10 border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-white/5 text-gray-700 hover:border-white/10'}`}>{p}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Session Init Greeting</label>
                <textarea value={prefs.greeting} onChange={(e) => setPrefs(p => ({ ...p, greeting: e.target.value }))} className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-6 text-sm font-bold focus:border-[var(--theme-primary)] outline-none resize-none" />
              </div>
            </div>
          )}

          {activeTab === 'VISUALS' && (
            <div className="space-y-12 animate-slide-up-reveal">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Primary Accent</label>
                    <div className="flex items-center gap-4">
                      <input type="color" value={prefs.primaryColor} onChange={(e) => setPrefs(p => ({ ...p, primaryColor: e.target.value, theme: 'custom' }))} className="w-16 h-16 rounded-2xl border-none bg-transparent cursor-pointer" />
                      <input type="text" value={prefs.primaryColor} onChange={(e) => setPrefs(p => ({ ...p, primaryColor: e.target.value, theme: 'custom' }))} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 font-mono text-xs uppercase" />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Glow Color</label>
                    <div className="flex items-center gap-4">
                      <input type="color" value={prefs.secondaryColor} onChange={(e) => setPrefs(p => ({ ...p, secondaryColor: e.target.value, theme: 'custom' }))} className="w-16 h-16 rounded-2xl border-none bg-transparent cursor-pointer" />
                      <input type="text" value={prefs.secondaryColor} onChange={(e) => setPrefs(p => ({ ...p, secondaryColor: e.target.value, theme: 'custom' }))} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 font-mono text-xs uppercase" />
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Shell Roundness</label>
                    <input type="range" min="0" max="80" step="2" value={parseInt(prefs.borderRadius)} onChange={(e) => setPrefs(p => ({ ...p, borderRadius: `${e.target.value}px` }))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[var(--theme-primary)]" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Interface Font</label>
                    <div className="grid grid-cols-2 gap-2">
                      {FONTS.map(f => (
                        <button key={f} onClick={() => setPrefs(p => ({ ...p, fontFamily: f }))} className={`py-3 rounded-xl border-2 text-[10px] font-black transition-all ${prefs.fontFamily === f ? 'bg-white text-black border-white' : 'border-white/5 text-gray-500'}`} style={{ fontFamily: f }}>{f}</button>
                      ))}
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Atmospheric Environment</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {BG_STYLES.map(s => (
                      <button key={s} onClick={() => setPrefs(p => ({ ...p, bgStyle: s }))} className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${prefs.bgStyle === s ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10' : 'border-white/5 bg-white/5'}`}>
                        <i className={`fas ${s === 'grid' ? 'fa-th' : s === 'aurora' ? 'fa-wind' : s === 'noise' ? 'fa-braille' : 'fa-stop'} text-lg`}></i>
                        <span className="text-[8px] font-black uppercase tracking-widest">{s}</span>
                      </button>
                    ))}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'AUDIO' && (
            <div className="space-y-12 animate-slide-up-reveal">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Vocal Selection</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {voices.map(v => (
                      <div key={v.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${prefs.voiceId === v.id ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10' : 'border-white/5 bg-white/5'}`}>
                        <button onClick={() => setPrefs(p => ({ ...p, voiceId: v.id }))} className="text-left flex-1">
                          <p className="text-xs font-black uppercase tracking-widest">{v.name}</p>
                          <p className="text-[8px] text-gray-600">{v.tone}</p>
                        </button>
                        <button onClick={() => onPreviewVoice?.(v.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${previewingVoiceId === v.id ? 'bg-[var(--theme-primary)] animate-pulse' : 'bg-white/5 text-gray-600 hover:text-white'}`}><i className={`fas ${previewingVoiceId === v.id ? 'fa-circle-notch fa-spin' : 'fa-play'} text-xs`}></i></button>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Cadence Speed: {prefs.speechSpeed}x</label>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={prefs.speechSpeed} onChange={(e) => setPrefs(p => ({ ...p, speechSpeed: parseFloat(e.target.value) }))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[var(--theme-primary)]" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Tonal Pitch: {prefs.speechPitch}x</label>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={prefs.speechPitch} onChange={(e) => setPrefs(p => ({ ...p, speechPitch: parseFloat(e.target.value) }))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[var(--theme-primary)]" />
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'SYSTEM' && (
            <div className="space-y-10 animate-slide-up-reveal">
               <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400 text-2xl"><i className="fas fa-microchip"></i></div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-widest">Identity Segment Privacy</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">All chat records, memories, and files are keyed to your username. No other user on this system can access your segment data.</p>
                  </div>
               </div>
               
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Direct Personality Matrix</label>
                  <textarea value={prefs.customPersonality} onChange={(e) => setPrefs(p => ({ ...p, customPersonality: e.target.value }))} placeholder="Provide specific behavior instructions..." className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-6 text-xs font-mono text-gray-400 focus:border-[var(--theme-primary)] outline-none resize-none" />
               </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-white/5 bg-black/40 text-center flex-shrink-0">
          <button onClick={onClose} className="w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-xs">Commit Neural Link Changes</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;