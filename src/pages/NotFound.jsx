import { useRouter } from '../router';
import logoImg from '../assets/logo.png';

export default function NotFound({ user }) {
  const { navigate } = useRouter();

  return (
    <div className="app-viewport">
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <main className="auth-container" style={{ maxWidth: '520px' }}>
        <div className="auth-card fade-in" style={{ textAlign: 'center', padding: '40px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img src={logoImg} alt="Task Grade" style={{ height: '48px', width: 'auto' }} />
          </div>

          <span style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.05em',
            background: 'rgba(79, 70, 229, 0.12)',
            color: '#4f46e5',
            marginBottom: '16px',
            textTransform: 'uppercase'
          }}>
            404 • Page Not Found
          </span>

          <h1 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', margin: '0 0 12px' }}>
            Oops! Route Missing
          </h1>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.6, marginBottom: '28px' }}>
            The page or route you are looking for does not exist, has been moved, or the URL entered is incorrect.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate(user ? '/dashboard' : '/login')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>{user ? 'Return to Dashboard' : 'Go to Login'}</span>
          </button>
        </div>
      </main>

      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Task Grade Web Application.</p>
      </footer>
    </div>
  );
}

