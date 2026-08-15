import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Activity, Zap, DollarSign, Wallet,
  AlertTriangle, ChevronUp, ChevronDown, Factory, BarChart2,
  LogOut, LayoutDashboard, RefreshCw, Sparkles, Play, Filter,
  History, Send, MessageCircle, X, CheckCircle, Landmark, ShieldCheck, Menu,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ─── Helpers ────────────────────────────────────────────────────────── */
const n = v => parseFloat(v) || 0;
const lakh = v => (n(v) / 100000).toFixed(2);
const fmt = v => `₹${lakh(v)}L`;

function parseAnalysis(raw) {
  if (!raw) return null;
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
  return null;
}

function detectAnomalies(rows) {
  if (!rows || rows.length < 2) return [];
  const alerts = [];
  let neg = 0;
  for (const r of rows) {
    if (n(r['Profit & Loss']) < 0) { neg++; if (neg >= 2) { alerts.push('Negative P&L for 2+ consecutive months.'); break; } }
    else neg = 0;
  }
  const cur = rows[rows.length - 1], prev = rows[rows.length - 2];
  const rev = n(cur['Sales & Revenue']);
  const exp = n(cur['Direct Expense']) + n(cur['Salary / Wages']) + n(cur['Other Expense']) + n(cur['R&D Expense']) + n(cur['Capex Investment']);
  if (exp > rev * 1.5) alerts.push(`Expenses (₹${lakh(exp)}L) exceeded Revenue (₹${lakh(rev)}L) by >50%.`);
  const cash = n(cur['Bank & Cash']), prevCash = n(prev['Bank & Cash']);
  if (prevCash > 0 && cash < prevCash * 0.6) alerts.push(`Cash dropped ${Math.round((1 - cash / prevCash) * 100)}% MoM.`);
  const loan = n(cur['Unsecured Loan']), prevLoan = n(prev['Unsecured Loan']);
  if (prevLoan > 0 && loan > prevLoan * 1.2) alerts.push(`Unsecured Loan up ${Math.round((loan / prevLoan - 1) * 100)}% MoM.`);
  return alerts;
}

/* ─── Design Tokens ──────────────────────────────────────────────────── */
const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: 'rgba(0,0,0,0.07)',
  dark: '#0F172A', mid: '#475569', dim: '#94A3B8',
  green: '#059669', greenBg: 'rgba(5,150,105,0.09)',
  indigo: '#4F46E5', indigoBg: 'rgba(79,70,229,0.09)',
  amber: '#D97706', amberBg: 'rgba(217,119,6,0.09)',
  red: '#DC2626', redBg: 'rgba(220,38,38,0.07)',
  purple: '#7C3AED', purpleBg: 'rgba(124,58,237,0.09)',
  shadow: '0 1px 3px rgba(0,0,0,0.06),0 8px 24px rgba(0,0,0,0.05)',
};

const EXPENSE_COLORS = { Capex: '#4F46E5', RnD: '#7C3AED', Direct: '#D97706', Salary: '#059669', Other: '#94A3B8' };

/* ─── Sub-components ─────────────────────────────────────────────────── */
function Card({ children, style = {} }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: C.shadow, ...style }}>{children}</div>;
}

