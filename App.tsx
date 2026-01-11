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
import SettingsModal from './components/SettingsModal';

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
      if (w <= 240 || (ua.includes('watch') && !ua.includes('tv'))) {
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

  // UI Adaptive Constants
  const isWearable = device === 'wear';
  const isAuto = device === 'auto';
  const isTV = device === 'tv';
  const isMobile = device === 'mobile';

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

  /**
   * Software downsampler to convert from hardware rate (e.g. 48kHz) to API required 16kHz
   */
  const downsample = (buffer: Float32Array, fromRate: number, toRate: number) => {
    if (fromRate === toRate) return buffer;
    const sampleRateRatio = fromRate / toRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      let nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const startSession = async (initialText?: string) => {
    try {
      setState(AssistantState.CONNECTING);
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Authentication failure: Key is not provided.");

      // CRITICAL: We remove forced sample rates here to satisfy browser hardware constraints (especially Firefox)
      if (!audioContextRef.current) {
        audioContextRef.current = {
          input: new (window.AudioContext || (window as any).webkitAudioContext)(),
          output: new (window.AudioContext || (window as any).webkitAudioContext)()
        };
      }
      const { input: inputCtx, output: outputCtx } = audioContextRef.current;
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      audioUtils.playLinkSound(outputCtx);

      // Request hardware stream matching the context rate or 16k hint
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: 16000, // Hint for browsers that support it
          channelCount: 1
        } 
      }).catch((e) => {
        throw new Error("Microphone link blocked: " + e.message);
      });
      micStreamRef.current = stream;
      
      const source = inputCtx.createMediaStreamSource(stream);
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const ai = new GoogleGenAI({ apiKey });
      const personalityPrompt = prefs.personality === 'custom' ? (prefs.customPersonality || 'Be helpful.') : PERSONALITIES[prefs.personality];
      
      const tools: any[] = [];
      if (sensorData.location) {
        tools.push({ googleMaps: {} });
        if (searchEnabled) tools.push({ googleSearch: {} });
      } else {
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
              // CRITICAL: Manually downsample to 16kHz before sending to Gemini
              const resampledData = downsample(inputData, inputCtx.sampleRate, 16000);
              const pcmBlob = audioUtils.createPcmBlob(resampledData);
              
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
              // Model typically returns 24kHz audio
              const buffer = await audioUtils.decodeAudioData(audioUtils.decode(base64Audio), outputCtx, 24000, 1);
              const s = outputCtx.createBufferSource(); 
              s.buffer = buffer; 
              s.connect(outputCtx.destination);
              s.onended = () => { activeSourcesRef.current.delete(s); if (activeSourcesRef.current.size === 0) setState(AssistantState.LISTENING); };
              s.start(nextStartTimeRef.current); 
              nextStartTimeRef.current += buffer.duration; 
              activeSourcesRef.current.add(s);
            }
            if (message.serverContent?.inputTranscription) setStreamingUserText(prev => prev + message.serverContent!.inputTranscription!.text);
            if (message.serverContent?.outputTranscription) setStreamingAssistantText(prev => prev + message.serverContent!.outputTranscription!.text);
            if (message.serverContent?.turnComplete) {
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
        <div className="relative w-48 h-48 lg:w-64 lg:h-64 flex items-center justify-center">
          <div className={`absolute inset-0 border-4 border-t-${themeData.primary} border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin opacity-40`}></div>
          <i className="fas fa-microchip text-4xl text-white/20 animate-pulse"></i>
        </div>
        <h2 className="mt-8 lg:mt-12 text-lg lg:text-xl font-black tracking-[0.5em] uppercase text-white mb-2 text-center">Synchronizing Neural Core</h2>
        <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest animate-pulse">Establishing secure link...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full w-full transition-colors duration-1000 overflow-hidden ${isTV ? 'text-lg' : isWearable ? 'text-[10px]' : 'text-base'}`} style={{ backgroundColor: themeData.bg }}>
      {errorToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl animate-slide-up flex items-center gap-4">
          <i className="fas fa-exclamation-triangle"></i>
          {errorToast}
          <button onClick={() => setErrorToast(null)} className="ml-4 opacity-50 hover:opacity-100"><i className="fas fa-times"></i></button>
        </div>
      )}

      {/* Adaptive Header */}
      {!isWearable && (
        <header className={`${isAuto ? 'px-10 py-6 m-2 rounded-3xl' : isTV ? 'px-20 py-12 m-8 rounded-[4rem]' : 'px-6 py-4 lg:px-12 lg:py-8 m-4 rounded-[2rem]'} flex items-center justify-between z-50 glass`}>
          <div className="flex items-center gap-4 lg:gap-8">
            <div className={`${isTV ? 'w-24 h-24 rounded-[3rem]' : 'w-12 h-12 lg:w-16 lg:h-16 rounded-[2rem]'} overflow-hidden border border-white/10 relative`}>
              {prefs.assistantProfilePic ? <img src={prefs.assistantProfilePic} className="w-full h-full object-cover" alt="AI" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center"><i className="fas fa-atom text-white"></i></div>}
            </div>
            {!isMobile && (
              <div>
                <h1 className={`${isTV ? 'text-5xl' : isAuto ? 'text-2xl' : 'text-xl lg:text-3xl'} font-black tracking-tighter text-white`}>{prefs.assistantName}</h1>
                <HardwareSensors data={sensorData} deviceType={device} themeColor={themeData.primary} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
             {!isMobile && (
               <button onClick={() => setIsSettingsOpen(true)} title="Settings" className={`${isTV ? 'w-20 h-20' : 'w-12 h-12'} rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all`}><i className="fas fa-cog"></i></button>
             )}
             <button onClick={() => setIsMemoryOpen(!isMemoryOpen)} title="Memory Bank" className={`${isTV ? 'w-20 h-20' : 'w-12 h-12'} rounded-2xl flex items-center justify-center transition-all ${isMemoryOpen ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400'}`}><i className="fas fa-brain"></i></button>
             {!isAuto && (
                <button onClick={handleLogout} className="text-gray-600 hover:text-white px-4"><i className="fas fa-sign-out-alt"></i></button>
             )}
          </div>
        </header>
      )}

      <main className={`flex-1 flex ${isWearable || isMobile ? 'flex-col' : 'flex-row'} min-h-0 ${isTV ? 'p-12 gap-12' : isWearable ? 'p-2 gap-2' : 'p-4 lg:p-12 gap-8'} overflow-hidden`}>
        <div className="flex-1 flex flex-col gap-4 lg:gap-8 min-h-0">
          {(isVisionActive || isScreenSharing) && !isWearable && (
            <div className={`${isTV ? 'h-96' : isAuto ? 'h-48' : 'h-64 md:h-80'} w-full animate-slide-up flex-shrink-0`}>
              {isVisionActive && <ObservationMode isActive={isVisionActive} onFrame={(b) => currentFrameRef.current = b} />}
              {isScreenSharing && screenStream && <ScreenShareMode isActive={isScreenSharing} stream={screenStream} onFrame={(b) => currentFrameRef.current = b} onStop={() => setIsScreenSharing(false)} />}
            </div>
          )}

          <div className={`flex-1 flex flex-col glass ${isWearable ? 'rounded-[1.5rem]' : 'rounded-[3rem]'} overflow-hidden relative min-h-0`}>
            {/* Transcription Feed */}
            {!isWearable && (
              <div className={`flex-1 ${isTV ? 'p-12 space-y-12' : isAuto ? 'p-8 space-y-8' : 'p-6 lg:p-12 space-y-6'} overflow-y-auto scrollbar-thin`} ref={scrollRef}>
                {transcriptions.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10">
                    <i className={`fas fa-atom ${isTV ? 'text-[12rem]' : 'text-9xl'} mb-8`}></i>
                    <p className={`${isTV ? 'text-4xl' : 'text-2xl'} font-black uppercase tracking-[1em]`}>Listening</p>
                  </div>
                )}
                
                {transcriptions.map(e => (
                  <div key={e.id} className={`flex flex-col ${e.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`${isAuto || isTV ? 'max-w-[90%]' : 'max-w-[85%]'} ${isTV ? 'px-10 py-8 rounded-[4rem]' : 'px-6 py-4 rounded-[2rem]'} ${e.sender === 'user' ? `bg-${themeData.primary} text-white` : 'bg-white/5 text-gray-300'}`}>
                      <p className={`${isTV ? 'text-2xl' : isAuto ? 'text-lg' : 'text-sm'} font-medium leading-relaxed whitespace-pre-wrap`}>{e.text}</p>
                      {e.sources && <GroundingSources sources={e.sources} themePrimary={themeData.primary} />}
                    </div>
                    <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest mt-2 mx-4">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                {streamingAssistantText && (
                  <div className="items-start flex flex-col">
                    <div className={`max-w-[85%] ${isTV ? 'px-10 py-8 text-lg' : 'px-6 py-4 text-xs'} rounded-[2rem] bg-white/5 text-white/50 animate-pulse font-mono`}>
                      {streamingAssistantText}
                    </div>
                  </div>
                )}
                {state === AssistantState.THINKING && (
                  <div className={`flex items-center gap-2 ${isTV ? 'text-sm' : 'text-[10px]'} text-blue-400 font-black uppercase tracking-widest px-6`}>
                    <i className="fas fa-circle-notch fa-spin"></i>
                    Processing Logic...
                  </div>
                )}
              </div>
            )}

            {/* Wearable / Auto Control Core */}
            <div className={`${isWearable ? 'flex-1 justify-center' : ''} ${isTV ? 'p-12' : isAuto ? 'p-8' : 'p-6 lg:p-10'} border-t border-white/5 bg-black/40 flex flex-col`}>
              <div className={isWearable ? 'scale-75' : ''}>
                <VoiceVisualizer state={state} analyser={analyserRef.current || undefined} />
              </div>
              
              <div className={`mt-6 flex ${isWearable ? 'flex-col gap-2' : 'gap-4'} items-center`}>
                  {!isWearable && !isAuto && (
                    <>
                      <button onClick={handleToggleVision} title="Toggle Optics" className={`w-12 h-12 rounded-xl flex items-center justify-center ${isVisionActive ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}><i className="fas fa-camera"></i></button>
                      <button onClick={handleToggleScreenShare} title="Toggle Desktop Link" className={`w-12 h-12 rounded-xl flex items-center justify-center ${isScreenSharing ? 'bg-cyan-500 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}><i className="fas fa-desktop"></i></button>
                    </>
                  )}
                  
                  {!isWearable && (
                    <input 
                      type="text" 
                      value={inputText} 
                      onChange={(e) => setInputText(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleSendText()} 
                      placeholder={isAuto ? "Voice only recommended" : "Neural command..."} 
                      className={`flex-1 bg-white/5 border border-white/10 rounded-2xl ${isTV ? 'px-10 py-6 text-xl' : 'px-6 py-4 text-base'} focus:outline-none focus:border-blue-500/40 text-white font-bold`} 
                    />
                  )}

                  <button 
                    onClick={inputText.trim() ? handleSendText : (state === AssistantState.IDLE ? () => startSession() : stopSession)} 
                    className={`${isTV ? 'w-80 h-24 text-3xl' : isAuto ? 'w-56 h-20 text-2xl' : isWearable ? 'w-full py-4 text-xl' : 'w-52 h-16'} rounded-2xl flex items-center justify-center transition-all gap-3 ${state === AssistantState.IDLE ? 'bg-white text-black hover:scale-105' : 'bg-red-500 text-white animate-pulse'}`}
                  >
                    <i className={`fas ${inputText.trim() ? 'fa-paper-plane' : (state === AssistantState.IDLE ? 'fa-microphone' : 'fa-square')}`}></i>
                    {!isWearable && (
                      <span className={`${isTV ? 'text-lg' : 'text-[11px]'} font-black uppercase tracking-widest`}>
                        {inputText.trim() ? 'Send Command' : (state === AssistantState.IDLE ? 'Initiate Link' : 'Terminate')}
                      </span>
                    )}
                  </button>
                  
                  {isWearable && (
                    <button onClick={handleLogout} className="text-[8px] text-gray-600 font-black uppercase mt-2">End Session</button>
                  )}
              </div>
            </div>
          </div>
        </div>
        
        {isMemoryOpen && !isWearable && (
          <div className={`${isTV ? 'w-[500px]' : isAuto ? 'w-[400px]' : 'w-full md:w-[360px]'} flex-shrink-0 h-full`}>
            <MemoryBank memories={memories} onRemove={(id) => setMemories(p => p.filter(m => m.id !== id))} assistantName={prefs.assistantName} />
          </div>
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        prefs={prefs}
        setPrefs={setPrefs}
        voices={VOICES}
        personalities={PERSONALITIES}
        isTV={isTV}
        isWearable={isWearable}
      />
    </div>
  );
};

export default App;