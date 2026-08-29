import { useState, useEffect } from 'react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import logoImg from '../../assets/logo.png';

const COOLDOWN_SECONDS = 60;
const SESSION_STORAGE_KEY = 'quizora_last_verification_sent';

export default function VerifyEmail({ user, onVerified }) {
  const [resendLoading, setResendLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate initial cooldown remaining from sessionStorage
  const getInitialCooldown = () => {
    try {
      const lastSent = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (lastSent) {
        const elapsed = Math.floor((Date.now() - parseInt(lastSent, 10)) / 1000);
        const remaining = COOLDOWN_SECONDS - elapsed;
        return remaining > 0 ? remaining : 0;
      }
    } catch (e) {
      console.warn('Could not read sessionStorage:', e);
    }
    return 0;
  };

  const [cooldown, setCooldown] = useState(getInitialCooldown);

  // Cooldown countdown timer effect (runs ONLY when cooldown > 0)
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const handleResendEmail = async () => {
    if (cooldown > 0 || resendLoading) return;

    setError('');
    setSuccess('');
    setResendLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('No active user session found. Please log in again.');
        return;
      }

      // Explicitly send verification email ONLY when user clicks button
      await sendEmailVerification(currentUser);

      // Persist cooldown timestamp in sessionStorage so page refreshes retain cooldown
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
      } catch (e) {
        console.warn('Could not save to sessionStorage:', e);
      }

      setSuccess('Verification email sent. Please check your inbox or spam folder.');
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      console.error('Error sending verification email:', err);
      if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few minutes before trying again.');
        setCooldown(COOLDOWN_SECONDS);
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError('Failed to resend verification email. Please try again later.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleCheckVerified = async () => {
    setError('');
    setSuccess('');
    setCheckLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('User session expired. Please log in again.');
        return;
      }

      // Does NOT call sendEmailVerification! Only reloads user state from backend.
      await currentUser.reload();
      const updatedUser = auth.currentUser;

      if (updatedUser && updatedUser.emailVerified) {
        setSuccess('Email verified successfully! Redirecting to dashboard...');
        if (onVerified) {
          onVerified(updatedUser);
        }
      } else {
        setError('Your email is not verified yet.');
      }
    } catch (err) {
      console.error('Error checking verification:', err);
      if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError('Could not verify status. Please check your internet connection.');
      }
    } finally {
      setCheckLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const displayEmail = user?.email || auth.currentUser?.email || '';

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="brand-badge logo-only">
          <img src={logoImg} alt="Logo" className="brand-logo-img" />
        </div>

        <div className="verify-email-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>

        <h1 className="auth-title">Please verify your email</h1>
        <p className="auth-subtitle notice-text">
          We sent a verification link to your email address.
        </p>
      </div>

      <div className="email-display-card">
        <span className="email-label">Account Email</span>
        <strong className="email-value">{displayEmail}</strong>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="status">
          <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>{success}</span>
        </div>
      )}

      <div className="verify-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCheckVerified}
          disabled={checkLoading || resendLoading}
        >
          {checkLoading ? (
            <span className="spinner-container">
              <span className="spinner"></span>
              <span>Checking status...</span>
            </span>
          ) : (
            "I've verified my email"
          )}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleResendEmail}
          disabled={resendLoading || checkLoading || cooldown > 0}
        >
          {resendLoading ? (
            <span className="spinner-container">
              <span className="spinner spinner-dark"></span>
              <span>Sending email...</span>
            </span>
          ) : cooldown > 0 ? (
            `Resend available in ${cooldown}s`
          ) : (
            'Resend verification email'
          )}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleSignOut}
          disabled={checkLoading || resendLoading}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
