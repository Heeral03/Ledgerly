import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { TrendingUp, AlertCircle, BarChart3, Zap, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        // Fetch user info from Google
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const googleUser = await userInfoRes.json();

        // Authenticate with our backend using a credential-less flow
        // We pass the access_token and user info to backend
        const res = await API.post('/api/auth/google-token', {
          access_token: tokenResponse.access_token,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
        });

        login(res.data.token, res.data.user);
        // Store Google access token for Drive API use
        localStorage.setItem('google_access_token', tokenResponse.access_token);
        navigate('/connect-sheet');
      } catch (err) {
        const msg = err.response?.data?.message || err.response?.data?.error || 'Login failed';
        if (err.response?.data?.error === 'not_whitelisted') {
          setError('Your Google account is not approved yet. Contact your Admin to get access.');
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google sign-in failed. Please try again.'),
    scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
  });

  return (
    <div className="content-wrapper" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '40px 20px',
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: 'fixed', top: '10%', right: '8%', width: '320px', height: '320px',
        background: 'radial-gradient(circle, rgba(192,57,43,0.06) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '15%', left: '5%', width: '200px', height: '200px',
        background: 'radial-gradient(circle, rgba(192,57,43,0.04) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', gap: '80px', alignItems: 'center', maxWidth: '900px', width: '100%' }}>
        {/* Left — branding */}
        <div style={{ flex: 1, display: 'none' }} className="login-hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{
              width: '48px', height: '48px', background: 'var(--primary)', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={24} color="#fff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-1px' }}>Ledgerly</h1>
          </div>
          <p style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text-dark)', lineHeight: '1.4', marginBottom: '32px' }}>
            Financial intelligence,<br />beautifully simple.
          </p>
          {[
            { icon: <BarChart3 size={18} />, label: 'Auto-generate KPIs from your data' },
            { icon: <Zap size={18} />, label: 'AI insights in seconds' },
            { icon: <TrendingUp size={18} />, label: 'Live sync every 30 seconds' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ color: 'var(--primary)' }}>{f.icon}</div>
              <span style={{ fontSize: '14px', color: 'var(--text-mid)' }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Right — card */}
        <div className="premium-card animate-slide-up" style={{ flex: 'none', width: '380px' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              width: '56px', height: '56px', background: 'var(--primary)', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(192,57,43,0.25)',
            }}>
              <TrendingUp size={28} color="#fff" />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '6px', letterSpacing: '-0.5px', color: 'var(--text-dark)' }}>
              Ledgerly
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
              Your financial data, intelligently.
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(192,57,43,0.07)', border: '1px solid var(--border-red)',
              borderRadius: '12px', padding: '14px 16px', marginBottom: '20px',
              display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--primary)',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            {loading ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                fontSize: '14px', color: 'var(--text-dim)', padding: '16px',
              }}>
                <div style={{
                  width: '16px', height: '16px', border: '2px solid var(--border-subtle)',
                  borderTopColor: 'var(--primary)', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Verifying…
              </div>
            ) : (
              <button
                onClick={() => handleGoogleLogin()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                  width: '100%', padding: '14px 20px',
                  background: '#fff', border: '1.5px solid var(--border-subtle)',
                  borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                  color: 'var(--text-dark)', transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-red)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(192,57,43,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>
            )}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
            fontSize: '11px', color: 'var(--text-dim)', marginBottom: '20px',
          }}>
            <Shield size={12} color="var(--primary)" />
            <span>Read-only access to your Google Sheets</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Don't have access?{' '}
              <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                Request access
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) { .login-hero { display: flex !important; flex-direction: column; } }
      `}</style>
    </div>
  );
};

export default Login;
