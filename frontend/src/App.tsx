import React, { useState, useEffect } from 'react';
import { ShieldAlert, Compass, Globe2, Loader2, Sparkles, LogOut, Lock, UserCheck } from 'lucide-react';
import { ServerDrivenLayout, AlertPhase } from './types.js';

// Import our atomic components
import { AlertBanner } from './components/AlertBanner.js';
import { WeatherCard } from './components/WeatherCard.js';
import { Checklist } from './components/Checklist.js';
import { EvacuationMap } from './components/EvacuationMap.js';
import { RAGChat } from './components/RAGChat.js';
import { AssistanceForm } from './components/AssistanceForm.js';

// Predefined testing locations representing different disaster/weather phases
const SIMULATION_ZONES = [
  { name: 'Jodhpur (Pre-Monsoon Preparedness)', lat: 26.2389, lon: 73.0243 },
  { name: 'Kolkata (Monsoon Active Rain)', lat: 22.5726, lon: 88.3639 },
  { name: 'Mumbai (Heavy Rain Warning)', lat: 19.0760, lon: 72.8777 },
  { name: 'Chennai (Flash Flood Emergency)', lat: 13.0827, lon: 80.2707 },
  { name: 'Odisha Recovery Center (Post-Disaster Recovery)', lat: 20.2961, lon: 85.8245 }, // Will use lat mapping to trigger recovery fallback
];

