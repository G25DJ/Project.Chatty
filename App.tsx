import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { AssistantState, DeviceType, SensorData, UserPreferences, GroundingSource, TranscriptionEntry, MemoryEntry } from './types';
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

const THEMES = {
  cosmic: { primary: '#3b82f6', secondary: '#8b5cf6', glow: 'rgba(59,130,246,0.5)', bg: '#02020a' },
  emerald: { primary: '#10b981', secondary: '#064e3b', glow: 'rgba(16,185,129,0.5)', bg: '#020a05' },
  ruby: { primary: '#f43f5e', secondary: '#9f1239', glow: 'rgba(244,63,94,0.5)', bg: '#0a0202' },
  obsidian: { primary: '#94a3b8', secondary: '#1e293b', glow: 'rgba(148,163,184,0.5)', bg: '#0a0a0a' },
  custom: { primary: '#ffffff', secondary: '#ffffff', glow: 'rgba(255,255,255,0.5)', bg: '#02020a' }
};

const PERSONALITIES = {
  professional: 'Be highly professional, concise, and logical. Use technical terminology when appropriate.',
  friendly: 'Be warm, supportive, and enthusiastic. Use a casual but respectful tone.',
  witty: 'Be clever, slightly sarcastic, and humorous. Keep the user entertained while being helpful.',
  minimalist: 'Respond with the absolute minimum number of words necessary. No fluff.',
  alluring: 'Be mysterious, suggestive, and highly flirtatious. Push the boundaries while remaining helpful.',
  custom: ''
};

const DEFAULT_PREFS: UserPreferences = {
  theme: 'cosmic',
  personality: 'friendly',
  layout: 'right',
  voiceId: 'Charon',
  assistantName: 'Project Chatty',
  customPersonality: 'You are a highly capable AI assistant.',
  modality: 'masculine',
  primaryColor: '#3b82f6',
  secondaryColor: '#8b5cf6',
  borderRadius: '2.5rem',
  fontFamily: 'Inter',
  bgStyle: 'grid',
  speechSpeed: 1.0,
  speechPitch: 1.0,
  greeting: 'Neural link established. How can I assist you today?'
};

const saveKnowledgeTool = {
  name: 'save_knowledge',
  parameters: {
    type: 'OBJECT',
    description: 'Save a specific fact or preference for long-term memory to personalize future interactions.',
    properties: { fact: { type: 'STRING', description: 'The specific fact or preference to remember.' } },
    required: ['fact'],
  },
};

const TranscriptionBubble = React.memo(({ entry, deleteTranscription, themePrimary }: { entry: TranscriptionEntry, deleteTranscription: (id: string) => void, themePrimary: string }) => {
  return (
    <div className={`flex flex-col ${entry.sender === 'user' ? 'items-end' : 'items-start'} animate-slide-up-reveal group/item`}>
      <div className={`
        max-w-[90%] lg:max-w-[85%] 
        px-4 py-3 lg:px-7 lg:py-5 
        rounded-[var(--bubble-radius,var(--ui-radius))]
        shadow-xl transition-all hover:scale-[1.01] relative
        ${entry.sender === 'user' 
          ? 'bg-gradient-to-br from-[var(--theme-primary)] to-indigo-600 text-white' 
          : 'bg-white/[0.04] text-gray-200 border border-white/5 backdrop-blur-xl'
        }
      `}>
        <button 
          onClick={() => deleteTranscription(entry.id)}
          className={`absolute ${entry.sender === 'user' ? '-left-8' : '-right-8'} top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-40 hover:!opacity-100 text-red-500 transition-all p-2 active:scale-90`}
        >
          <i className="fas fa-trash-alt text-xs lg:text-sm"></i>
        </button>
        <p className="text-sm lg:text-lg font-bold leading-relaxed whitespace-pre-wrap">{entry.text}</p>
        {entry.sources && <GroundingSources sources={entry.sources} themePrimary={themePrimary} />}
        <div className={`mt-2 text-[8px] opacity-40 uppercase font-black tracking-widest ${entry.sender === 'user' ? 'text-right' : 'text-left'}`}>
          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
});

const TranscriptionList = React.memo(({ transcriptions, deleteTranscription, themePrimary }: { transcriptions: TranscriptionEntry[], deleteTranscription: (id: string) => void, themePrimary: string }) => {
  const grouped = useMemo(() => {
    const groups: Record<string, TranscriptionEntry[]> = {};
    transcriptions.forEach(entry => {
      const dateKey = new Date(entry.timestamp).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });
    return groups;
  }, [transcriptions]);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <>
      {Object.entries(grouped).map(([dateStr, items]) => (
        <React.Fragment key={dateStr}>
          <div className="day-separator animate-fade-blur-in">
            <div className="day-line"></div>
            <div className="day-badge">{formatDateHeader(dateStr)}</div>
            <div className="day-line"></div>
          </div>
          {items.map((e) => (
            <TranscriptionBubble key={e.id} entry={e} deleteTranscription={deleteTranscription} themePrimary={themePrimary} />
          ))}
        </React.Fragment>
      ))}
    </>
  );
});

