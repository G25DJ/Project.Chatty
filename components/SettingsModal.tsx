import React from 'react';
import { UserPreferences, PersonalityType } from '../types';

interface Voice {
  id: string;
  name: string;
  tone: string;
  gender: string;
}

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
  isOpen,
  onClose,
  prefs,
  setPrefs,
  voices,
  personalities,
  isTV,
  isWearable,
  onPreviewVoice,
  previewingVoiceId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 lg:p-8">
      <div className={`w-full ${isTV ? 'max-w-6xl p-20' : 'max-w-4xl p-12'} bg-[#02020a] border border-white/10 ${isTV ? 'rounded-[6rem]' : 'rounded-[4rem]'} relative overflow-y-auto max-h-[90vh] scrollbar-thin`}>
        <button onClick={onClose} className="absolute top-8 right-8 lg:top-12 lg:right-12 text-gray-700 hover:text-white text-2xl">
          <i className="fas fa-times"></i>
        </button>
        <h2 className={`${isTV ? 'text-6xl' : 'text-4xl'} font-black tracking-tighter uppercase mb-12`}>Configuration</h2>
        <div className={`grid grid-cols-1 ${isWearable ? '' : 'lg:grid-cols-2'} gap-8 lg:gap-12`}>
          <section className="space-y-8 lg:space-y-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Assistant Designation</label>
              <input 
                type="text" 
                value={prefs.assistantName} 
                onChange={(e) => setPrefs(p => ({ ...p, assistantName: e.target.value }))} 
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-xl" 
              />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-4">Chatty Profile</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {voices.map(v => (
                  <div 
                    key={v.id} 
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all group ${prefs.voiceId === v.id ? 'bg-blue-500/10 border-blue-500' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                  >
                    <button 
                      onClick={() => setPrefs(pr => ({ ...pr, voiceId: v.id }))} 
                      className="flex items-center gap-3 text-left flex-1"
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${v.gender === 'masculine' ? 'bg-blue-900/20 text-blue-500' : 'bg-emerald-900/20 text-emerald-500'}`}>
                        <i className={`fas ${v.gender === 'masculine' ? 'fa-mars' : 'fa-venus'} text-xs`}></i>
                      </div>
                      <div className="overflow-hidden">
                        <p className={`text-xs font-black uppercase tracking-widest truncate ${prefs.voiceId === v.id ? 'text-white' : 'text-gray-400'}`}>{v.name}</p>
                        <p className="text-[8px] text-gray-600 truncate">{v.tone}</p>
                      </div>
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onPreviewVoice?.(v.id); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${previewingVoiceId === v.id ? 'bg-blue-500 text-white animate-pulse' : 'bg-white/5 text-gray-600 hover:text-white hover:bg-white/10'}`}
                        title="Chatty Preview"
                      >
                        {previewingVoiceId === v.id ? (
                          <i className="fas fa-circle-notch fa-spin text-[10px]"></i>
                        ) : (
                          <i className="fas fa-volume-up text-[10px]"></i>
                        )}
                      </button>
                      {prefs.voiceId === v.id && <i className="fas fa-check-circle text-blue-500 text-xs"></i>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="space-y-8 lg:space-y-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Chatty Persona</label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(personalities) as PersonalityType[]).map(p => (
                  <button 
                    key={p} 
                    onClick={() => setPrefs(pr => ({ ...pr, personality: p }))} 
                    className={`py-4 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${prefs.personality === p ? `bg-blue-500/10 border-blue-500` : 'border-white/5 text-gray-700'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              
              {prefs.personality === 'custom' && (
                <div className="mt-6 animate-slide-up space-y-4">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Behavioral Directives</label>
                  <textarea 
                    value={prefs.customPersonality} 
                    onChange={(e) => setPrefs(p => ({ ...p, customPersonality: e.target.value }))}
                    placeholder="Instruct the assistant on how to think, act, and respond..."
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-blue-500/50 resize-none"
                  />
                </div>
              )}
            </div>
            {!isWearable && (
              <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-3xl">
                <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                  <i className="fas fa-shield-halved"></i> Security Node
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Optic and audio uplinks require explicit user activation to ensure privacy standards. Configuration changes propagate across the chatty segment instantly.
                </p>
              </div>
            )}
          </section>
        </div>
        <button 
          onClick={onClose} 
          className="mt-12 w-full py-6 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-[1.02] transition-transform"
        >
          Apply Chatty Configuration
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;