function SHead({ title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: 0 }}>{title}</h3>
      {sub && <p style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

function Spark({ data, color }) {
  const max = Math.max(...data), min = Math.min(...data), W = 72, H = 28, p = 3;
  const pts = data.map((d, i) => {
    const x = p + (i / (data.length - 1)) * (W - p * 2);
    const y = H - p - ((d - min) / (max - min || 1)) * (H - p * 2);
    return `${x},${y}`;
  }).join(' ');
  return <svg width={W} height={H}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.dark, borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontSize: 11, color: C.dim, margin: '0 0 6px' }}>{label}</p>
      {payload.map(p => <p key={p.dataKey} style={{ fontSize: 12, fontWeight: 700, color: p.color, margin: '2px 0' }}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
}

/* ─── KPI Cards ──────────────────────────────────────────────────────── */
function KpiGrid({ rows }) {
  if (!rows?.length) return null;
  const cur = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const rev = n(cur['Sales & Revenue']);
  const pl = n(cur['Profit & Loss']);
  const exp = n(cur['Direct Expense']) + n(cur['Salary / Wages']) + n(cur['Other Expense']) + n(cur['R&D Expense']) + n(cur['Capex Investment']);
  const cash = n(cur['Bank & Cash']);
  const debt = n(cur['Unsecured Loan']) + n(cur['Bank Loan']);
  const margin = rev ? ((pl / rev) * 100).toFixed(1) : 0;

  const mom = (field) => {
    if (!prev) return null;
    const c = n(cur[field]), p = n(prev[field]);
    if (!p) return null;
    return ((c - p) / p * 100).toFixed(1);
  };

  const revMom = mom('Sales & Revenue');
  const plMom = mom('Profit & Loss');
  const cashMom = mom('Bank & Cash');

  // build mini spark from all rows
  const getSpark = field => rows.slice(-7).map(r => n(r[field]));

  const cards = [
    { label: 'Total Revenue', value: `₹${lakh(rev)}L`, mom: revMom, icon: <DollarSign size={18} />, accent: C.green, bg: C.greenBg, spark: getSpark('Sales & Revenue') },
    { label: 'Net P&L Margin', value: `${margin}%`, mom: plMom, icon: pl >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />, accent: pl >= 0 ? C.green : C.red, bg: pl >= 0 ? C.greenBg : C.redBg, spark: getSpark('Profit & Loss') },
    { label: 'Total Expenses', value: `₹${lakh(exp)}L`, mom: null, icon: <Activity size={18} />, accent: C.amber, bg: C.amberBg, spark: getSpark('Direct Expense') },
    { label: 'Cash & Bank', value: `₹${lakh(cash)}L`, mom: cashMom, icon: <Wallet size={18} />, accent: C.indigo, bg: C.indigoBg, spark: getSpark('Bank & Cash') },
    { label: 'Total Debt', value: `₹${lakh(debt)}L`, mom: null, icon: <Landmark size={18} />, accent: C.purple, bg: C.purpleBg, spark: getSpark('Unsecured Loan') },
    { label: 'Net P&L', value: `₹${lakh(pl)}L`, mom: plMom, icon: <Zap size={18} />, accent: pl >= 0 ? C.green : C.red, bg: pl >= 0 ? C.greenBg : C.redBg, spark: getSpark('Profit & Loss') },
  ];

  return (
    <div className="responsive-kpi-grid-3" style={{ marginBottom: 24 }}>
      {cards.slice(0, 6).map((k, i) => (
        <Card key={i} style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.accent, borderRadius: '16px 16px 0 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ padding: 9, borderRadius: 10, background: k.bg, color: k.accent }}>{k.icon}</div>
            <Spark data={k.spark} color={k.accent} />
          </div>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px' }}>{k.label}</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.dark, letterSpacing: '-0.5px', margin: '0 0 8px', fontFamily: 'inherit' }}>{k.value}</p>
          {k.mom !== null && k.mom !== undefined ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {+k.mom >= 0 ? <ChevronUp size={13} color={C.green} /> : <ChevronDown size={13} color={C.red} />}
              <span style={{ fontSize: 11, fontWeight: 600, color: +k.mom >= 0 ? C.green : C.red }}>{Math.abs(k.mom)}% MoM</span>
            </div>
          ) : <span style={{ fontSize: 11, color: C.dim }}>Current period</span>}
        </Card>
      ))}
    </div>
  );
}