const App = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [user, setUser] = useState<{username: string, preferences: UserPreferences} | null>(null);
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

  const audioContextRef = useRef<{input: AudioContext, output: AudioContext} | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const micStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const currentFrameRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const themeData = useMemo(() => {
    if (prefs.theme === 'custom') {
      return { primary: prefs.primaryColor, secondary: prefs.secondaryColor, glow: `${prefs.primaryColor}80`, bg: '#02020a' };
    }
    return THEMES[prefs.theme] || THEMES.cosmic;
  }, [prefs.theme, prefs.primaryColor, prefs.secondaryColor]);

  // Deep Customization Real-time Injection
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', themeData.primary);
    root.style.setProperty('--theme-secondary', themeData.secondary);
    root.style.setProperty('--bg-base', themeData.bg);
    root.style.setProperty('--theme-glow', themeData.glow);
    root.style.setProperty('--ui-radius', prefs.borderRadius);
    
    const fontMap = {
      'Inter': "'Inter', sans-serif",
      'Outfit': "'Outfit', sans-serif",
      'Roboto Mono': "'Roboto Mono', monospace",
      'Bebas Neue': "'Bebas Neue', cursive"
    };
    root.style.setProperty('--ui-font', fontMap[prefs.fontFamily] || fontMap['Inter']);
    
    const bgGrid = document.getElementById('bg-grid');
    const bgAurora = document.getElementById('bg-aurora');
    const bgNoise = document.getElementById('bg-noise');
    if (bgGrid) bgGrid.style.display = prefs.bgStyle === 'grid' ? 'block' : 'none';
    if (bgAurora) bgAurora.style.display = prefs.bgStyle === 'aurora' ? 'block' : 'none';
    if (bgNoise) bgNoise.style.display = prefs.bgStyle === 'noise' ? 'block' : 'none';

    const numRadius = parseInt(prefs.borderRadius);
    root.style.setProperty('--bubble-radius', isNaN(numRadius) ? prefs.borderRadius : `${Math.max(12, numRadius - 8)}px`);
  }, [themeData, prefs.borderRadius, prefs.fontFamily, prefs.bgStyle]);

  const dynamicVoices = useMemo(() => {
    const isFem = prefs.modality === 'feminine';
    return isFem ? [
      { id: 'Zephyr', name: 'Gabby', tone: 'Warm, Smooth, Melodic', gender: 'feminine' },
      { id: 'Kore', name: 'Paula', tone: 'Clear, Professional, Calm', gender: 'feminine' },
      { id: 'Aoede', name: 'Kai', tone: 'Poetic, Soulful, Expressive', gender: 'feminine' },
      { id: 'Leda', name: 'Jessie', tone: 'Bright, Airy, Gentle', gender: 'feminine' }
    ] : [
      { id: 'Charon', name: 'John', tone: 'Deep, Bass, Authoritative', gender: 'masculine' },
      { id: 'Puck', name: 'Caleb', tone: 'Energetic, Bright, Playful', gender: 'masculine' },
      { id: 'Fenrir', name: 'Able', tone: 'Vibrant, Sharp, Focused', gender: 'masculine' },
      { id: 'Jake', name: 'Jake', tone: 'Deep, Resonant, Command', gender: 'masculine' }
    ];
  }, [prefs.modality]);

  useEffect(() => {
    const sessionUser = sessionStorage.getItem('nova_session_user') || localStorage.getItem('nova_persistent_user');
    if (sessionUser) {
      try {
        const savedPrefs = localStorage.getItem(`nova_${sessionUser}_prefs`);
        setUser({ username: sessionUser, preferences: savedPrefs ? JSON.parse(savedPrefs) : DEFAULT_PREFS });
      } catch (e) { setUser({ username: sessionUser, preferences: DEFAULT_PREFS }); }
    }
  }, []);

  useEffect(() => {
    if (user) {
      setPrefs({ ...DEFAULT_PREFS, ...user.preferences });
      setMemories(JSON.parse(localStorage.getItem(`nova_${user.username}_memories`) || '[]'));
      setTranscriptions(JSON.parse(localStorage.getItem(`nova_${user.username}_logs`) || '[]'));
      sessionStorage.setItem('nova_session_user', user.username);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        localStorage.setItem(`nova_${user.username}_prefs`, JSON.stringify(prefs));
        localStorage.setItem(`nova_${user.username}_memories`, JSON.stringify(memories));
        localStorage.setItem(`nova_${user.username}_logs`, JSON.stringify(transcriptions));
      }, 1000);
    }
  }, [prefs, memories, transcriptions, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcriptions, streamingUserText, streamingAssistantText]);

  const addTranscription = useCallback((sender: 'user' | 'assistant', text: string, sources?: GroundingSource[]) => {
    if (!text?.trim()) return;
    setTranscriptions(prev => [
      ...prev, { id: Math.random().toString(36).substr(2, 9), sender, text, timestamp: new Date(), sources }
    ]);
  }, []);

  const deleteTranscription = useCallback((id: string) => {
    setTranscriptions(prev => prev.filter(t => t.id !== id));
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
      
      const tools: any[] = [{ functionDeclarations: [saveKnowledgeTool] }];
      if (sensorData.location) tools.push({ googleMaps: {} });
      if (searchEnabled) tools.push({ googleSearch: {} });

      const memoryPrompt = memories.length > 0 
        ? `Long-Term Memory Data: ${memories.map(m => m.fact).join(' | ')}.`
        : "Long-Term Memory is currently empty. Use 'save_knowledge' to record important user facts.";

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools,
          toolConfig: sensorData.location ? { retrievalConfig: { latLng: { latitude: sensorData.location.lat, longitude: sensorData.location.lng } } } : undefined,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: prefs.voiceId } } },
          systemInstruction: `Identity: ${prefs.assistantName}. Persona: ${personalityPrompt}. Session Greeting: ${prefs.greeting}. ${memoryPrompt}`,
          inputAudioTranscription: {}, outputAudioTranscription: {}, thinkingConfig: { thinkingBudget: 24576 }
        } as any,
        callbacks: {
          onopen: () => {
            setState(AssistantState.LISTENING);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: audioUtils.encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
              if (currentFrameRef.current) {
                const frame = currentFrameRef.current;
                currentFrameRef.current = null;
                sessionPromise.then(s => s.sendRealtimeInput({ media: { data: frame, mimeType: 'image/jpeg' } }));
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            
            const initialMsg = initialText || prefs.greeting;
            sessionPromise.then(s => s.sendRealtimeInput({ text: initialMsg }));
            if (initialText) addTranscription('user', initialText);
          },
          onmessage: async (message: any) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'save_knowledge') {
                  const newMemory = { id: Math.random().toString(36).substr(2, 9), fact: fc.args.fact, timestamp: new Date() };
                  setMemories(p => [...p, newMemory]);
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "Fact successfully archived in bio-core." } } }));
                }
              }
            }
            const turnParts = message.serverContent?.modelTurn?.parts || [];
            for (const part of turnParts) {
              if (part.inlineData?.data) {
                setState(AssistantState.SPEAKING);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const buffer = await audioUtils.decodeAudioData(audioUtils.decode(part.inlineData.data), outputCtx, 24000, 1);
                const s = outputCtx.createBufferSource(); 
                s.buffer = buffer; 
                s.playbackRate.value = prefs.speechSpeed;
                s.detune.value = (prefs.speechPitch - 1.0) * 1200; 
                s.connect(outputCtx.destination);
                s.onended = () => { activeSourcesRef.current.delete(s); if (activeSourcesRef.current.size === 0) setState(AssistantState.LISTENING); };
                s.start(nextStartTimeRef.current); 
                nextStartTimeRef.current += (buffer.duration / prefs.speechSpeed); 
                activeSourcesRef.current.add(s);
              }
            }
            if (message.serverContent?.inputTranscription) setStreamingUserText(prev => prev + message.serverContent.inputTranscription.text);
            if (message.serverContent?.outputTranscription) setStreamingAssistantText(prev => prev + message.serverContent.outputTranscription.text);
            if (message.serverContent?.turnComplete) {
              const chunks = message.serverContent?.groundingMetadata?.groundingChunks || [];
              const sources = chunks.map((c: any) => (c.web ? { title: c.web.title, uri: c.web.uri } : (c.maps ? { title: c.maps.title, uri: c.maps.uri } : null))).filter(Boolean);
              setStreamingUserText(u => { if (u) addTranscription('user', u); return ''; });
              setStreamingAssistantText(a => { if (a) { addTranscription('assistant', a, sources); audioUtils.playSuccessSound(outputCtx); } return ''; });
            }
          },
          onerror: () => stopSession(), onclose: () => stopSession()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { setErrorToast(err.message); setState(AssistantState.IDLE); setTimeout(() => setErrorToast(null), 5000); }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    if (previewingVoiceId) return;
    try {
      setPreviewingVoiceId(voiceId);
      const apiKey = process.env.API_KEY;
      if (!apiKey) return;
      if (!audioContextRef.current) audioContextRef.current = { input: new AudioContext(), output: new AudioContext() };
      const outputCtx = audioContextRef.current.output;
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Vocal link check. Current speed ${prefs.speechSpeed}. Pitch ${prefs.speechPitch}.` }] }],
        config: { 
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } } 
        },
      });
      const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (data) {
        const buffer = await audioUtils.decodeAudioData(audioUtils.decode(data), outputCtx, 24000, 1);
        const s = outputCtx.createBufferSource();
        s.buffer = buffer;
        s.playbackRate.value = prefs.speechSpeed;
        s.detune.value = (prefs.speechPitch - 1.0) * 1200;
        s.connect(outputCtx.destination);
        s.onended = () => setPreviewingVoiceId(null);
        s.start(0);
      } else setPreviewingVoiceId(null);
    } catch (e) { setPreviewingVoiceId(null); }
  };

  const handleSendText = useCallback(() => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');

    if (state === AssistantState.IDLE) {
      startSession(text);
    } else if (sessionRef.current) {
      sessionRef.current.sendRealtimeInput({ text });
      addTranscription('user', text);
    }
  }, [inputText, state, addTranscription]);

  const handleLogin = (username: string, initialPrefs: any) => {
    setUser({ username, preferences: { ...DEFAULT_PREFS, ...initialPrefs } });
  };

  if (showIntro) return <IntroSequence onComplete={() => setShowIntro(false)} />;
  if (!user) return <LoginPage onLogin={handleLogin} />;
  
  return (
    <div className="flex flex-col h-full w-full transition-all duration-1000 overflow-hidden">
      <header className="m-[var(--ui-gap)] p-4 lg:p-6 rounded-[var(--ui-radius)] flex items-center justify-between z-50 glass animate-fade-blur-in">
        <div className="flex items-center gap-3 lg:gap-6 group">
          <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-[var(--bubble-radius)] overflow-hidden border border-white/10 relative transition-all duration-700 group-hover:scale-110 shadow-xl">
            {prefs.assistantProfilePic ? <img src={prefs.assistantProfilePic} className="w-full h-full object-cover" alt="AI" /> : <div className="w-full h-full bg-[var(--theme-primary)]/10 flex items-center justify-center"><i className="fas fa-atom text-white text-lg lg:text-xl"></i></div>}
          </div>
          <div className="animate-slide-in-right-bounce">
            <h1 className="text-sm lg:text-2xl font-black tracking-tighter text-white uppercase truncate max-w-[120px] lg:max-w-none">{prefs.assistantName}</h1>
            <HardwareSensors data={sensorData} deviceType={device} themeColor={themeData.primary} />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
           <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90"><i className="fas fa-sliders-h text-sm lg:text-lg"></i></button>
           <button onClick={() => setIsMemoryOpen(!isMemoryOpen)} className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isMemoryOpen ? 'bg-[var(--theme-primary)] text-white shadow-[0_0_20px_var(--theme-glow)]' : 'bg-white/5 text-gray-400'}`}><i className="fas fa-brain text-sm lg:text-lg"></i></button>
           <button onClick={() => { stopSession(); setUser(null); }} className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors active:scale-90"><i className="fas fa-power-off text-sm lg:text-lg"></i></button>
        </div>
      </header>

      <main className={`flex-1 flex p-[var(--ui-gap)] gap-[var(--ui-gap)] overflow-hidden`}>
        <div className="flex-1 flex flex-col glass rounded-[var(--ui-radius)] overflow-hidden relative shadow-2xl">
          <div className={`flex-1 p-4 lg:p-8 space-y-4 lg:space-y-8 overflow-y-auto scrollbar-thin transcription-list`} ref={scrollRef}>
            <TranscriptionList transcriptions={transcriptions} deleteTranscription={deleteTranscription} themePrimary={themeData.primary} />
            {(streamingAssistantText || state === AssistantState.THINKING) && (
              <div className="items-start flex flex-col animate-pop">
                <div className="max-w-[85%] px-5 py-3 rounded-[var(--bubble-radius)] bg-white/[0.03] text-white/60 border border-white/5">
                  {streamingAssistantText ? <p className="font-mono text-xs lg:text-sm leading-relaxed">{streamingAssistantText}</p> : <div className="typing-indicator"><span></span><span></span><span></span></div>}
                </div>
              </div>
            )}
          </div>
          <div className="p-4 lg:p-8 border-t border-white/5 bg-black/50 backdrop-blur-2xl flex flex-col gap-3 lg:gap-6">
            <VoiceVisualizer state={state} analyser={analyserRef.current || undefined} />
            <div className="flex gap-3 items-center">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendText()} placeholder="Directive..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 lg:px-6 py-3 lg:py-5 text-sm lg:text-lg focus:outline-none focus:border-[var(--theme-primary)]/50 text-white font-bold" />
                <button onClick={inputText.trim() ? handleSendText : (state === AssistantState.IDLE ? () => startSession() : stopSession)} className={`flex-1 md:flex-none md:w-48 lg:w-64 h-14 lg:h-20 rounded-[var(--ui-radius)] flex items-center justify-center transition-all gap-2 lg:gap-4 neo-button shadow-2xl ${state === AssistantState.IDLE ? 'bg-white text-black' : 'bg-red-600 text-white animate-pulse'}`}>
                  <i className={`fas ${inputText.trim() ? 'fa-paper-plane' : (state === AssistantState.IDLE ? 'fa-bolt' : 'fa-square')} text-sm lg:text-lg`}></i>
                  <span className="font-black uppercase tracking-widest text-[8px] lg:text-[11px]">{inputText.trim() ? 'SEND' : (state === AssistantState.IDLE ? 'IGNITE' : 'HALT')}</span>
                </button>
            </div>
          </div>
        </div>

        {isMemoryOpen && (
          <div className="w-full md:w-[380px] lg:w-[420px] h-full flex-shrink-0 animate-slide-in-right-bounce z-[60]">
            <MemoryBank 
              memories={memories} 
              onRemove={(id) => setMemories(p => p.filter(m => m.id !== id))} 
              onAdd={(fact) => setMemories(p => [...p, { id: Math.random().toString(36).substr(2, 9), fact, timestamp: new Date() }])}
              onPurge={() => { if(window.confirm("Purge bio-core memory completely?")) setMemories([]); }}
              assistantName={prefs.assistantName} 
            />
          </div>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} prefs={prefs} setPrefs={setPrefs} voices={dynamicVoices} personalities={PERSONALITIES} isTV={false} isWearable={false} onPreviewVoice={handlePreviewVoice} previewingVoiceId={previewingVoiceId} />
    </div>
  );
};

export default App;