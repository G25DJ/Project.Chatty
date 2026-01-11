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
      
      const defaultVoiceId = genderPref === 'masculine' ? 'Charon' : 'Zephyr';
      onLogin(username, { voiceId: defaultVoiceId });
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
      setError("Neural password mismatch.");
      const form = document.getElementById('auth-form');
      form?.classList.add('animate-shake');
      setTimeout(() => form?.classList.remove('animate-shake'), 500);
    }
  };

  const identities = JSON.parse(localStorage.getItem('nova_identities') || '[]');

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#02020a] relative overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
      </div>

      <div className="w-full max-w-2xl z-10 animate-fade-in">
        {mode === 'VAULT' ? (
          <div className="space-y-12">
            <header className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-[0.4em] mb-4 mx-auto">
                <i className="fas fa-vault"></i> Identity Vault Active
              </div>
              <h1 className="text-6xl font-black tracking-tighter text-white">Select Profile</h1>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {identities.map((name: string) => (
                <button
                  key={name}
                  onClick={() => { setSelectedProfile(name); setMode('VERIFY'); }}
                  className="group relative bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 rounded-[2.5rem] p-8 transition-all duration-500 hover:scale-[1.02] text-left"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-black shadow-lg">
                    {name[0].toUpperCase()}
                  </div>
                  <div className="mt-8">
                    <p className="text-xl font-black text-white truncate">{name}</p>
                    <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em] mt-1">Encrypted Segment</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setMode('SIGN_UP')}
                className="flex flex-col items-center justify-center gap-4 bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[2.5rem] p-8 hover:bg-white/[0.03] transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center text-gray-600 group-hover:text-white transition-all">
                  <i className="fas fa-user-plus"></i>
                </div>
                <p className="font-black text-gray-500 group-hover:text-white">New User</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <div id="auth-form" className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[4rem] p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-40 animate-[scan_3s_ease-in-out_infinite]"></div>

              {mode === 'SIGN_UP' && (
                <form onSubmit={handleSignUpStart} className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter text-center mb-8">Initialize Identity</h2>
                  <div className="space-y-4">
                    <input
                      type="text"
                      required
                      placeholder="Username"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Password"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-red-500 text-[10px] font-black uppercase text-center">{error}</p>}
                  <button type="submit" className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-blue-50 transition-all uppercase tracking-widest">Next Step</button>
                </form>
              )}

              {mode === 'SAFETY_GATE' && (
                <form onSubmit={handleAgeCheck} className="space-y-6 text-center animate-fade-in">
                  <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-shield-alt text-3xl text-red-500"></i>
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter">Safety Gate</h2>
                  <p className="text-gray-500 text-xs uppercase tracking-widest font-black">Verify age for link authorization</p>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 25"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-6 text-center text-4xl text-white font-black"
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value) || '')}
                  />
                  {error && <p className="text-red-500 text-[10px] font-black uppercase leading-relaxed">{error}</p>}
                  <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-500 transition-all uppercase tracking-widest">Verify Age</button>
                </form>
              )}

              {mode === 'VOICE_SELECT' && (
                <div className="space-y-8 animate-fade-in">
                  <h2 className="text-3xl font-black tracking-tighter text-center">Neural Profile</h2>
                  <p className="text-gray-500 text-[10px] text-center uppercase tracking-[0.3em] font-black">Select Voice Modality</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setGenderPref('masculine')}
                      className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${genderPref === 'masculine' ? 'bg-blue-500/20 border-blue-500' : 'bg-white/5 border-white/10 opacity-40'}`}
                    >
                      <i className="fas fa-mars text-4xl"></i>
                      <span className="font-black uppercase tracking-widest text-[10px]">Masculine</span>
                    </button>
                    <button
                      onClick={() => setGenderPref('feminine')}
                      className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${genderPref === 'feminine' ? 'bg-emerald-500/20 border-emerald-500' : 'bg-white/5 border-white/10 opacity-40'}`}
                    >
                      <i className="fas fa-venus text-4xl"></i>
                      <span className="font-black uppercase tracking-widest text-[10px]">Feminine</span>
                    </button>
                  </div>
                  <button onClick={finalizeSignUp} disabled={isSyncing} className="w-full bg-white text-black font-black py-4 rounded-2xl hover:scale-105 transition-all uppercase tracking-widest disabled:opacity-50">
                    {isSyncing ? 'Synchronizing...' : 'Finalize Sync'}
                  </button>
                </div>
              )}

              {mode === 'VERIFY' && (
                <form onSubmit={handleVerify} className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter text-center mb-8">Authentication</h2>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter Secret Key"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {error && <p className="text-red-500 text-[10px] font-black uppercase text-center">{error}</p>}
                  <button type="submit" disabled={isSyncing} className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-blue-50 transition-all uppercase tracking-widest">
                    {isSyncing ? 'Verifying...' : 'Establish Link'}
                  </button>
                </form>
              )}

              <button
                onClick={() => { setMode('VAULT'); setError(null); setPassword(''); setUsername(''); setAge(''); }}
                className="mt-8 w-full text-[10px] text-gray-600 hover:text-white font-black uppercase tracking-[0.4em] transition-colors py-2 flex items-center justify-center gap-3"
              >
                <i className="fas fa-chevron-left text-[8px]"></i> Cancel and Return
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;