import React, { useState, useEffect } from 'react';

type AuthMode = 'VAULT' | 'SIGN_UP' | 'SAFETY_GATE' | 'VOICE_SELECT' | 'VERIFY';

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [genderPref, setGenderPref] = useState('masculine');
  const [mode, setMode] = useState('VAULT');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const getStoredUsers = () => {
    try {
      const stored = localStorage.getItem('nova_credentials');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  };

  const getUserPrefs = (uname) => {
    try {
      const saved = localStorage.getItem(`nova_${uname}_prefs`);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const users = getStoredUsers();
    if (Object.keys(users).length === 0) {
      setMode('SIGN_UP');
    }
  }, []);

  const handleProfileSelect = (name) => {
    setSelectedProfile(name);
    const prefs = getUserPrefs(name);
    if (prefs && prefs.modality) {
      setGenderPref(prefs.modality);
    }
    setMode('VERIFY');
    setError(null);
  };

  const handleSignUpStart = (e) => {
    e.preventDefault();
    setError(null);
    const users = getStoredUsers();
    if (users[username]) {
      setError("Username already registered.");
      return;
    }
    setMode('SAFETY_GATE');
  };

  const handleAgeCheck = (e) => {
    e.preventDefault();
    if (age === '' || parseInt(age) < 13) {
      setError("Safety Protocol: 13+ only.");
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
      onLogin(username, { voiceId: defaultVoiceId, modality: genderPref });
    }, 1500);
  };

  const handleVerify = (e) => {
    e.preventDefault();
    setError(null);
    const users = getStoredUsers();
    if (selectedProfile && users[selectedProfile] === password) {
      setIsSyncing(true);
      
      const existingPrefs = getUserPrefs(selectedProfile) || {};
      const updatedPrefs = { 
        ...existingPrefs, 
        modality: genderPref,
        voiceId: (genderPref === 'feminine' && existingPrefs.modality === 'masculine') ? 'Zephyr' :
                 (genderPref === 'masculine' && existingPrefs.modality === 'feminine') ? 'Charon' :
                 existingPrefs.voiceId || (genderPref === 'masculine' ? 'Charon' : 'Zephyr')
      };
      localStorage.setItem(`nova_${selectedProfile}_prefs`, JSON.stringify(updatedPrefs));
      
      setTimeout(() => onLogin(selectedProfile, updatedPrefs), 1200);
    } else {
      setError("Passcode mismatch.");
    }
  };

  const identities = JSON.parse(localStorage.getItem('nova_identities') || '[]');

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 lg:p-10 bg-[#02020a] relative overflow-hidden">
      <div className="w-full max-w-5xl z-10">
        {mode === 'VAULT' ? (
          <div className="space-y-8 lg:space-y-12 animate-fade-in text-center">
            <header className="space-y-4">
              <h1 className="text-4xl lg:text-7xl font-black tracking-tighter text-white">Chatty <span className="shimmer-text-fast">Link</span></h1>
              <p className="text-gray-500 uppercase tracking-widest text-[8px] lg:text-[10px] font-bold">Select biological segment</p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
              {identities.map((name) => (
                <button
                  key={name}
                  onClick={() => handleProfileSelect(name)}
                  className="group relative glass rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-10 transition-all hover:scale-[1.02] text-left"
                >
                  <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl lg:rounded-[2rem] bg-blue-600 flex items-center justify-center text-xl lg:text-2xl font-black">{(name || 'U')[0].toUpperCase()}</div>
                  <div className="mt-6 lg:mt-10">
                    <p className="text-xl lg:text-2xl font-black text-white truncate">{name}</p>
                    <p className="text-[8px] lg:text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">Encrypted</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setMode('SIGN_UP')}
                className="flex flex-col items-center justify-center gap-4 glass border-dashed border-white/10 rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-10 opacity-60 hover:opacity-100 transition-all"
              >
                <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center"><i className="fas fa-plus text-sm"></i></div>
                <p className="font-black text-gray-500 uppercase tracking-widest text-[8px] lg:text-[10px]">New Identity</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto animate-pop">
            <div className="glass rounded-[2rem] lg:rounded-[4rem] p-8 lg:p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400/30 animate-biometric"></div>
              
              <div className="relative z-10 space-y-6 lg:space-y-8">
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-[10px] font-bold uppercase tracking-wider text-center animate-shake">
                    {error}
                  </div>
                )}
                
                {mode === 'SIGN_UP' && (
                  <form onSubmit={handleSignUpStart} className="space-y-6 lg:space-y-8">
                    <div className="text-center">
                      <h2 className="text-2xl lg:text-3xl font-black">Initialize</h2>
                    </div>
                    <div className="space-y-3 lg:space-y-4">
                      <input type="text" required placeholder="Username" className="w-full bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl py-3 lg:py-5 px-6 lg:px-8 text-white font-bold" value={username} onChange={(e) => setUsername(e.target.value)} />
                      <input type="password" required placeholder="Passcode" className="w-full bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl py-3 lg:py-5 px-6 lg:px-8 text-white font-bold" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <button type="submit" className="w-full bg-white text-black font-black py-4 lg:py-5 rounded-xl lg:rounded-2xl uppercase tracking-widest text-[10px] lg:text-xs neo-button">Register</button>
                  </form>
                )}

                {mode === 'SAFETY_GATE' && (
                   <form onSubmit={handleAgeCheck} className="space-y-6 lg:space-y-8">
                      <div className="text-center">
                        <h2 className="text-2xl lg:text-3xl font-black">Verification</h2>
                      </div>
                      <div className="space-y-3 lg:space-y-4">
                        <input type="number" required placeholder="Age" className="w-full bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl py-3 lg:py-5 px-6 lg:px-8 text-white font-bold" value={age} onChange={(e) => setAge(e.target.value)} />
                      </div>
                      <button type="submit" className="w-full bg-white text-black font-black py-4 lg:py-5 rounded-xl lg:rounded-2xl uppercase tracking-widest text-[10px] lg:text-xs neo-button">Validate</button>
                   </form>
                )}

                {mode === 'VOICE_SELECT' && (
                  <div className="space-y-6 lg:space-y-10">
                    <h2 className="text-2xl lg:text-3xl font-black text-center">Modality</h2>
                    <div className="grid grid-cols-2 gap-3 lg:gap-4">
                      <button onClick={() => setGenderPref('masculine')} className={`p-6 lg:p-10 rounded-3xl border-2 transition-all ${genderPref === 'masculine' ? 'bg-blue-500/10 border-blue-500' : 'bg-white/5 border-white/10'}`}>
                        <i className="fas fa-mars text-2xl lg:text-4xl text-blue-400"></i>
                        <p className="mt-2 text-[8px] font-bold uppercase tracking-widest">Masculine</p>
                      </button>
                      <button onClick={() => setGenderPref('feminine')} className={`p-6 lg:p-10 rounded-3xl border-2 transition-all ${genderPref === 'feminine' ? 'bg-emerald-500/10 border-emerald-500' : 'bg-white/5 border-white/10'}`}>
                        <i className="fas fa-venus text-2xl lg:text-4xl text-emerald-400"></i>
                        <p className="mt-2 text-[8px] font-bold uppercase tracking-widest">Feminine</p>
                      </button>
                    </div>
                    <button onClick={finalizeSignUp} disabled={isSyncing} className="w-full bg-white text-black font-black py-4 lg:py-5 rounded-xl lg:rounded-2xl uppercase tracking-widest text-[10px] lg:text-xs">Finalize Link</button>
                  </div>
                )}

                {mode === 'VERIFY' && (
                  <form onSubmit={handleVerify} className="space-y-6 lg:space-y-8">
                    <div className="text-center">
                      <h2 className="text-2xl lg:text-3xl font-black">Authorize</h2>
                      <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em] mt-1">{selectedProfile}</p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest block ml-2">Preferred Modality</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            type="button"
                            onClick={() => setGenderPref('masculine')} 
                            className={`py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${genderPref === 'masculine' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-gray-600'}`}
                          >
                            <i className="fas fa-mars text-xs"></i>
                            <span className="text-[9px] font-black uppercase">MASC</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setGenderPref('feminine')} 
                            className={`py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${genderPref === 'feminine' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/5 text-gray-600'}`}
                          >
                            <i className="fas fa-venus text-xs"></i>
                            <span className="text-[9px] font-black uppercase">FEMI</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest block ml-2">Passcode</label>
                         <input 
                           type="password" 
                           required 
                           autoFocus 
                           placeholder="••••••" 
                           className="w-full bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl py-4 lg:py-5 px-6 lg:px-8 text-white font-bold text-center tracking-[0.5em]" 
                           value={password} 
                           onChange={(e) => setPassword(e.target.value)} 
                         />
                      </div>
                    </div>

                    <button type="submit" disabled={isSyncing} className="w-full bg-white text-black font-black py-4 lg:py-5 rounded-xl lg:rounded-2xl uppercase tracking-widest text-[10px] lg:text-xs">
                      {isSyncing ? <i className="fas fa-circle-notch fa-spin"></i> : 'Uplink'}
                    </button>
                  </form>
                )}

                <button onClick={() => { setMode('VAULT'); setPassword(''); }} className="w-full text-[8px] lg:text-[10px] text-gray-600 hover:text-white uppercase tracking-widest transition-colors py-2 flex items-center justify-center gap-2">
                  <i className="fas fa-chevron-left text-[6px]"></i> Return to Vault
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;