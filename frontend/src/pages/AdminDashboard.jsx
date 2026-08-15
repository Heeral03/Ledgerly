import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, BarChart2, Settings, LogOut,
  ShieldCheck, UserPlus, Trash2, Eye, CheckCircle, AlertCircle, RefreshCw,
  History, Sparkles, TrendingUp, AlertTriangle, Wallet, Landmark,
  Filter, X, Play, TrendingDown, Menu,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#C0392B', '#E74C3C', '#922B21', '#F1948A'];
const EXPENSE_COLORS = { Capex: '#3498db', RnD: '#9b59b6', Direct: '#e67e22', Salary: '#1abc9c', Other: '#95a5a6' };
const TABS = [
  { id: 'overview',   icon: <LayoutDashboard size={18} />, label: 'Overview' },
  { id: 'ceo',        icon: <ShieldCheck size={18} />,     label: 'CEO Dashboard' },
  { id: 'users',      icon: <Users size={18} />,           label: 'User Management' },
  { id: 'analytics',  icon: <BarChart2 size={18} />,       label: 'Analytics Viewer' },
  { id: 'settings',   icon: <Settings size={18} />,        label: 'System Settings' },
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function n(val) { return parseFloat(val) || 0; }
function lakh(val) { return (n(val) / 100000).toFixed(2); }

function parseAnalysis(raw) {
  if (!raw) return null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* fallthrough */ }
  return null;
}

function detectAnomalies(rows) {
  if (!rows || rows.length < 2) return [];
  const alerts = [];
  let consecutiveNeg = 0;
  for (const r of rows) {
    if (n(r['Profit & Loss']) < 0) { consecutiveNeg++; if (consecutiveNeg >= 2) { alerts.push('Negative P&L for 2+ consecutive months.'); break; } }
    else consecutiveNeg = 0;
  }
  const cur = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const curRev = n(cur['Sales & Revenue']);
  const curExp = n(cur['Direct Expense']) + n(cur['Salary / Wages']) + n(cur['Other Expense']) + n(cur['R&D Expense']) + n(cur['Capex Investment']);
  if (curExp > curRev * 1.5) alerts.push(`Expenses (₹${lakh(curExp)}L) exceeded Revenue (₹${lakh(curRev)}L) by >50%.`);
  const curCash = n(cur['Bank & Cash']); const prevCash = n(prev['Bank & Cash']);
  if (prevCash > 0 && curCash < prevCash * 0.6) alerts.push(`Cash & Bank dropped ${Math.round((1 - curCash / prevCash) * 100)}% MoM.`);
  const curU = n(cur['Unsecured Loan']); const prevU = n(prev['Unsecured Loan']);
  if (prevU > 0 && curU > prevU * 1.2) alerts.push(`Unsecured Loan up ${Math.round((curU / prevU - 1) * 100)}% MoM.`);
  return alerts;
}

