import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Trash2, LogOut, ArrowLeft, Download, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = '/api';

const Admin = () => {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [newAccessPwd, setNewAccessPwd] = useState('');
  
  // Admin Credentials State
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const [waStatus, setWaStatus] = useState({ isConnected: false, qrData: null });
  const [initializingWa, setInitializingWa] = useState(false);

  useEffect(() => {
    if (token) {
      fetchJobs();
      fetchWaStatus();
      const interval = setInterval(fetchWaStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchWaStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/whatsapp-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWaStatus(res.data);
    } catch (e) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password });
      localStorage.setItem('adminToken', res.data.token);
      setToken(res.data.token);
    } catch (error) {
      alert('Invalid credentials');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  const fetchJobs = async () => {
    try {
      const res = await axios.get(`${API_URL}/jobs`);
      setJobs(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const exportCSV = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      if (data.length === 0) return alert("No jobs to export");

      // Generate CSV string
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(job => 
        Object.values(job).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nigeria_jobs_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export CSV');
    }
  };

  const startWaEngine = async () => {
    setInitializingWa(true);
    try {
      await axios.post(`${API_URL}/admin/whatsapp-start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      alert('Error starting WhatsApp engine');
    } finally {
      setTimeout(() => setInitializingWa(false), 2000);
    }
  };

  const triggerScraper = async () => {
    setScraping(true);
    try {
      const res = await axios.post(`${API_URL}/admin/trigger-scraper`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Scraping complete! Found ${res.data.count || 0} new jobs from web and scholarships sources.`);
      fetchJobs();
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) handleLogout();
      else alert('Error running scraper');
    } finally {
      setScraping(false);
    }
  };

  const deleteJob = async (id) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await axios.delete(`${API_URL}/admin/jobs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(jobs.filter(j => j.id !== id));
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) handleLogout();
      else alert('Error deleting job');
    }
  };

  const handleChangeAccessPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/admin/change-access-password`, { newPassword: newAccessPwd }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Public Access Password changed successfully!');
      setNewAccessPwd('');
    } catch (error) {
      alert('Failed to change password.');
    }
  };

  const handleChangeAdminCredentials = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/admin/change-credentials`, { 
        newUsername: newAdminUsername, 
        newPassword: newAdminPassword 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Auto-download credentials
      const text = `Nigeria Jobs Hunter Admin Credentials\n\nUsername: ${newAdminUsername}\nPassword: ${newAdminPassword}\n\nKeep this file safe!`;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'admin_credentials.txt';
      a.click();
      window.URL.revokeObjectURL(url);

      alert('Admin credentials updated and downloaded successfully! You will now be logged out.');
      handleLogout();
    } catch (error) {
      alert('Failed to update admin credentials.');
    }
  };

  if (!token) {
    return (
      <div className="admin-login glass-panel">
        <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Admin Control Panel</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '1rem' }}>
            Secure Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <div className="admin-header" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>System Dashboard</h2>
          <Link to="/" className="btn" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={18} /> Back to Public Feed
          </Link>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={triggerScraper} className="btn" disabled={scraping}>
            <RefreshCw size={18} className={scraping ? 'spin' : ''} />
            {scraping ? 'Agent is Hunting...' : 'Force Run Scraper'}
          </button>
          <button onClick={exportCSV} className="btn" style={{ background: 'var(--panel-bg)' }}>
            <Download size={18} /> Export Data (CSV)
          </button>
          <button onClick={handleLogout} className="btn btn-danger" style={{ marginLeft: 'auto' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <h4>Total Active Jobs</h4>
          <div className="value">{jobs.length}</div>
        </div>
        <div className="stat-card glass-panel">
          <h4>Sources Monitored</h4>
          <div className="value">7</div>
        </div>
        <div className="stat-card glass-panel">
          <h4>System Status</h4>
          <div className="value" style={{ color: '#66fcf1' }}>Online</div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3>WhatsApp Sync Engine</h3>
        <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Connect your WhatsApp to automatically scrape jobs from approved Channels. History is forcefully backfilled on connection.
        </p>
        
        {waStatus.isConnected ? (
          <div style={{ color: '#66fcf1', fontWeight: 'bold' }}>✓ WhatsApp Engine is Connected and Monitoring.</div>
        ) : waStatus.qrData ? (
          <div>
            <p>Scan this QR Code with your WhatsApp app to link the engine:</p>
            <img src={waStatus.qrData} alt="WhatsApp QR Code" style={{ border: '4px solid white', borderRadius: '8px', marginTop: '1rem', width: '250px' }} />
          </div>
        ) : (
          <button onClick={startWaEngine} className="btn btn-primary" disabled={initializingWa}>
            {initializingWa ? 'Starting Engine...' : 'Initialize WhatsApp Engine'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {/* Public Password Reset */}
        <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, minWidth: '300px' }}>
          <h3>Public Access Password</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa' }}>Change the password you share with others.</p>
          <form onSubmit={handleChangeAccessPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <input 
              type="text" 
              placeholder="New Public Password" 
              value={newAccessPwd} 
              onChange={e => setNewAccessPwd(e.target.value)} 
              required 
            />
            <button type="submit" className="btn btn-primary">Update Password</button>
          </form>
        </div>

        {/* Admin Credential Reset */}
        <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, minWidth: '300px', borderLeft: '3px solid var(--danger)' }}>
          <h3><ShieldAlert size={18} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Admin Credentials</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa' }}>Change your master login details. This will auto-download a backup file.</p>
          <form onSubmit={handleChangeAdminCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <input 
              type="text" 
              placeholder="New Admin Username" 
              value={newAdminUsername} 
              onChange={e => setNewAdminUsername(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="New Admin Password" 
              value={newAdminPassword} 
              onChange={e => setNewAdminPassword(e.target.value)} 
              required 
            />
            <button type="submit" className="btn btn-danger">Change Master Login</button>
          </form>
        </div>
      </div>

      <h3>Manage Active Jobs</h3>
      <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '1rem' }}>Title</th>
              <th style={{ padding: '1rem' }}>Company</th>
              <th style={{ padding: '1rem' }}>Location</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem' }}>{job.title}</td>
                <td style={{ padding: '1rem' }}>{job.company}</td>
                <td style={{ padding: '1rem' }}>{job.state}</td>
                <td style={{ padding: '1rem' }}>
                  <button onClick={() => deleteJob(job.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Admin;
