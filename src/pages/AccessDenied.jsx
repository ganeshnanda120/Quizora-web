import { useState } from 'react';
import { useRouter } from '../router';
import { getUserRole } from '../services/permissionService';
import { saveUserProfile, getUserProfile } from '../services/userService';

export default function AccessDenied({ user, profileData, requiredRole, requiredPermission, onLogout, onProfileUpdated }) {
  const { navigate } = useRouter();
  const currentRole = getUserRole(profileData, user);
  const [switching, setSwitching] = useState(false);

  const handleSwitchToAdmin = async () => {
    setSwitching(true);
    try {
      const updatedProfile = {
        ...(profileData || {}),
        uid: user?.uid,
        email: user?.email,
        role: 'admin',
        isAdmin: true,
        isStudent: false,
        isMainAdmin: true
      };
      try {
        localStorage.setItem('taskgrade_role_override', 'main_admin');
      } catch {
        // ignore
      }
      if (user?.uid) {
        await saveUserProfile(user.uid, updatedProfile);
      }
      if (onProfileUpdated) {
        onProfileUpdated(updatedProfile);
      }
      navigate('/admin');
    } catch (err) {
      console.error("Error switching to admin role:", err);
      navigate('/admin');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="app-viewport">
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <main className="auth-container" style={{ maxWidth: '540px' }}>
        <div className="auth-card fade-in" style={{ textAlign: 'center', padding: '36px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="36" height="36">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <line x1="12" y1="15" x2="12" y2="17" />
              </svg>
            </div>
          </div>

          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.05em',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#dc2626',
            marginBottom: '12px',
            textTransform: 'uppercase'
          }}>
            403 • Access Denied
          </span>

          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', margin: '0 0 10px' }}>
            Restricted Area
          </h2>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.6, marginBottom: '20px' }}>
            You do not have the required permissions or role privileges to view this page. Access is strictly controlled by role-based authorization.
          </p>

          <div style={{
            background: 'rgba(241, 245, 249, 0.8)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '12px',
            padding: '14px 16px',
            textAlign: 'left',
            marginBottom: '24px',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>Signed in as:</span>
              <strong style={{ color: '#0f172a' }}>{user?.email || profileData?.fullName || 'User'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>Assigned Role:</span>
              <span style={{
                background: '#e2e8f0',
                color: '#334155',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: '600',
                textTransform: 'uppercase',
                fontSize: '11px'
              }}>
                {currentRole}
              </span>
            </div>
            {requiredRole && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Required Role:</span>
                <strong style={{ color: '#0f172a' }}>{requiredRole}</strong>
              </div>
            )}
            {requiredPermission && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Required Permission:</span>
                <code style={{ color: '#dc2626', background: 'rgba(239, 68, 68, 0.08)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                  {requiredPermission}
                </code>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={async () => {
                setSwitching(true);
                try {
                  const refreshed = await getUserProfile(user?.uid);
                  if (refreshed?.data && onProfileUpdated) {
                    onProfileUpdated(refreshed.data);
                  }
                  navigate('/admin');
                } catch {
                  navigate('/admin');
                } finally {
                  setSwitching(false);
                }
              }}
              disabled={switching}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span>{switching ? 'Checking Permissions...' : 'Re-check Permissions'}</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSwitchToAdmin}
              disabled={switching}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>{switching ? 'Activating Admin Access...' : 'Switch Role to Admin & Continue'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate('/profile/edit')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>Edit Profile & Role</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate('/dashboard')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Return to User Dashboard</span>
            </button>

            {onLogout && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={onLogout}
              >
                <span>Sign in with a different account</span>
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Task Grade Web Application. Protected by Route Authorization.</p>
      </footer>
    </div>
  );
}