/* ─── Briefing Card ───────────────────────────────────────────────────── */
function BriefingCard({ analysis, generating, onGenerate, company }) {
  const parsed = parseAnalysis(analysis);
  return (
    <div className="premium-card" style={{
      maxWidth: 'none', margin: '0 0 24px 0', padding: '24px',
      background: '#fff', border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--primary)" /> Executive AI Briefing
          {company && <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '400' }}>— {company}</span>}
        </h3>
        <button onClick={onGenerate} disabled={generating} className="btn-premium" style={{
          padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
        }}>
          <Play size={12} /> {generating ? 'Generating…' : parsed ? 'Regenerate' : 'Generate Briefing'}
        </button>
      </div>

      {generating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[90, 70, 80].map((w, i) => (
            <div key={i} style={{ height: '12px', borderRadius: '6px', background: 'rgba(0,0,0,0.04)', width: `${w}%` }} />
          ))}
        </div>
      )}
      {!generating && !parsed && !analysis && (
        <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic' }}>
          Click "Generate Briefing" to produce a data-driven executive summary.
        </p>
      )}
      {!generating && analysis && !parsed && (
        <p style={{ color: 'var(--primary)', fontSize: '13px' }}>{analysis}</p>
      )}
      {!generating && parsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Key Observations</p>
            {parsed.observations?.map((obs, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 14px', borderRadius: '10px', marginBottom: '6px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(192,57,43,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800' }}>{i + 1}</span>
                <p style={{ color: 'var(--text-mid)', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>{obs}</p>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.2)' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#E74C3C', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>⚠ Major Risk</p>
            <p style={{ color: 'var(--text-dark)', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>{parsed.risk}</p>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.2)' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#27ae60', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>✓ Recommended Action</p>
            <p style={{ color: 'var(--text-dark)', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>{parsed.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── KPI Cards ───────────────────────────────────────────────────────── */
function KpiCards({ rows }) {
  if (!rows || !rows.length) return null;
  const l = rows[rows.length - 1];
  const rev = n(l['Sales & Revenue']); const pl = n(l['Profit & Loss']);
  const csh = n(l['Bank & Cash']); const dbt = n(l['Unsecured Loan']) + n(l['Bank Loan']);
  const mgn = rev ? ((pl / rev) * 100).toFixed(1) : '0';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
      {[
        { label: 'Revenue', value: `₹${lakh(rev)}L`, icon: <TrendingUp size={16} />, color: 'var(--success)' },
        { label: 'P&L Margin', value: `${mgn}%`, icon: pl >= 0 ? <CheckCircle size={16} /> : <TrendingDown size={16} />, color: pl >= 0 ? 'var(--success)' : 'var(--primary)' },
        { label: 'Cash', value: `₹${lakh(csh)}L`, icon: <Wallet size={16} />, color: 'var(--success)' },
        { label: 'Total Debt', value: `₹${lakh(dbt)}L`, icon: <Landmark size={16} />, color: 'var(--primary)' },
      ].map((m, i) => (
        <div key={i} className="premium-card" style={{ margin: 0, padding: '20px', maxWidth: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', marginBottom: '8px' }}>
            {m.icon} <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{m.label}</span>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: m.color }}>{m.value}</h3>
        </div>
      ))}
    </div>
  );
}

/* ─── CEO Charts ──────────────────────────────────────────────────────── */
function CeoCharts({ rows, labelCol, insights }) {
  if (!rows || !rows.length) return null;
  const lineData = rows.map(r => ({ n: (r._label || r[labelCol] || '—').toString(), Revenue: n(r['Sales & Revenue']), Expenses: n(r['Direct Expense']) + n(r['Salary / Wages']) + n(r['Other Expense']) + n(r['R&D Expense']) + n(r['Capex Investment']) }));
  const expData = rows.map(r => ({ n: (r._label || r[labelCol] || '—').toString(), Capex: n(r['Capex Investment']), RnD: n(r['R&D Expense']), Direct: n(r['Direct Expense']), Salary: n(r['Salary / Wages']), Other: n(r['Other Expense']) }));
  const plData = rows.map(r => ({ n: (r._label || r[labelCol] || '—').toString(), PL: n(r['Profit & Loss']) }));
  const liqData = rows.map(r => ({ n: (r._label || r[labelCol] || '—').toString(), Cash: n(r['Bank & Cash']), Loans: n(r['Unsecured Loan']) + n(r['Bank Loan']) }));
  const t = { fontSize: 10 };
  const fmt = v => `₹${lakh(v)}L`;
  const incStyle = { fontSize: 12, color: 'var(--text-mid)', marginTop: '12px', fontStyle: 'italic', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' };
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px', background: '#fff' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-dark)' }}>Revenue vs Total Expenses</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lineData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" /><XAxis dataKey="n" tick={{...t, fill: 'var(--text-dim)'}} /><YAxis tick={{...t, fill: 'var(--text-dim)'}} tickFormatter={fmt} /><Tooltip formatter={fmt} /><Legend />
            <Line type="monotone" name="Revenue" dataKey="Revenue" stroke="#27ae60" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" name="Expenses" dataKey="Expenses" stroke="#C0392B" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        {insights?.revenueVsExpenses && <p style={incStyle}>{insights.revenueVsExpenses}</p>}
      </div>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px', background: '#fff' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-dark)' }}>Expense Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={expData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" /><XAxis dataKey="n" tick={{...t, fill: 'var(--text-dim)'}} /><YAxis tick={{...t, fill: 'var(--text-dim)'}} tickFormatter={fmt} /><Tooltip formatter={fmt} /><Legend />
            {Object.entries(EXPENSE_COLORS).map(([k, c]) => <Bar key={k} dataKey={k} name={k === 'RnD' ? 'R&D' : k} stackId="e" fill={c} radius={k === 'Other' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
        {insights?.expenseBreakdown && <p style={incStyle}>{insights.expenseBreakdown}</p>}
      </div>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px', background: '#fff' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-dark)' }}>Profit & Loss Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={plData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" /><XAxis dataKey="n" tick={{...t, fill: 'var(--text-dim)'}} /><YAxis tick={{...t, fill: 'var(--text-dim)'}} tickFormatter={fmt} /><Tooltip formatter={fmt} />
            <Bar dataKey="PL" name="P&L" radius={[4, 4, 0, 0]}>
              {plData.map((d, i) => <Cell key={i} fill={d.PL >= 0 ? '#27ae60' : '#C0392B'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {insights?.profitLoss && <p style={incStyle}>{insights.profitLoss}</p>}
      </div>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px', background: '#fff' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-dark)' }}>Liquidity: Cash vs Loans</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={liqData}>
            <defs>
              <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#27ae60" stopOpacity={0.1} /><stop offset="95%" stopColor="#27ae60" stopOpacity={0} /></linearGradient>
              <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#C0392B" stopOpacity={0.1} /><stop offset="95%" stopColor="#C0392B" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" /><XAxis dataKey="n" tick={{...t, fill: 'var(--text-dim)'}} /><YAxis tick={{...t, fill: 'var(--text-dim)'}} tickFormatter={fmt} /><Tooltip formatter={fmt} /><Legend />
            <Area type="monotone" dataKey="Cash" name="Cash & Bank" stroke="#27ae60" fill="url(#gC)" strokeWidth={2} />
            <Area type="monotone" dataKey="Loans" name="Total Loans" stroke="#C0392B" fill="url(#gL)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        {insights?.liquidity && <p style={incStyle}>{insights.liquidity}</p>}
      </div>
    </div>
  );
}

/* ─── Portfolio Overview ──────────────────────────────────────────────── */
function PortfolioView({ portfolioData, onSelectCompany }) {
  const sorted = [...portfolioData].sort((a, b) => b.revenue - a.revenue);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Portfolio Ranking</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead><tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-dim)', textAlign: 'left' }}>
            <th style={{ padding: '10px 12px' }}>#</th><th style={{ padding: '10px 12px' }}>Company</th>
            <th style={{ padding: '10px 12px' }}>Revenue</th><th style={{ padding: '10px 12px' }}>Net P&L</th><th style={{ padding: '10px 12px' }}>Cash</th>
          </tr></thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={i} onClick={() => onSelectCompany(p.companyName)} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: p.pl < 0 ? 'rgba(192,57,43,0.03)' : 'transparent' }}>
                <td style={{ padding: '12px', color: 'var(--text-dim)', fontWeight: '600' }}>{i + 1}</td>
                <td style={{ padding: '12px', fontWeight: '700', color: p.pl < 0 ? 'var(--primary)' : 'var(--text-dark)' }}>{p.companyName}</td>
                <td style={{ padding: '12px' }}>₹{lakh(p.revenue)}L</td>
                <td style={{ padding: '12px', fontWeight: '700', color: p.pl >= 0 ? 'var(--success)' : 'var(--primary)' }}>₹{lakh(p.pl)}L</td>
                <td style={{ padding: '12px' }}>₹{lakh(p.cash)}L</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Comparative Radar</h3>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={portfolioData}>
            <PolarGrid stroke="var(--border-subtle)" /><PolarAngleAxis dataKey="companyName" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} /><PolarRadiusAxis angle={30} tick={false} />
            <Radar name="Revenue" dataKey="revenue" stroke="#3498db" fill="#3498db" fillOpacity={0.2} />
            <Radar name="Cash" dataKey="cash" stroke="var(--success)" fill="var(--success)" fillOpacity={0.2} />
            <Radar name="Expenses" dataKey="expense" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
            <Tooltip /><Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Main Admin Dashboard ────────────────────────────────────────────── */
export default function AdminDashboard() {
  const { user, logout, API } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState('view');
  const [inviteMsg, setInviteMsg] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [activeChart, setActiveChart] = useState('bar');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const adminFileRef = React.useRef();
  const globalFileRef = React.useRef();
  const [uploadingFor, setUploadingFor] = useState(null);
  const [isGlobalUploading, setIsGlobalUploading] = useState(false);
  const [ceoData, setCeoData] = useState(null);
  const [globalHistory, setGlobalHistory] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [companyAnalysis, setCompanyAnalysis] = useState('');
  const [showGlobalHistory, setShowGlobalHistory] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [portfolioData, setPortfolioData] = useState([]);
  const [dismissedAnomalies, setDismissedAnomalies] = useState(false);
  
  // Google Sheets Global Sync
  const [globalSheetUrl, setGlobalSheetUrl] = useState(localStorage.getItem('googleSheetUrlGlobal') || '');
  const [globalAutoSync, setGlobalAutoSync] = useState(false);
  const [globalSyncing, setGlobalSyncing] = useState(false);

  useEffect(() => { fetchUsers(); fetchWhitelist(); fetchCeoData(); fetchGlobalHistory(); }, []);
  
  useEffect(() => {
    let interval;
    if (globalAutoSync && globalSheetUrl && tab === 'ceo') {
      interval = setInterval(() => { handleGlobalSync(); }, 60000);
    }
    return () => clearInterval(interval);
  }, [globalAutoSync, globalSheetUrl, tab]);

  useEffect(() => {
    if (globalSheetUrl) localStorage.setItem('googleSheetUrlGlobal', globalSheetUrl);
  }, [globalSheetUrl]);

  async function fetchGlobalHistory() { try { const r = await API.get('/api/admin/global-history'); setGlobalHistory(r.data); } catch { /* silent */ } }
  async function fetchPortfolio(batchId = selectedBatchId) {
    try { const r = await API.get(`/api/user/portfolio${batchId ? `?batchId=${batchId}` : ''}`); setPortfolioData(r.data.portfolio || []); } catch { setPortfolioData([]); }
  }
  async function fetchAnalysis(company, batchId = selectedBatchId) {
    if (!company) return;
    try { const r = await API.get(`/api/user/ceo-analysis?company=${encodeURIComponent(company)}${batchId ? `&batchId=${batchId}` : ''}`); setCompanyAnalysis(r.data.analysis || ''); }
    catch { setCompanyAnalysis(''); }
  }
  async function fetchCeoData(company = '', batchId = selectedBatchId) {
    try {
      const q = []; if (company) q.push(`company=${encodeURIComponent(company)}`); if (batchId) q.push(`batchId=${batchId}`);
      const r = await API.get(`/api/user/ceo-charts${q.length ? `?${q.join('&')}` : ''}`);
      setCeoData(r.data); if (r.data.selectedBatchId) setSelectedBatchId(r.data.selectedBatchId);
      if (r.data.availableCompanies?.length && !company) {
        setSelectedCompany('PORTFOLIO_OVERVIEW');
        fetchPortfolio(r.data.selectedBatchId || batchId);
      }
    } catch { /* silent */ }
  }
  async function fetchUsers() { setLoadingUsers(true); try { const r = await API.get('/api/admin/users'); setUsers(r.data); } catch { /* silent */ } finally { setLoadingUsers(false); } }
  async function fetchWhitelist() { try { const r = await API.get('/api/admin/whitelist'); setWhitelist(r.data); } catch { /* silent */ } }

  async function handleInvite(e) {
    e.preventDefault(); setInviteMsg(null);
    try {
      const r = await API.post('/api/admin/whitelist', { email: inviteEmail, permission: invitePermission });
      setInviteMsg({ type: 'success', text: r.data.message }); setInviteEmail(''); fetchWhitelist();
    } catch (err) { setInviteMsg({ type: 'error', text: err.response?.data?.error || 'Failed to whitelist.' }); }
  }
  async function handleAdminUpload(file) {
    if (!file || !uploadingFor) return;
    try { const form = new FormData(); form.append('file', file); const r = await API.post(`/api/admin/users/${uploadingFor}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); alert(`Success: ${r.data.rows} rows uploaded.`); fetchUsers(); }
    catch (err) { alert(err.response?.data?.error || 'Upload failed'); } finally { setUploadingFor(null); }
  }
  async function handleGlobalUpload(file) {
    if (!file) return; setIsGlobalUploading(true);
    try { const form = new FormData(); form.append('file', file); const r = await API.post('/api/admin/global-upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }); alert(r.data.message); fetchCeoData(); fetchGlobalHistory(); }
    catch (err) { alert(err.response?.data?.error || 'Global upload failed'); } finally { setIsGlobalUploading(false); }
  }
  async function handleGlobalSync() {
    if (!globalSheetUrl.trim()) return;
    setGlobalSyncing(true);
    try {
      const r = await API.post('/api/admin/global-sync-sheets', { spreadsheetUrl: globalSheetUrl });
      alert(r.data.message);
      fetchCeoData(); fetchGlobalHistory();
    } catch (err) {
      console.error('Global Sync Error:', err);
    } finally { setGlobalSyncing(false); }
  }
  function switchCompany(name) {
    setSelectedCompany(name); setDismissedAnomalies(false);
    if (name === 'PORTFOLIO_OVERVIEW') { fetchPortfolio(selectedBatchId); }
    else { fetchCeoData(name, selectedBatchId); fetchAnalysis(name, selectedBatchId); }
  }
  function handleBatchSelect(batchId) { setSelectedBatchId(batchId); fetchCeoData('', batchId); }
  async function handleGenerateAI() {
    if (!selectedCompany || selectedCompany === 'PORTFOLIO_OVERVIEW') return;
    setGeneratingAI(true); setCompanyAnalysis('');
    try { const r = await API.post('/api/user/generate-analysis', { company: selectedCompany, batchId: selectedBatchId }); setCompanyAnalysis(r.data.analysis); }
    catch (err) { setCompanyAnalysis(err.response?.data?.error || 'Failed to generate.'); }
    finally { setGeneratingAI(false); }
  }
  async function removeFromWhitelist(email) { try { await API.delete(`/api/admin/whitelist/${encodeURIComponent(email)}`); fetchWhitelist(); } catch { /* silent */ } }
  async function viewUserCharts(u) {
    setSelectedUser(u); setChartData(null); setTab('analytics');
    try { const r = await API.get(`/api/admin/users/${u.id}/charts`); setChartData(r.data); } catch { setChartData({ columns: [], rows: [] }); }
  }

  const chartRows = chartData?.rows?.map(row => {
    const obj = { label: row[chartData.labelCol] || '—' };
    chartData.numericCols?.forEach(col => { obj[col] = parseFloat(row[col]) || 0; });
    return obj;
  }) || [];

  const handleLogout = () => { logout(); navigate('/login'); };
  const nonAdminUsers = users.filter(u => u.role !== 'admin');
  const totalUploads = users.reduce((s, u) => s + (u.upload_count || 0), 0);
  const anomalies = ceoData?.rows && selectedCompany !== 'PORTFOLIO_OVERVIEW' ? detectAnomalies(ceoData.rows) : [];

  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px', position: 'relative' }}>
        <button className="mobile-only" onClick={() => setMobileOpen(false)} style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 4px 14px rgba(192,57,43,0.25)' }}>
          <TrendingUp size={20} color="#fff" />
        </div>
        <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.3px' }}>Ledgerly</p>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>Admin Portal</p>
      </div>
      {user?.picture && (
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src={user.picture} alt="Avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--primary)', boxShadow: '0 0 10px rgba(192,57,43,0.2)', marginBottom: '8px' }} />
          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-dark)' }}>{user.name}</p>
          <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Administrator</p>
        </div>
      )}
      <nav style={{ flex: 1 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setMobileOpen(false); }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '11px 14px', borderRadius: '10px', marginBottom: '4px',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer', border: 'none',
            color: tab === t.id ? 'var(--primary)' : 'var(--text-mid)',
            background: tab === t.id ? 'rgba(192,57,43,0.07)' : 'transparent',
            borderLeft: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
            transition: 'all 0.2s ease',
          }}>{t.icon} {t.label}</button>
        ))}
      </nav>
      <button onClick={handleLogout} className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-subtle)' }}>
      {/* Mobile Header Bar */}
      <div className="mobile-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dark)' }}>
            <Menu size={22} />
          </button>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-dark)' }}>
            Ledgerly Admin
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', background: 'rgba(192,57,43,0.08)', padding: '4px 8px', borderRadius: 6 }}>
          Admin
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {/* Desktop Sidebar */}
        <aside className="desktop-only" style={{ width: '260px', background: '#fff', borderRight: '1px solid var(--border-subtle)', padding: '32px 20px', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 8px rgba(26,22,20,0.04)', flexShrink: 0 }}>
          {sidebarContent}
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileOpen && (
          <>
            <div className="mobile-drawer-backdrop mobile-only" onClick={() => setMobileOpen(false)} />
            <div className="mobile-drawer mobile-only" style={{ background: '#fff', padding: '24px 20px' }}>
              {sidebarContent}
            </div>
          </>
        )}

        {/* Main */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

          {/* ── Overview ────────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <>
              <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '6px' }}>Admin Portal</h1>
                <p className="calligraphy-text" style={{ fontSize: '15px' }}>Welcome back, {user?.name}</p>
              </header>
              <div className="responsive-kpi-grid-3" style={{ marginBottom: '32px' }}>
                {[
                  { label: 'Registered Users', value: nonAdminUsers.length },
                  { label: 'Total Uploads', value: totalUploads },
                  { label: 'Whitelisted Emails', value: whitelist.length },
                ].map((s, i) => (
                  <div key={i} className="premium-card" style={{ padding: '24px', margin: 0, maxWidth: 'none' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>{s.label}</p>
                    <h3 style={{ fontSize: '32px', fontWeight: '700', marginTop: '8px', color: 'var(--primary)' }}>{s.value}</h3>
                  </div>
                ))}
              </div>
            </>
          )}

        {/* ── CEO Dashboard ───────────────────────────────────────────── */}
        {tab === 'ceo' && (
          <>
            <header style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={24} color="var(--primary)" /> Global CEO Engine
                  </h1>
                  <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginTop: '4px' }}>Multi-company master data & AI-driven insights.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowGlobalHistory(!showGlobalHistory)} className="btn-ghost" style={{ border: '1px solid var(--border-subtle)' }}>
                    <History size={16} /> History
                  </button>
                  <button onClick={() => globalFileRef.current.click()} disabled={isGlobalUploading} className="btn-premium">
                    <BarChart2 size={16} /> {isGlobalUploading ? 'Uploading…' : 'Upload Master Sheet'}
                  </button>
                </div>
              </div>
              
              <div className="premium-card" style={{ maxWidth: 'none', margin: '0', padding: '20px', display: 'flex', gap: '16px', alignItems: 'center', background: '#fff' }}>
                <div style={{ padding: '10px', background: 'rgba(52,152,219,0.1)', color: '#3498db', borderRadius: '10px' }}><RefreshCw size={20} /></div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Google Sheets Global Sync</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Link your Master Sheet (all tabs will sync as separate companies).</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flex: 1.5 }}>
                  <input 
                    value={globalSheetUrl} 
                    onChange={e => setGlobalSheetUrl(e.target.value)} 
                    placeholder="Enter Google Sheets URL..."
                    className="glass-input" 
                    style={{ fontSize: '12px' }}
                  />
                  <button onClick={handleGlobalSync} disabled={globalSyncing || !globalSheetUrl} className="btn-premium" style={{ whiteSpace: 'nowrap' }}>
                    {globalSyncing ? '...' : 'Sync Master'}
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: 'var(--text-mid)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '16px' }}>
                  <input type="checkbox" checked={globalAutoSync} onChange={e => setGlobalAutoSync(e.target.checked)} />
                  Auto-Sync
                </label>
              </div>
            </header>

            {showGlobalHistory && (
              <div className="premium-card" style={{ maxWidth: 'none', margin: '0 0 28px 0', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Master Upload History</h3>
                  <button onClick={() => setShowGlobalHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--primary)' }}>Close</button>
                </div>
                <div className="table-responsive-wrapper">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Batch ID', 'Filename', 'Uploaded By', 'Date', 'Companies'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {globalHistory.map(h => {
                        const meta = JSON.parse(h.metadata || '{}');
                        return (
                          <tr key={h.id} onClick={() => handleBatchSelect(h.id)} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: selectedBatchId === h.id ? 'rgba(192,57,43,0.04)' : 'transparent' }}>
                            <td style={{ padding: '12px 16px', fontSize: '13px' }}>#{h.id}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{h.filename}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px' }}>{h.uploader_name}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-dim)' }}>{new Date(h.uploaded_at).toLocaleString()}</td>
                            <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                              {meta.companies?.map(c => <span key={c} style={{ background: 'rgba(192,57,43,0.06)', padding: '2px 8px', borderRadius: '4px', marginRight: '4px', color: 'var(--primary)' }}>{c}</span>)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ceoData && ceoData.availableCompanies?.length > 0 ? (
              <>
                {/* Company Switcher */}
                <div className="premium-card" style={{ margin: '0 0 24px 0', padding: '18px 20px', maxWidth: 'none', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)' }}>
                    <Filter size={16} /><span style={{ fontSize: '13px', fontWeight: '600' }}>Company:</span>
                  </div>
                  <button onClick={() => switchCompany('PORTFOLIO_OVERVIEW')} style={{
                    padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                    background: selectedCompany === 'PORTFOLIO_OVERVIEW' ? 'var(--primary)' : '#fff',
                    color: selectedCompany === 'PORTFOLIO_OVERVIEW' ? '#fff' : 'var(--text-mid)', transition: 'all 0.2s',
                  }}>Portfolio Overview</button>
                  {ceoData.availableCompanies.map(c => (
                    <button key={c} onClick={() => switchCompany(c)} style={{
                      padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                      background: selectedCompany === c ? 'var(--primary)' : '#fff',
                      color: selectedCompany === c ? '#fff' : 'var(--text-mid)', transition: 'all 0.2s',
                    }}>{c}</button>
                  ))}
                </div>

                {selectedCompany === 'PORTFOLIO_OVERVIEW' ? (
                  <PortfolioView portfolioData={portfolioData} onSelectCompany={switchCompany} />
                ) : (
                  <>
                    <KpiCards rows={ceoData.rows} />

                    {!dismissedAnomalies && anomalies.length > 0 && (
                      <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.3)', padding: '16px 20px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '24px', color: 'var(--primary)' }}>
                        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>⚠ System Anomalies Detected</h4>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', lineHeight: '1.7' }}>{anomalies.map((a, i) => <li key={i}>{a}</li>)}</ul>
                        </div>
                        <button onClick={() => setDismissedAnomalies(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '2px', flexShrink: 0 }}><X size={16} /></button>
                      </div>
                    )}

                    <div style={{ marginBottom: '24px' }}>
                      <BriefingCard analysis={companyAnalysis} generating={generatingAI} onGenerate={handleGenerateAI} company={selectedCompany} />
                    </div>

                    <CeoCharts rows={ceoData.rows} labelCol={ceoData.labelCol} insights={parseAnalysis(companyAnalysis)?.chartInsights} />
                  </>
                )}
              </>
            ) : (
              <div className="premium-card" style={{ maxWidth: 'none', padding: '60px', textAlign: 'center' }}>
                <ShieldCheck size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                <p style={{ color: 'var(--text-dim)' }}>Upload a master sheet to begin.</p>
              </div>
            )}
            <input type="file" ref={globalFileRef} hidden onChange={e => handleGlobalUpload(e.target.files[0])} />
          </>
        )}

        {/* ── User Management ─────────────────────────────────────────── */}
        {tab === 'users' && (
          <>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '700' }}>User Management</h1>
                <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginTop: '4px' }}>Whitelist a Google email to grant access.</p>
              </div>
              <button onClick={fetchUsers} style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-dim)' }}><RefreshCw size={14} /></button>
            </header>
            <div className="premium-card" style={{ maxWidth: 'none', margin: '0 0 28px 0', padding: '28px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="var(--primary)" /> Whitelist New User
              </h3>
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}><input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@gmail.com" className="glass-input" /></div>
                <div style={{ width: '180px' }}>
                  <select value={invitePermission} onChange={e => setInvitePermission(e.target.value)} className="glass-input" style={{ padding: '11px' }}>
                    <option value="view">View Only</option><option value="upload">Upload & View</option>
                  </select>
                </div>
                <button type="submit" className="btn-premium" style={{ minWidth: '140px', flexShrink: 0 }}><UserPlus size={15} /> Add to List</button>
              </form>
              {inviteMsg && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '12px 14px', borderRadius: '10px', background: inviteMsg.type === 'success' ? 'rgba(30,132,73,0.07)' : 'rgba(192,57,43,0.07)', color: inviteMsg.type === 'success' ? 'var(--success)' : 'var(--primary)', border: `1px solid ${inviteMsg.type === 'success' ? 'rgba(30,132,73,0.3)' : 'var(--border-red)'}` }}>
                  {inviteMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}{inviteMsg.text}
                </div>
              )}
            </div>
            <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['User', 'Email', 'Status', 'Uploads', 'Actions'].map(h => <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {loadingUsers ? <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>Loading…</td></tr>
                    : nonAdminUsers.length === 0 ? <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>No users yet.</td></tr>
                    : nonAdminUsers.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{u.picture && <img src={u.picture} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />}<span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>{u.name || '—'}</span></div></td>
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>{u.email}</td>
                        <td style={{ padding: '14px 20px' }}><span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', background: u.status === 'active' ? 'rgba(30,132,73,0.1)' : 'rgba(192,57,43,0.1)', color: u.status === 'active' ? 'var(--success)' : 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{u.status}</span></td>
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>{u.upload_count}</td>
                        <td style={{ padding: '14px 20px', display: 'flex', gap: '8px' }}>
                          <button onClick={() => viewUserCharts(u)} style={{ background: 'rgba(192,57,43,0.08)', border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Eye size={13} /> View</button>
                          <button onClick={() => { setUploadingFor(u.id); adminFileRef.current.click(); }} style={{ background: 'rgba(30,132,73,0.08)', border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><UserPlus size={13} /> Upload</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {whitelist.length > 0 && (
              <div style={{ marginTop: '28px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '12px' }}>Whitelist</h3>
                <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                    {whitelist.map(w => (
                      <tr key={w.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-dark)' }}>{w.email}</td>
                        <td style={{ padding: '12px 20px' }}><span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', textTransform: 'uppercase', background: w.used ? 'rgba(30,132,73,0.1)' : 'rgba(201,168,76,0.12)', color: w.used ? 'var(--success)' : '#7D6608' }}>{w.used ? 'Joined' : 'Pending'}</span></td>
                        <td style={{ padding: '12px 20px', textAlign: 'right' }}><button onClick={() => removeFromWhitelist(w.email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px' }}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            )}
            <input type="file" ref={adminFileRef} style={{ display: 'none' }} onChange={e => handleAdminUpload(e.target.files[0])} />
          </>
        )}

        {/* ── Analytics Viewer ─────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <>
            <header style={{ marginBottom: '32px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>{selectedUser ? `${selectedUser.name}'s Analytics` : 'Analytics Viewer'}</h1>
              {selectedUser && <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{selectedUser.email}</p>}
            </header>
            {!selectedUser && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '56px 40px', textAlign: 'center' }}>
                <BarChart2 size={44} style={{ opacity: 0.15, marginBottom: '20px', display: 'block', margin: '0 auto 20px' }} />
                <p style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-dark)', marginBottom: '8px' }}>No user selected yet</p>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '28px', maxWidth: '360px', margin: '0 auto 28px' }}>
                  To view analytics for a user, follow the steps below.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[
                    { step: '1', label: 'Go to User Management', desc: 'Click the tab in the sidebar' },
                    { step: '2', label: 'Find a User', desc: 'Look in the users table' },
                    { step: '3', label: 'Click "View"', desc: 'The blue View button on that row' },
                  ].map(s => (
                    <div key={s.step} style={{ background: 'var(--bg-subtle)', borderRadius: '12px', padding: '18px 20px', width: '160px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(192,57,43,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', margin: '0 auto 10px' }}>{s.step}</div>
                      <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '4px' }}>{s.label}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{s.desc}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab('users')} className="btn-premium" style={{ marginTop: '28px', padding: '11px 24px' }}>
                  Go to User Management
                </button>
              </div>
            )}
            {selectedUser && chartData && (
              chartData.rows?.length > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    {['bar', 'line'].map(t => (
                      <button key={t} onClick={() => setActiveChart(t)} style={{ padding: '7px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid var(--border-subtle)', textTransform: 'capitalize', background: activeChart === t ? 'var(--primary)' : '#fff', color: activeChart === t ? '#fff' : 'var(--text-mid)', transition: 'all 0.2s ease' }}>{t}</button>
                    ))}
                  </div>
                  <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '32px' }}>
                    <ResponsiveContainer width="100%" height={360}>
                      {activeChart === 'bar' ? (
                        <BarChart data={chartRows} margin={{ top: 10, right: 20, bottom: 40, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} angle={-30} textAnchor="end" /><YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} /><Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} /><Legend />
                          {chartData.numericCols?.map((col, i) => <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
                        </BarChart>
                      ) : (
                        <LineChart data={chartRows} margin={{ top: 10, right: 20, bottom: 40, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} angle={-30} textAnchor="end" /><YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} /><Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} /><Legend />
                          {chartData.numericCols?.map((col, i) => <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />)}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                  <BarChart2 size={40} style={{ marginBottom: '14px', opacity: 0.3 }} />
                  <p style={{ fontWeight: '600', color: 'var(--text-mid)' }}>No uploads yet for this user.</p>
                </div>
              )
            )}
          </>
        )}

        {/* ── Settings ─────────────────────────────────────────────────── */}
        {tab === 'settings' && (
          <div>
            <header style={{ marginBottom: '32px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '700' }}>System Settings</h1>
            </header>
            <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '32px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Security Configuration</h3>
              {[
                { label: 'Encryption', value: 'AES-256-GCM (per-cell, unique IV)' },
                { label: 'Authentication', value: 'Google OAuth 2.0 + JWT (8h expiry)' },
                { label: 'Access Control', value: 'RBAC — admin whitelist enforced on every API route' },
                { label: 'Data Isolation', value: 'Per-user row-level isolation; admin grants required for cross-access' },
                { label: 'Input Sanitisation', value: 'CSV injection strip on all uploaded cells' },
                { label: 'AI Model', value: 'Groq · llama3-70b-8192' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-mid)', fontWeight: '600' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-dark)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  </div>
);
}
