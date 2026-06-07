import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import JobBoard from './components/JobBoard';
import Admin from './pages/Admin';
import { Briefcase, ShieldAlert, Lock, Settings } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('appAccess') === 'granted');
  const [isSetup, setIsSetup] = useState(true);
  
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [publicPassword, setPublicPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const res = await axios.get('/api/auth/setup-status');
      setIsSetup(res.data.isSetup);
    } catch (error) {
      console.error('Failed to check setup status');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (adminPassword.length < 4 || publicPassword.length < 4) {
      return setError('Passwords must be at least 4 characters');
    }
    try {
      await axios.post('/api/auth/setup', { adminUsername, adminPassword, publicPassword, recoveryPhrase });
      setIsSetup(true);
      setError('');
      alert('System successfully initialized! You can now log in.');
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/verify-access', { password: loginPassword });
      if (res.data.success) {
        localStorage.setItem('appAccess', 'granted');
        setIsAuthenticated(true);
      }
    } catch (err) {
      setError('Incorrect access password');
    }
  };

  if (loading) return null;

  if (!isSetup) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '2rem' }}>
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
          <Settings size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '1.5rem' }}>Initial <span style={{ color: 'var(--primary-color)' }}>System Setup</span></h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Welcome, Owner. Please configure your entire application.</p>
          
          <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'left' }}>
            <div className="input-group">
              <label>1. Create Admin Username</label>
              <input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>2. Create Admin Password</label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
            <div className="input-group">
              <label>3. Create Public Access Password (for sharing the link)</label>
              <input type="password" value={publicPassword} onChange={e => setPublicPassword(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>4. Create Recovery Phrase</label>
              <input type="text" value={recoveryPhrase} onChange={e => setRecoveryPhrase(e.target.value)} required />
            </div>
            
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <Lock size={16} /> Secure Entire App
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <Briefcase size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '1.5rem' }}>Nigeria<span style={{ color: 'var(--primary-color)' }}>Jobs</span> Portal</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Private portal. Please enter the access password to view the live job feed.</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <input 
                type="password" 
                placeholder="Enter Access Password" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                required 
                style={{ textAlign: 'center' }}
              />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              <Lock size={16} /> Unlock App
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <header>
          <Link to="/" className="logo">
            <Briefcase size={28} color="var(--primary-color)" />
            Nigeria<span>Jobs</span>
          </Link>
          <button onClick={() => { localStorage.removeItem('appAccess'); setIsAuthenticated(false); setLoginPassword(''); }} className="btn" style={{ marginRight: 'auto', marginLeft: '2rem', border: 'none' }}>
            <Lock size={14} /> Lock App
          </button>
          <Link to="/admin" className="btn" title="Admin Control Panel">
            <ShieldAlert size={18} />
            Admin Dashboard
          </Link>
        </header>

        <Routes>
          <Route path="/" element={<JobBoard />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
