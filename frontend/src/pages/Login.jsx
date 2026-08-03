import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Shield, ArrowRight, User, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/api/auth/google', {
        credential: credentialResponse.credential,
      });
      login(res.data.token, res.data.user);
      navigate(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
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
  };

  return (
    <div className="content-wrapper" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '40px 20px',
    }}>
      <div className="premium-card animate-slide-up">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/src/assets/logo.png" alt="Manu Yantralaya Logo"
            style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '12px' }} />
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px', letterSpacing: '-1px' }}>
            Manu Yantralaya
          </h1>
          <p className="calligraphy-text">...securing the right move</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(192,57,43,0.08)', border: '1px solid var(--border-red)',
            borderRadius: '12px', padding: '14px 16px', marginBottom: '20px',
            display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--primary)'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          {loading ? (
            <div style={{ fontSize: '14px', color: 'var(--text-dim)', padding: '16px' }}>Verifying…</div>
          ) : (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError('Google sign-in failed. Please try again.')}
              theme="outline"
              shape="rectangular"
              size="large"
              text="signin_with"
              width="340px"
            />
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', margin: '20px 0',
          color: 'var(--text-dim)', fontSize: '10px', letterSpacing: '1.5px'
        }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
          <span style={{ margin: '0 16px', color: 'var(--primary)', fontWeight: '600' }}>SECURE ACCESS</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
        </div>

        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
          <span className="label-text">Corporate ID</span>
          <div style={{ position: 'relative' }}>
            <input type="text" className="glass-input" placeholder="e.g. MANU-ST-1204"
              style={{ paddingLeft: '48px' }} />
            <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          </div>
        </div>

        <button className="btn-premium" style={{ margin: '12px auto 0', minWidth: '200px' }}>
          Enter Portal <ArrowRight size={16} />
        </button>

        <div style={{ marginTop: '28px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-mid)' }}>
            Need access?{' '}
            <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
              Request Credentials
            </Link>
          </p>
        </div>

        <div style={{
          marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.8px'
        }}>
          <Shield size={13} color="var(--primary)" />
          <span>MILITARY-GRADE ENCRYPTION ACTIVE</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
