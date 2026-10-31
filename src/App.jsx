import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, getRedirectResult, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { getUserProfile, checkIsProfileComplete, subscribeUserProfile } from './services/userService';
import { canAccessRoute } from './services/permissionService';
import { RouterProvider, useRouter, matchRoute } from './router';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import VerifyEmail from './components/Auth/VerifyEmail';
import CompleteProfile from './components/Profile/CompleteProfile';
import Dashboard from './pages/Dashboard';
import StudentActivityScreen from './components/Student/StudentActivityScreen';
import AccessDenied from './pages/AccessDenied';
import NotFound from './pages/NotFound';
import logoImg from './assets/logo.png';
import './App.css';

/**
 * Checks whether user email is verified or authenticated via Google provider
 */
const isUserVerified = (u) => {
  if (!u) return false;
  if (u.emailVerified) return true;
  const isGoogleUser = u.providerData?.some(
    (provider) => provider.providerId === 'google.com'
  );
  return Boolean(isGoogleUser);
};

/**
 * Checks whether user profile is filled
 */
const isProfileComplete = (profile) => {
  return checkIsProfileComplete(profile);
};

/**
 * Checks if the route belongs to the core dashboard / admin suite
 */
const isKnownDashboardRoute = (path) => {
  if (['/dashboard', '/profile', '/profile/edit', '/admin', '/admin/create', '/admin/submissions', '/admin/results'].includes(path)) {
    return true;
  }
  if (matchRoute('/admin/submissions/:activityId', path)) {
    return true;
  }
  if (matchRoute('/admin/results/:activityId', path)) {
    return true;
  }
  if (matchRoute('/admin/edit/:activityId', path)) {
    return true;
  }
  return false;
};