/* ─── Charts Grid ────────────────────────────────────────────────────── */
function ChartsGrid({ rows, labelCol, insights }) {
  if (!rows?.length) return null;
  const label = r => (r._label || r[labelCol] || '—').toString();
  const t = { fontSize: 10 };
  const ins = { fontSize: 12, color: C.mid, marginTop: 12, fontStyle: 'italic', paddingTop: 12, borderTop: `1px solid ${C.border}` };

  const lineData = rows.map(r => ({ n: label(r), Revenue: n(r['Sales & Revenue']), Expenses: n(r['Direct Expense']) + n(r['Salary / Wages']) + n(r['Other Expense']) + n(r['R&D Expense']) + n(r['Capex Investment']) }));
  const expData = rows.map(r => ({ n: label(r), Capex: n(r['Capex Investment']), RnD: n(r['R&D Expense']), Direct: n(r['Direct Expense']), Salary: n(r['Salary / Wages']), Other: n(r['Other Expense']) }));
  const plData = rows.map(r => ({ n: label(r), PL: n(r['Profit & Loss']) }));
  const liqData = rows.map(r => ({ n: label(r), Cash: n(r['Bank & Cash']), Loans: n(r['Unsecured Loan']) + n(r['Bank Loan']) }));
  const recPayData = rows.map(r => ({ n: label(r), Receivable: n(r['Receivable']), Payable: n(r['Payable']) }));

  // COGS donut from latest row
  const cur = rows[rows.length - 1];
  const direct = n(cur['Direct Expense']), salary = n(cur['Salary / Wages']), capex = n(cur['Capex Investment']), rnd = n(cur['R&D Expense']), other = n(cur['Other Expense']);
  const totalC = direct + salary + capex + rnd + other || 1;
  const cogsData = [
    { name: 'Direct Exp', value: +((direct / totalC) * 100).toFixed(1), fill: C.amber },
    { name: 'Salary', value: +((salary / totalC) * 100).toFixed(1), fill: C.green },
    { name: 'Capex', value: +((capex / totalC) * 100).toFixed(1), fill: C.indigo },
    { name: 'R&D', value: +((rnd / totalC) * 100).toFixed(1), fill: C.purple },
    { name: 'Other', value: +((other / totalC) * 100).toFixed(1), fill: C.dim },
  ].filter(d => d.value > 0);

  return (
    <div className="responsive-grid-2col">

      {/* Revenue vs Expenses */}
      <Card style={{ padding: 24 }}>
        <SHead title="Revenue vs Total Expenses" sub="Monthly trend (₹ in Lakhs)" />
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lineData}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.green} stopOpacity={0.15} /><stop offset="95%" stopColor={C.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="n" tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} />
            <YAxis tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" name="Revenue" dataKey="Revenue" stroke={C.green} strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" name="Expenses" dataKey="Expenses" stroke={C.red} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        {insights?.revenueVsExpenses && <p style={ins}>{insights.revenueVsExpenses}</p>}
      </Card>

      {/* Expense Breakdown Stacked */}
      <Card style={{ padding: 24 }}>
        <SHead title="Expense Breakdown" sub="Stacked by category (₹ in Lakhs)" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={expData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="n" tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} />
            <YAxis tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {Object.entries(EXPENSE_COLORS).map(([k, c], i, arr) =>
              <Bar key={k} dataKey={k} name={k === 'RnD' ? 'R&D' : k} stackId="e" fill={c} radius={i === arr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
        {insights?.expenseBreakdown && <p style={ins}>{insights.expenseBreakdown}</p>}
      </Card>

      {/* Profit & Loss */}
      <Card style={{ padding: 24 }}>
        <SHead title="Profit & Loss Trend" sub="Monthly net P&L (₹ in Lakhs)" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={plData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="n" tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} />
            <YAxis tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <Tooltip content={<DarkTooltip />} />
            <Bar dataKey="PL" name="P&L" radius={[4, 4, 0, 0]}>
              {plData.map((d, i) => <Cell key={i} fill={d.PL >= 0 ? C.green : C.red} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {insights?.profitLoss && <p style={ins}>{insights.profitLoss}</p>}
      </Card>

      {/* Liquidity */}
      <Card style={{ padding: 24 }}>
        <SHead title="Liquidity: Cash vs Loans" sub="Cash runway vs total debt exposure" />
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={liqData}>
            <defs>
              <linearGradient id="gC2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.green} stopOpacity={0.15} /><stop offset="95%" stopColor={C.green} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gL2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.red} stopOpacity={0.12} /><stop offset="95%" stopColor={C.red} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="n" tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} />
            <YAxis tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" name="Cash & Bank" dataKey="Cash" stroke={C.green} fill="url(#gC2)" strokeWidth={2} />
            <Area type="monotone" name="Total Loans" dataKey="Loans" stroke={C.red} fill="url(#gL2)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        {insights?.liquidity && <p style={ins}>{insights.liquidity}</p>}
      </Card>

      {/* Receivable vs Payable */}
      <Card style={{ padding: 24 }}>
        <SHead title="Receivables vs Payables" sub="Working capital health" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={recPayData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="n" tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} />
            <YAxis tick={{ ...t, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Receivable" name="Receivable" fill={C.indigo} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Payable" name="Payable" fill={C.amber} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* COGS Donut */}
      <Card style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
        <SHead title="Cost Structure (Latest Period)" sub="Breakdown of total expenditure" />
        <div style={{ flex: 1, display: 'flex', gap: 20, alignItems: 'center' }}>
          <ResponsiveContainer width="55%" height={180}>
            <PieChart>
              <Pie data={cogsData} cx="50%" cy="50%" innerRadius={46} outerRadius={72} dataKey="value" strokeWidth={2} stroke={C.bg}>
                {cogsData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={{ borderRadius: 10, border: 'none', background: C.dark, color: '#fff', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cogsData.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.mid }}>{d.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

    </div>
  );
}

/* ─── Data Table ─────────────────────────────────────────────────────── */
function DataTable({ rows, labelCol }) {
  if (!rows?.length) return null;
  const fields = ['Sales & Revenue', 'Profit & Loss', 'Direct Expense', 'Salary / Wages', 'Capex Investment', 'R&D Expense', 'Other Expense', 'Bank & Cash', 'Unsecured Loan', 'Bank Loan', 'Receivable', 'Payable'];
  return (
    <Card style={{ overflow: 'hidden', marginTop: 20 }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: 0 }}>Full Financial Data</h3>
        <p style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>All periods — values in ₹ Lakhs</p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>Period</th>
              {fields.map(f => <th key={f} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{f}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pl = n(r['Profit & Loss']);
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: pl < 0 ? 'rgba(220,38,38,0.02)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: C.dark, whiteSpace: 'nowrap' }}>{r._label || r[labelCol] || '—'}</td>
                  {fields.map(f => {
                    const val = n(r[f]);
                    const isNeg = val < 0;
                    const isPL = f === 'Profit & Loss';
                    return <td key={f} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: isPL ? 700 : 400, color: isPL ? (val >= 0 ? C.green : C.red) : C.dark, whiteSpace: 'nowrap' }}>{r[f] !== undefined && r[f] !== '' ? `₹${lakh(val)}L` : '—'}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─── AI Briefing ────────────────────────────────────────────────────── */
function Briefing({ analysis, generating, onGenerate, company }) {
  const parsed = parseAnalysis(analysis);
  return (
    <Card style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Sparkles size={16} color={C.indigo} /> AI Executive Briefing
          {company && <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>— {company}</span>}
        </h3>
        <button onClick={onGenerate} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: C.indigo, color: '#fff', fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1 }}>
          <Play size={12} /> {generating ? 'Generating…' : parsed ? 'Regenerate' : 'Generate Briefing'}
        </button>
      </div>
      {generating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[90, 70, 80].map((w, i) => <div key={i} style={{ height: 10, borderRadius: 6, background: 'rgba(0,0,0,0.05)', width: `${w}%` }} />)}
        </div>
      )}
      {!generating && !analysis && <p style={{ color: C.dim, fontSize: 13, fontStyle: 'italic', margin: 0 }}>Generate an AI-powered briefing to get data-driven insights on this company.</p>}
      {!generating && analysis && !parsed && <p style={{ color: C.mid, fontSize: 13, margin: 0 }}>{analysis}</p>}
      {!generating && parsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.dim, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10 }}>Key Observations</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parsed.observations?.map((obs, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: C.indigoBg, color: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{i + 1}</span>
                  <p style={{ color: C.mid, fontSize: 13, lineHeight: '1.6', margin: 0 }}>{obs}</p>
                </div>
              ))}
            </div>
          </div>
          {parsed.risk && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: C.red, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>⚠ Major Risk</p>
              <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.5, margin: 0 }}>{parsed.risk}</p>
            </div>
          )}
          {parsed.action && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.2)' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>✓ Recommended Action</p>
              <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.5, margin: 0 }}>{parsed.action}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─── AI Chat ────────────────────────────────────────────────────────── */
function Chat({ company, batchId, API }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: `Hi! I'm your financial AI analyst for ${company}. Ask me anything about the data.` }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const q = input.trim(); setInput('');
    setMsgs(p => [...p, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const r = await API.post('/api/user/chat', { message: q, company, batchId });
      setMsgs(p => [...p, { role: 'assistant', content: r.data.reply }]);
    } catch {
      setMsgs(p => [...p, { role: 'assistant', content: "Sorry, I'm having trouble connecting to the AI right now." }]);
    } finally { setLoading(false); }
  }

  return (
    <Card style={{ padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px' }}>
        <MessageCircle size={16} color={C.indigo} /> Financial AI Analyst
      </h3>
      <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, background: m.role === 'user' ? C.indigo : C.bg, color: m.role === 'user' ? '#fff' : C.dark }}>{m.content}</div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: C.bg, fontSize: 13, color: C.dim }}>Thinking…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} style={{ display: 'flex', gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={`Ask about ${company}…`} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: C.bg, color: C.dark }} />
        <button type="submit" disabled={loading || !input.trim()} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: C.indigo, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Send size={15} />
        </button>
      </form>
    </Card>
  );
}

