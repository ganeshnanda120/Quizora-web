import { useState, useEffect, useCallback } from 'react';
import { getAdminActivities, getAdminSubmissions, duplicateAdminActivity, deleteAdminActivity } from '../../services/adminService';
import SubmissionsList from './SubmissionsList';

export default function AdminHome({ user, onSelectOption, onOpenCreate, onOpenShareLink }) {
  const [activities, setActivities] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Type Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  // Interactive feedback & modal states
  const [copiedId, setCopiedId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [selectedSubmissionsActivity, setSelectedSubmissionsActivity] = useState(null);
  const [selectedResultsActivity, setSelectedResultsActivity] = useState(null);
  const [deleteTargetActivity, setDeleteTargetActivity] = useState(null);
  const [deletingActivity, setDeletingActivity] = useState(false);

  // Load activities and submissions for current logged-in admin only
  const loadData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [acts, subs] = await Promise.all([
        getAdminActivities(user.uid),
        getAdminSubmissions(user.uid)
      ]);
      const ownActivities = (acts || []).filter((a) => a.adminUid === user.uid);
      const ownSubmissions = (subs || []).filter((s) => s.adminUid === user.uid);
      setActivities(ownActivities);
      setSubmissions(ownSubmissions);
    } catch (err) {
      console.warn("Error loading admin dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    if (user?.uid) {
      Promise.resolve().then(() => {
        if (active) loadData();
      });
    }
    return () => {
      active = false;
    };
  }, [user, loadData]);

  // Handle Copy Link action
  const handleCopyLink = async (act) => {
    const link = act.shareUrl || `${window.location.origin}/activity/${act.activityId}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(act.activityId);
      setActionNotice({ type: 'success', message: `Copied link for "${act.title || 'Activity'}" to clipboard.` });
      setTimeout(() => {
        setCopiedId(null);
        setActionNotice(null);
      }, 3000);
    } catch (err) {
      console.warn("Copy link error:", err);
    }
  };

  // Handle Duplicate Activity action
  const handleDuplicate = async (act) => {
    if (act.adminUid !== user.uid) return;
    try {
      await duplicateAdminActivity(act, user.uid);
      setActionNotice({ type: 'success', message: `Duplicated "${act.title || 'Activity'}" successfully as a new draft.` });
      await loadData();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || "Failed to duplicate activity." });
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Handle Delete Activity action
  const handleConfirmDeleteActivity = async () => {
    if (!deleteTargetActivity || !user?.uid) return;
    setDeletingActivity(true);
    try {
      await deleteAdminActivity(deleteTargetActivity.activityId, user.uid);
      setActivities((prev) => prev.filter((a) => a.activityId !== deleteTargetActivity.activityId));
      setActionNotice({ type: 'success', message: `Activity "${deleteTargetActivity.title || 'Activity'}" deleted successfully.` });
      setTimeout(() => setActionNotice(null), 4000);
      setDeleteTargetActivity(null);
    } catch (err) {
      console.error("Error deleting activity:", err);
      setActionNotice({ type: 'error', message: "Failed to delete activity. Please try again." });
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setDeletingActivity(false);
    }
  };

  // Condition Helpers for Active vs Completed
  const isActivityActive = (act) => {
    // Drafts (unfinished creation wizard steps) must NOT appear in Active until published
    if (act.status === 'draft') {
      return false;
    }

    // If status is explicitly marked completed/expired, it is not active
    if (act.status === 'completed' || act.status === 'expired' || act.computedStatus === 'Completed' || act.computedStatus === 'Expired') {
      return false;
    }

    const now = new Date();
    const end = act.endTime ? new Date(act.endTime) : null;
    const isValidEnd = end && !isNaN(end.getTime());

    // If final end date is configured and current time is past the final date, it's no longer active
    if (isValidEnd && now > end) {
      return false;
    }

    // Must be published or active
    const isPublished = act.status === 'published' || act.status === 'active' || act.shareUrl || act.computedStatus === 'Active';
    return !!isPublished;
  };

  const isActivityCompleted = (act) => {
    const now = new Date();
    const end = act.endTime ? new Date(act.endTime) : null;
    const isValidEnd = end && !isNaN(end.getTime());

    const isExplicitlyCompleted =
      act.status === 'completed' ||
      act.status === 'expired' ||
      act.computedStatus === 'Completed' ||
      act.computedStatus === 'Expired';

    // Only completed if final date has passed OR status is explicitly completed
    const isEndPassed = isValidEnd && now > end;

    return isExplicitlyCompleted || isEndPassed;
  };

  // Filter activities by adminUid == user.uid, search query, and selected purpose filter
  const filterActivityItem = (act) => {
    if (act.adminUid !== user.uid) return false;

    if (searchQuery.trim()) {
      const titleLower = (act.title || '').toLowerCase();
      const subjectLower = (act.subject || '').toLowerCase();
      const queryLower = searchQuery.trim().toLowerCase();
      if (!titleLower.includes(queryLower) && !subjectLower.includes(queryLower)) {
        return false;
      }
    }

    if (typeFilter !== 'All') {
      const purposeLower = (act.purpose || 'Exam').toLowerCase();
      const filterLower = typeFilter.toLowerCase();

      if (typeFilter === 'Other') {
        if (['exam', 'assignment', 'custom'].includes(purposeLower)) {
          return false;
        }
      } else if (purposeLower !== filterLower) {
        return false;
      }
    }

    return true;
  };

  const activeActivities = activities.filter((act) => isActivityActive(act) && filterActivityItem(act));
  const completedActivities = activities.filter((act) => !isActivityActive(act) && isActivityCompleted(act) && filterActivityItem(act));

  // Compute stats for a single activity
  const getSubmissionsForActivity = (activityId) => {
    return submissions.filter((s) => s.activityId === activityId);
  };

  const getAverageScoreText = (activityId) => {
    const subs = getSubmissionsForActivity(activityId);
    const scoredSubs = subs.filter((s) => s.score !== undefined && s.score !== null);
    if (scoredSubs.length === 0) return 'N/A';

    const totalPerc = scoredSubs.reduce((acc, curr) => {
      if (curr.percentage !== undefined && curr.percentage !== null) {
        return acc + Number(curr.percentage);
      }
      if (curr.totalMarks && curr.totalMarks > 0) {
        return acc + (Number(curr.score) / Number(curr.totalMarks)) * 100;
      }
      return acc + Number(curr.score);
    }, 0);

    const avg = Math.round(totalPerc / scoredSubs.length);
    return `${avg}%`;
  };

  const handleCreateClick = () => {
    if (onOpenCreate) {
      onOpenCreate();
    } else if (onSelectOption) {
      onSelectOption('CREATE');
    }
  };

  return (
    <div className="admin-dashboard-redesign fade-in">
      {/* Toast Notice */}
      {actionNotice && (
        <div className={`admin-toast-banner alert-${actionNotice.type} fade-in`}>
          <span>{actionNotice.message}</span>
          <button className="toast-close-btn" onClick={() => setActionNotice(null)}>×</button>
        </div>
      )}

      {/* 1. CREATE SECTION (Large Hero Card at Top) */}
      <section className="create-section mb-8">
        <div className="create-hero-card">
          <div className="create-hero-content">
            <div className="create-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="badge-icon">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Activity Creator</span>
            </div>
            <h1 className="create-hero-title">CREATE</h1>
            <p className="create-hero-desc">
              Create a new Exam, Assignment, Custom Activity or Other Activity.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-create-hero"
            onClick={handleCreateClick}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="btn-plus-icon">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create New Activity</span>
          </button>
        </div>
      </section>

      {/* GLOBAL SEARCH & CATEGORY FILTERS TOOLBAR CARD */}
      <section className="filters-toolbar-card mb-6">
        <div className="search-input-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="form-input search-title-input"
            placeholder="Search activities by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        <div className="category-filter-pills">
          <span className="filter-lbl">Category:</span>
          {['All', 'Exam', 'Assignment', 'Custom', 'Other'].map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill-btn ${typeFilter === cat ? 'active' : ''}`}
              onClick={() => setTypeFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* 2. ACTIVE SECTION */}
      <section className="dashboard-section mb-8">
        <div className="section-header-row">
          <div className="section-title-box">
            <span className="status-live-indicator"></span>
            <h2 className="section-heading">ACTIVE</h2>
          </div>
          <span className="section-count-badge">{activeActivities.length} Active</span>
        </div>

        {loading ? (
          <div className="loading-center py-6">
            <div className="spinner"></div>
            <span>Loading active activities...</span>
          </div>
        ) : activeActivities.length === 0 ? (
          <div className="empty-section-card">
            <div className="empty-icon-circle active-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 className="empty-title">No Active Activities</h3>
            <p className="empty-desc">
              {searchQuery || typeFilter !== 'All'
                ? 'No active activities match your search query or filter.'
                : 'There are currently no running exams or assignments.'}
            </p>
          </div>
        ) : (
          <div className="activities-grid">
            {activeActivities.map((act) => {
              const actSubmissions = getSubmissionsForActivity(act.activityId);
              const participantCount = actSubmissions.length;
              const link = act.shareUrl || `${window.location.origin}/activity/${act.activityId}`;
              const isCopied = copiedId === act.activityId;

              return (
                <div key={act.activityId} className="activity-card active-card-theme">
                  <div className="card-top-bar">
                    <span className={`purpose-tag tag-${(act.purpose || 'Exam').toLowerCase()}`}>
                      {act.purpose || 'Exam'}
                    </span>
                    <span className="active-badge-pill">● Active</span>
                  </div>

                  <h3 className="card-activity-title">{act.title || 'Untitled Activity'}</h3>

                  {act.subject && (
                    <p className="card-activity-subject">
                      <strong>Subject:</strong> {act.subject}
                    </p>
                  )}

                  <div className="card-info-list">
                    <div className="info-item">
                      <span className="info-label">Start Date & Time:</span>
                      <span className="info-value">
                        {act.startTime ? new Date(act.startTime).toLocaleString() : 'Not Set'}
                      </span>
                    </div>

                    <div className="info-item">
                      <span className="info-label">End Date & Time:</span>
                      <span className="info-value">
                        {act.endTime ? new Date(act.endTime).toLocaleString() : 'Not Set'}
                      </span>
                    </div>

                    <div className="info-item highlight-item">
                      <span className="info-label">Participants:</span>
                      <span className="info-value participant-live-count">
                        <svg className="users-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        {participantCount} {participantCount === 1 ? 'Participant' : 'Participants'}
                      </span>
                    </div>

                    <div className="info-item link-item">
                      <span className="info-label">Activity Link:</span>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="activity-url-link"
                        title={link}
                      >
                        {link}
                      </a>
                    </div>
                  </div>

                  {/* ACTIVE CARD BUTTONS */}
                  <div className="card-buttons-row">
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-card-action btn-open"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      <span>Open</span>
                    </a>

                    <button
                      type="button"
                      className={`btn btn-card-action btn-copy ${isCopied ? 'copied' : ''}`}
                      onClick={() => handleCopyLink(act)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isCopied ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : (
                          <>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </>
                        )}
                      </svg>
                      <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-card-action btn-share"
                      onClick={() => onOpenShareLink && onOpenShareLink(act)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      <span>Share Link</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-card-action btn-submissions"
                      onClick={() => setSelectedSubmissionsActivity(act)}
                      title="View student submissions & grade answers"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      <span>View Submissions</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-card-action btn-delete-activity"
                      onClick={() => setDeleteTargetActivity(act)}
                      title="Delete Activity"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. COMPLETED SECTION */}
      <section className="dashboard-section mb-8">
        <div className="section-header-row">
          <div className="section-title-box">
            <svg className="section-icon completed-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h2 className="section-heading">COMPLETED</h2>
          </div>
          <span className="section-count-badge completed-badge">{completedActivities.length} Completed</span>
        </div>

        {loading ? (
          <div className="loading-center py-6">
            <div className="spinner"></div>
            <span>Loading completed activities...</span>
          </div>
        ) : completedActivities.length === 0 ? (
          <div className="empty-section-card">
            <div className="empty-icon-circle completed-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className="empty-title">No Completed Activities</h3>
            <p className="empty-desc">
              {searchQuery || typeFilter !== 'All'
                ? 'No completed activities match your search query or filter.'
                : 'There are no finished exams, assignments, or expired activities.'}
            </p>
          </div>
        ) : (
          <div className="activities-grid">
            {completedActivities.map((act) => {
              const actSubmissions = getSubmissionsForActivity(act.activityId);
              const totalParticipants = actSubmissions.length;
              const avgScore = getAverageScoreText(act.activityId);

              const completionDate = act.endTime
                ? new Date(act.endTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : act.updatedAt
                ? new Date(act.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Finished';

              return (
                <div key={act.activityId} className="activity-card completed-card-theme">
                  <div className="card-top-bar">
                    <span className={`purpose-tag tag-${(act.purpose || 'Exam').toLowerCase()}`}>
                      {act.purpose || 'Exam'}
                    </span>
                    <span className="completed-badge-pill">✓ Finished</span>
                  </div>

                  <h3 className="card-activity-title">{act.title || 'Untitled Activity'}</h3>

                  {act.subject && (
                    <p className="card-activity-subject">
                      <strong>Subject:</strong> {act.subject}
                    </p>
                  )}

                  <div className="card-info-list">
                    <div className="info-item">
                      <span className="info-label">Total Participants:</span>
                      <span className="info-value">
                        <strong className="text-highlight">{totalParticipants}</strong>
                      </span>
                    </div>

                    <div className="info-item">
                      <span className="info-label">Completion Date:</span>
                      <span className="info-value">{completionDate}</span>
                    </div>

                    <div className="info-item highlight-score-item">
                      <span className="info-label">Average Score:</span>
                      <span className="info-value avg-score-tag">{avgScore}</span>
                    </div>
                  </div>

                  {/* COMPLETED CARD BUTTONS */}
                  <div className="card-buttons-row">
                    <button
                      type="button"
                      className="btn btn-card-action btn-results"
                      onClick={() => setSelectedResultsActivity(act)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      <span>Open Results</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-card-action btn-submissions"
                      onClick={() => setSelectedSubmissionsActivity(act)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      <span>View Submissions</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-card-action btn-duplicate"
                      onClick={() => handleDuplicate(act)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>Duplicate Activity</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-card-action btn-delete-activity"
                      onClick={() => setDeleteTargetActivity(act)}
                      title="Delete Activity"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CONFIRM DELETE ACTIVITY MODAL */}
      {deleteTargetActivity && (
        <div className="modal-backdrop" onClick={() => setDeleteTargetActivity(null)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text text-danger font-bold">⚠️ Confirm Delete Activity</h4>
              <button type="button" className="modal-close-btn" onClick={() => setDeleteTargetActivity(null)}>×</button>
            </div>
            <div className="modal-body-content py-3">
              <p className="text-sm font-semibold mb-2" style={{ color: '#0f172a' }}>
                Are you sure you want to delete this activity?
              </p>
              <p className="text-xs text-muted mb-2">
                <strong>Activity Title:</strong> {deleteTargetActivity.title || 'Untitled Activity'}
              </p>
              <p className="text-xs text-danger">
                This will permanently remove this activity and all student submissions associated with it. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleteTargetActivity(null)}
                disabled={deletingActivity}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmDeleteActivity}
                disabled={deletingActivity}
              >
                {deletingActivity ? 'Deleting...' : 'Yes, Delete Activity'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW SUBMISSIONS MODAL */}
      {selectedSubmissionsActivity && (
        <div className="modal-backdrop" onClick={() => setSelectedSubmissionsActivity(null)}>
          <div className="modal-card extra-wide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <div>
                <h3 className="modal-title-text">
                  Submissions: {selectedSubmissionsActivity.title || 'Activity'}
                </h3>
                <p className="modal-subtext">Review answers, grade student papers, and update scores.</p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedSubmissionsActivity(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body-scroll">
              <SubmissionsList
                user={user}
                onBack={() => setSelectedSubmissionsActivity(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* OPEN RESULTS MODAL */}
      {selectedResultsActivity && (
        <div className="modal-backdrop" onClick={() => setSelectedResultsActivity(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <div>
                <h3 className="modal-title-text">
                  Results Overview: {selectedResultsActivity.title || 'Activity'}
                </h3>
                <span className="modal-type-badge">
                  {selectedResultsActivity.purpose || 'Exam'}
                </span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedResultsActivity(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body-content">
              {(() => {
                const subs = getSubmissionsForActivity(selectedResultsActivity.activityId);
                const avg = getAverageScoreText(selectedResultsActivity.activityId);
                const scoredSubs = subs.filter((s) => s.score !== undefined);

                return (
                  <div className="results-summary-box">
                    <div className="results-stats-grid">
                      <div className="results-stat-card">
                        <span className="stat-value">{subs.length}</span>
                        <span className="stat-label">Total Participants</span>
                      </div>
                      <div className="results-stat-card">
                        <span className="stat-value highlight">{avg}</span>
                        <span className="stat-label">Average Score</span>
                      </div>
                      <div className="results-stat-card">
                        <span className="stat-value">{scoredSubs.length}</span>
                        <span className="stat-label">Graded Submissions</span>
                      </div>
                    </div>

                    <div className="results-details-list mt-4">
                      <h4 className="results-list-heading">Participant Score Breakdown</h4>
                      {subs.length === 0 ? (
                        <p className="no-subs-notice py-4 text-center">No submissions submitted for this activity yet.</p>
                      ) : (
                        <div className="results-table-wrapper">
                          <table className="results-table">
                            <thead>
                              <tr>
                                <th>Participant</th>
                                <th>ID / Roll</th>
                                <th>Score</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subs.map((s, idx) => (
                                <tr key={s.submissionId || idx}>
                                  <td>{s.participantDetails?.Name || s.participantName || 'Participant'}</td>
                                  <td>{s.participantDetails?.['Roll Number'] || s.participantDetails?.['Registration Number'] || 'N/A'}</td>
                                  <td><strong>{s.score !== undefined ? `${s.score} pts` : 'Pending'}</strong></td>
                                  <td>
                                    <span className={`status-pill ${s.status === 'Checked' ? 'checked' : 'pending'}`}>
                                      {s.status || 'Pending'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="modal-footer-bar flex-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedResultsActivity(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
