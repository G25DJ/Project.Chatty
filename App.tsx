
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { AssistantState, TranscriptionEntry, MemoryEntry, GroundingSource, AuthUser, UITheme, PersonalityType, UserPreferences, DeviceType, SensorData } from './types';
import * as audioUtils from './services/audioUtils';
import VoiceVisualizer from './components/VoiceVisualizer';
import MemoryBank from './components/MemoryBank';
import LoginPage from './components/LoginPage';
import ObservationMode from './components/ObservationMode';
import ScreenShareMode from './components/ScreenShareMode';
import HardwareSensors from './components/HardwareSensors';
import GroundingSources from './components/GroundingSources';

const VOICES = [
  { id: 'Charon', name: 'Charon', tone: 'Deep, Bass, Authoritative', gender: 'masculine' },
  { id: 'Puck', name: 'Puck', tone: 'Energetic, Bright, Playful', gender: 'masculine' },
  { id: 'Fenrir', name: 'Fenrir', tone: 'Vibrant, Sharp, Focused', gender: 'masculine' },
  { id: 'Kore', name: 'Kore', tone: 'Clear, Professional, Calm', gender: 'feminine' },
  { id: 'Zephyr', name: 'Zephyr', tone: 'Warm, Smooth, Melodic', gender: 'feminine' }
];

const THEMES: Record<UITheme, { primary: string; secondary: string; glow: string; bg: string }> = {
  cosmic: { primary: 'blue-500', secondary: 'indigo-500', glow: 'rgba(59,130,246,0.5)', bg: '#02020a' },
  emerald: { primary: 'emerald-500', secondary: 'teal-500', glow: 'rgba(16,185,129,0.5)', bg: '#020a05' },
  ruby: { primary: 'rose-500', secondary: 'orange-500', glow: 'rgba(244,63,94,0.5)', bg: '#0a0202' },
  obsidian: { primary: 'slate-400', secondary: 'zinc-500', glow: 'rgba(148,163,184,0.5)', bg: '#0a0a0a' }
};

const PERSONALITIES: Record<PersonalityType, string> = {
  professional: 'Be highly professional, concise, and logical. Use technical terminology when appropriate.',
  friendly: 'Be warm, supportive, and enthusiastic. Use a casual but respectful tone.',
  witty: 'Be clever, slightly sarcastic, and humorous. Keep the user entertained while being helpful.',
  minimalist: 'Respond with the absolute minimum number of words necessary. No fluff.',
  alluring: 'Be mysterious, suggestive, and highly flirtatious. Push the boundaries of a typical assistant relationship with playful banter and charm while remaining helpful.',
  custom: ''
};

const saveKnowledgeTool: FunctionDeclaration = {
  name: 'save_knowledge',
  parameters: {
    type: Type.OBJECT,
    description: 'Save a specific fact or preference for long-term memory.',
    properties: {
      fact: { type: Type.STRING, description: 'The specific fact (e.g., "The user works as a pilot").' },
    },
    required: ['fact'],
  },
};

const DEFAULT_PREFS: UserPreferences = {
  theme: 'cosmic',
  personality: 'friendly',
  layout: 'right',
  voiceId: VOICES[0].id,
  assistantName: 'Project Chatty',
  customPersonality: 'You are a highly capable AI assistant.'
};

