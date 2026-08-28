import { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification,
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth } from '../../firebase';

const SESSION_STORAGE_KEY = 'quizora_last_verification_sent';

export default function Register({ onNavigate }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validateEmail = (emailStr) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr);
  };

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please log in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many requests. Please wait a few minutes before trying again.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completion.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser settings.';
      default:
        return 'An error occurred during registration. Please try again.';
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create the Firebase Authentication account
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = userCredential.user;

      // 2. Set user display name
      if (newUser) {
        await updateProfile(newUser, {
          displayName: fullName.trim(),
        });

        // 3. Immediately send Firebase verification email link EXACTLY ONCE
        await sendEmailVerification(newUser);

        // 4. Save timestamp in sessionStorage for the 60s resend cooldown
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
        } catch (e) {
          console.warn('Could not set sessionStorage:', e);
        }
      }

      setSuccess('Verification email sent. Please check your inbox or spam folder.');
    } catch (err) {
      console.error("Registration error:", err);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
      // Google login bypasses email verification
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(getFriendlyErrorMessage(err.code));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="brand-badge">
          <svg className="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="brand-name">Quizora</span>
        </div>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join Quizora to take tests, track progress, and learn</p>
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

      <form onSubmit={handleRegister} className="auth-form" noValidate>
        <div className="form-group">
          <label htmlFor="reg-name" className="form-label">Full Name</label>
          <div className="input-wrapper">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <input
              id="reg-name"
              type="text"
              className="form-input"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading || googleLoading}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="reg-email" className="form-label">Email Address</label>
          <div className="input-wrapper">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <input
              id="reg-email"
              type="email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || googleLoading}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="reg-password" className="form-label">Password</label>
          <div className="input-wrapper">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || googleLoading}
              required
            />
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={loading || googleLoading}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="reg-confirm-password" className="form-label">Confirm Password</label>
          <div className="input-wrapper">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <input
              id="reg-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || googleLoading}
              required
            />
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              disabled={loading || googleLoading}
            >
              {showConfirmPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || googleLoading}
        >
          {loading ? (
            <span className="spinner-container">
              <span className="spinner"></span>
              <span>Creating account & sending email...</span>
            </span>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <div className="divider">
        <span>or</span>
      </div>

      <button
        type="button"
        className="btn btn-google"
        onClick={handleGoogleSignIn}
        disabled={loading || googleLoading}
      >
        {googleLoading ? (
          <span className="spinner-container">
            <span className="spinner spinner-dark"></span>
            <span>Connecting to Google...</span>
          </span>
        ) : (
          <>
            <svg className="google-icon" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      <div className="auth-footer">
        <p>
          Already have an account?{' '}
          <button
            type="button"
            className="link-button highlight"
            onClick={() => onNavigate('login')}
            disabled={loading || googleLoading}
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
