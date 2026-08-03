import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud, LogOut, BarChart2, FileSpreadsheet,
  CheckCircle, AlertCircle, RefreshCw, ShieldCheck,
  Sparkles, Filter, TrendingUp, Activity, Wallet, Landmark, History,
  Send, MessageCircle, AlertTriangle, Play, LayoutGrid, X, TrendingDown
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#C0392B', '#E74C3C', '#922B21', '#F1948A', '#7B241C', '#FADBD8'];
const EXPENSE_COLORS = {
  Capex: '#3498db',
  RnD: '#9b59b6',
  Direct: '#e67e22',
  Salary: '#1abc9c',
  Other: '#95a5a6',
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function n(val) { return parseFloat(val) || 0; }
function lakh(val) { return (n(val) / 100000).toFixed(2); }

function parseAnalysis(raw) {
  if (!raw) return null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* fall through */ }
  return null;
}

/* ─── CEO Briefing Card ───────────────────────────────────────────────── */
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
          {company && <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '400', marginLeft: '4px' }}>— {company}</span>}
        </h3>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="btn-premium"
          style={{
            padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
          }}
        >
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

/* ─── Anomaly Detection ───────────────────────────────────────────────── */
function detectAnomalies(rows) {
  if (!rows || rows.length < 2) return [];
  const alerts = [];

  // 1. Negative P&L for 2+ consecutive months (scan entire history)
  let consecutiveNeg = 0;
  for (const r of rows) {
    if (n(r['Profit & Loss']) < 0) {
      consecutiveNeg++;
      if (consecutiveNeg >= 2) {
        alerts.push('Negative Profit & Loss for 2 or more consecutive months detected.');
        break;
      }
    } else {
      consecutiveNeg = 0;
    }
  }

  const cur = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  // 2. Expenses > Revenue by 50%
  const curRev = n(cur['Sales & Revenue']);
  const curExp = n(cur['Direct Expense']) + n(cur['Salary / Wages']) + n(cur['Other Expense']) + n(cur['R&D Expense']) + n(cur['Capex Investment']);
  if (curExp > curRev * 1.5) alerts.push(`Total Expenses (₹${lakh(curExp)}L) exceeded Revenue (₹${lakh(curRev)}L) by more than 50%.`);

  // 3. Cash & Bank dropped >40% MoM
  const curCash = n(cur['Bank & Cash']);
  const prevCash = n(prev['Bank & Cash']);
  if (prevCash > 0 && curCash < prevCash * 0.6) alerts.push(`Cash & Bank dropped ${Math.round((1 - curCash / prevCash) * 100)}% month-over-month (₹${lakh(prevCash)}L → ₹${lakh(curCash)}L).`);

  // 4. Unsecured loan grew >20% MoM
  const curUnsec = n(cur['Unsecured Loan']);
  const prevUnsec = n(prev['Unsecured Loan']);
  if (prevUnsec > 0 && curUnsec > prevUnsec * 1.2) alerts.push(`Unsecured Loan increased ${Math.round((curUnsec / prevUnsec - 1) * 100)}% month-over-month (₹${lakh(prevUnsec)}L → ₹${lakh(curUnsec)}L).`);

  return alerts;
}

