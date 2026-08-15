import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Shield, Check, Trash2, Mail, Link as LinkIcon, UserCheck, Clock, AlertCircle } from 'lucide-react';

export default function TeamManagement({ dashboardId, userRole, token }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);

  const isOwner = userRole === 'OWNER';
  const isEditor = userRole === 'EDITOR';

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`/api/dashboards/${dashboardId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMembers(res.data.members || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dashboardId) fetchMembers();
  }, [dashboardId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      setInviting(true);
      setError('');
      setSuccess('');

      const res = await axios.post(
        `/api/dashboards/${dashboardId}/invite`,
        { email: inviteEmail, role: inviteRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(res.data.message || 'Invitation created successfully!');
      setInviteEmail('');
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      setError('');
      await axios.put(
        `/api/dashboards/${dashboardId}/members/${memberId}`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Member role updated');
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (memberId, email) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from this dashboard?`)) return;

    try {
      setError('');
      await axios.delete(`/api/dashboards/${dashboardId}/members/${memberId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Member removed from dashboard');
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const copyInviteLink = (inviteToken) => {
    const link = `${window.location.origin}/login?invite=${inviteToken}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(inviteToken);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  return (
    <div style={{ color: 'var(--text-dark)' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-dark)' }}>
            <Shield size={24} style={{ color: 'var(--primary)' }} /> Team & Access Control
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage dashboard members, invite teammates by email, and enforce server-side RBAC permissions.
          </p>
        </div>
        <div style={{
          background: isOwner ? 'rgba(192,57,43,0.1)' : 'var(--bg-subtle)',
          border: `1px solid ${isOwner ? 'var(--border-red)' : 'var(--border-subtle)'}`,
          padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, color: isOwner ? 'var(--primary)' : 'var(--text-mid)'
        }}>
          YOUR ROLE: {userRole}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid var(--border-red)', color: 'var(--primary)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {success && (
        <div style={{ background: 'rgba(30,132,73,0.08)', border: '1px solid rgba(30,132,73,0.3)', color: 'var(--success)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={18} /> {success}
        </div>
      )}

      {/* Invite Member Section (Owner Only) */}
      {isOwner ? (
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', marginBottom: '30px', boxShadow: 'var(--shadow-card)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark)' }}>
            <UserPlus size={20} style={{ color: 'var(--primary)' }} /> Invite New Team Member
          </h3>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="email"
                placeholder="Enter email (e.g. cfo@company.com)"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="glass-input"
                style={{ paddingLeft: '42px' }}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="glass-input"
              >
                <option value="VIEWER">Viewer (Read Only)</option>
                <option value="EDITOR">Editor (Can Configure)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="btn-premium"
              style={{ padding: '12px 24px' }}
            >
              {inviting ? 'Inviting...' : 'Send Invite'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px', marginBottom: '30px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          ℹ️ Only workspace Owners can invite new team members or alter access permissions.
        </div>
      )}

      {/* Permissions Breakdown Reference */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '30px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-red)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>👑 OWNER</div>
          <div style={{ color: 'var(--text-mid)', fontSize: '0.78rem' }}>Full access: Connect/disconnect Sheets, invite & remove users, change roles, manage workspace settings.</div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#3498db', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>✏️ EDITOR</div>
          <div style={{ color: 'var(--text-mid)', fontSize: '0.78rem' }}>Configure analytics, add/remove KPIs, trigger sheet sync. Cannot remove owner or invite members.</div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>👁️ VIEWER</div>
          <div style={{ color: 'var(--text-mid)', fontSize: '0.78rem' }}>View dashboard metrics, charts, & AI insights. Cannot edit configurations or view raw Sheet data.</div>
        </div>
      </div>

      {/* Members & Invitations Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-dark)' }}>Workspace Members ({members.length})</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Server-Enforced RBAC</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading team members...</div>
        ) : members.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>No members found.</div>
        ) : (
          <div className="table-responsive-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '14px 24px' }}>User / Email</th>
                  <th style={{ padding: '14px 24px' }}>Role</th>
                  <th style={{ padding: '14px 24px' }}>Status</th>
                  <th style={{ padding: '14px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isPending = m.status === 'PENDING';
                  const isOwnerMember = m.role === 'OWNER';

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {m.picture ? (
                            <img src={m.picture} alt="" style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid var(--border-subtle)' }} />
                          ) : (
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                              {(m.name || m.email)[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{m.name || m.email}</div>
                            {m.name && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{m.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 24px' }}>
                        {isOwner && !isOwnerMember ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                            className="glass-input"
                            style={{ padding: '6px 10px', fontSize: '0.8rem', width: 'auto' }}
                          >
                            <option value="VIEWER">VIEWER</option>
                            <option value="EDITOR">EDITOR</option>
                          </select>
                        ) : (
                          <span style={{
                            padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                            background: m.role === 'OWNER' ? 'rgba(192,57,43,0.1)' : m.role === 'EDITOR' ? 'rgba(52,152,219,0.1)' : 'rgba(39,174,96,0.1)',
                            color: m.role === 'OWNER' ? 'var(--primary)' : m.role === 'EDITOR' ? '#3498db' : 'var(--success)'
                          }}>
                            {m.role}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 24px' }}>
                        {isPending ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#e67e22', fontSize: '0.8rem', background: 'rgba(230,126,34,0.1)', padding: '4px 10px', borderRadius: '8px', fontWeight: 600 }}>
                            <Clock size={14} /> PENDING SIGN IN
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '0.8rem', background: 'rgba(30,132,73,0.1)', padding: '4px 10px', borderRadius: '8px', fontWeight: 600 }}>
                            <UserCheck size={14} /> ACTIVE
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          {isPending && m.invite_token && (
                            <button
                              onClick={() => copyInviteLink(m.invite_token)}
                              className="btn-ghost"
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            >
                              <LinkIcon size={12} /> {copiedToken === m.invite_token ? 'Copied Link!' : 'Copy Invite'}
                            </button>
                          )}
                          {isOwner && !isOwnerMember && (
                            <button
                              onClick={() => handleRemoveMember(m.id, m.email)}
                              style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid var(--border-red)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '50px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