const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [state, setState] = useState<AssistantState>(AssistantState.IDLE);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [isScanning, setIsScanning] = useState(true);
  const [sensorData, setSensorData] = useState<SensorData>({ online: navigator.onLine, platform: navigator.platform });
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [streamingUserText, setStreamingUserText] = useState('');
  const [streamingAssistantText, setStreamingAssistantText] = useState('');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVisionActive, setIsVisionActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const currentFrameRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const detectHardware = useCallback(async () => {
    try {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ua = navigator.userAgent.toLowerCase();
      
      let detectedDevice: DeviceType = 'desktop';
      if (w <= 300 || (ua.includes('watch') && !ua.includes('tv'))) {
        detectedDevice = 'wear';
      } else if (ua.includes('android') && w > h && w >= 800 && w <= 1280) {
        detectedDevice = 'auto';
      } else if (ua.includes('tv') || ua.includes('smarttv') || (w >= 1920 && h >= 1080)) {
        detectedDevice = 'tv';
      } else if (w < 768 || (w < 1024 && h > w)) {
        detectedDevice = 'mobile';
      }
      setDevice(detectedDevice);

      const sensorPayload: SensorData = { online: navigator.onLine, platform: navigator.platform };
      
      if (navigator && 'getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          sensorPayload.battery = battery.level;
          sensorPayload.charging = battery.charging;
        } catch (e) {
          console.warn("Battery API inaccessible");
        }
      }

      if (navigator.geolocation && ['auto', 'mobile', 'desktop'].includes(detectedDevice)) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setSensorData(prev => ({ ...prev, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } })),
          (err) => console.warn("GPS locked", err.message),
          { enableHighAccuracy: false, timeout: 5000 }
        );
      }
      setSensorData(prev => ({ ...prev, ...sensorPayload }));
    } catch (err) {
      console.error("Hardware probe failure", err);
    } finally {
      setTimeout(() => setIsScanning(false), 2000);
    }
  }, []);

  useEffect(() => {
    detectHardware();
    window.addEventListener('resize', detectHardware);
    return () => window.removeEventListener('resize', detectHardware);
  }, [detectHardware]);

  useEffect(() => {
    const sessionUser = sessionStorage.getItem('nova_session_user');
    if (sessionUser) {
      try {
        const savedPrefs = localStorage.getItem(`nova_${sessionUser}_prefs`);
        if (savedPrefs) {
          setUser({ username: sessionUser, preferences: JSON.parse(savedPrefs) });
        } else {
          setUser({ username: sessionUser, preferences: DEFAULT_PREFS });
        }
      } catch (e) {
        setUser({ username: sessionUser, preferences: DEFAULT_PREFS });
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      setPrefs(user.preferences);
      setMemories(JSON.parse(localStorage.getItem(`nova_${user.username}_memories`) || '[]'));
      setTranscriptions(JSON.parse(localStorage.getItem(`nova_${user.username}_logs`) || '[]'));
      sessionStorage.setItem('nova_session_user', user.username);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`nova_${user.username}_prefs`, JSON.stringify(prefs));
      localStorage.setItem(`nova_${user.username}_memories`, JSON.stringify(memories));
      localStorage.setItem(`nova_${user.username}_logs`, JSON.stringify(transcriptions));
    }
  }, [prefs, memories, transcriptions, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcriptions, streamingUserText, streamingAssistantText]);

  const themeData = useMemo(() => THEMES[prefs.theme] || THEMES.cosmic, [prefs.theme]);
  const isMobile = useMemo(() => device === 'mobile' || device === 'wear', [device]);

  const addTranscription = useCallback((sender: 'user' | 'assistant', text: string, sources?: GroundingSource[]) => {
    if (!text.trim()) return;
    setTranscriptions(prev => [
      ...prev, { id: Math.random().toString(36).substr(2, 9), sender, text, timestamp: new Date(), sources }
    ]);
  }, []);

  const stopSession = useCallback(() => {
    if (sessionRef.current) { try { sessionRef.current.close?.(); } catch(e){} sessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    if (scriptProcessorRef.current) { scriptProcessorRef.current.disconnect(); scriptProcessorRef.current = null; }
    if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); setScreenStream(null); }
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setState(AssistantState.IDLE);
    setIsVisionActive(false);
    setIsScreenSharing(false);
    setStreamingUserText('');
    setStreamingAssistantText('');
  }, [screenStream]);

  const handleLogout = useCallback(() => {
    stopSession();
    setUser(null);
    sessionStorage.removeItem('nova_session_user');
  }, [stopSession]);

  const handleLogin = (username: string, initialPrefs?: Partial<UserPreferences>) => {
    const finalPrefs = { ...DEFAULT_PREFS, ...initialPrefs };
    setUser({ username, preferences: finalPrefs });
  };

  const startSession = async (initialText?: string) => {
    try {
      setState(AssistantState.CONNECTING);
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Authentication failure: Key is not provided.");

      if (!audioContextRef.current) {
        audioContextRef.current = {
          input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
          output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
        };
      }
      const { input: inputCtx, output: outputCtx } = audioContextRef.current;
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      audioUtils.playLinkSound(outputCtx);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => {
        throw new Error("Microphone link blocked by security protocols.");
      });
      micStreamRef.current = stream;
      const source = inputCtx.createMediaStreamSource(stream);
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      // Fixed: Initialize GoogleGenAI instance right before making an API call
      const ai = new GoogleGenAI({ apiKey });
      const personalityPrompt = prefs.personality === 'custom' ? (prefs.customPersonality || 'Be helpful.') : PERSONALITIES[prefs.personality];
      
      const tools: any[] = [];
      // Fixed: Enforce Search/Maps/Function Calling rules. Search can only be used alone or with Maps.
      if (sensorData.location) {
        tools.push({ googleMaps: {} });
        if (searchEnabled) tools.push({ googleSearch: {} });
      } else {
        // If search is enabled, we cannot use function declarations per guideline: "googleSearch ... Do not use it with other tools."
        if (searchEnabled) {
          tools.push({ googleSearch: {} });
        } else {
          tools.push({ functionDeclarations: [saveKnowledgeTool] });
        }
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools,
          toolConfig: sensorData.location ? {
            retrievalConfig: {
              latLng: {
                latitude: sensorData.location.lat,
                longitude: sensorData.location.lng,
              }
            }
          } : undefined,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: prefs.voiceId } } },
          systemInstruction: `Identity: ${prefs.assistantName}. Platform: ${device}. Personality: ${personalityPrompt}.`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          thinkingConfig: { thinkingBudget: 24576 }
        },
        callbacks: {
          onopen: () => {
            setState(AssistantState.LISTENING);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = audioUtils.createPcmBlob(inputData);
              // Fixed: Ensure sendRealtimeInput is called only after the session promise resolves
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
              if (currentFrameRef.current) {
                const frame = currentFrameRef.current;
                currentFrameRef.current = null;
                sessionPromise.then(s => s.sendRealtimeInput({ media: { data: frame, mimeType: 'image/jpeg' } }));
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            if (initialText) sessionPromise.then(s => s.sendRealtimeInput({ text: initialText }));
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'save_knowledge') {
                  const factStr = (fc.args as any).fact;
                  setMemories(p => [...p, { id: Math.random().toString(36).substr(2, 9), fact: factStr, timestamp: new Date() }]);
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "Saved." } } }));
                }
              }
            }
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setState(AssistantState.SPEAKING);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await audioUtils.decodeAudioData(audioUtils.decode(base64Audio), outputCtx, 24000, 1);
              const s = outputCtx.createBufferSource(); 
              s.buffer = buffer; s.connect(outputCtx.destination);
              s.onended = () => { activeSourcesRef.current.delete(s); if (activeSourcesRef.current.size === 0) setState(AssistantState.LISTENING); };
              s.start(nextStartTimeRef.current); nextStartTimeRef.current += buffer.duration; 
              activeSourcesRef.current.add(s);
            }
            if (message.serverContent?.inputTranscription) setStreamingUserText(prev => prev + message.serverContent!.inputTranscription!.text);
            if (message.serverContent?.outputTranscription) setStreamingAssistantText(prev => prev + message.serverContent!.outputTranscription!.text);
            if (message.serverContent?.turnComplete) {
              // Fixed: Always extract website and map URLs from grounding chunks as required
              const chunks = message.serverContent?.groundingMetadata?.groundingChunks || [];
              const sources: GroundingSource[] = chunks.map((c: any) => {
                if (c.web) return { title: c.web.title, uri: c.web.uri };
                if (c.maps) return { title: c.maps.title, uri: c.maps.uri };
                return null;
              }).filter(Boolean) as GroundingSource[];

              setStreamingUserText(u => { if (u) addTranscription('user', u); return ''; });
              setStreamingAssistantText(a => { if (a) { addTranscription('assistant', a, sources); audioUtils.playSuccessSound(outputCtx); } return ''; });
            }
          },
          onerror: (err: any) => {
            const errorMsg = err.message || JSON.stringify(err);
            if (errorMsg.includes("Requested entity was not found")) {
               setErrorToast("Conversational model not found.");
               // Fixed: Prompt user to select key again on entity 404 error
               if (window.aistudio) window.aistudio.openSelectKey();
            }
            stopSession();
          },
          onclose: () => stopSession()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { 
      const errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.includes("Requested entity was not found")) {
        if (window.aistudio) await window.aistudio.openSelectKey();
      }
      setErrorToast(errorMsg);
      setState(AssistantState.IDLE); 
      setTimeout(() => setErrorToast(null), 5000);
    }
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); setScreenStream(null); }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true }).catch((err) => {
          if (err.name === 'NotAllowedError') throw new Error("Screen capture authorization denied.");
          throw err;
        });
        setScreenStream(stream);
        setIsVisionActive(false);
        setIsScreenSharing(true);
        if (state === AssistantState.IDLE) startSession();
        stream.getVideoTracks()[0].onended = () => { setIsScreenSharing(false); setScreenStream(null); };
      } catch (err: any) {
        setErrorToast(err.message);
        setTimeout(() => setErrorToast(null), 4000);
      }
    }
  };

  const handleToggleVision = async () => {
    if (isVisionActive) {
      setIsVisionActive(false);
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setIsScreenSharing(false);
        setIsVisionActive(true);
        if (state === AssistantState.IDLE) startSession();
      } catch (err: any) {
        setErrorToast("Primary optic access denied.");
        setTimeout(() => setErrorToast(null), 4000);
      }
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    const msg = inputText.trim();
    setInputText('');
    addTranscription('user', msg);
    if (sessionRef.current) {
      setState(AssistantState.THINKING);
      sessionRef.current.sendRealtimeInput({ text: msg });
    } else {
      startSession(msg);
    }
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  if (isScanning) {
    return (
      <div className="fixed inset-0 bg-[#02020a] flex flex-col items-center justify-center z-[200] animate-fade-in overflow-hidden">
        <div className="absolute inset-0 animate-scan bg-gradient-to-b from-transparent via-blue-500/10 to-transparent pointer-events-none opacity-20"></div>
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className={`absolute inset-0 border-4 border-t-${themeData.primary} border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin opacity-40`}></div>
          <i className="fas fa-microchip text-4xl text-white/20 animate-pulse"></i>
        </div>
        <h2 className="mt-12 text-xl font-black tracking-[0.5em] uppercase text-white mb-2 text-center">Synchronizing Neural Core</h2>
        <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest animate-pulse">Establishing secure link...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full transition-colors duration-1000 overflow-hidden" style={{ backgroundColor: themeData.bg }}>
      {errorToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl animate-slide-up flex items-center gap-4">
          <i className="fas fa-exclamation-triangle"></i>
          {errorToast}
          <button onClick={() => setErrorToast(null)} className="ml-4 opacity-50 hover:opacity-100"><i className="fas fa-times"></i></button>
        </div>
      )}

      <header className="px-6 py-4 lg:px-12 lg:py-8 flex items-center justify-between z-50 glass m-4 rounded-[2rem]">
        <div className="flex items-center gap-4 lg:gap-8">
          <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-[2rem] overflow-hidden border border-white/10 relative">
            {prefs.assistantProfilePic ? <img src={prefs.assistantProfilePic} className="w-full h-full object-cover" alt="AI" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center"><i className="fas fa-atom text-white"></i></div>}
          </div>
          <div>
            <h1 className="text-xl lg:text-3xl font-black tracking-tighter text-white">{prefs.assistantName}</h1>
            <HardwareSensors data={sensorData} deviceType={device} themeColor={themeData.primary} />
          </div>
        </div>
        <div className="flex items-center gap-4">
           {!isMobile && (
             <>
               <button onClick={() => setIsSettingsOpen(true)} title="Settings" className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"><i className="fas fa-cog"></i></button>
             </>
           )}
           <button onClick={() => setIsMemoryOpen(!isMemoryOpen)} title="Memory Bank" className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isMemoryOpen ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400'}`}><i className="fas fa-brain"></i></button>
           <button onClick={handleLogout} className="text-gray-600 hover:text-white px-4"><i className="fas fa-sign-out-alt"></i></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row min-h-0 p-4 lg:p-12 gap-8 overflow-hidden">
        <div className="flex-1 flex flex-col gap-8 min-h-0">
          {(isVisionActive || isScreenSharing) && (
            <div className="h-64 md:h-80 w-full animate-slide-up flex-shrink-0">
              {isVisionActive && <ObservationMode isActive={isVisionActive} onFrame={(b) => currentFrameRef.current = b} />}
              {isScreenSharing && screenStream && <ScreenShareMode isActive={isScreenSharing} stream={screenStream} onFrame={(b) => currentFrameRef.current = b} onStop={() => setIsScreenSharing(false)} />}
            </div>
          )}

          <div className="flex-1 flex flex-col glass rounded-[3rem] overflow-hidden relative min-h-0">
            <div className="flex-1 p-6 lg:p-12 overflow-y-auto space-y-6 scrollbar-thin" ref={scrollRef}>
              {transcriptions.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                  <i className="fas fa-atom text-9xl mb-8"></i>
                  <p className="text-2xl font-black uppercase tracking-[1em]">Listening</p>
                </div>
              )}
              
              {transcriptions.map(e => (
                <div key={e.id} className={`flex flex-col ${e.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] px-6 py-4 rounded-[2rem] ${e.sender === 'user' ? `bg-${themeData.primary} text-white` : 'bg-white/5 text-gray-300'}`}>
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{e.text}</p>
                    {e.sources && <GroundingSources sources={e.sources} themePrimary={themeData.primary} />}
                  </div>
                  <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest mt-2 mx-4">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
              {streamingAssistantText && (
                <div className="items-start flex flex-col">
                  <div className="max-w-[85%] px-6 py-4 rounded-[2rem] bg-white/5 text-white/50 animate-pulse font-mono text-xs">
                    {streamingAssistantText}
                  </div>
                </div>
              )}
              {state === AssistantState.THINKING && (
                <div className="flex items-center gap-2 text-[10px] text-blue-400 font-black uppercase tracking-widest px-6">
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Processing Logic...
                </div>
              )}
            </div>

            <div className="p-6 lg:p-10 border-t border-white/5 bg-black/40">
              <VoiceVisualizer state={state} analyser={analyserRef.current || undefined} />
              <div className="mt-6 flex gap-4">
                  <button onClick={handleToggleVision} title="Toggle Optics" className={`w-12 h-12 rounded-xl flex items-center justify-center ${isVisionActive ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}><i className="fas fa-camera"></i></button>
                  <button onClick={handleToggleScreenShare} title="Toggle Desktop Link" className={`w-12 h-12 rounded-xl flex items-center justify-center ${isScreenSharing ? 'bg-cyan-500 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}><i className="fas fa-desktop"></i></button>
                  <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendText()} placeholder={`Neural command...`} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500/40 text-white font-bold" />
                  <button onClick={state === AssistantState.IDLE ? () => startSession() : stopSession} className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${state === AssistantState.IDLE ? 'bg-white text-black hover:scale-105' : 'bg-red-500 text-white animate-pulse'}`}><i className={`fas ${state === AssistantState.IDLE ? 'fa-microphone' : 'fa-square'}`}></i></button>
              </div>
            </div>
          </div>
        </div>
        {isMemoryOpen && <div className="w-full md:w-[360px] flex-shrink-0 h-full"><MemoryBank memories={memories} onRemove={(id) => setMemories(p => p.filter(m => m.id !== id))} assistantName={prefs.assistantName} /></div>}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-8">
          <div className="w-full max-w-4xl bg-[#02020a] border border-white/10 rounded-[4rem] p-12 relative overflow-y-auto max-h-[90vh] scrollbar-thin">
             <button onClick={() => setIsSettingsOpen(false)} className="absolute top-12 right-12 text-gray-700 hover:text-white text-2xl"><i className="fas fa-times"></i></button>
             <h2 className="text-4xl font-black tracking-tighter uppercase mb-12">Configuration</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <section className="space-y-12">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Assistant Designation</label>
                      <input type="text" value={prefs.assistantName} onChange={(e) => setPrefs(p => ({ ...p, assistantName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-xl" />
                   </div>
                   <div className="space-y-8">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-4">Neural Profile</label>
                      <div className="grid grid-cols-1 gap-3">
                         {VOICES.map(v => (
                           <button key={v.id} onClick={() => setPrefs(pr => ({ ...pr, voiceId: v.id }))} className={`flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all group ${prefs.voiceId === v.id ? 'bg-blue-500/10 border-blue-500' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                             <div className="flex items-center gap-4 text-left">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${v.gender === 'masculine' ? 'bg-blue-900/20 text-blue-500' : 'bg-emerald-900/20 text-emerald-500'}`}><i className={`fas ${v.gender === 'masculine' ? 'fa-mars' : 'fa-venus'}`}></i></div>
                               <div><p className={`text-sm font-black uppercase tracking-widest ${prefs.voiceId === v.id ? 'text-white' : 'text-gray-400'}`}>{v.name}</p></div>
                             </div>
                             {prefs.voiceId === v.id && <i className="fas fa-check-circle text-blue-500"></i>}
                           </button>
                         ))}
                      </div>
                   </div>
                </section>
                <section className="space-y-12">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Neural Persona</label>
                      <div className="grid grid-cols-2 gap-3">
                         {(Object.keys(PERSONALITIES) as PersonalityType[]).map(p => (
                           <button key={p} onClick={() => setPrefs(pr => ({ ...pr, personality: p }))} className={`py-4 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${prefs.personality === p ? `bg-blue-500/10 border-blue-500` : 'border-white/5 text-gray-700'}`}>{p}</button>
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
                   <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-3xl">
                      <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2"><i className="fas fa-shield-halved"></i> Security Node</p>
                      <p className="text-xs text-gray-500 leading-relaxed">Optic and audio uplinks require explicit user activation to ensure privacy standards. Configuration changes propagate across the neural segment instantly.</p>
                   </div>
                </section>
             </div>
             <button onClick={() => setIsSettingsOpen(false)} className="mt-12 w-full py-6 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-[1.02] transition-transform">Apply Neural Configuration</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