/* ─── Portfolio View ─────────────────────────────────────────────────── */
function PortfolioView({ data, onSelect }) {
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
  return (
    <div className="responsive-grid-2col">
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: 0 }}>Portfolio Performance Ranking</h3>
          <p style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>Click a row to drill into that company</p>
        </div>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['#', 'Company', 'Revenue', 'Net P&L', 'Cash', 'Expenses'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: h === '#' ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={i} onClick={() => onSelect(p.companyName)} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: p.pl < 0 ? 'rgba(220,38,38,0.02)' : 'transparent' }}>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: C.dim, fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: p.pl < 0 ? C.red : C.dark, fontSize: 13 }}>{p.companyName}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13 }}>₹{lakh(p.revenue)}L</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: p.pl >= 0 ? C.green : C.red }}>₹{lakh(p.pl)}L</td>
                  <td style={{ padding: '14px 16px', fontSize: 13 }}>₹{lakh(p.cash)}L</td>
                  <td style={{ padding: '14px 16px', fontSize: 13 }}>₹{lakh(p.expense)}L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card style={{ padding: 24 }}>
        <SHead title="Comparative Radar" sub="Revenue · Cash · Expenses" />
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data}>
            <PolarGrid stroke={C.border} />
            <PolarAngleAxis dataKey="companyName" tick={{ fill: C.dim, fontSize: 10 }} />
            <PolarRadiusAxis angle={30} tick={false} />
            <Radar name="Revenue" dataKey="revenue" stroke={C.indigo} fill={C.indigo} fillOpacity={0.2} />
            <Radar name="Cash" dataKey="cash" stroke={C.green} fill={C.green} fillOpacity={0.2} />
            <Radar name="Expenses" dataKey="expense" stroke={C.red} fill={C.red} fillOpacity={0.2} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────────── */
