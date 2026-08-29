import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { getTimeBasedGreeting } from '../utils/greetingUtils';
import ProfileModal from '../components/Profile/ProfileModal';
import CreateActivityWizard from '../components/Admin/CreateActivityWizard';
import AdminHome from '../components/Admin/AdminHome';
import Step5FinalizeShare from '../components/Admin/Step5FinalizeShare';
import { getActivityById } from '../services/activityService';
import logoImg from '../assets/logo.png';

export default function Dashboard({ user, profileData, onProfileUpdated }) {
  const [activeSection, setActiveSection] = useState('user'); // 'selector', 'user', 'admin'
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'user', 'admin'
  const [showDropdown, setShowDropdown] = useState(false);
  const [modalMode, setModalMode] = useState(null); // null, 'view', or 'edit'
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [shareActivityData, setShareActivityData] = useState(null);

  // User Dashboard: Paste Exam URL state
  const [examUrl, setExamUrl] = useState('');
  const [joining, setJoining] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [joinedActivity, setJoinedActivity] = useState(null);

  const dropdownRef = useRef(null);

  // Time-based welcome & quote calculations
  const displayName = profileData?.fullName || user?.displayName || user?.email?.split('@')[0] || 'User';
  const { greeting, quote } = getTimeBasedGreeting(displayName);

  const profilePicUrl = profileData?.photoURL || profileData?.profileImageUrl || user?.photoURL || '';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setShowDropdown(false);
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'Q';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'Q';
  };

  // URL extraction helper
  const extractExamId = (urlInput) => {
    if (!urlInput || !urlInput.trim()) return '';
    const trimmed = urlInput.trim();
    const match = trimmed.match(/(?:exam|activity)\/([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed.split('/').pop().split('?')[0];
  };

  // Clipboard Paste handler
  const handlePasteFromClipboard = async () => {
    setUrlError('');
    setJoinedActivity(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setExamUrl(text.trim());
        }
      }
    } catch (err) {
      console.warn("Clipboard read error:", err);
    }
  };

  // Join Exam handler
  const handleJoinExam = async (e) => {
    if (e) e.preventDefault();
    setUrlError('');
    setJoinedActivity(null);

    const rawId = extractExamId(examUrl);
    if (!rawId) {
      setUrlError("Please enter or paste a valid Exam / Assignment URL.");
      return;
    }

    setJoining(true);
    try {
      const activity = await getActivityById(rawId);
      if (activity && (activity.status === 'published' || activity.title)) {
        setJoinedActivity(activity);
      } else {
        setUrlError("Invalid or expired exam link.");
      }
    } catch (err) {
      console.error("Join exam error:", err);
      setUrlError("Invalid or expired exam link.");
    } finally {
      setJoining(false);
    }
  };

  const handleAdminOptionSelect = (option) => {
    if (option === 'CREATE') {
      setShowCreateWizard(true);
    }
  };

  // History entries list
  const historyData = [];

  const filteredHistory = historyData.filter((item) => {
    if (historyFilter === 'all') return true;
    return item.type === historyFilter;
  });

  return (
    <div className="dashboard-layout">
      {/* DASHBOARD HEADER */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          {/* Left Side: Brand Logo + Greeting with space */}
          <div className="header-left-group">
            <div className="header-brand-box" title="Quizora">
              <img src={logoImg} alt="Quizora" className="navbar-logo-img" />
            </div>

            <div className="header-greeting-box">
              <h2 className="header-user-name">{greeting}</h2>
              <div className="header-welcome-line">
                <span className="welcome-greeting">Welcome back!</span>
                <span className="greeting-divider">•</span>
                <span className="welcome-quote">"{quote}"</span>
              </div>
            </div>
          </div>

          {/* User Profile Avatar & Dropdown (Far Right) */}
          <div className="header-right">
            <div className="user-profile-menu" ref={dropdownRef}>
              <button
                className="avatar-btn"
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label="User menu"
                aria-expanded={showDropdown}
              >
                {profilePicUrl ? (
                  <img src={profilePicUrl} alt={displayName} className="user-avatar-img" />
                ) : (
                  <div className="user-avatar-badge">{getInitials(displayName)}</div>
                )}
              </button>

            {/* Profile Dropdown Menu */}
            {showDropdown && (
              <div className="profile-dropdown-menu">
                <div className="dropdown-user-header">
                  {profilePicUrl ? (
                    <img src={profilePicUrl} alt={displayName} className="dropdown-avatar-sm" />
                  ) : (
                    <div className="dropdown-avatar-fallback">{getInitials(displayName)}</div>
                  )}
                  <div className="dropdown-user-info">
                    <span className="dropdown-name">{displayName}</span>
                    <span className="dropdown-email">{user?.email}</span>
                  </div>
                </div>

                <div className="dropdown-divider"></div>

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowDropdown(false);
                    setModalMode('view');
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>View Profile</span>
                </button>

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowDropdown(false);
                    setModalMode('edit');
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  <span>Edit Profile</span>
                </button>

                <div className="dropdown-divider"></div>

                <button className="dropdown-item danger" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="dashboard-main dashboard-container">
        {/* Main Section Navigation Switcher Tabs */}
        <div className="section-tab-container mb-6">
          <div className="section-tabs">
            <button
              className={`section-tab-btn ${activeSection === 'user' ? 'active' : ''}`}
              onClick={() => setActiveSection('user')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>USER</span>
            </button>

            <button
              className={`section-tab-btn ${activeSection === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveSection('admin')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>ADMIN</span>
            </button>
          </div>
        </div>

        {/* 1. TWO LARGE CENTRAL CARDS / SELECTOR VIEW */}
        {activeSection === 'selector' && (
          <div className="main-selector-container fade-in">
            <div className="selector-grid">
              {/* USER Card */}
              <div className="selector-card primary-card">
                <div className="selector-card-icon icon-user">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <h2 className="selector-card-title">USER</h2>
                <p className="selector-card-desc">
                  Join and complete exams, assignments and other activities.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => setActiveSection('user')}
                >
                  <span>Continue as User &rarr;</span>
                </button>
              </div>

              {/* ADMIN Card */}
              <div className="selector-card admin-card">
                <div className="selector-card-icon icon-admin">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h2 className="selector-card-title">ADMIN</h2>
                <p className="selector-card-desc">
                  Create and manage exams, assignments and other activities.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={() => setActiveSection('admin')}
                >
                  <span>Continue as Admin &rarr;</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. USER DASHBOARD VIEW */}
        {activeSection === 'user' && (
          <div className="dashboard-section-view fade-in">
            {/* PASTE EXAM URL SECTION (Write ONLY Join here) */}
            <div className="join-exam-card">
              <div className="join-card-header">
                <div className="join-icon-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <div>
                  <h2 className="join-card-title">Join</h2>
                  <p className="join-card-desc">Enter or paste the link provided by your Admin to participate.</p>
                </div>
              </div>

              <form onSubmit={handleJoinExam} className="url-join-form">
                <div className="url-input-wrapper">
                  <input
                    type="text"
                    className="form-input large-url-input"
                    placeholder="Paste Exam / Assignment URL here..."
                    value={examUrl}
                    onChange={(e) => {
                      setUrlError('');
                      setExamUrl(e.target.value);
                    }}
                  />
                  <div className="url-btn-group">
                    <button
                      type="button"
                      className="btn btn-secondary btn-paste"
                      onClick={handlePasteFromClipboard}
                      title="Paste from clipboard"
                    >
                      Paste
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-join"
                      disabled={joining || !examUrl.trim()}
                    >
                      {joining ? (
                        <div className="spinner-container">
                          <div className="spinner spinner-dark"></div>
                          <span>Checking...</span>
                        </div>
                      ) : (
                        <span>Join</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Error State */}
              {urlError && (
                <div className="alert alert-error mt-4 fade-in" role="alert">
                  <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{urlError}</span>
                </div>
              )}

              {/* Found Joined Activity Card Preview */}
              {joinedActivity && (
                <div className="found-activity-card fade-in mt-4">
                  <div className="found-activity-header">
                    <span className="type-tag-badge">{joinedActivity.purpose || 'Exam'}</span>
                    <h3 className="found-title">{joinedActivity.title}</h3>
                  </div>
                  {joinedActivity.institutionName && (
                    <p className="found-institution">Institution: {joinedActivity.institutionName}</p>
                  )}
                  <p className="found-admin">Admin: {joinedActivity.adminName}</p>

                  <div className="found-actions mt-3">
                    <button type="button" className="btn btn-success btn-lg">
                      Start {joinedActivity.purpose || 'Activity'} &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* HISTORY SECTION */}
            <div className="history-container mt-6">
              <div className="history-header">
                <div className="history-title-group">
                  <svg className="history-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <h2 className="history-title">History</h2>
                </div>

                {/* History Filter Tabs: ALL, AS USER, AS ADMIN */}
                <div className="filter-tabs">
                  <button
                    className={`filter-btn ${historyFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setHistoryFilter('all')}
                  >
                    ALL
                  </button>
                  <button
                    className={`filter-btn ${historyFilter === 'user' ? 'active' : ''}`}
                    onClick={() => setHistoryFilter('user')}
                  >
                    AS USER
                  </button>
                  <button
                    className={`filter-btn ${historyFilter === 'admin' ? 'active' : ''}`}
                    onClick={() => setHistoryFilter('admin')}
                  >
                    AS ADMIN
                  </button>
                </div>
              </div>

              {/* History Content / Empty State */}
              {filteredHistory.length > 0 ? (
                <div className="history-list">
                  {filteredHistory.map((item) => (
                    <div key={item.id} className="history-item-card">
                      <div className="history-item-main">
                        <span className={`type-badge ${item.type}`}>
                          {item.purpose || item.type.toUpperCase()}
                        </span>
                        <h4>{item.title}</h4>
                      </div>
                      <div className="history-item-meta">
                        <span>{item.date}</span>
                        <span className="history-role-tag">
                          {item.type === 'admin' ? 'Created by you' : 'Participated as User'}
                        </span>
                        <span className="history-status">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-card card-3d-layer-info">
                  <div className="empty-icon-box card-3d-layer-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8v4l3 3"/>
                      <path d="M16.5 7.5L18 6"/>
                    </svg>
                  </div>
                  <h3 className="empty-title card-3d-layer-title">No activity yet.</h3>
                  <p className="empty-desc card-3d-layer-sub">
                    {historyFilter === 'all'
                      ? 'You have not participated in or created any exams or assignments yet.'
                      : historyFilter === 'user'
                      ? 'No exam participation history recorded for this account.'
                      : 'No admin creation history recorded for this account.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. ADMIN DASHBOARD VIEW */}
        {activeSection === 'admin' && (
          <div className="dashboard-section-view fade-in">
            <AdminHome
              user={user}
              onSelectOption={handleAdminOptionSelect}
              onOpenCreate={() => setShowCreateWizard(true)}
              onOpenShareLink={(act) => setShareActivityData(act)}
            />
          </div>
        )}
      </main>

      {/* Profile Modal for View / Edit */}
      {modalMode && (
        <ProfileModal
          user={user}
          profileData={profileData}
          initialMode={modalMode}
          onClose={() => setModalMode(null)}
          onProfileUpdated={(updated) => {
            if (onProfileUpdated) onProfileUpdated(updated);
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Admin Activity Creation Wizard Modal */}
      {showCreateWizard && (
        <CreateActivityWizard
          user={user}
          profileData={profileData}
          onClose={() => setShowCreateWizard(false)}
        />
      )}

      {/* Share / Open Modal */}
      {shareActivityData && (
        <div className="modal-backdrop" onClick={() => setShareActivityData(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <Step5FinalizeShare
              activityId={shareActivityData.activityId}
              shareUrl={shareActivityData.shareUrl}
              activityData={shareActivityData}
              onClose={() => setShareActivityData(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
