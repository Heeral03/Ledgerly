import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Shield, Factory, ArrowLeft, Briefcase, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const Signup = () => {
  const handleSuccess = (credentialResponse) => {
    console.log('Signup Success:', credentialResponse);
  };

  const handleError = () => {
    console.log('Signup Failed');
  };

  return (
    <div className="signup-container content-wrapper" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 20px',
    }}>
      <div className="premium-card animate-slide-up" style={{ maxWidth: '520px', padding: '32px 40px' }}>
        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
          <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '13px', fontWeight: '600' }}>
            <ArrowLeft size={16} /> Return to Login
          </Link>
        </div>

        <div className="header" style={{ marginBottom: '24px', textAlign: 'center' }}>
          <img 
            src="/src/assets/logo.png" 
            alt="Manu Yantralaya Logo" 
            style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '16px' }} 
          />
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px', letterSpacing: '-0.5px' }}>
            Request Access
          </h1>
          <p className="calligraphy-text" style={{ fontSize: '16px' }}>
            ...securing the right move
          </p>
        </div>

        <div className="auth-box">
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              theme="outline"
              shape="rectangular"
              size="medium"
              width="100%"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '11fr 9fr', gap: '16px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'left' }}>
              <span className="label-text">Full Name</span>
              <input type="text" className="glass-input" placeholder="Name" style={{ padding: '12px' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <span className="label-text">Designation</span>
              <input type="text" className="glass-input" placeholder="Role" style={{ padding: '12px' }} />
            </div>
          </div>

          <div style={{ textAlign: 'left', marginBottom: '16px' }}>
            <span className="label-text">Department</span>
            <div style={{ position: 'relative' }}>
              <select className="glass-input" style={{ appearance: 'none', paddingRight: '40px', padding: '12px' }}>
                <option value="">Select Dept</option>
                <option value="exec">Management</option>
                <option value="prod">Production</option>
                <option value="qa">QA</option>
                <option value="logistics">Logistics</option>
              </select>
              <Briefcase size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button className="btn-premium" style={{ marginTop: '8px', minWidth: '220px' }}>
              Submit Request
            </button>
          </div>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.4' }}>
            Account creation subject to verification.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
