import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, LogOut, BarChart2, Sparkles,
  RefreshCw, AlertTriangle, Send, MessageCircle, X, CheckCircle,
  Settings, Zap, Activity, Database, ChevronUp, ChevronDown, Plus,
  BarChart3, LineChartIcon, AreaChartIcon,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WorkspaceSidebar from '../components/WorkspaceSidebar';
import TeamManagement from '../components/TeamManagement';

/* ─── Palette ──────────────────────────────────────────────────────── */
const PALETTE = ['#C0392B', '#3498db', '#27ae60', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#2980b9'];

/* ─── Helpers ──────────────────────────────────────────────────────── */
function n(v) { return parseFloat(v) || 0; }
function fmt(v) {
  const abs = Math.abs(n(v));
  if (abs >= 1e7) return `${(n(v) / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${(n(v) / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${(n(v) / 1e3).toFixed(1)}K`;
  return n(v).toFixed(2);
}

function parseAnalysis(raw) {
  if (!raw) return null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { }
  return null;
}

function detectAnomalies(rows, numericCols) {
  if (!rows || rows.length < 2) return [];
  const alerts = [];
  const cur = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  numericCols.slice(0, 5).forEach(col => {
    const cv = n(cur[col]), pv = n(prev[col]);
    if (pv > 0) {
      const change = ((cv - pv) / Math.abs(pv)) * 100;
      if (Math.abs(change) > 50) {
        alerts.push(`${col} ${change > 0 ? 'surged' : 'dropped'} ${Math.abs(Math.round(change))}% in the latest period.`);
      }
    }
    if (cv < 0 && col.toLowerCase().includes('profit')) {
      alerts.push(`${col} is negative in the latest period.`);
    }
  });
  return alerts.slice(0, 4);
}

/* ─── Sync Countdown ───────────────────────────────────────────────── */
function SyncIndicator({ countdown, syncing, onSync }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 12px', borderRadius: '20px',
      background: syncing ? 'rgba(192,57,43,0.08)' : 'rgba(39,174,96,0.08)',
      border: `1px solid ${syncing ? 'rgba(192,57,43,0.2)' : 'rgba(39,174,96,0.2)'}`,
      cursor: 'pointer', fontSize: '12px', fontWeight: '600',
      color: syncing ? 'var(--primary)' : 'var(--success)',
    }} onClick={onSync} title="Click to sync now">
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: syncing ? 'var(--primary)' : 'var(--success)',
        animation: syncing ? 'pulse 1s ease-in-out infinite' : 'none',
      }} />
      {syncing ? 'Syncing…' : `Live · ${countdown}s`}
    </div>
  );
}

/* ─── KPI Card ─────────────────────────────────────────────────────── */
function KpiCard({ kpi, pinned, onTogglePin }) {
  const up = kpi.trend >= 0;
  return (
    <div className="premium-card" style={{
      margin: 0, maxWidth: 'none', padding: '20px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginRight: '8px' }}>
          {kpi.label}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {kpi.trend !== 0 && (
            <span style={{
              fontSize: '10px', fontWeight: '700',
              color: up ? 'var(--success)' : 'var(--primary)',
              display: 'flex', alignItems: 'center', gap: '2px',
            }}>
              {up ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {Math.abs(kpi.trend)}%
            </span>
          )}
          <button
            onClick={() => onTogglePin(kpi.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
              color: pinned ? 'var(--primary)' : 'var(--text-dim)',
              opacity: pinned ? 1 : 0.5, fontSize: '14px',
            }}
            title={pinned ? 'Unpin KPI' : 'Pin KPI'}
          >
            {pinned ? '★' : '☆'}
          </button>
        </div>
      </div>
      <p style={{
        fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)',
        letterSpacing: '-0.5px', lineHeight: 1,
      }}>
        {fmt(kpi.value)}
      </p>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
        background: up ? 'var(--success)' : 'var(--primary)',
        opacity: 0.4,
      }} />
    </div>
  );
}

