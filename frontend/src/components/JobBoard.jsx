import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Clock, Building, Search, Briefcase, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

const API_URL = '/api';

const JobBoard = () => {
  const [jobs, setJobs] = useState([]);
  const [locationsData, setLocationsData] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedState, setSelectedState] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'applied'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 20;

  // Local Storage for Applied Jobs
  const [appliedJobs, setAppliedJobs] = useState(() => {
    const saved = localStorage.getItem('appliedJobs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    fetchLocations();
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchJobs();
    setCurrentPage(1); // Reset to page 1 on filter change
  }, [selectedState, selectedCity]);

  useEffect(() => {
    localStorage.setItem('appliedJobs', JSON.stringify(appliedJobs));
  }, [appliedJobs]);

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API_URL}/locations`);
      setLocationsData(res.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/jobs`, {
        params: { state: selectedState, city: selectedCity, search: searchQuery }
      });
      setJobs(res.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchJobs();
  };

  const handleApply = (jobUrl) => {
    if (!appliedJobs.includes(jobUrl)) {
      setAppliedJobs([...appliedJobs, jobUrl]);
    }
  };

  const handleStateChange = (e) => {
    setSelectedState(e.target.value);
    setSelectedCity('All'); 
  };

  // Derived state for filtering
  const states = Object.keys(locationsData).sort();
  const cities = selectedState !== 'All' && locationsData[selectedState] ? locationsData[selectedState].sort() : [];

  let filteredJobs = jobs.filter(job => {
    if (viewMode === 'all') return true;
    if (viewMode === 'applied') return appliedJobs.includes(job.url);
    if (viewMode === 'expiring') {
      const jobAgeDays = differenceInDays(new Date(), new Date(job.posted_date));
      return jobAgeDays >= 25;
    }
    return true;
  });

  // Pagination Logic
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobs = filteredJobs.slice(indexOfFirstJob, indexOfLastJob);
  const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div>
      {/* HERO SECTION */}
      <div className="hero-section" style={{ textAlign: 'center', padding: '4rem 1rem', marginBottom: '2rem' }}>
        <h1 className="hero-title" style={{ fontSize: '3.5rem', marginBottom: '1rem', fontWeight: '700' }}>
          Find Your Next <span className="text-gradient">Dream Job</span>
        </h1>
        <p className="hero-subtitle" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          We scan 20+ top Nigerian job boards continuously so you don't have to.
          Discover executive roles, remote work, and tech opportunities updated every 5 minutes.
        </p>
      </div>

      {/* FILTER BAR */}
      <div className="filters glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Top Row: Search & View Mode */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <form className="input-group" style={{ flex: 2, minWidth: '250px', flexDirection: 'row', alignItems: 'flex-end', gap: '0.5rem' }} onSubmit={handleSearchSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              <label><Search size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/> Search Database</label>
              <input 
                type="text" 
                placeholder="e.g. Executive Assistant..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 1.5rem', height: 'fit-content' }}>Search</button>
          </form>
          <div className="input-group" style={{ flex: 1, minWidth: '150px' }}>
            <label>View Mode</label>
            <select value={viewMode} onChange={e => { setViewMode(e.target.value); setCurrentPage(1); }}>
              <option value="all">🌐 All Jobs</option>
              <option value="applied">✅ My Applied Jobs</option>
              <option value="expiring">⚠️ Soon to Delete</option>
            </select>
          </div>
        </div>

        {/* Bottom Row: Locations */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label>State</label>
            <select value={selectedState} onChange={handleStateChange}>
              <option value="All">All of Nigeria</option>
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
          
          {selectedState !== 'All' && (
            <div className="input-group" style={{ flex: 1 }}>
              <label>City/Town</label>
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                <option value="All">All cities in {selectedState}</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--primary-color)' }}>
          <h2>Scanning the web for the latest jobs...</h2>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span>Found {filteredJobs.length} {viewMode === 'applied' ? 'applied' : 'active'} jobs</span>
            {filteredJobs.length > 0 && <span>Page {currentPage} of {totalPages}</span>}

            {/* Top Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" disabled={currentPage === 1} onClick={() => paginate(currentPage - 1)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--panel-bg)' }}>
                  Previous
                </button>
                <button className="btn" disabled={currentPage === totalPages} onClick={() => paginate(currentPage + 1)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--panel-bg)' }}>
                  Next Page
                </button>
              </div>
            )}
          </div>

          <div className="jobs-grid">
            {currentJobs.map(job => {
              const isApplied = appliedJobs.includes(job.url);
              const jobAgeDays = differenceInDays(new Date(), new Date(job.posted_date));
              const daysUntilDeletion = 30 - jobAgeDays;
              
              return (
                <div className="job-card glass-panel" key={job.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="company-name" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><Building size={16} /> {job.company}</span>
                    {isApplied && <span style={{ color: '#66fcf1', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Applied</span>}
                  </div>
                  <h3 style={{ margin: '0.5rem 0' }}>{job.title}</h3>
                  
                  {jobAgeDays >= 25 && (
                    <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: 'var(--danger)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                      <AlertTriangle size={14} />
                      Warning: Auto-deleting in {Math.max(1, daysUntilDeletion)} day{daysUntilDeletion !== 1 ? 's' : ''}
                    </div>
                  )}

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
                    onClick={() => handleApply(job.url)}
                  >
                    {isApplied ? 'View Application' : 'Apply Now'} <ExternalLink size={14} style={{ marginLeft: '6px' }}/>
                  </a>
                </div>
              );
            })}
            
            {filteredJobs.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                {viewMode === 'applied' ? 'You have not applied to any jobs yet.' : 'No jobs found matching your filters.'}
              </div>
            )}
          </div>

          {/* PAGINATION CONTROLS */}
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
                // Show a sliding window of 5 pages
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

export default JobBoard;