/* ─── KPI Cards ───────────────────────────────────────────────────────── */
function KpiCards({ rows }) {
  if (!rows || !rows.length) return null;
  const l = rows[rows.length - 1];
  const rev = n(l['Sales & Revenue']);
  const pl = n(l['Profit & Loss']);
  const exp = n(l['Direct Expense']) + n(l['Salary / Wages']) + n(l['Other Expense']) + n(l['R&D Expense']) + n(l['Capex Investment']);
  const cash = n(l['Bank & Cash']);
  const rec = n(l['Receivable']);
  const pay = n(l['Payable']);

  const cards = [
    { label: 'Total Revenue', val: `₹${lakh(rev)}L`, icon: <TrendingUp size={16} />, color: 'var(--success)' },
    { label: 'Net P&L', val: `₹${lakh(pl)}L`, icon: pl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />, color: pl >= 0 ? 'var(--success)' : 'var(--primary)' },
    { label: 'Total Expenses', val: `₹${lakh(exp)}L`, icon: <LayoutGrid size={16} />, color: 'var(--primary)' },
    { label: 'Cash & Bank', val: `₹${lakh(cash)}L`, icon: <Wallet size={16} />, color: cash > 0 ? 'var(--success)' : 'var(--primary)' },
    { label: 'Rec / Pay Ratio', val: pay > 0 ? `${(rec / pay).toFixed(1)}x` : '—', icon: <Landmark size={16} />, color: rec >= pay ? 'var(--success)' : 'var(--primary)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
      {cards.map((m, i) => (
        <div key={i} className="premium-card" style={{ margin: 0, padding: '20px', maxWidth: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', marginBottom: '10px' }}>
            {m.icon}
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</span>
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: m.color }}>{m.val}</h3>
        </div>
      ))}
    </div>
  );
}

/* ─── CEO Charts ──────────────────────────────────────────────────────── */
function CeoCharts({ rows, labelCol, insights }) {
  if (!rows || !rows.length) return null;
  // MATCHING BACKEND KEYS: 'Sales & Revenue', 'Direct Expense', 'Salary / Wages', 'Other Expense', 'R&D Expense', 'Capex Investment'
  const lineData = rows.map(r => ({ 
    n: (r._label || r[labelCol] || '—').toString(), 
    Revenue: n(r['Sales & Revenue']), 
    Expenses: n(r['Direct Expense']) + n(r['Salary / Wages']) + n(r['Other Expense']) + n(r['R&D Expense']) + n(r['Capex Investment']) 
  }));
  const expData = rows.map(r => ({ 
    n: (r._label || r[labelCol] || '—').toString(), 
    Capex: n(r['Capex Investment']), 
    RnD: n(r['R&D Expense']), 
    Direct: n(r['Direct Expense']), 
    Salary: n(r['Salary / Wages']), 
    Other: n(r['Other Expense']) 
  }));
  const plData = rows.map(r => ({ 
    n: (r._label || r[labelCol] || '—').toString(), 
    PL: n(r['Profit & Loss']) 
  }));
  const liqData = rows.map(r => ({ 
    n: (r._label || r[labelCol] || '—').toString(), 
    Cash: n(r['Bank & Cash']), 
    Loans: n(r['Unsecured Loan']) + n(r['Bank Loan']) 
  }));
  const t = { fontSize: 10 };
  const fmt = v => `₹${lakh(v)}L`;
  const incStyle = { fontSize: 12, color: 'var(--text-mid)', marginTop: '12px', fontStyle: 'italic', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' };
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-dark)' }}>Revenue vs Total Expenses</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lineData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" /><XAxis dataKey="n" tick={{...t, fill: 'var(--text-dim)'}} /><YAxis tick={{...t, fill: 'var(--text-dim)'}} tickFormatter={fmt} /><Tooltip formatter={fmt} /><Legend />
            <Line type="monotone" name="Revenue" dataKey="Revenue" stroke="#27ae60" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" name="Expenses" dataKey="Expenses" stroke="#C0392B" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        {insights?.revenueVsExpenses && <p style={incStyle}>{insights.revenueVsExpenses}</p>}
      </div>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-dark)' }}>Expense Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={expData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" /><XAxis dataKey="n" tick={{...t, fill: 'var(--text-dim)'}} /><YAxis tick={{...t, fill: 'var(--text-dim)'}} tickFormatter={fmt} /><Tooltip formatter={fmt} /><Legend />
            {Object.entries(EXPENSE_COLORS).map(([k, c]) => <Bar key={k} dataKey={k} name={k === 'RnD' ? 'R&D' : k} stackId="e" fill={c} radius={k === 'Other' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
        {insights?.expenseBreakdown && <p style={incStyle}>{insights.expenseBreakdown}</p>}
      </div>
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px' }}>
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
      <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-dark)' }}>Liquidity: Cash vs Loans</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={liqData}>
            <defs>
              <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#27ae60" stopOpacity={0.2} /><stop offset="95%" stopColor="#27ae60" stopOpacity={0.05} /></linearGradient>
              <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#C0392B" stopOpacity={0.2} /><stop offset="95%" stopColor="#C0392B" stopOpacity={0.05} /></linearGradient>
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
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Portfolio Performance Ranking</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-dim)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px' }}>#</th>
              <th style={{ padding: '10px 12px' }}>Company</th>
              <th style={{ padding: '10px 12px' }}>Revenue</th>
              <th style={{ padding: '10px 12px' }}>Net P&L</th>
              <th style={{ padding: '10px 12px' }}>Cash</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr
                key={i}
                onClick={() => onSelectCompany(p.companyName)}
                style={{
                  borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                  background: p.pl < 0 ? 'rgba(192,57,43,0.03)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
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
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Comparative Radar Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={portfolioData}>
            <PolarGrid stroke="var(--border-subtle)" />
            <PolarAngleAxis dataKey="companyName" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
            <PolarRadiusAxis angle={30} tick={false} />
            <Radar name="Revenue" dataKey="revenue" stroke="#3498db" fill="#3498db" fillOpacity={0.2} />
            <Radar name="Cash" dataKey="cash" stroke="var(--success)" fill="var(--success)" fillOpacity={0.2} />
            <Radar name="Expenses" dataKey="expense" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
            <Tooltip />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ──────────────────────────────────────────────────── */
export default function UserDashboard() {
  const { user, logout, API } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();
  const chatEndRef = useRef();

  const [chartData, setChartData] = useState(null);
  const [ceoChartData, setCeoChartData] = useState(null);
  const [viewMode, setViewMode] = useState('personal');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeChart, setActiveChart] = useState('bar');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [companyAnalysis, setCompanyAnalysis] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [globalHistory, setGlobalHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatThreads, setChatThreads] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [portfolioData, setPortfolioData] = useState([]);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [dismissedAnomalies, setDismissedAnomalies] = useState(false);
  
  // Google Sheets Sync
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem('googleSheetUrl') || '');
  const [autoSync, setAutoSync] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { fetchCharts(); fetchCeoCharts(); fetchGlobalHistory(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatThreads]);
  
  useEffect(() => {
    let interval;
    if (autoSync && sheetUrl && viewMode === 'personal') {
      interval = setInterval(() => { handleGoogleSync(); }, 60000);
    }
    return () => clearInterval(interval);
  }, [autoSync, sheetUrl, viewMode]);

  useEffect(() => {
    if (sheetUrl) localStorage.setItem('googleSheetUrl', sheetUrl);
  }, [sheetUrl]);

  async function fetchGlobalHistory() {
    try { const r = await API.get('/api/admin/global-history'); setGlobalHistory(r.data); } catch { /* silent */ }
  }
  async function fetchCharts() {
    try { const r = await API.get('/api/user/charts'); setChartData(r.data.rows?.length ? r.data : null); } catch { setChartData(null); }
  }
  async function fetchPortfolio(batchId = selectedBatchId) {
    try {
      const r = await API.get(`/api/user/portfolio${batchId ? `?batchId=${batchId}` : ''}`);
      setPortfolioData(r.data.portfolio || []);
      if (!selectedBatchId && r.data.selectedBatchId) setSelectedBatchId(r.data.selectedBatchId);
    } catch { setPortfolioData([]); }
  }
  async function fetchCeoCharts(company = '', batchId = selectedBatchId) {
    try {
      const q = [];
      if (company && company !== 'PORTFOLIO_OVERVIEW') q.push(`company=${encodeURIComponent(company)}`);
      if (batchId) q.push(`batchId=${batchId}`);
      const r = await API.get(`/api/user/ceo-charts${q.length ? `?${q.join('&')}` : ''}`);
      setCeoChartData(r.data);
      if (r.data.selectedBatchId) setSelectedBatchId(r.data.selectedBatchId);
      if (!company) {
        setSelectedCompany('PORTFOLIO_OVERVIEW');
        fetchPortfolio(r.data.selectedBatchId || batchId);
      } else if (company !== 'PORTFOLIO_OVERVIEW') {
        fetchAnalysis(company, r.data.selectedBatchId || batchId);
      }
    } catch { /* silent */ }
  }
  async function fetchAnalysis(company, batchId = selectedBatchId) {
    if (!company) return;
    try {
      const r = await API.get(`/api/user/ceo-analysis?company=${encodeURIComponent(company)}${batchId ? `&batchId=${batchId}` : ''}`);
      setCompanyAnalysis(r.data.analysis || '');
      setChatThreads([{ role: 'assistant', content: `Hello! I've loaded the financial data for ${company}. Ask me anything about it.` }]);
    } catch { setCompanyAnalysis(''); setChatThreads([]); }
  }
  function switchCompany(name) {
    setSelectedCompany(name);
    setDismissedAnomalies(false);
    if (name === 'PORTFOLIO_OVERVIEW') {
      fetchPortfolio(selectedBatchId);
    } else {
      fetchCeoCharts(name, selectedBatchId);
      fetchAnalysis(name, selectedBatchId);
    }
  }
  function handleBatchSelect(batchId) {
    setSelectedBatchId(batchId);
    fetchCeoCharts('', batchId);
    fetchPortfolio(batchId);
    setShowHistory(false);
  }
  async function handleGenerateAI() {
    if (!selectedCompany || selectedCompany === 'PORTFOLIO_OVERVIEW') return;
    setGeneratingAI(true);
    setCompanyAnalysis('');
    try {
      const r = await API.post('/api/user/generate-analysis', { company: selectedCompany, batchId: selectedBatchId });
      setCompanyAnalysis(r.data.analysis);
      setChatThreads([{ role: 'assistant', content: `I've generated a fresh executive briefing for ${selectedCompany}. What questions do you have?` }]);
    } catch (err) {
      setCompanyAnalysis(err.response?.data?.error || 'Failed to generate AI analysis.');
    } finally { setGeneratingAI(false); }
  }
  async function handleChat(e) {
    e.preventDefault();
    if (!chatMsg.trim() || chatLoading) return;
    const userMsg = chatMsg.trim();
    setChatMsg('');
    setChatThreads(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      const r = await API.post('/api/user/chat', { message: userMsg, company: selectedCompany, batchId: selectedBatchId });
      setChatThreads(prev => [...prev, { role: 'assistant', content: r.data.reply }]);
    } catch {
      setChatThreads(prev => [...prev, { role: 'assistant', content: "I'm sorry, I'm having trouble connecting to the AI." }]);
    } finally { setChatLoading(false); }
  }
  async function handleUpload(file) {
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) { setUploadMsg({ type: 'error', text: 'Only .xlsx, .xls, or .csv files are accepted.' }); return; }
    setUploading(true); setUploadMsg(null);
    try {
      const form = new FormData(); form.append('file', file);
      const r = await API.post('/api/user/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadMsg({ type: 'success', text: `✓ ${r.data.rows} rows encrypted & stored from ${file.name}` });
      await fetchCharts();
    } catch (err) { setUploadMsg({ type: 'error', text: err.response?.data?.error || 'Upload failed.' }); }
    finally { setUploading(false); }
  }

  async function handleGoogleSync() {
    if (!sheetUrl.trim()) return;
    setSyncing(true); setUploadMsg(null);
    try {
      const r = await API.post('/api/user/sync-google-sheet', { spreadsheetUrl: sheetUrl });
      setUploadMsg({ type: 'success', text: r.data.message });
      await fetchCharts();
    } catch (err) {
      setUploadMsg({ type: 'error', text: err.response?.data?.error || 'Sync failed.' });
    } finally { setSyncing(false); }
  }
  const handleLogout = () => { logout(); navigate('/login'); };

  // Personal chart data
  const chartRows = chartData?.rows?.map(row => {
    const obj = { label: row[chartData.labelCol] || '—' };
    chartData.numericCols?.forEach(col => { obj[col] = parseFloat(row[col]) || 0; });
    return obj;
  }) || [];
  const pieData = chartData?.numericCols?.slice(0, 1).flatMap(col =>
    chartRows.map(r => ({ name: r.label, value: r[col] })).filter(d => d.value > 0)
  ) || [];

  const anomalies = ceoChartData?.rows && selectedCompany !== 'PORTFOLIO_OVERVIEW'
    ? detectAnomalies(ceoChartData.rows) : [];

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-subtle)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px', background: '#fff', borderRight: '1px solid var(--border-subtle)',
        padding: '32px 20px', display: 'flex', flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(26,22,20,0.04)', flexShrink: 0,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src="/src/assets/logo.png" alt="Logo" style={{ width: '44px', marginBottom: '12px' }} />
          <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)' }}>Manu Yantralaya</p>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Employee Portal</p>
        </div>
        {user?.picture && (
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src={user.picture} alt="Profile" style={{ width: '52px', height: '52px', borderRadius: '50%', border: '2px solid var(--primary)', marginBottom: '8px' }} />
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>{user.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{user.email}</p>
          </div>
        )}
        <nav style={{ flex: 1 }}>
          {[
            { icon: <BarChart2 size={18} />, label: 'My Analytics', id: 'personal' },
            { icon: <ShieldCheck size={18} />, label: 'CEO Dashboard', id: 'ceo' },
            { icon: <FileSpreadsheet size={18} />, label: 'Upload Data', id: 'upload', hide: user?.permission === 'view' },
          ].filter(i => !i.hide).map(item => (
            <button key={item.id} onClick={() => {
              if (item.id === 'upload') { setViewMode('personal'); setTimeout(() => fileRef.current?.click(), 100); }
              else setViewMode(item.id);
            }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '11px 14px', borderRadius: '10px', marginBottom: '4px',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer', border: 'none',
              color: viewMode === item.id ? 'var(--primary)' : 'var(--text-mid)',
              background: viewMode === item.id ? 'rgba(192,57,43,0.07)' : 'transparent',
              borderLeft: viewMode === item.id ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'all 0.2s ease',
            }}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto' }}>
        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }}>My Dashboard</h1>
          <p className="calligraphy-text" style={{ fontSize: '16px' }}>Your financial data, securely encrypted.</p>
        </header>

        {/* Upload zone */}
        {user?.permission !== 'view' && (
          <section style={{ marginBottom: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files[0]); }}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  borderRadius: '16px', padding: '36px', textAlign: 'center', cursor: 'pointer',
                  background: isDragging ? 'rgba(192,57,43,0.04)' : '#fff', transition: 'all 0.25s ease',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => handleUpload(e.target.files[0])} />
                <UploadCloud size={36} color={isDragging ? 'var(--primary)' : 'var(--text-dim)'} style={{ marginBottom: '12px', transition: 'color 0.2s' }} />
                <p style={{ fontWeight: '600', color: 'var(--text-dark)', marginBottom: '4px' }}>
                  {uploading ? 'Encrypting & uploading…' : 'Drop your Excel / CSV here'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  or <span style={{ color: 'var(--primary)', fontWeight: '600' }}>browse files</span>
                </p>
              </div>

              <div className="premium-card" style={{ margin: 0, padding: '24px', maxWidth: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '8px', background: 'rgba(52,152,219,0.1)', color: '#3498db', borderRadius: '8px' }}><RefreshCw size={18} /></div>
                  <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Google Sheets Sync</h3>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '14px' }}>Paste your Google Sheet URL here; all tabs will be synced.</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    value={sheetUrl} 
                    onChange={e => setSheetUrl(e.target.value)} 
                    placeholder="Enter Google Sheets URL..."
                    className="glass-input" 
                    style={{ fontSize: '12px', padding: '10px' }}
                  />
                  <button 
                    onClick={handleGoogleSync} 
                    disabled={syncing || !sheetUrl}
                    className="btn-premium" 
                    style={{ padding: '0 16px', borderRadius: '10px', flexShrink: 0 }}
                  >
                    {syncing ? '...' : 'Sync'}
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--text-mid)' }}>
                  <input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)} />
                  Enable Auto-Sync (every 60s)
                </label>
              </div>
            </div>
            
            {uploadMsg && (
              <div style={{
                marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '14px 16px', borderRadius: '12px', fontSize: '13px',
                background: uploadMsg.type === 'success' ? 'rgba(30,132,73,0.07)' : 'rgba(192,57,43,0.07)',
                border: `1px solid ${uploadMsg.type === 'success' ? 'rgba(30,132,73,0.3)' : 'var(--border-red)'}`,
                color: uploadMsg.type === 'success' ? 'var(--success)' : 'var(--primary)',
              }}>
                {uploadMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {uploadMsg.text}
              </div>
            )}
          </section>
        )}

        {/* ── CEO Dashboard ──────────────────────────────────────────────── */}
        {viewMode === 'ceo' && (() => {
          if (!ceoChartData || !ceoChartData.availableCompanies?.length) {
            return (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-dim)', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                <ShieldCheck size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p style={{ fontWeight: '600' }}>CEO Dashboard is empty</p>
                <p style={{ fontSize: '13px' }}>The administrator has not uploaded master data yet.</p>
              </div>
            );
          }

          return (
            <section>
              {/* Company Switcher + Batch Selector */}
              <div className="premium-card" style={{ margin: '0 0 24px 0', padding: '18px 20px', maxWidth: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)' }}>
                    <Filter size={16} /><span style={{ fontSize: '13px', fontWeight: '600' }}>Company:</span>
                  </div>
                  <button onClick={() => switchCompany('PORTFOLIO_OVERVIEW')} style={{
                    padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                    background: selectedCompany === 'PORTFOLIO_OVERVIEW' ? 'var(--primary)' : '#fff',
                    color: selectedCompany === 'PORTFOLIO_OVERVIEW' ? '#fff' : 'var(--text-mid)', transition: 'all 0.2s',
                  }}>Portfolio Overview</button>
                  {ceoChartData.availableCompanies.map(c => (
                    <button key={c} onClick={() => switchCompany(c)} style={{
                      padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                      background: selectedCompany === c ? 'var(--primary)' : '#fff',
                      color: selectedCompany === c ? '#fff' : 'var(--text-mid)', transition: 'all 0.2s',
                    }}>{c}</button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowHistory(!showHistory)} className="btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }}>
                    <History size={14} /> {globalHistory.find(h => h.id === selectedBatchId)?.filename || 'Select Upload'}
                  </button>
                  {showHistory && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, width: '280px', background: '#fff',
                      border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      zIndex: 100, marginTop: '8px', padding: '8px',
                    }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', padding: '8px', textTransform: 'uppercase' }}>Upload History</p>
                      {globalHistory.map(h => (
                        <div key={h.id} onClick={() => handleBatchSelect(h.id)} style={{
                          padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px',
                          background: selectedBatchId === h.id ? 'rgba(192,57,43,0.04)' : 'transparent',
                          borderBottom: '1px solid var(--bg-subtle)',
                        }}>
                          <div style={{ fontWeight: '600', color: selectedBatchId === h.id ? 'var(--primary)' : 'var(--text-dark)' }}>{h.filename}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{new Date(h.uploaded_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedCompany === 'PORTFOLIO_OVERVIEW' ? (
                <PortfolioView portfolioData={portfolioData} onSelectCompany={switchCompany} />
              ) : (
                <>
                  {/* KPI Cards */}
                  <KpiCards rows={ceoChartData.rows} />

                  {/* Anomaly Banner */}
                  {!dismissedAnomalies && anomalies.length > 0 && (
                    <div style={{
                      background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.3)',
                      padding: '16px 20px', borderRadius: '12px', display: 'flex', gap: '12px',
                      alignItems: 'flex-start', marginBottom: '24px', color: 'var(--primary)',
                    }}>
                      <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>⚠ System Anomalies Detected</h4>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', lineHeight: '1.7' }}>
                          {anomalies.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                      <button onClick={() => setDismissedAnomalies(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '2px', flexShrink: 0 }}>
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* AI Briefing Card */}
                  <div style={{ marginBottom: '24px' }}>
                    <BriefingCard
                      analysis={companyAnalysis}
                      generating={generatingAI}
                      onGenerate={handleGenerateAI}
                      company={selectedCompany}
                    />
                  </div>

                  {/* 4 Charts */}
                  <CeoCharts rows={ceoChartData.rows} labelCol={ceoChartData.labelCol} />

                  {/* AI Chat */}
                  <div className="premium-card" style={{ maxWidth: 'none', margin: '24px 0 0 0', padding: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MessageCircle size={16} color="var(--primary)" /> Financial AI Analyst
                    </h3>
                    <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {chatThreads.map((m, i) => (
                        <div key={i} style={{
                          alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '80%', padding: '10px 14px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.5',
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
                      <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder={`Ask about ${selectedCompany}…`}
                        className="glass-input" style={{ flex: 1, padding: '10px 14px', fontSize: '13px' }} />
                      <button type="submit" disabled={chatLoading || !chatMsg.trim()} className="btn-premium" style={{ padding: '10px 16px', flexShrink: 0 }}>
                        <Send size={15} />
                      </button>
                    </form>
                  </div>
                </>
              )}
            </section>
          );
        })()}

        {/* ── Personal Dashboard ─────────────────────────────────────────── */}
        {viewMode === 'personal' && (() => {
          if (!chartData || chartRows.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-dim)', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                <BarChart2 size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <p style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-mid)' }}>No personal data yet</p>
                <p style={{ fontSize: '13px', marginTop: '6px' }}>Upload an Excel or CSV file above to see your charts.</p>
              </div>
            );
          }
          return (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700' }}>My Analytics</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['bar', 'line', 'pie'].map(t => (
                    <button key={t} onClick={() => setActiveChart(t)} style={{
                      padding: '7px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', border: '1px solid var(--border-subtle)', textTransform: 'capitalize',
                      background: activeChart === t ? 'var(--primary)' : '#fff',
                      color: activeChart === t ? '#fff' : 'var(--text-mid)', transition: 'all 0.2s ease',
                    }}>{t}</button>
                  ))}
                  <button onClick={fetchCharts} className="btn-ghost" style={{ padding: '6px', borderRadius: '50%' }}><RefreshCw size={14} /></button>
                </div>
              </div>
              <div className="premium-card" style={{ maxWidth: 'none', margin: 0, padding: '32px' }}>
                <ResponsiveContainer width="100%" height={360}>
                  {activeChart === 'bar' ? (
                    <BarChart data={chartRows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend />
                      {chartData.numericCols?.map((col, i) => <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
                    </BarChart>
                  ) : activeChart === 'line' ? (
                    <LineChart data={chartRows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend />
                      {chartData.numericCols?.map((col, i) => <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />)}
                    </LineChart>
                  ) : (
                    <BarChart data={pieData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>
          );
        })()}
      </main>
    </div>
  );
}