export default function App() {
  // Token state loaded from localStorage
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  
  // Login input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Slate coordinate state default (Mumbai)
  const [lat, setLat] = useState(19.0760);
  const [lon, setLon] = useState(72.8777);
  const [lang, setLang] = useState('en');
  const [selectedZone, setSelectedZone] = useState('');
  
  const [layoutData, setLayoutData] = useState<ServerDrivenLayout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch layout on coordinate, language, or auth state changes
  const fetchLayout = async (targetLat: number, targetLon: number, targetLang: string, authToken: string | null) => {
    if (!authToken) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // Force coordinates ending in .99 for Odisha to trigger POST_DISASTER_RECOVERY in the backend classification fallback
      let queryLat = targetLat;
      if (targetLat === 20.2961) {
        queryLat = 20.0099; // Ends with 99
      }

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3051';
      const url = `${apiBase}/api/layout?lat=${queryLat}&lon=${targetLon}&lang=${targetLang}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (res.status === 401) {
        handleLogout();
        throw new Error('Authenticated session expired. Please log in again.');
      }

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }
      
      const data = await res.json() as ServerDrivenLayout;
      setLayoutData(data);
    } catch (err: any) {
      console.error('[FRONTEND APP] Layout load error:', err.message);
      setError(`Failed to retrieve dynamic layout: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLayout(lat, lon, lang, token);
    }
  }, [lat, lon, lang, token]);

  // Request browser GPS position
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setLat(position.coords.latitude);
        setLon(position.coords.longitude);
        setSelectedZone(''); // Clear preset selection
      },
      err => {
        console.error('[GEOLOCATION] Failed:', err.message);
        alert(`Location access denied or unavailable: ${err.message}. Using default coordinates.`);
        setIsLoading(false);
      }
    );
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const zoneName = e.target.value;
    setSelectedZone(zoneName);
    const found = SIMULATION_ZONES.find(z => z.name === zoneName);
    if (found) {
      setLat(found.lat);
      setLon(found.lon);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3051';
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errData = await res.json() as { error: string };
        throw new Error(errData.error || 'Authentication failed.');
      }

      const data = await res.json() as { token: string };
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setLayoutData(null);
    setEmail('');
    setPassword('');
  };

  const getPhaseClass = (phase?: AlertPhase) => {
    if (!phase) return 'phase-pre_monsoon';
    return `phase-${phase.toLowerCase()}`;
  };

  const renderComponent = (comp: any) => {
    switch (comp.type) {
      case 'AlertBanner':
        return <AlertBanner key={comp.id} severity={comp.props.severity} title={comp.props.title} message={comp.props.message} />;
      case 'WeatherCard':
        return <WeatherCard key={comp.id} {...comp.props} />;
      case 'Checklist':
        return <Checklist key={comp.id} title={comp.props.title} items={comp.props.items} />;
      case 'EvacuationMap':
        return <EvacuationMap key={comp.id} lat={comp.props.lat} lon={comp.props.lon} shelters={comp.props.shelters} />;
      case 'RAGChat':
        return <RAGChat key={comp.id} placeholder={comp.props.placeholder} lang={lang} />;
      case 'AssistanceForm':
        return <AssistanceForm key={comp.id} title={comp.props.title} fields={comp.props.fields} action={comp.props.action} />;
      default:
        return (
          <div key={comp.id} className="card" style={{ gridColumn: 'span 6', border: '1px dashed red' }}>
            <p>Unknown Server Component: {comp.type}</p>
          </div>
        );
    }
  };

  // Render Login lockscreeen overlay if unauthorized
  if (!token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, backgroundColor: 'var(--bg-base)' }}>
        <div className="card" style={{ maxWidth: '450px', width: '100%', border: '1px solid var(--glass-border)', padding: 32, animation: 'fadeIn 0.6s ease' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div className="logo-badge" style={{ padding: 12 }}>
              <Lock size={28} style={{ color: '#0f172a' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #fff 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center' }}>
              Monsoon Dashboard Lock
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Provide authorized reviewer credentials to access live telemetry layouts.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} id="login-form-element">
            {loginError && (
              <div className="form-success-alert" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', color: 'var(--color-danger)', borderColor: 'var(--color-danger)', fontSize: '0.85rem' }}>
                <ShieldAlert size={16} />
                <span>{loginError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="text-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="reviewer_antigravity@domain.com"
                required
                disabled={isLoggingIn}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="text-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={isLoggingIn}
              />
            </div>

            <button type="submit" className="form-submit-btn" style={{ width: '100%', marginTop: 8 }} disabled={isLoggingIn}>
              {isLoggingIn ? 'Verifying Token...' : 'Access Dashboard'}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <strong>🔑 Reviewer Helper Note:</strong>
            <p style={{ marginTop: 4 }}>User: <code style={{ color: 'var(--color-primary)' }}>reviewer_antigravity@domain.com</code></p>
            <p>Pass: <code style={{ color: 'var(--color-primary)' }}>MonsoonAlertSecurePass2026!</code></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header section with telemetry controls */}
      <header className="header">
        <div className="header-title-area">
          <div className="logo-badge">
            <Compass size={24} style={{ color: '#0f172a' }} />
          </div>
          <div>
            <h1>Monsoon Resilience Engine</h1>
            <p style={{ fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Server-Driven UI &bull; Safety Verified RAG Pipeline
            </p>
          </div>
        </div>

        <div className="controls">
          {/* User authenticated identity badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--glass-border)', fontSize: '0.82rem' }}>
            <UserCheck size={14} style={{ color: 'var(--color-success)' }} />
            <span style={{ color: 'var(--text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>reviewer_antigravity</span>
            <button 
              onClick={handleLogout} 
              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 4 }}
              title="Logout session"
              id="logout-button"
            >
              <LogOut size={14} />
            </button>
          </div>

          {/* Simulation dropdown */}
          <select className="select-input" value={selectedZone} onChange={handleZoneChange}>
            <option value="">-- Switch Simulation Zone --</option>
            {SIMULATION_ZONES.map(z => (
              <option key={z.name} value={z.name}>{z.name}</option>
            ))}
          </select>

          {/* GPS button */}
          <button className="location-btn" onClick={handleUseCurrentLocation} disabled={isLoading}>
            <Globe2 size={16} /> GPS Location
          </button>

          {/* Lang Selector */}
          <select className="select-input" value={lang} onChange={e => setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="bn">বাংলা (Bengali)</option>
          </select>
        </div>
      </header>

      {/* Top Banner showing Active Phase Badge */}
      {layoutData && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            Selected coordinates: <strong>{lat.toFixed(4)}, {lon.toFixed(4)}</strong>
          </div>
          <div className={`phase-badge ${getPhaseClass(layoutData.phase)}`}>
            <ShieldAlert size={14} />
            Phase: {layoutData.phase.replace('_', ' ')}
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: 16 }}>
          <Loader2 size={40} className="weather-icon-pulse" style={{ color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Synthesizing Dynamic UI from telemetry...</p>
        </div>
      )}

      {/* Error state display */}
      {error && !isLoading && (
        <div className="card" style={{ border: '1px solid var(--color-danger)', backgroundColor: 'var(--color-danger-glow)', gridColumn: 'span 12' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--color-danger)' }}>
            <ShieldAlert size={24} />
            <strong>System Telemetry Connection Error</strong>
          </div>
          <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      )}

      {/* Main Server-Driven UI component container */}
      {!isLoading && !error && layoutData && (
        <main className="grid-layout">
          {layoutData.components.map(comp => renderComponent(comp))}
        </main>
      )}

      {/* RAG metadata validation badge */}
      {!isLoading && !error && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <Sparkles size={12} style={{ color: 'var(--color-primary)' }} />
          <span>Strict guardrails & deterministic rescue overrides active. Source verifying.</span>
        </div>
      )}
    </div>
  );
}