function AppContent() {
  const { currentPath, navigate } = useRouter();

  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Catch redirect auth result on load
  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect sign-in error:", error);
    });
  }, []);

  // Helper to fetch user profile from Firestore with safety checks
  const fetchProfile = useCallback(async (uid) => {
    try {
      const res = await getUserProfile(uid);
      setProfileData(res.data);
      return res.data;
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setProfileData(null);
      return null;
    }
  }, []);

  // Firebase auth state listener with real-time profile subscription
  useEffect(() => {
    let isMounted = true;
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;

      if (currentUser) {
        setUser(currentUser);
        setProfileLoading(true);
        try {
          const profile = await fetchProfile(currentUser.uid);
          if (isMounted) {
            setProfileData(profile);
          }
        } finally {
          if (isMounted) {
            setProfileLoading(false);
            setAuthLoading(false);
          }
        }

        // Attach real-time snapshot listener for permission & profile changes
        unsubscribeProfile();
        unsubscribeProfile = subscribeUserProfile(currentUser.uid, (updatedProfile) => {
          if (isMounted) {
            setProfileData(updatedProfile);
          }
        });
      } else {
        unsubscribeProfile();
        setUser(null);
        setProfileData(null);
        setProfileLoading(false);
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, [fetchProfile]);

  // Handle automatic redirects based on auth state, verification, and saved return routes
  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      // If user is unauthenticated and attempting to visit a private route, redirect to /login
      if (currentPath !== '/login' && currentPath !== '/register' && !currentPath.startsWith('/activity/')) {
        if (currentPath !== '/') {
          sessionStorage.setItem('quizora_redirect_after_auth', currentPath);
        }
        navigate('/login', { replace: true });
      }
      return;
    }

    // Authenticated user checks
    if (!isUserVerified(user)) {
      if (currentPath !== '/verify-email') {
        navigate('/verify-email', { replace: true });
      }
      return;
    }

    if (!isProfileComplete(profileData)) {
      if (currentPath !== '/complete-profile') {
        navigate('/complete-profile', { replace: true });
      }
      return;
    }

    // User is fully authenticated, verified, and profile complete.
    // Redirect away from entry/auth pages to intended destination or /dashboard
    if (['/login', '/register', '/verify-email', '/complete-profile', '/'].includes(currentPath)) {
      const redirectTarget = sessionStorage.getItem('quizora_redirect_after_auth');
      if (redirectTarget && redirectTarget !== '/login' && redirectTarget !== '/') {
        sessionStorage.removeItem('quizora_redirect_after_auth');
        navigate(redirectTarget, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, profileData, authLoading, profileLoading, currentPath, navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, [navigate]);

  // Callback when user completes email verification
  const handleUserVerified = useCallback((updatedUser) => {
    setUser(updatedUser);
    setProfileLoading(true);
    fetchProfile(updatedUser.uid).finally(() => {
      setProfileLoading(false);
    });
  }, [fetchProfile]);

  // Callback when user completes profile setup
  const handleProfileCompleted = useCallback((newProfileData) => {
    setProfileData(newProfileData);
    const redirectTarget = sessionStorage.getItem('quizora_redirect_after_auth');
    if (redirectTarget && redirectTarget !== '/login' && redirectTarget !== '/') {
      sessionStorage.removeItem('quizora_redirect_after_auth');
      navigate(redirectTarget);
    } else {
      navigate('/dashboard');
    }
  }, [navigate]);

  // Callback when user updates profile from dashboard modal
  const handleProfileUpdated = useCallback((updatedProfileData) => {
    setProfileData(updatedProfileData);
  }, []);

  // 1. Initial loading screen while Firebase checks session & profile
  if (authLoading || (user && profileLoading)) {
    return (
      <div className="full-page-loader">
        <div className="loader-brand">
          <img src={logoImg} alt="Task Grade" className="loader-logo" />
        </div>
        <div className="spinner large"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  // 2. Direct Activity Link view controller (Student / Guest taking an activity)
  if (currentPath.startsWith('/activity/')) {
    const activityId = currentPath.replace('/activity/', '').split('?')[0].split('/')[0];
    return (
      <StudentActivityScreen
        activityId={activityId}
        user={user}
        profileData={profileData}
        onNavigateHome={() => navigate(user ? '/dashboard' : '/login')}
      />
    );
  }

  // 3. Authenticated View Controller
  if (user) {
    if (!isUserVerified(user)) {
      return (
        <div className="app-viewport">
          <div className="bg-glow bg-glow-1"></div>
          <div className="bg-glow bg-glow-2"></div>
          <main className="auth-container">
            <VerifyEmail user={user} onVerified={handleUserVerified} />
          </main>
          <footer className="app-footer">
            <p>© {new Date().getFullYear()} Task Grade Web Application. Powered by Firebase Auth.</p>
          </footer>
        </div>
      );
    }

    if (!isProfileComplete(profileData)) {
      return (
        <div className="app-viewport">
          <div className="bg-glow bg-glow-1"></div>
          <div className="bg-glow bg-glow-2"></div>
          <main className="auth-container">
            <CompleteProfile
              user={user}
              initialProfile={profileData}
              onComplete={handleProfileCompleted}
            />
          </main>
          <footer className="app-footer">
            <p>© {new Date().getFullYear()} Task Grade Web Application. Powered by Firebase Auth.</p>
          </footer>
        </div>
      );
    }

    // Role and Permission verification
    const accessCheck = canAccessRoute(currentPath, profileData, user);
    if (!accessCheck.allowed) {
      return (
        <AccessDenied
          user={user}
          profileData={profileData}
          requiredRole={accessCheck.requiredRole}
          requiredPermission={accessCheck.requiredPermission}
          reason={accessCheck.reason}
          onLogout={handleLogout}
        />
      );
    }

    // Known Dashboard / Admin / Profile routes
    if (isKnownDashboardRoute(currentPath)) {
      return (
        <Dashboard
          user={user}
          profileData={profileData}
          onProfileUpdated={handleProfileUpdated}
        />
      );
    }

    // Fallback while redirecting from auth paths to /dashboard
    if (['/login', '/register', '/verify-email', '/complete-profile', '/'].includes(currentPath)) {
      return (
        <Dashboard
          user={user}
          profileData={profileData}
          onProfileUpdated={handleProfileUpdated}
        />
      );
    }

    // Unknown authenticated route -> 404
    return <NotFound user={user} />;
  }

  // 4. Unauthenticated View Controller
  if (currentPath === '/register') {
    return (
      <div className="app-viewport">
        <div className="bg-glow bg-glow-1"></div>
        <div className="bg-glow bg-glow-2"></div>

        <main className="auth-container">
          <Register onNavigate={(target) => navigate(target.startsWith('/') ? target : `/${target}`)} />
        </main>

        <footer className="app-footer">
          <p>© {new Date().getFullYear()} Task Grade Web Application. Powered by Firebase Auth.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-viewport">
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <main className="auth-container">
        <Login onNavigate={(target) => navigate(target.startsWith('/') ? target : `/${target}`)} />
      </main>

      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Task Grade Web Application. Powered by Firebase Auth.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
