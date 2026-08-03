import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="login-container content-wrapper" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 20px',
    }}>
      <div className="premium-card animate-slide-up" style={{ textAlign: 'center' }}>
        <div style={{
          width: '64px', height: '64px',
          background: 'rgba(192, 57, 43, 0.06)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          border: '1px solid var(--border-red)'
        }}>
          <ShieldAlert size={32} color="var(--primary)" />
        </div>
        
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Access Pending</h1>
        
        <p style={{ color: 'var(--text-mid)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
          Hello, <strong>{user.name || 'User'}</strong>. Your account is currently pending approval by the Manu Yantralaya Administrator.
        </p>

        <div style={{ 
          background: 'var(--bg-subtle)', 
          border: '1px solid var(--border-subtle)',
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '32px',
          fontSize: '13px',
          color: 'var(--text-mid)'
        }}>
          Your ID: {user.email} <br/>
          Status: <span style={{ color: 'var(--danger)', fontWeight: '700', letterSpacing: '1px' }}>UNAUTHORIZED</span>
        </div>

        <Link to="/login" className="btn-premium" style={{ minWidth: '180px', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Sign In
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;
