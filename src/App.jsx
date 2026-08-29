import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { getUserProfile } from './services/userService';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import VerifyEmail from './components/Auth/VerifyEmail';
import CompleteProfile from './components/Profile/CompleteProfile';
import Dashboard from './pages/Dashboard';
import logoImg from './assets/logo.png';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Sync state with browser location
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    let target = path;
    if (!target.startsWith('/')) {
      target = '/' + target;
    }
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    setCurrentPath(target);
  };

  // Helper to fetch user profile from Firestore
  const fetchProfile = async (uid) => {
    setProfileLoading(true);
    try {
      const res = await getUserProfile(uid);
      setProfileData(res.data);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // Single Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchProfile(currentUser.uid);
      } else {
        setUser(null);
        setProfileData(null);
        setProfileLoading(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper to determine if user is verified
  // Google sign-in users are automatically considered verified.
  const isUserVerified = (u) => {
    if (!u) return false;
    if (u.emailVerified) return true;

    // Check if user authenticated via Google Provider
    const isGoogleUser = u.providerData?.some(
      (provider) => provider.providerId === 'google.com'
    );
    return isGoogleUser;
  };

  // Handle automatic redirects based on auth state, email verification & profile completion
  useEffect(() => {
    if (authLoading || profileLoading) return;

    let target = null;
    if (user) {
      if (isUserVerified(user)) {
        if (!profileData || !profileData.profileCompleted) {
          if (currentPath !== '/complete-profile') target = '/complete-profile';
        } else {
          if (currentPath !== '/dashboard') target = '/dashboard';
        }
      } else {
        if (currentPath !== '/verify-email') target = '/verify-email';
      }
    } else {
      if (['/dashboard', '/complete-profile', '/verify-email', '/'].includes(currentPath)) {
        target = '/login';
      }
    }

    if (target) {
      window.history.pushState({}, '', target);
      queueMicrotask(() => setCurrentPath(target));
    }
  }, [user, profileData, authLoading, profileLoading, currentPath]);

  // Callback when user completes email verification
  const handleUserVerified = async (updatedUser) => {
    setUser(updatedUser);
    await fetchProfile(updatedUser.uid);
  };

  // Callback when user completes profile setup
  const handleProfileCompleted = (newProfileData) => {
    setProfileData(newProfileData);
    navigateTo('/dashboard');
  };

  // Callback when user updates profile from dashboard modal
  const handleProfileUpdated = (updatedProfileData) => {
    setProfileData(updatedProfileData);
  };

  // Render initial loading screen while Firebase checks session & profile
  if (authLoading || (user && profileLoading)) {
    return (
      <div className="full-page-loader">
        <div className="loader-brand">
          <img src={logoImg} alt="Logo" className="loader-logo" />
        </div>
        <div className="spinner large"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  // Active Session View Controller
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
            <p>© {new Date().getFullYear()} Quizora Web Application. Powered by Firebase Auth.</p>
          </footer>
        </div>
      );
    }

    if (!profileData || !profileData.profileCompleted) {
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
            <p>© {new Date().getFullYear()} Quizora Web Application. Powered by Firebase Auth.</p>
          </footer>
        </div>
      );
    }

    return (
      <Dashboard
        user={user}
        profileData={profileData}
        onProfileUpdated={handleProfileUpdated}
      />
    );
  }

  // Unauthenticated View Controller
  return (
    <div className="app-viewport">
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <main className="auth-container">
        {currentPath === '/register' ? (
          <Register onNavigate={(target) => navigateTo(target)} />
        ) : (
          <Login onNavigate={(target) => navigateTo(target)} />
        )}
      </main>

      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Quizora Web Application. Powered by Firebase Auth.</p>
      </footer>
    </div>
  );
}

export default App;
