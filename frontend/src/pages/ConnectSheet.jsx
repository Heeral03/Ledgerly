import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, Table2, ChevronRight, CheckCircle, Loader, FileSpreadsheet, ArrowRight, LogOut } from 'lucide-react';

/* ── Step indicator ─────────────────────────────────────────────── */
function Steps({ current }) {
  const steps = ['Connect Account', 'Choose Sheet', 'Select Tab'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '48px' }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--bg-mid)',
                color: done || active ? '#fff' : 'var(--text-dim)',
                fontSize: '13px', fontWeight: '700',
                boxShadow: active ? '0 4px 14px rgba(192,57,43,0.3)' : 'none',
                transition: 'all 0.3s ease',
              }}>
                {done ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span style={{
                fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px',
                color: active ? 'var(--primary)' : done ? 'var(--success)' : 'var(--text-dim)',
                whiteSpace: 'nowrap',
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: '60px', height: '2px', margin: '0 4px 24px',
                background: done ? 'var(--success)' : 'var(--border-subtle)',
                transition: 'background 0.3s ease',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ConnectSheet() {
  const navigate = useNavigate();
  const { user, logout, API } = useAuth();
  const [step, setStep] = useState(0);         // 0=connect, 1=choose sheet, 2=select tab
  const [connectionMode, setConnectionMode] = useState('drive'); // 'drive' or 'link'
  const [accessToken, setAccessToken] = useState(localStorage.getItem('google_access_token') || '');
  const [sheets, setSheets] = useState([]);    // list of spreadsheets from Drive
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [customUrl, setCustomUrl] = useState('');
  const [tabs, setTabs] = useState([]);        // worksheets in selected spreadsheet
  const [selectedTab, setSelectedTab] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

  // On mount if we already have a token, go straight to step 1
  useEffect(() => {
    if (accessToken) {
      setStep(1);
      fetchSheets(accessToken);
    }
  }, []);

  async function fetchSheets(token) {
    setLoading(true);
    setError('');
    try {
      const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id%2Cname%2CmodifiedTime)&orderBy=modifiedTime+desc&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('google_access_token');
          setStep(0);
          setError('Session expired. Please reconnect your Google Account.');
          return;
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to fetch spreadsheets from Google Drive');
      }
      const data = await res.json();
      setSheets(data.files || []);
      setStep(1);
    } catch (e) {
      setError(e.message || 'Could not list your spreadsheets from Google Drive.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTabs(sheet, token) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}?fields=sheets.properties(title,sheetId)`,
        { headers: { Authorization: `Bearer ${token || accessToken}` } }
      );
      if (!res.ok) throw new Error('Could not read sheet structure');
      const data = await res.json();
      const sheetTabs = (data.sheets || []).map(s => s.properties.title);
      setTabs(sheetTabs);
      setStep(2);
    } catch (e) {
      // Fallback if sheets API metadata fails (e.g. private sheet or restricted scope)
      setTabs(['Sheet1']);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  function selectSheet(sheet) {
    setSelectedSheet(sheet);
    setSelectedTab(null);
    fetchTabs(sheet);
  }

  function handleCustomUrlSubmit(e) {
    e.preventDefault();
    if (!customUrl.trim()) return;

    const match = customUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      setError('Invalid Google Sheet URL format. Please paste a full Google Sheet URL.');
      return;
    }

    const sheetId = match[1];
    const sheetObj = { id: sheetId, name: 'Custom Google Sheet' };
    setSelectedSheet(sheetObj);
    setSelectedTab(null);
    fetchTabs(sheetObj);
  }

  async function handleConnect() {
    setSyncing(true);
    setError('');
    try {
      const exportUrl = `https://docs.google.com/spreadsheets/d/${selectedSheet.id}/export?format=xlsx`;

      localStorage.setItem('connected_sheet', JSON.stringify({
        id: selectedSheet.id,
        name: selectedSheet.name,
        tab: selectedTab,
        exportUrl,
      }));

      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${selectedSheet.id}`;
      await API.post('/api/user/sync-google-sheet', {
        spreadsheetUrl,
        selectedTab,
        googleAccessToken: accessToken,
      });

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sheet data. Make sure the sheet is accessible.');
    } finally {
      setSyncing(false);
    }
  }

  const handleLogout = () => {
    logout();
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('connected_sheet');
    navigate('/login');
  };

  return (
    <div className="content-wrapper" style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '60px',
        background: '#fff', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={16} color="#fff" />
          </div>
          <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>Ledgerly</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user?.picture && <img src={user.picture} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border-subtle)' }} />}
          <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>{user?.name}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ marginTop: '60px', width: '100%', maxWidth: '560px' }}>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
            Connect your data
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-dim)', marginTop: '6px' }}>
            Link a Google Sheet to power your financial dashboard
          </p>
        </div>

        <Steps current={step} />

        {error && (
          <div style={{
            background: 'rgba(192,57,43,0.07)', border: '1px solid var(--border-red)',
            borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
            fontSize: '13px', color: 'var(--primary)',
          }}>
            {error}
          </div>
        )}

        {/* ── Step 0: Connect Google Account ─────────────────────────── */}
        {step === 0 && (
          <div className="premium-card animate-slide-up" style={{ textAlign: 'center', padding: '48px 40px' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(192,57,43,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <FileSpreadsheet size={36} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Connect Google Account</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '28px', lineHeight: '1.6' }}>
              We need read-only access to your Google Drive to list your spreadsheets or sync private sheets.
            </p>
            <button onClick={handleLogout} className="btn-premium" style={{ width: '100%' }}>
              Sign in with Google
            </button>
          </div>
        )}

        {/* ── Step 1: Choose Spreadsheet ─────────────────────────────── */}
        {step === 1 && (
          <div className="premium-card animate-slide-up" style={{ padding: '28px', maxWidth: 'none' }}>
            {/* Mode selection tabs */}
            <div style={{
              display: 'flex', background: 'var(--bg-mid)', borderRadius: '10px', padding: '4px',
              marginBottom: '20px', gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => setConnectionMode('drive')}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                  fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  background: connectionMode === 'drive' ? '#fff' : 'transparent',
                  color: connectionMode === 'drive' ? 'var(--text-dark)' : 'var(--text-dim)',
                  boxShadow: connectionMode === 'drive' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Choose from Drive
              </button>
              <button
                type="button"
                onClick={() => setConnectionMode('link')}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                  fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  background: connectionMode === 'link' ? '#fff' : 'transparent',
                  color: connectionMode === 'link' ? 'var(--text-dark)' : 'var(--text-dim)',
                  boxShadow: connectionMode === 'link' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Paste Sheet Link
              </button>
            </div>

            {connectionMode === 'drive' ? (
              <>
                <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Your Google Sheets</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px' }}>Choose a spreadsheet to connect</p>

                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px', color: 'var(--text-dim)' }}>
                    <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Loading your spreadsheets…</span>
                  </div>
                ) : sheets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-dim)' }}>
                    <FileSpreadsheet size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>No Google Sheets found in your Drive.</p>
                    <p style={{ fontSize: '12px', marginBottom: '16px' }}>You can paste a Google Sheet URL directly instead.</p>
                    <button
                      type="button"
                      onClick={() => setConnectionMode('link')}
                      className="btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                    >
                      Paste Sheet Link
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                    {sheets.map(sheet => (
                      <button
                        key={sheet.id}
                        onClick={() => selectSheet(sheet)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 16px', borderRadius: '12px', border: '1.5px solid var(--border-subtle)',
                          background: '#fff', cursor: 'pointer', textAlign: 'left', width: '100%',
                          transition: 'all 0.2s ease', gap: '12px',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--border-red)';
                          e.currentTarget.style.background = 'rgba(192,57,43,0.02)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#0F9D58', flexShrink: 0 }}>
                            <FileSpreadsheet size={20} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sheet.name}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                              Modified {new Date(sheet.modifiedTime).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={handleCustomUrlSubmit}>
                <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Paste Spreadsheet URL</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px' }}>
                  Paste the full web link to any Google Sheet you have access to.
                </p>
                <div style={{ marginBottom: '20px' }}>
                  <input
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: '10px',
                      border: '1.5px solid var(--border-subtle)', fontSize: '13px',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!customUrl.trim() || loading}
                  className="btn-premium"
                  style={{ width: '100%', padding: '12px' }}
                >
                  {loading ? 'Reading Sheet…' : 'Continue to Select Tab'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Step 2: Select Tab ─────────────────────────────────────── */}
        {step === 2 && selectedSheet && (
          <div className="premium-card animate-slide-up" style={{ padding: '28px', maxWidth: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <button
                onClick={() => { setStep(1); setSelectedSheet(null); setSelectedTab(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                ← Back
              </button>
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Select a sheet tab</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '20px' }}>
              From "<strong>{selectedSheet.name}</strong>"
            </p>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px', color: 'var(--text-dim)' }}>
                <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Loading tabs…</span>
              </div>
            ) : (
              <>
                {/* All tabs option */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {['all', ...tabs].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '13px 16px', borderRadius: '10px', border: '1.5px solid',
                        borderColor: selectedTab === tab ? 'var(--primary)' : 'var(--border-subtle)',
                        background: selectedTab === tab ? 'rgba(192,57,43,0.04)' : '#fff',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.2s ease',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      <Table2 size={16} color={selectedTab === tab ? 'var(--primary)' : 'var(--text-dim)'} />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: selectedTab === tab ? 'var(--primary)' : 'var(--text-dark)' }}>
                        {tab === 'all' ? '📋 All Tabs (sync everything)' : tab}
                      </span>
                      {selectedTab === tab && <CheckCircle size={16} color="var(--primary)" style={{ marginLeft: 'auto' }} />}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleConnect}
                  disabled={!selectedTab || syncing}
                  className="btn-premium"
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', opacity: selectedTab ? 1 : 0.5 }}
                >
                  {syncing ? (
                    <>
                      <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading data…
                    </>
                  ) : (
                    <> Open Dashboard <ArrowRight size={16} /> </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
