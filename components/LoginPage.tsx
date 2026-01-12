import React, { useState, useEffect } from 'react';
import { UserPreferences } from '../types';

interface LoginPageProps {
  onLogin: (username: string, initialPrefs?: Partial<UserPreferences>) => void;
}

type AuthMode = 'VAULT' | 'SIGN_UP' | 'SAFETY_GATE' | 'VOICE_SELECT' | 'VERIFY';

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [genderPref, setGenderPref] = useState<'masculine' | 'feminine'>('masculine');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<AuthMode>('VAULT');
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const getStoredUsers = (): Record<string, string> => {
    try {
      const stored = localStorage.getItem('nova_credentials');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  };

  useEffect(() => {
    const users = getStoredUsers();
    if (Object.keys(users).length === 0) {
      setMode('SIGN_UP');
    }
  }, []);

  const handleSignUpStart = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const users = getStoredUsers();
    if (users[username]) {
      setError("Designation already registered.");
      return;
    }
    setMode('SAFETY_GATE');
  };

  const handleAgeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (age === '' || age < 13) {
      setError("Safety Protocol: Access denied for individuals under 13.");
      return;
    }
    setError(null);
    setMode('VOICE_SELECT');
  };

  const finalizeSignUp = () => {
    setIsSyncing(true);
    const users = getStoredUsers();
    setTimeout(() => {
      const updatedUsers = { ...users, [username]: password };
      localStorage.setItem('nova_credentials', JSON.stringify(updatedUsers));
      
      const identities = JSON.parse(localStorage.getItem('nova_identities') || '[]');
      localStorage.setItem('nova_identities', JSON.stringify([...new Set([username, ...identities])]));
      
      // Select appropriate initial voice ID based on modality
      const defaultVoiceId = genderPref === 'masculine' ? 'Charon' : 'Zephyr';
      onLogin(username, { 
        voiceId: defaultVoiceId,
        modality: genderPref 
      });
    }, 1500);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const users = getStoredUsers();
    if (users[selectedProfile!] === password) {
      setIsSyncing(true);
      setTimeout(() => onLogin(selectedProfile!), 1200);
    } else {
      setError("Chatty passcode mismatch.");
    }
  };

  const identities = JSON.parse(localStorage.getItem('nova_identities') || '[]');

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#02020a] relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 rounded-full blur-[150px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/5 rounded-full blur-[150px] animate-pulse-slow"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      </div>

      <div className="w-full max-w-4xl z-10">
        {mode === 'VAULT' ? (
          <div className="space-y-12 animate-fade-in">
            <header className="text-center space-y-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.5em] mb-4 mx-auto animate-float">
                <i className="fas fa-vault"></i> Identity Vault Active
              </div>
              <h1 className="text-7xl font-black tracking-tighter text-white drop-shadow-2xl">
                Chatty Link <span className="shimmer-text">Established</span>
              </h1>
              <p className="text-gray-500 uppercase tracking-widest text-[10px] font-bold">Select biological segment to proceed</p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {identities.map((name: string, i: number) => (
                <button
                  key={name}
                  onClick={() => { setSelectedProfile(name); setMode('VERIFY'); }}
                  style={{ animationDelay: `${i * 100}ms` }}
                  className="group relative bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 rounded-[3rem] p-10 transition-all duration-700 hover:scale-[1.05] text-left glass animate-slide-up"
                >
                  {/* Miniature scanner on profile cards */}
                  <div className="absolute inset-0 overflow-hidden rounded-[3rem] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-biometric"></div>
                  </div>

                  <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-black shadow-2xl group-hover:rotate-6 transition-transform relative">
                    {name[0].toUpperCase()}
                    <div className="absolute inset-0 border border-white/20 rounded-[2rem] animate-pulse"></div>
                  </div>
                  <div className="mt-10">
                    <p className="text-2xl font-black text-white truncate">{name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                      <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">Encrypted Segment</p>
                    </div>
                  </div>
                </button>
              ))}
              
              <button
                onClick={() => setMode('SIGN_UP')}
                style={{ animationDelay: `${identities.length * 100}ms` }}
                className="flex flex-col items-center justify-center gap-6 bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[3rem] p-10 hover:bg-white/[0.03] transition-all group glass animate-slide-up"
              >
                <div className="w-16 h-16 rounded-[2rem] border-2 border-dashed border-white/10 flex items-center justify-center text-gray-600 group-hover:text-white group-hover:scale-110 transition-all">
                  <i className="fas fa-user-plus text-xl"></i>
                </div>
                <p className="font-black text-gray-500 group-hover:text-white uppercase tracking-widest text-[11px]">Register Biological Data</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto animate-pop-in">
            <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[4rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden glass">
              
              {/* Main Card Biometric Scanner Beam */}
              <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(34,211,238,0.8)] opacity-60 animate-biometric"></div>
                {/* Subtle Grid revealed by scanner */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
              </div>

              <div className="relative z-10">
                {mode === 'SIGN_UP' && (
                  <form onSubmit={handleSignUpStart} className="space-y-8">
                    <div className="text-center space-y-2">
                      <div className="w-20 h-20 rounded-full border border-blue-500/20 bg-blue-500/5 flex items-center justify-center mx-auto mb-4 animate-float">
                        <i className="fas fa-fingerprint text-3xl text-blue-400"></i>
                      </div>
                      <h2 className="text-3xl font-black tracking-tighter">Initialize Identity</h2>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Chatty registration node</p>
                    </div>
                    <div className="space-y-4">
                      <input
                        type="text"
                        required
                        placeholder="Username"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Passcode"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
                        >
                          <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>
                    {error && <p className="text-red-500 text-[10px] font-black uppercase text-center animate-shake">{error}</p>}
                    <button type="submit" className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-blue-50 transition-all uppercase tracking-[0.2em] text-xs neo-button">
                      Initialize Core
                    </button>
                  </form>
                )}

                {mode === 'SAFETY_GATE' && (
                  <form onSubmit={handleAgeCheck} className="space-y-8 text-center animate-fade-in">
                    <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
                      <i className="fas fa-shield-alt text-4xl text-red-500"></i>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-black tracking-tighter">Safety Gate</h2>
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-black">Verify biological cycle maturity</p>
                    </div>
                    <input
                      type="number"
                      required
                      placeholder="21"
                      className="w-full bg-white/5 border border-white/10 rounded-3xl py-8 text-center text-5xl text-white font-black focus:outline-none focus:border-red-500/50"
                      value={age}
                      onChange={(e) => setAge(parseInt(e.target.value) || '')}
                    />
                    {error && <p className="text-red-500 text-[10px] font-black uppercase leading-relaxed">{error}</p>}
                    <button type="submit" className="w-full bg-red-600 text-white font-black py-5 rounded-2xl hover:bg-red-500 transition-all uppercase tracking-widest text-xs">
                      Confirm Maturation
                    </button>
                  </form>
                )}

                {mode === 'VOICE_SELECT' && (
                  <div className="space-y-10 animate-fade-in">
                    <div className="text-center space-y-2">
                      <h2 className="text-3xl font-black tracking-tighter">Auditory Link</h2>
                      <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-black">Select Chatty Modality</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setGenderPref('masculine')}
                        className={`p-8 rounded-[3rem] border-2 transition-all flex flex-col items-center gap-6 ${genderPref === 'masculine' ? 'bg-blue-500/20 border-blue-500 scale-105' : 'bg-white/5 border-white/10 opacity-30'}`}
                      >
                        <i className="fas fa-mars text-5xl"></i>
                        <span className="font-black uppercase tracking-widest text-[11px]">Masculine</span>
                      </button>
                      <button
                        onClick={() => setGenderPref('feminine')}
                        className={`p-8 rounded-[3rem] border-2 transition-all flex flex-col items-center gap-6 ${genderPref === 'feminine' ? 'bg-emerald-500/20 border-emerald-500 scale-105' : 'bg-white/5 border-white/10 opacity-30'}`}
                      >
                        <i className="fas fa-venus text-5xl"></i>
                        <span className="font-black uppercase tracking-widest text-[11px]">Feminine</span>
                      </button>
                    </div>
                    <button onClick={finalizeSignUp} disabled={isSyncing} className="w-full bg-white text-black font-black py-5 rounded-2xl hover:scale-105 transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                      {isSyncing ? 'Synchronizing Chatty Segments...' : 'Finalize Identity Sync'}
                    </button>
                  </div>
                )}

                {mode === 'VERIFY' && (
                  <form onSubmit={handleVerify} className="space-y-8">
                    <div className="text-center space-y-2">
                      <div className="w-20 h-20 rounded-full border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
                        <i className="fas fa-eye text-3xl text-cyan-400"></i>
                      </div>
                      <h2 className="text-3xl font-black tracking-tighter">Authorization</h2>
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-black">Identity: {selectedProfile}</p>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      placeholder="Enter Passcode"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-white font-bold focus:outline-none focus:border-blue-500/50"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {error && <p className="text-red-500 text-[10px] font-black uppercase text-center animate-shake">{error}</p>}
                    <button type="submit" disabled={isSyncing} className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-blue-50 transition-all uppercase tracking-widest text-xs">
                      {isSyncing ? 'Accessing Segment...' : 'Establish Chatty Link'}
                    </button>
                  </form>
                )}
              </div>

              <button
                onClick={() => { setMode('VAULT'); setError(null); setPassword(''); setUsername(''); setAge(''); }}
                className="mt-10 w-full text-[10px] text-gray-600 hover:text-white font-black uppercase tracking-[0.5em] transition-colors py-2 flex items-center justify-center gap-3 group relative z-10"
              >
                <i className="fas fa-chevron-left text-[8px] group-hover:-translate-x-1 transition-transform"></i> Return to Vault
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;