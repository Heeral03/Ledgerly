import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const Signup = () => {
  const handleSuccess = (credentialResponse) => {
    console.log('Signup Success:', credentialResponse);
  };

  return (
    <div className="content-wrapper" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '40px 20px',
    }}>
      <div className="premium-card animate-slide-up" style={{ maxWidth: '480px', padding: '40px' }}>
        <div style={{ marginBottom: '24px' }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '13px', fontWeight: '600' }}>
            <ArrowLeft size={15} /> Back to login
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '52px', height: '52px', background: 'var(--primary)', borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            boxShadow: '0 6px 20px rgba(192,57,43,0.22)',
          }}>
            <TrendingUp size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px', letterSpacing: '-0.5px' }}>
            Request Access
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
            Sign in with Google to request access to Ledgerly.
            An administrator will approve your account.
          </p>
        </div>

        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => console.log('Error')}
            theme="outline"
            shape="rectangular"
            size="medium"
          />
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
            Account creation requires admin approval.
            Contact your administrator to whitelist your email.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
