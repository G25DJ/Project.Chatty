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
import IntroSequence from './components/IntroSequence';

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
  voiceId: 'Charon',
  assistantName: 'Project Chatty',
  customPersonality: 'You are a highly capable AI assistant.',
  modality: 'masculine'
};

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
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
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const currentFrameRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dynamicVoices = useMemo(() => {
    const isFem = prefs.modality === 'feminine';
    if (isFem) {
      return [
        { id: 'Zephyr', name: 'Gabby', tone: 'Warm, Smooth, Melodic', gender: 'feminine' },
        { id: 'Kore', name: 'Paula', tone: 'Clear, Professional, Calm', gender: 'feminine' },
        { id: 'Aoede', name: 'Kai', tone: 'Poetic, Soulful, Expressive', gender: 'feminine' },
        { id: 'Leda', name: 'Jessie', tone: 'Bright, Airy, Gentle', gender: 'feminine' }
      ];
    } else {
      return [
        { id: 'Charon', name: 'John', tone: 'Deep, Bass, Authoritative', gender: 'masculine' },
        { id: 'Puck', name: 'Caleb', tone: 'Energetic, Bright, Playful', gender: 'masculine' },
        { id: 'Fenrir', name: 'Able', tone: 'Vibrant, Sharp, Focused', gender: 'masculine' },
        { id: 'Charon', name: 'Jake', tone: 'Deep, Resonant, Command', gender: 'masculine' }
      ];
    }
  }, [prefs.modality]);

  useEffect(() => {
    const isValid = dynamicVoices.some(v => v.id === prefs.voiceId);
    if (!isValid && dynamicVoices.length > 0) {
      setPrefs(p => ({ ...p, voiceId: dynamicVoices[0].id }));
    }
  }, [dynamicVoices, prefs.voiceId]);

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
      document.documentElement.setAttribute('data-device', detectedDevice);

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

  const handlePreviewVoice = async (voiceId: string) => {
    if (previewingVoiceId) return;
    try {
      setPreviewingVoiceId(voiceId);
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key required for voice synthesis.");

      if (!audioContextRef.current) {
        audioContextRef.current = {
          input: new (window.AudioContext || (window as any).webkitAudioContext)(),
          output: new (window.AudioContext || (window as any).webkitAudioContext)()
        };
      }
      const outputCtx = audioContextRef.current.output;
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      const ai = new GoogleGenAI({ apiKey });
      const voice = dynamicVoices.find(v => v.id === voiceId);
      const prompt = `Say: Hello, I am ${voice?.name}. I am your chatty voice profile.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceId },
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (audioPart?.inlineData?.data) {
        const audioBuffer = await audioUtils.decodeAudioData(
          audioUtils.decode(audioPart.inlineData.data),
          outputCtx,
          24000,
          1
        );
        const source = outputCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputCtx.destination);
        source.onended = () => setPreviewingVoiceId(null);
        source.start(0);
      } else {
        setPreviewingVoiceId(null);
      }
    } catch (err: any) {
      setPreviewingVoiceId(null);
    }
  };

  const startSession = async (initialText?: string) => {
    try {
      setState(AssistantState.CONNECTING);
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Authentication failure.");

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

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000, channelCount: 1 } 
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
      if (sensorData.location) tools.push({ googleMaps: {} });
      if (searchEnabled) tools.push({ googleSearch: {} });
      if (!searchEnabled && !sensorData.location) tools.push({ functionDeclarations: [saveKnowledgeTool] });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools,
          toolConfig: sensorData.location ? {
            retrievalConfig: { latLng: { latitude: sensorData.location.lat, longitude: sensorData.location.lng } }
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
          onerror: (err: any) => stopSession(),
          onclose: () => stopSession()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { 
      setErrorToast(err.message);
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
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setIsVisionActive(false);
        setIsScreenSharing(true);
        if (state === AssistantState.IDLE) startSession();
        stream.getVideoTracks()[0].onended = () => { setIsScreenSharing(false); setScreenStream(null); };
      } catch (err: any) {
        setErrorToast(err.message);
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
        setErrorToast("Optic access denied.");
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

  if (showIntro) return <IntroSequence onComplete={() => setShowIntro(false)} />;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  if (isScanning) {
    return (
      <div className="fixed inset-0 bg-[#02020a] flex flex-col items-center justify-center z-[200] animate-fade-blur-in overflow-hidden">
        <div className="absolute inset-0 animate-scan-v bg-gradient-to-b from-transparent via-blue-500/20 to-transparent pointer-events-none opacity-40"></div>
        <div className="relative w-64 h-64 flex items-center justify-center animate-float-3d">
          <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-4 border-2 border-b-purple-500 border-t-transparent border-r-transparent border-l-transparent rounded-full animate-spin [animation-duration:3s]"></div>
          <i className="fas fa-atom text-6xl text-white animate-pulse"></i>
        </div>
        <h2 className="mt-12 text-2xl font-black tracking-[0.5em] uppercase text-white mb-2 text-center animate-slide-up-reveal">Chatty Sync Active</h2>
        <p className="text-[11px] text-blue-500 font-black uppercase tracking-[0.3em] animate-pulse">Linking Bio-Core...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full transition-all duration-1000 overflow-hidden" style={{ backgroundColor: themeData.bg }}>
      {errorToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-red-600/90 backdrop-blur-xl text-white px-8 py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-[0_20px_60px_rgba(220,38,38,0.4)] animate-pop flex items-center gap-4">
          <i className="fas fa-exclamation-triangle"></i>
          {errorToast}
          <button onClick={() => setErrorToast(null)} className="ml-4 opacity-50 hover:opacity-100"><i className="fas fa-times"></i></button>
        </div>
      )}

      {/* Header */}
      <header className={`${isTV ? 'px-20 py-12 m-8 rounded-[4rem]' : 'px-6 py-4 lg:px-12 lg:py-6 m-4 rounded-[2.5rem]'} flex items-center justify-between z-50 glass animate-fade-blur-in`}>
        <div className="flex items-center gap-4 lg:gap-8 group">
          <div className={`${isTV ? 'w-24 h-24 rounded-[3rem]' : 'w-12 h-12 lg:w-16 lg:h-16 rounded-[2rem]'} overflow-hidden border border-white/10 relative transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 shadow-xl group-hover:shadow-blue-500/20`}>
            {prefs.assistantProfilePic ? <img src={prefs.assistantProfilePic} className="w-full h-full object-cover" alt="AI" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center"><i className="fas fa-atom text-white"></i></div>}
          </div>
          {!isMobile && (
            <div className="animate-slide-in-right-bounce">
              <h1 className={`${isTV ? 'text-5xl' : 'text-xl lg:text-3xl'} font-black tracking-tighter text-white uppercase`}>{prefs.assistantName}</h1>
              <HardwareSensors data={sensorData} deviceType={device} themeColor={themeData.primary} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 md:gap-4">
           <button onClick={() => setIsSettingsOpen(true)} className={`${isTV ? 'w-20 h-20' : 'w-10 h-10 md:w-12 md:h-12'} rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 border border-white/5 shadow-lg`}><i className="fas fa-cog text-lg md:text-xl"></i></button>
           <button onClick={() => setIsMemoryOpen(!isMemoryOpen)} className={`${isTV ? 'w-20 h-20' : 'w-10 h-10 md:w-12 md:h-12'} rounded-2xl flex items-center justify-center transition-all active:scale-90 border border-white/5 ${isMemoryOpen ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}><i className="fas fa-brain text-lg md:text-xl"></i></button>
           <button onClick={handleLogout} className={`${isTV ? 'px-10 h-20' : 'px-2 md:px-4 h-12'} text-gray-600 hover:text-red-500 transition-colors active:scale-90`}><i className="fas fa-power-off text-lg md:text-xl"></i></button>
        </div>
      </header>

      <main className={`flex-1 flex ${isMobile ? 'flex-col' : 'flex-row'} min-h-0 ${isTV ? 'p-12 gap-12' : 'p-4 lg:p-8 gap-8'} overflow-hidden`}>
        <div className="flex-1 flex flex-col gap-4 lg:gap-8 min-h-0">
          {(isVisionActive || isScreenSharing) && (
            <div className={`${isTV ? 'h-96' : 'h-64 md:h-80'} w-full animate-pop flex-shrink-0 relative group`}>
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              {isVisionActive && <ObservationMode isActive={isVisionActive} onFrame={(b) => currentFrameRef.current = b} />}
              {isScreenSharing && screenStream && <ScreenShareMode isActive={isScreenSharing} stream={screenStream} onFrame={(b) => currentFrameRef.current = b} onStop={() => setIsScreenSharing(false)} />}
            </div>
          )}

          <div className="flex-1 flex flex-col glass rounded-[3rem] overflow-hidden relative min-h-0 group shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none opacity-40"></div>
            
            <div className={`flex-1 ${isTV ? 'p-12 space-y-12' : 'p-6 lg:p-10 space-y-8'} overflow-y-auto scrollbar-thin transcription-list`} ref={scrollRef}>
              {transcriptions.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 animate-float-3d">
                  <i className={`fas fa-comment-dots ${isTV ? 'text-[14rem]' : 'text-9xl'} mb-10 text-gray-600`}></i>
                  <p className={`${isTV ? 'text-5xl' : 'text-3xl'} font-black uppercase tracking-[1em] shimmer-text-fast`}>Chatty Core</p>
                </div>
              )}
              
              {transcriptions.map((e, idx) => (
                <div 
                  key={e.id} 
                  className={`flex flex-col ${e.sender === 'user' ? 'items-end' : 'items-start'} animate-slide-up-reveal`}
                  style={{ animationDelay: `${Math.min(idx * 50, 500)}ms` }}
                >
                  <div className={`
                    ${isTV ? 'max-w-[90%]' : 'max-w-[85%]'} 
                    ${isTV ? 'px-12 py-10 rounded-[4rem]' : 'px-7 py-5 rounded-[2rem]'} 
                    shadow-xl transition-transform hover:scale-[1.01]
                    ${e.sender === 'user' 
                      ? `bg-gradient-to-br from-${themeData.primary} to-indigo-600 text-white animate-slide-in-right-bounce` 
                      : 'bg-white/[0.04] text-gray-200 border border-white/5 backdrop-blur-xl animate-pop'
                    }
                  `}>
                    <p className={`${isTV ? 'text-4xl' : 'text-lg'} font-bold leading-relaxed whitespace-pre-wrap`}>{e.text}</p>
                    {e.sources && <GroundingSources sources={e.sources} themePrimary={themeData.primary} />}
                  </div>
                  <span className="text-[11px] text-gray-600 font-black uppercase tracking-widest mt-2 mx-5 opacity-40">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
              
              {(streamingAssistantText || state === AssistantState.THINKING) && (
                <div className="items-start flex flex-col animate-pop">
                  <div className="max-w-[85%] px-7 py-5 rounded-[2rem] bg-white/[0.03] text-white/60 border border-white/5 shadow-lg">
                    {streamingAssistantText ? (
                      <p className="font-mono text-sm leading-relaxed">{streamingAssistantText}</p>
                    ) : (
                      <div className="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className={`${isTV ? 'p-12' : 'p-8 lg:p-12'} border-t border-white/5 bg-black/50 backdrop-blur-2xl flex flex-col`}>
              <div className="w-full relative mb-6">
                <div className={`absolute inset-0 blur-[60px] rounded-full opacity-20 transition-colors duration-1000 ${state === AssistantState.SPEAKING ? 'bg-blue-500' : state === AssistantState.LISTENING ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                <VoiceVisualizer state={state} analyser={analyserRef.current || undefined} />
              </div>
              
              <div className={`flex ${isMobile ? 'flex-col gap-5' : 'gap-5'} items-center`}>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={handleToggleVision} title="Optic Link" className={`${isTV ? 'w-24 h-24' : 'w-14 h-14 flex-1 md:flex-none'} rounded-2xl glass flex items-center justify-center active:scale-90 ${isVisionActive ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'text-gray-500 hover:text-white'}`}><i className="fas fa-camera text-xl"></i></button>
                    <button onClick={handleToggleScreenShare} title="Desktop Uplink" className={`${isTV ? 'w-24 h-24' : 'w-14 h-14 flex-1 md:flex-none'} rounded-2xl glass flex items-center justify-center active:scale-90 ${isScreenSharing ? 'bg-cyan-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'text-gray-500 hover:text-white'}`}><i className="fas fa-desktop text-xl"></i></button>
                  </div>
                  
                  <input 
                    type="text" 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSendText()} 
                    placeholder="Chatty directive..." 
                    className={`flex-1 bg-white/5 border border-white/10 rounded-[2rem] ${isTV ? 'px-12 py-8 text-3xl' : 'px-8 py-5 text-lg'} focus:outline-none focus:border-blue-500/50 text-white font-bold transition-all shadow-inner placeholder-gray-700`} 
                  />

                  <button 
                    onClick={inputText.trim() ? handleSendText : (state === AssistantState.IDLE ? () => startSession() : stopSession)} 
                    className={`${isTV ? 'w-[400px] h-28 text-4xl' : 'w-full md:w-64 h-20'} rounded-[2rem] flex items-center justify-center transition-all gap-4 neo-button shadow-2xl ${state === AssistantState.IDLE ? 'bg-white text-black hover:scale-105' : 'bg-red-600 text-white animate-pulse'}`}
                  >
                    <i className={`fas ${inputText.trim() ? 'fa-paper-plane' : (state === AssistantState.IDLE ? 'fa-microphone' : 'fa-square')} text-lg`}></i>
                    <span className="font-black uppercase tracking-[0.2em] text-[11px]">
                      {inputText.trim() ? 'DISPATCH' : (state === AssistantState.IDLE ? 'INITIALIZE' : 'TERMINATE')}
                    </span>
                  </button>
              </div>
            </div>
          </div>
        </div>
        
        {isMemoryOpen && !isMobile && (
          <div className={`${isTV ? 'w-[600px]' : 'w-full md:w-[420px]'} flex-shrink-0 h-full animate-slide-in-right-bounce`}>
            <MemoryBank memories={memories} onRemove={(id) => setMemories(p => p.filter(m => m.id !== id))} assistantName={prefs.assistantName} />
          </div>
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        prefs={prefs}
        setPrefs={setPrefs}
        voices={dynamicVoices}
        personalities={PERSONALITIES}
        isTV={isTV}
        isWearable={isWearable}
        onPreviewVoice={handlePreviewVoice}
        previewingVoiceId={previewingVoiceId}
      />
    </div>
  );
};

export default App;