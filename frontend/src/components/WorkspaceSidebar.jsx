import React from 'react';
import { Activity, BarChart2, Zap, Sparkles, Link2, Users, Settings, LogOut, Shield, ChevronRight } from 'lucide-react';

export default function WorkspaceSidebar({
  activeTab,
  setActiveTab,
  dashboard,
  userRole,
  user,
  onLogout
}) {
  const menuItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: Activity },
    { id: 'charts', label: 'Financial Charts', icon: BarChart2 },
    { id: 'kpis', label: 'KPI Management', icon: Zap },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
    { id: 'sheetsync', label: 'Google Sheet Sync', icon: Link2 },
    { id: 'team', label: 'Team & Permissions', icon: Users },
    { id: 'settings', label: 'Workspace Settings', icon: Settings },
  ];

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: '#FFFFFF',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
      boxSizing: 'border-box',
      zIndex: 50,
      boxShadow: '2px 0 12px rgba(26, 22, 20, 0.03)',
    }}>
      <div>
        {/* Ledgerly Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', padding: '0 8px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#FFFFFF', fontSize: '1.2rem',
            boxShadow: '0 4px 14px rgba(192, 57, 43, 0.25)'
          }}>
            L
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
              Ledgerly
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={12} style={{ color: 'var(--primary)' }} /> Executive Workspace
            </div>
          </div>
        </div>

        {/* Workspace Active Card */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '14px',
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
            CURRENT WORKSPACE
          </div>
          <div style={{ color: 'var(--text-dark)', fontWeight: 700, fontSize: '0.95rem', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dashboard?.name || 'Financial Workspace'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{
              padding: '3px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700,
              background: userRole === 'OWNER' ? 'rgba(192,57,43,0.1)' : userRole === 'EDITOR' ? 'rgba(52,152,219,0.1)' : 'rgba(39,174,96,0.1)',
              color: userRole === 'OWNER' ? 'var(--primary)' : userRole === 'EDITOR' ? '#3498db' : 'var(--success)',
              border: `1px solid ${userRole === 'OWNER' ? 'var(--border-red)' : 'transparent'}`
            }}>
              {userRole || 'MEMBER'}
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', padding: '0 8px' }}>
          NAVIGATION
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(192,57,43,0.08)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-mid)',
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={17} style={{ color: isActive ? 'var(--primary)' : 'var(--text-dim)' }} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} style={{ color: 'var(--primary)' }} />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile Card & Logout */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {user?.picture ? (
              <img src={user.picture} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border-subtle)' }} />
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-dark)', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="btn-ghost"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        )}
      </div>
    </aside>
  );
}
