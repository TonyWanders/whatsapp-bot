import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Clock, Building, Search, Briefcase, ExternalLink, Lock, CheckCircle } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

const API_URL = '/api';
const INDUSTRY_KEYWORDS = ['oil', 'gas', 'petroleum', 'energy', 'shell', 'chevron', 'total', 'nnpc', 'seplat', 'oando', 'nlng'];
const ROLE_KEYWORDS = ['admin', 'executive', 'hr ', 'human resources', 'assistant', 'secretary', 'office', 'clerk', 'manager', 'receptionist', 'officer', 'coordinator'];
const PERSONAL_PASSWORD = 'oilmoney'; // Hardcoded simple password for personal use

const PersonalBoard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 20;

  useEffect(() => {
    // Check if previously authenticated in this session
    const auth = sessionStorage.getItem('personalAuth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchJobs();
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === PERSONAL_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('personalAuth', 'true');
      setError('');
      fetchJobs();
    } else {
      setError('Incorrect password. This area is restricted.');
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/jobs`);
      // Filter jobs specifically for Administrative roles INSIDE Oil & Gas
      const filtered = res.data.filter(job => {
        const searchText = `${job.title} ${job.company}`.toLowerCase();
        const isOilAndGas = INDUSTRY_KEYWORDS.some(keyword => searchText.includes(keyword));
        const isAdminRole = ROLE_KEYWORDS.some(keyword => searchText.includes(keyword));
        
        // Return jobs that match BOTH Oil/Gas industry AND Admin/HR/Executive roles
        return isOilAndGas && isAdminRole;
      });
      setJobs(filtered);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '2rem' }}>
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <Lock size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '1rem' }}>Personal <span style={{ color: 'var(--primary-color)' }}>Targets</span></h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>This VIP section exclusively filters for Administrative and HR roles specifically within Oil & Gas companies.</p>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="password" 
              placeholder="Enter VIP Password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)} 
              required 
              style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>Unlock Targets</button>
          </form>
        </div>
      </div>
    );
  }

  // Pagination Logic
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob);
  const totalPages = Math.ceil(jobs.length / jobsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div>
      <div className="hero-section" style={{ textAlign: 'center', padding: '3rem 1rem', marginBottom: '2rem' }}>
        <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '700' }}>
          Your <span className="text-gradient">VIP Targets</span>
        </h1>
        <p className="hero-subtitle" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          Exclusively filtered for Oil, Gas, Energy, and Administrative roles.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--primary-color)' }}>
          <h2>Pumping personal targets...</h2>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Found {jobs.length} VIP targeted jobs</span>
            {jobs.length > 0 && <span>Page {currentPage} of {totalPages}</span>}
          </div>

          <div className="jobs-grid">
            {currentJobs.map(job => {
              const jobAgeDays = differenceInDays(new Date(), new Date(job.posted_date));
              
              return (
                <div className="job-card glass-panel" key={job.id} style={{ display: 'flex', flexDirection: 'column', borderLeft: '4px solid var(--primary-color)' }}>
                  <div className="company-name" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><Building size={16} /> {job.company}</span>
                  </div>
                  <h3 style={{ margin: '0.5rem 0' }}>{job.title}</h3>
                  
                  <div className="job-meta" style={{ marginBottom: '1rem', marginTop: 'auto' }}>
                    <div className="meta-item">
                      <MapPin size={14} color="var(--primary-color)" />
                      {job.city !== 'Unknown' ? `${job.city}, ` : ''}{job.state}
                    </div>
                    <div className="meta-item" style={{ marginLeft: 'auto' }}>
                      <Clock size={14} color="var(--primary-color)" />
                      Posted: {formatDistanceToNow(new Date(job.posted_date), { addSuffix: true })}
                    </div>
                  </div>
                  <a 
                    href={job.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-primary" 
                    style={{ textAlign: 'center', justifyContent: 'center', width: '100%', padding: '0.6rem' }}
                  >
                    Apply Now <ExternalLink size={14} style={{ marginLeft: '6px' }}/>
                  </a>
                </div>
              );
            })}
            
            {jobs.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                No VIP targeted jobs found yet. Scrapers are running in the background.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem', flexWrap: 'wrap' }}>
              <button 
                className="btn" 
                disabled={currentPage === 1} 
                onClick={() => paginate(currentPage - 1)}
                style={{ background: 'var(--panel-bg)' }}
              >
                Previous
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                
                return (
                  <button 
                    key={pageNum} 
                    className={`btn ${currentPage === pageNum ? 'btn-primary' : ''}`}
                    onClick={() => paginate(pageNum)}
                    style={currentPage !== pageNum ? { background: 'var(--panel-bg)' } : {}}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button 
                className="btn" 
                disabled={currentPage === totalPages} 
                onClick={() => paginate(currentPage + 1)}
                style={{ background: 'var(--panel-bg)' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PersonalBoard;