/* ─── Charts Panel ─────────────────────────────────────────────────── */
function ChartsPanel({ rows, columns, numericCols, labelCol }) {
  const [activeChart, setActiveChart] = useState('line');
  if (!rows || !rows.length || !numericCols.length) return null;

  const label = labelCol || (columns.find(c => !numericCols.includes(c)) || 'index');
  const chartData = rows.map((r, i) => {
    const obj = { _label: r[label] || String(i + 1) };
    numericCols.forEach(c => { obj[c] = n(r[c]); });
    return obj;
  });

  const fmtTick = v => fmt(v);

  return (
    <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)' }}>Data Visualization</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'line', icon: <LineChartIcon size={14} /> },
            { id: 'bar', icon: <BarChart3 size={14} /> },
            { id: 'area', icon: <AreaChartIcon size={14} /> },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveChart(t.id)} style={{
              padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
              background: activeChart === t.id ? 'var(--primary)' : '#fff',
              color: activeChart === t.id ? '#fff' : 'var(--text-dim)',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}>{t.icon}</button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {activeChart === 'bar' ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
            <XAxis dataKey="_label" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickFormatter={fmtTick} />
            <Tooltip formatter={v => fmt(v)} />
            <Legend />
            {numericCols.slice(0, 4).map((c, i) => (
              <Bar key={c} dataKey={c} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : activeChart === 'area' ? (
          <AreaChart data={chartData}>
            <defs>
              {numericCols.slice(0, 4).map((c, i) => (
                <linearGradient key={c} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.03} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
            <XAxis dataKey="_label" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickFormatter={fmtTick} />
            <Tooltip formatter={v => fmt(v)} />
            <Legend />
            {numericCols.slice(0, 4).map((c, i) => (
              <Area key={c} type="monotone" dataKey={c} stroke={PALETTE[i % PALETTE.length]}
                fill={`url(#g${i})`} strokeWidth={2} />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
            <XAxis dataKey="_label" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickFormatter={fmtTick} />
            <Tooltip formatter={v => fmt(v)} />
            <Legend />
            {numericCols.slice(0, 6).map((c, i) => (
              <Line key={c} type="monotone" dataKey={c} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Trend Mini Chart ─────────────────────────────────────────────── */
function TrendSparkline({ data, col }) {
  const vals = data.map(r => n(r[col]));
  if (!vals.some(v => v !== 0)) return null;
  const sData = vals.map((v, i) => ({ i, v }));
  const color = vals[vals.length - 1] >= vals[0] ? 'var(--success)' : 'var(--primary)';
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={sData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ─── AI Insights Panel ────────────────────────────────────────────── */
function AiInsightsPanel({ analysis, generating, onGenerate, chartData }) {
  const parsed = parseAnalysis(analysis);
  const [chatMsg, setChatMsg] = useState('');
  const [chatThreads, setChatThreads] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef();
  const { API } = useAuth();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatThreads]);

  async function handleChat(e) {
    e.preventDefault();
    if (!chatMsg.trim() || chatLoading) return;
    const userMsg = chatMsg.trim();
    setChatMsg('');
    setChatThreads(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      const r = await API.post('/api/user/chat', { message: userMsg });
      setChatThreads(prev => [...prev, { role: 'assistant', content: r.data.reply }]);
    } catch {
      setChatThreads(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to the AI right now." }]);
    } finally { setChatLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* AI Briefing */}
      <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--primary)" /> Executive AI Briefing
          </h3>
          <button onClick={onGenerate} disabled={generating} className="btn-premium"
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px' }}>
            {generating ? 'Generating…' : parsed ? 'Regenerate' : 'Generate Insights'}
          </button>
        </div>

        {generating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[85, 65, 75].map((w, i) => (
              <div key={i} style={{ height: '12px', borderRadius: '6px', background: 'var(--bg-mid)', width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!generating && !analysis && (
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic' }}>
            Click "Generate Insights" to produce a data-driven executive summary powered by AI.
          </p>
        )}

        {!generating && analysis && !parsed && (
          <p style={{ color: 'var(--primary)', fontSize: '13px' }}>{analysis}</p>
        )}

        {!generating && parsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {parsed.observations?.map((obs, i) => (
              <div key={i} style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                padding: '12px 14px', borderRadius: '10px',
                background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)',
              }}>
                <span style={{
                  flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%',
                  background: 'rgba(192,57,43,0.1)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '800',
                }}>{i + 1}</span>
                <p style={{ color: 'var(--text-mid)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>{obs}</p>
              </div>
            ))}
            {parsed.risk && (
              <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.2)' }}>
                <p style={{ fontSize: '10px', fontWeight: '800', color: '#E74C3C', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>⚠ Key Risk</p>
                <p style={{ color: 'var(--text-dark)', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>{parsed.risk}</p>
              </div>
            )}
            {parsed.action && (
              <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.2)' }}>
                <p style={{ fontSize: '10px', fontWeight: '800', color: '#27ae60', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>✓ Recommended Action</p>
                <p style={{ color: 'var(--text-dark)', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>{parsed.action}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Chat */}
      <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageCircle size={16} color="var(--primary)" /> Ask your data
        </h3>
        <div style={{ minHeight: '120px', maxHeight: '300px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {chatThreads.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic' }}>
              Ask me anything about your financial data — trends, comparisons, anomalies…
            </p>
          )}
          {chatThreads.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%', padding: '10px 14px', borderRadius: '12px',
              fontSize: '13px', lineHeight: '1.5',
              background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-subtle)',
              color: m.role === 'user' ? '#fff' : 'var(--text-dark)',
            }}>{m.content}</div>
          ))}
          {chatLoading && (
            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-subtle)', fontSize: '13px', color: 'var(--text-dim)' }}>
              Thinking…
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleChat} style={{ display: 'flex', gap: '10px' }}>
          <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
            placeholder="E.g. Which column grew the most last month?"
            className="glass-input" style={{ flex: 1, fontSize: '13px', padding: '10px 14px' }} />
          <button type="submit" disabled={chatLoading || !chatMsg.trim()} className="btn-premium" style={{ padding: '10px 16px', flexShrink: 0 }}>
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ────────────────────────────────────────────────── */
export default function UserDashboard() {
  const { user, logout, API } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [dashboards, setDashboards] = useState([]);
  const [activeDashboard, setActiveDashboard] = useState(null);
  const [userRole, setUserRole] = useState('OWNER'); // 'OWNER' | 'EDITOR' | 'VIEWER'
  const [chartData, setChartData] = useState(null);
  const [autoKpis, setAutoKpis] = useState([]);
  const [pinnedKpis, setPinnedKpis] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pinned_kpis') || '[]'); } catch { return []; }
  });
  const [analysis, setAnalysis] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [dismissedAnomalies, setDismissedAnomalies] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const syncIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const connectedSheet = JSON.parse(localStorage.getItem('connected_sheet') || '{}');

  // Load user workspace and role
  const loadWorkspace = useCallback(async () => {
    try {
      const res = await API.get('/api/dashboards');
      if (res.data && res.data.length > 0) {
        setDashboards(res.data);
        const current = res.data[0];
        setActiveDashboard(current);
        setUserRole(current.user_role || 'OWNER');
      } else {
        // Create initial default workspace for user
        const newDash = await API.post('/api/dashboards', {
          name: connectedSheet.name ? `${connectedSheet.name} Workspace` : 'Ledgerly Financial Workspace',
          spreadsheet_url: connectedSheet.id ? `https://docs.google.com/spreadsheets/d/${connectedSheet.id}` : '',
          selected_tab: connectedSheet.tab || 'all'
        });
        setActiveDashboard(newDash.data);
        setUserRole('OWNER');
        setDashboards([newDash.data]);
      }
    } catch (err) {
      console.warn('Dashboard workspace fetch error:', err);
    }
  }, [API, connectedSheet.id, connectedSheet.name, connectedSheet.tab]);

  const fetchData = useCallback(async (showMsg = false) => {
    try {
      setSyncing(true);
      // If we have a connected sheet, re-sync it
      if (connectedSheet.id) {
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${connectedSheet.id}`;
        const googleAccessToken = localStorage.getItem('google_access_token') || '';
        try {
          await API.post('/api/user/sync-google-sheet', {
            spreadsheetUrl,
            selectedTab: connectedSheet.tab,
            googleAccessToken,
          });
        } catch (syncErr) {
          console.warn('Auto-sync failed, attempting to load cached DB data:', syncErr);
        }
      }
      const [chartsRes, kpisRes] = await Promise.all([
        API.get('/api/user/charts'),
        API.get('/api/user/auto-kpis'),
      ]);
      if (chartsRes.data.rows?.length) {
        setChartData(chartsRes.data);
        setAnomalies(detectAnomalies(chartsRes.data.rows, chartsRes.data.numericCols));
      }
      setAutoKpis(kpisRes.data.kpis || []);
      if (showMsg) setSyncMsg({ type: 'success', text: 'Synced successfully' });
    } catch (err) {
      if (showMsg) setSyncMsg({ type: 'error', text: err.response?.data?.error || 'Sync failed' });
    } finally {
      setSyncing(false);
      setCountdown(30);
    }
  }, [API, connectedSheet.id, connectedSheet.tab]);

  // Initial load
  useEffect(() => {
    loadWorkspace();
    fetchData();
  }, []);

  // 30-second auto-sync timer
  useEffect(() => {
    // Countdown tick
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) return 30;
        return c - 1;
      });
    }, 1000);

    // Sync every 30s
    syncIntervalRef.current = setInterval(() => {
      fetchData();
    }, 30000);

    return () => {
      clearInterval(countdownRef.current);
      clearInterval(syncIntervalRef.current);
    };
  }, [fetchData]);

  // Auto-dismiss sync message
  useEffect(() => {
    if (syncMsg) {
      const t = setTimeout(() => setSyncMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [syncMsg]);

  // Pinned KPIs persist
  useEffect(() => {
    localStorage.setItem('pinned_kpis', JSON.stringify(pinnedKpis));
  }, [pinnedKpis]);

  function togglePin(key) {
    setPinnedKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function handleGenerateAI() {
    if (!chartData?.rows?.length) return;
    setGeneratingAI(true);
    setAnalysis('');
    try {
      const r = await API.post('/api/user/generate-analysis', {
        company: connectedSheet.name || 'My Dataset',
        batchId: null,
      });
      setAnalysis(r.data.analysis);
    } catch (err) {
      setAnalysis(err.response?.data?.error || 'Failed to generate AI analysis.');
    } finally { setGeneratingAI(false); }
  }

  const handleLogout = () => {
    logout();
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('connected_sheet');
    navigate('/login');
  };

  const handleManualSync = () => {
    setCountdown(30);
    fetchData(true);
  };

  /* Display KPIs: pinned first, then rest if < 5 total */
  const pinnedKpisList = autoKpis.filter(k => pinnedKpis.includes(k.key));
  const unpinnedKpis = autoKpis.filter(k => !pinnedKpis.includes(k.key));
  const displayKpis = pinnedKpis.length > 0
    ? [...pinnedKpisList, ...unpinnedKpis].slice(0, 5)
    : autoKpis.slice(0, 5);

  const TAB_ITEMS = [
    { id: 'overview', label: 'Overview', icon: <Activity size={16} /> },
    { id: 'charts', label: 'Charts', icon: <BarChart2 size={16} /> },
    { id: 'kpis', label: 'KPIs', icon: <Zap size={16} /> },
    { id: 'insights', label: 'AI Insights', icon: <Sparkles size={16} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)', display: 'flex', color: 'var(--text-dark)' }}>
      {/* ── Left Sidebar Menu ────────────────────────────────────────── */}
      <WorkspaceSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dashboard={activeDashboard}
        userRole={userRole}
        user={user}
        onLogout={handleLogout}
      />

      {/* ── Right Content Area ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        {/* Top Header */}
        <header style={{
          background: '#FFFFFF',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', sticky: 'top', zIndex: 40,
          boxShadow: '0 1px 4px rgba(26,22,20,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
              {activeTab === 'overview' && '📊 Executive Dashboard'}
              {activeTab === 'charts' && '📈 Financial Charts & Trends'}
              {activeTab === 'kpis' && '⚡ Key Performance Indicators'}
              {activeTab === 'insights' && '✨ AI Financial Briefing'}
              {activeTab === 'sheetsync' && '🔗 Google Sheet Connection'}
              {activeTab === 'team' && '👥 Team & Access Control'}
              {activeTab === 'settings' && '⚙️ Workspace Settings'}
            </span>
            {connectedSheet.name && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', background: 'var(--bg-subtle)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-subtle)', fontWeight: 600 }}>
                Sheet: {connectedSheet.name}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <SyncIndicator countdown={countdown} syncing={syncing} onSync={handleManualSync} />
            {userRole === 'OWNER' || userRole === 'EDITOR' ? (
              <button
                onClick={() => navigate('/connect-sheet')}
                className="btn-ghost"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                <Settings size={14} /> Connect / Change Sheet
              </button>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                👁️ Viewer Mode (Read-Only)
              </span>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: '28px 32px', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

          {/* Alerts row */}
          {syncMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px',
              marginBottom: '20px', fontSize: '13px',
              background: syncMsg.type === 'success' ? 'rgba(39,174,96,0.08)' : 'rgba(192,57,43,0.08)',
              border: `1px solid ${syncMsg.type === 'success' ? 'rgba(39,174,96,0.3)' : 'var(--border-red)'}`,
              color: syncMsg.type === 'success' ? 'var(--success)' : 'var(--primary)',
            }}>
              {syncMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              {syncMsg.text}
            </div>
          )}

          {/* Render Team Management Tab */}
          {activeTab === 'team' && (
            <TeamManagement
              dashboardId={activeDashboard?.id}
              userRole={userRole}
              token={localStorage.getItem('token')}
            />
          )}

          {/* Render Google Sheet Sync Tab */}
          {activeTab === 'sheetsync' && (
            <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '30px' }}>
              <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.4rem', color: 'var(--text-dark)' }}>🔗 Google Sheet Integration</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '24px' }}>
                Connect your Google Sheet or Google Drive file to automatically synchronize financial rows into Ledgerly.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.5px' }}>CONNECTED SPREADSHEET</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '4px', color: 'var(--primary)' }}>{connectedSheet.name || 'None'}</div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.5px' }}>ACTIVE TAB</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '4px', color: '#3498db' }}>{connectedSheet.tab || 'all'}</div>
                </div>
              </div>
              {userRole === 'OWNER' || userRole === 'EDITOR' ? (
                <button
                  className="btn-premium"
                  onClick={() => navigate('/connect-sheet')}
                  style={{ padding: '12px 24px', fontSize: '0.88rem' }}
                >
                  Configure / Reconnect Google Sheet
                </button>
              ) : (
                <div style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
                  ⚠️ Only Owners and Editors can alter the connected spreadsheet data source.
                </div>
              )}
            </div>
          )}

          {/* Render Workspace Settings Tab */}
          {activeTab === 'settings' && (
            <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '30px' }}>
              <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.4rem', color: 'var(--text-dark)' }}>⚙️ Workspace Settings</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '24px' }}>
                Manage workspace parameters, role defaults, and security configurations.
              </p>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-mid)', marginBottom: '6px', fontWeight: 600 }}>Workspace Name</label>
                <input
                  type="text"
                  readOnly
                  value={activeDashboard?.name || 'Ledgerly Financial Workspace'}
                  className="glass-input"
                  style={{ maxWidth: '400px' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-mid)', marginBottom: '6px', fontWeight: 600 }}>Server RBAC Enforcement</label>
                <div style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 700 }}>Active (Strict role validation enabled on all endpoints)</div>
              </div>
            </div>
          )}

        {!dismissedAnomalies && anomalies.length > 0 && (
          <div style={{
            background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.3)',
            padding: '14px 18px', borderRadius: '12px', display: 'flex', gap: '12px',
            alignItems: 'flex-start', marginBottom: '24px', color: 'var(--primary)',
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>Anomalies Detected</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', lineHeight: '1.7' }}>
                {anomalies.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
            <button onClick={() => setDismissedAnomalies(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* No data state */}
        {!chartData && !syncing && (
          <div style={{
            textAlign: 'center', padding: '80px 40px', background: '#fff',
            borderRadius: '20px', border: '1px solid var(--border-subtle)',
          }}>
            <Database size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-mid)' }}>No data loaded yet</p>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '6px', marginBottom: '24px' }}>
              Connect a Google Sheet to get started
            </p>
            <button className="btn-premium" onClick={() => navigate('/connect-sheet')}>
              Connect Google Sheet
            </button>
          </div>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
        {activeTab === 'overview' && chartData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* KPI row — top 5 */}
            {displayKpis.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)' }}>
                    Key Metrics <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '400' }}>— auto-detected</span>
                  </h2>
                  <button onClick={() => setActiveTab('kpis')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Settings size={13} /> Customize
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(displayKpis.length, 5)}, 1fr)`, gap: '16px' }}>
                  {displayKpis.map(kpi => (
                    <KpiCard key={kpi.key} kpi={kpi} pinned={pinnedKpis.includes(kpi.key)} onTogglePin={togglePin} />
                  ))}
                </div>
              </div>
            )}

            {/* Row data summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
              <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>Dataset Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Total Rows</span>
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{chartData.rows?.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Numeric Columns</span>
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{chartData.numericCols?.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Sheet</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{connectedSheet.name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Tab</span>
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{connectedSheet.tab === 'all' ? 'All tabs' : connectedSheet.tab || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Auto-sync</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--success)' }}>Every 30s</span>
                  </div>
                </div>
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                  <button onClick={handleManualSync} disabled={syncing} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}>
                    <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                </div>
              </div>

              {/* Mini chart */}
              {chartData.numericCols?.length > 0 && (
                <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>Quick Trends</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {chartData.numericCols.slice(0, 4).map((col, i) => {
                      const vals = chartData.rows.map(r => ({ i, v: n(r[col]) }));
                      const latest = n(chartData.rows[chartData.rows.length - 1]?.[col]);
                      const prev = n(chartData.rows[chartData.rows.length - 2]?.[col]);
                      const change = prev !== 0 ? ((latest - prev) / Math.abs(prev)) * 100 : 0;
                      return (
                        <div key={col} style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{col}</p>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: change >= 0 ? 'var(--success)' : 'var(--primary)' }}>
                              {change >= 0 ? '+' : ''}{Math.round(change)}%
                            </span>
                          </div>
                          <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '6px' }}>{fmt(latest)}</p>
                          <ResponsiveContainer width="100%" height={32}>
                            <LineChart data={vals}>
                              <Line type="monotone" dataKey="v" stroke={change >= 0 ? 'var(--success)' : 'var(--primary)'} strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CHARTS TAB ───────────────────────────────────────────── */}
        {activeTab === 'charts' && chartData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <ChartsPanel
              rows={chartData.rows}
              columns={chartData.columns}
              numericCols={chartData.numericCols}
              labelCol={chartData.labelCol}
            />

            {/* Additional breakdown charts */}
            {chartData.numericCols?.length >= 2 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Top values bar */}
                <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>Column Totals</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData.numericCols.slice(0, 6).map((col, i) => ({
                      name: col.length > 12 ? col.slice(0, 12) + '…' : col,
                      value: chartData.rows.reduce((a, r) => a + n(r[col]), 0),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickFormatter={fmt} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.numericCols.slice(0, 6).map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Latest vs previous */}
                <div className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>Latest vs Previous Period</h3>
                  {chartData.rows?.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData.numericCols.slice(0, 5).map(col => ({
                        name: col.length > 12 ? col.slice(0, 12) + '…' : col,
                        Current: n(chartData.rows[chartData.rows.length - 1]?.[col]),
                        Previous: n(chartData.rows[chartData.rows.length - 2]?.[col]),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickFormatter={fmt} />
                        <Tooltip formatter={v => fmt(v)} />
                        <Legend />
                        <Bar dataKey="Current" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Previous" fill="var(--bg-mid)" stroke="var(--border-subtle)" strokeWidth={1} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p style={{ color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', paddingTop: '40px' }}>Need at least 2 rows for comparison.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── KPIs TAB ─────────────────────────────────────────────── */}
        {activeTab === 'kpis' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700' }}>KPI Management</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Pin the metrics that matter most — they'll appear first on your Overview.
                </p>
              </div>
              <button onClick={() => fetchData()} disabled={syncing} className="btn-ghost" style={{ fontSize: '12px' }}>
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </button>
            </div>
            {autoKpis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-dim)', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                <Zap size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p>No KPIs auto-detected yet. Connect a sheet with numeric data.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {autoKpis.map((kpi, i) => (
                  <div key={kpi.key} className="premium-card" style={{ margin: 0, maxWidth: 'none', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: `${PALETTE[i % PALETTE.length]}18`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: PALETTE[i % PALETTE.length], flexShrink: 0,
                        }}>
                          <BarChart3 size={16} />
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dark)' }}>{kpi.label}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>Numeric column</p>
                        </div>
                      </div>
                      <button
                        onClick={() => togglePin(kpi.key)}
                        style={{
                          background: pinnedKpis.includes(kpi.key) ? 'rgba(192,57,43,0.08)' : 'var(--bg-subtle)',
                          border: `1px solid ${pinnedKpis.includes(kpi.key) ? 'var(--border-red)' : 'var(--border-subtle)'}`,
                          borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: '600',
                          color: pinnedKpis.includes(kpi.key) ? 'var(--primary)' : 'var(--text-dim)',
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}
                      >
                        {pinnedKpis.includes(kpi.key) ? '★ Pinned' : '☆ Pin'}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>Latest</p>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>{fmt(kpi.value)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>Trend</p>
                        <p style={{
                          fontSize: '16px', fontWeight: '800',
                          color: kpi.trend >= 0 ? 'var(--success)' : 'var(--primary)',
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                          {kpi.trend >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {Math.abs(kpi.trend)}%
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>Total</p>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-mid)' }}>{fmt(kpi.sum)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>Average</p>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-mid)' }}>{fmt(kpi.avg)}</p>
                      </div>
                    </div>
                    {chartData && (
                      <div style={{ marginTop: '10px' }}>
                        <TrendSparkline data={chartData.rows} col={kpi.key} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AI INSIGHTS TAB ──────────────────────────────────────── */}
        {activeTab === 'insights' && (
          <AiInsightsPanel
            analysis={analysis}
            generating={generatingAI}
            onGenerate={handleGenerateAI}
            chartData={chartData}
          />
        )}

      </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