export default function CEODashboard() {
  const { user, logout, API } = useAuth();
  const navigate = useNavigate();

  const [ceoData, setCeoData] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalHistory, setGlobalHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchCeoData(); fetchHistory(); }, []);

  async function fetchHistory() {
    try { const r = await API.get('/api/admin/global-history'); setGlobalHistory(r.data); } catch {}
  }

  async function fetchCeoData(company = '', batchId = null) {
    try {
      const q = [];
      if (company && company !== 'PORTFOLIO_OVERVIEW') q.push(`company=${encodeURIComponent(company)}`);
      if (batchId) q.push(`batchId=${batchId}`);
      const r = await API.get(`/api/user/ceo-charts${q.length ? `?${q.join('&')}` : ''}`);
      setCeoData(r.data);
      const bid = r.data.selectedBatchId;
      if (bid) setSelectedBatchId(bid);
      if (!company) {
        setSelectedCompany('PORTFOLIO_OVERVIEW');
        fetchPortfolio(bid);
      }
    } catch {}
  }

  async function fetchPortfolio(batchId) {
    try {
      const r = await API.get(`/api/user/portfolio${batchId ? `?batchId=${batchId}` : ''}`);
      setPortfolio(r.data.portfolio || []);
    } catch { setPortfolio([]); }
  }

  async function fetchAnalysis(company, batchId) {
    try {
      const r = await API.get(`/api/user/ceo-analysis?company=${encodeURIComponent(company)}${batchId ? `&batchId=${batchId}` : ''}`);
      setAnalysis(r.data.analysis || '');
    } catch { setAnalysis(''); }
  }

  function switchCompany(name) {
    setSelectedCompany(name); setDismissedAlerts(false); setAnalysis('');
    setMobileOpen(false);
    if (name === 'PORTFOLIO_OVERVIEW') fetchPortfolio(selectedBatchId);
    else { fetchCeoData(name, selectedBatchId); fetchAnalysis(name, selectedBatchId); }
  }

  function switchBatch(id) {
    setSelectedBatchId(id); setShowHistory(false);
    fetchCeoData('', id); fetchPortfolio(id);
  }

  async function generateAI() {
    if (!selectedCompany || selectedCompany === 'PORTFOLIO_OVERVIEW') return;
    setGeneratingAI(true); setAnalysis('');
    try {
      const r = await API.post('/api/user/generate-analysis', { company: selectedCompany, batchId: selectedBatchId });
      setAnalysis(r.data.analysis);
    } catch (e) { setAnalysis(e.response?.data?.error || 'Failed to generate AI analysis.'); }
    finally { setGeneratingAI(false); }
  }

  const handleLogout = () => { logout(); navigate('/login'); };
  const anomalies = ceoData?.rows && selectedCompany !== 'PORTFOLIO_OVERVIEW' ? detectAnomalies(ceoData.rows) : [];
  const insights = parseAnalysis(analysis)?.chartInsights;
  const hasData = ceoData?.availableCompanies?.length > 0;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
    { id: 'charts', label: 'Charts', icon: <BarChart2 size={16} /> },
    { id: 'data', label: 'Data Table', icon: <Activity size={16} /> },
    { id: 'ai', label: 'AI Analyst', icon: <Sparkles size={16} /> },
  ];

  const sidebarNavContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36, padding: '0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Factory size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#fff', margin: 0 }}>Manu Yantralaya</p>
            <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>CFO Dashboard</p>
          </div>
        </div>
        <button className="mobile-only" onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      {/* Company selector */}
      {hasData && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 8px', marginBottom: 8 }}>Companies</p>
          <button onClick={() => switchCompany('PORTFOLIO_OVERVIEW')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 9, marginBottom: 3, fontSize: 12, fontWeight: selectedCompany === 'PORTFOLIO_OVERVIEW' ? 700 : 500, cursor: 'pointer', border: 'none', color: selectedCompany === 'PORTFOLIO_OVERVIEW' ? '#fff' : 'rgba(255,255,255,0.4)', background: selectedCompany === 'PORTFOLIO_OVERVIEW' ? 'rgba(255,255,255,0.10)' : 'transparent', borderLeft: selectedCompany === 'PORTFOLIO_OVERVIEW' ? `3px solid ${C.indigo}` : '3px solid transparent', transition: 'all 0.2s' }}>
            <ShieldCheck size={14} /> Portfolio View
          </button>
          {ceoData?.availableCompanies?.map(c => (
            <button key={c} onClick={() => switchCompany(c)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 9, marginBottom: 3, fontSize: 12, fontWeight: selectedCompany === c ? 700 : 500, cursor: 'pointer', border: 'none', color: selectedCompany === c ? '#fff' : 'rgba(255,255,255,0.4)', background: selectedCompany === c ? 'rgba(255,255,255,0.10)' : 'transparent', borderLeft: selectedCompany === c ? `3px solid ${C.indigo}` : '3px solid transparent', transition: 'all 0.2s', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Factory size={14} style={{ flexShrink: 0 }} /> {c}
            </button>
          ))}
        </div>
      )}

      {/* Section tabs */}
      {selectedCompany && selectedCompany !== 'PORTFOLIO_OVERVIEW' && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 8px', marginBottom: 8 }}>View</p>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setMobileOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 9, marginBottom: 3, fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500, cursor: 'pointer', border: 'none', color: activeTab === t.id ? '#fff' : 'rgba(255,255,255,0.4)', background: activeTab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent', borderLeft: activeTab === t.id ? `3px solid ${C.indigo}` : '3px solid transparent', transition: 'all 0.2s' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {user?.picture && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '0 4px' }}>
          <img src={user.picture} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${C.indigo}` }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
            <p style={{ fontSize: 9, color: C.dim, margin: 0 }}>CFO</p>
          </div>
        </div>
      )}
      <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', transition: 'all 0.2s' }}>
        <LogOut size={14} /> Sign Out
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", background: C.bg }}>
      {/* Mobile Top Header */}
      <div className="mobile-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.dark }}>
            <Menu size={22} />
          </button>
          <span style={{ fontWeight: 800, fontSize: 14, color: C.dark }}>
            {selectedCompany === 'PORTFOLIO_OVERVIEW' ? 'Portfolio' : selectedCompany || 'CEO Dashboard'}
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.indigo, background: C.indigoBg, padding: '4px 8px', borderRadius: 6 }}>
          CFO Suite
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {/* Desktop Sidebar */}
        <aside className="desktop-only" style={{ width: 220, flexShrink: 0, background: C.dark, display: 'flex', flexDirection: 'column', padding: '24px 14px' }}>
          {sidebarNavContent}
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileOpen && (
          <>
            <div className="mobile-drawer-backdrop mobile-only" onClick={() => setMobileOpen(false)} />
            <div className="mobile-drawer mobile-only" style={{ background: C.dark, padding: '20px 14px' }}>
              {sidebarNavContent}
            </div>
          </>
        )}

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.dark, margin: 0, letterSpacing: '-0.5px' }}>
              {selectedCompany === 'PORTFOLIO_OVERVIEW' ? 'Portfolio Overview' : selectedCompany || 'CEO Dashboard'}
            </h1>
            <p style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Manu Yantralaya · Financial Intelligence Suite</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowHistory(!showHistory)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: C.mid, cursor: 'pointer' }}>
                <History size={14} /> {globalHistory.find(h => h.id === selectedBatchId)?.filename?.slice(0, 20) || 'Select Upload'}
              </button>
              {showHistory && (
                <div style={{ position: 'absolute', top: '110%', right: 0, width: 280, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 100, padding: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.dim, padding: '6px 8px', textTransform: 'uppercase' }}>Upload History</p>
                  {globalHistory.map(h => (
                    <div key={h.id} onClick={() => switchBatch(h.id)} style={{ padding: '10px 10px', borderRadius: 8, cursor: 'pointer', borderBottom: `1px solid ${C.bg}`, background: selectedBatchId === h.id ? C.indigoBg : 'transparent' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: selectedBatchId === h.id ? C.indigo : C.dark, margin: '0 0 2px' }}>{h.filename}</p>
                      <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>{new Date(h.uploaded_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => fetchCeoData(selectedCompany === 'PORTFOLIO_OVERVIEW' ? '' : selectedCompany, selectedBatchId)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: C.indigo, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* No data state */}
        {!hasData && (
          <Card style={{ padding: '80px 40px', textAlign: 'center' }}>
            <ShieldCheck size={48} style={{ opacity: 0.15, marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 700, fontSize: 15, color: C.mid, margin: '0 0 6px' }}>No CEO data uploaded yet</p>
            <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Ask your administrator to upload a master financial sheet in the Admin Portal.</p>
          </Card>
        )}

        {/* Portfolio Overview */}
        {hasData && selectedCompany === 'PORTFOLIO_OVERVIEW' && (
          <PortfolioView data={portfolio} onSelect={switchCompany} />
        )}

        {/* Company Dashboard */}
        {hasData && selectedCompany && selectedCompany !== 'PORTFOLIO_OVERVIEW' && (
          <>
            {/* Anomaly Banner */}
            {!dismissedAlerts && anomalies.length > 0 && (
              <div style={{ background: C.redBg, border: '1px solid rgba(220,38,38,0.25)', padding: '14px 18px', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20, color: C.red }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>⚠ Anomalies Detected</p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>{anomalies.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
                <button onClick={() => setDismissedAlerts(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 2, flexShrink: 0 }}><X size={15} /></button>
              </div>
            )}

            {/* Overview Tab: KPIs + top 2 charts */}
            {activeTab === 'overview' && (
              <>
                <KpiGrid rows={ceoData?.rows} />
                {ceoData?.rows && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                    <Card style={{ padding: 24 }}>
                      <SHead title="Revenue vs Total Expenses" sub="Monthly trend (₹ in Lakhs)" />
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={ceoData.rows.map(r => ({ n: (r._label || r[ceoData.labelCol] || '—').toString(), Revenue: n(r['Sales & Revenue']), Expenses: n(r['Direct Expense']) + n(r['Salary / Wages']) + n(r['Other Expense']) + n(r['R&D Expense']) + n(r['Capex Investment']) }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                          <XAxis dataKey="n" tick={{ fontSize: 10, fill: C.dim }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                          <Tooltip content={<DarkTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" name="Revenue" dataKey="Revenue" stroke={C.green} strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" name="Expenses" dataKey="Expenses" stroke={C.red} strokeWidth={2.5} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                    <Card style={{ padding: 24 }}>
                      <SHead title="Profit & Loss Trend" sub="Monthly net P&L (₹ in Lakhs)" />
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={ceoData.rows.map(r => ({ n: (r._label || r[ceoData.labelCol] || '—').toString(), PL: n(r['Profit & Loss']) }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                          <XAxis dataKey="n" tick={{ fontSize: 10, fill: C.dim }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                          <Tooltip content={<DarkTooltip />} />
                          <Bar dataKey="PL" name="P&L" radius={[4, 4, 0, 0]}>
                            {ceoData.rows.map((r, i) => <Cell key={i} fill={n(r['Profit & Loss']) >= 0 ? C.green : C.red} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>
                )}
                <Briefing analysis={analysis} generating={generatingAI} onGenerate={generateAI} company={selectedCompany} />
              </>
            )}

            {/* Charts Tab */}
            {activeTab === 'charts' && <ChartsGrid rows={ceoData?.rows} labelCol={ceoData?.labelCol} insights={insights} />}

            {/* Data Table Tab */}
            {activeTab === 'data' && <DataTable rows={ceoData?.rows} labelCol={ceoData?.labelCol} />}

            {/* AI Tab */}
            {activeTab === 'ai' && (
              <>
                <Briefing analysis={analysis} generating={generatingAI} onGenerate={generateAI} company={selectedCompany} />
                <Chat company={selectedCompany} batchId={selectedBatchId} API={API} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  </div>
);
}
