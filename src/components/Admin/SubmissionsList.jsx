import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAdminSubmissions, getAdminActivities } from '../../services/adminService';
import {
  getEvaluationStats,
  getSubmissionEvaluationStatus,
  getSubmissionPublicationStatus
} from '../../services/evaluationService';
import SubmissionChecker from './SubmissionChecker';

export default function SubmissionsList({ user, onBack, filterActivityId }) {
  const [submissions, setSubmissions] = useState([]);
  const [activitiesMap, setActivitiesMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'pending', 'partially_checked', 'completed', 'published'
  const [sortBy, setSortBy] = useState('Submission Time');

  // Selected submission for grading
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const loadSubmissionsData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [subList, actList] = await Promise.all([
        getAdminSubmissions(user.uid),
        getAdminActivities(user.uid)
      ]);

      const aMap = {};
      (actList || []).forEach((a) => {
        aMap[a.activityId] = a;
      });

      setSubmissions(subList || []);
      setActivitiesMap(aMap);
    } catch (err) {
      console.warn("Load admin submissions error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    if (user?.uid) {
      Promise.resolve().then(() => {
        if (active) loadSubmissionsData();
      });
    }
    return () => {
      active = false;
    };
  }, [user, loadSubmissionsData]);

  // Current activity for this review view
  const currentActivity = useMemo(() => {
    if (!filterActivityId || filterActivityId === 'all') return null;
    return activitiesMap[filterActivityId] || { activityId: filterActivityId, title: 'Activity' };
  }, [filterActivityId, activitiesMap]);

  // Submissions filtered strictly to this activity (Phase 1: Do not mix participants from different activities)
  const activitySubmissions = useMemo(() => {
    if (!filterActivityId || filterActivityId === 'all') return submissions;
    return submissions.filter((s) => s.activityId === filterActivityId);
  }, [submissions, filterActivityId]);

  // High-level activity statistics
  const stats = useMemo(() => {
    return getEvaluationStats(currentActivity, activitySubmissions);
  }, [currentActivity, activitySubmissions]);

  // Filtered submissions based on active filter and search query
  const filteredSubmissions = useMemo(() => {
    return activitySubmissions.filter((sub) => {
      const evalStatus = getSubmissionEvaluationStatus(sub, currentActivity);
      const pubStatus = getSubmissionPublicationStatus(sub);

      // Status filters
      if (activeFilter === 'pending' && evalStatus !== 'pending') return false;
      if (activeFilter === 'partially_checked' && evalStatus !== 'partially_checked') return false;
      if (activeFilter === 'completed' && evalStatus !== 'completed') return false;
      if (activeFilter === 'published' && pubStatus !== 'published') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pDetails = sub.participantData || sub.participantDetails || {};
        const name = (pDetails.Name || sub.participantName || '').toLowerCase();
        const regNo = (pDetails['Registration Number'] || pDetails['Student ID'] || pDetails['Roll Number'] || '').toLowerCase();
        const email = (pDetails['Email Address'] || sub.participantEmail || '').toLowerCase();

        return name.includes(q) || regNo.includes(q) || email.includes(q);
      }

      return true;
    });
  }, [activitySubmissions, activeFilter, searchQuery, currentActivity]);

  // Sorted submissions
  const sortedSubmissions = useMemo(() => {
    return [...filteredSubmissions].sort((a, b) => {
      if (sortBy === 'Name') {
        const nameA = a.participantData?.Name || a.participantDetails?.Name || a.participantName || '';
        const nameB = b.participantData?.Name || b.participantDetails?.Name || b.participantName || '';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'Identifier') {
        const idA = a.participantData?.['Registration Number'] || a.participantData?.['Student ID'] || a.participantData?.['Roll Number'] || '';
        const idB = b.participantData?.['Registration Number'] || b.participantData?.['Student ID'] || b.participantData?.['Roll Number'] || '';
        return idA.localeCompare(idB);
      }
      if (sortBy === 'Score') {
        return (b.score || 0) - (a.score || 0);
      }
      if (sortBy === 'Status') {
        const sA = getSubmissionEvaluationStatus(a);
        const sB = getSubmissionEvaluationStatus(b);
        return sA.localeCompare(sB);
      }
      // Default: Submission Time (newest first)
      const timeA = new Date(a.submittedAt || 0).getTime();
      const timeB = new Date(b.submittedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [filteredSubmissions, sortBy]);

  return (
    <div className="submissions-list-container evaluation-dashboard-container fade-in">
      {/* View Header with Activity Context */}
      <div className="view-header flex-between align-start mb-4">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={onBack}>
            &larr; Back to Admin Home
          </button>
          <div className="flex-align-center gap-2 mb-1">
            <span className="badge badge-primary">{currentActivity?.purpose || 'Exam'} Submissions</span>
            {currentActivity?.subject && (
              <span className="badge badge-secondary">{currentActivity.subject}</span>
            )}
            <span className="text-xs text-muted">ID: <code>{filterActivityId || 'All'}</code></span>
          </div>
          <h2 className="view-title m-0">
            {currentActivity?.title || 'Participant Submissions Review'}
          </h2>
          <p className="view-subtitle mt-1">
            Review participant answers, evaluate responses, award marks, and publish official results.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadSubmissionsData}
          disabled={loading}
          title="Refresh submissions list"
        >
          {loading ? 'Refreshing...' : '🔄 Refresh List'}
        </button>
      </div>

      {/* PHASE 1: Summary Statistics Cards Bar */}
      <div className="evaluation-stats-banner grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        <div className="eval-stat-card card-total">
          <span className="stat-num">{stats.totalRegistered}</span>
          <span className="stat-lbl">Registered / Expected</span>
        </div>
        <div className="eval-stat-card card-submitted">
          <span className="stat-num">{stats.totalSubmitted}</span>
          <span className="stat-lbl">Total Submitted</span>
        </div>
        <div className="eval-stat-card card-pending">
          <span className="stat-num">{stats.pendingEvaluations}</span>
          <span className="stat-lbl">Pending Checking</span>
        </div>
        <div className="eval-stat-card card-partial">
          <span className="stat-num">{stats.partiallyChecked}</span>
          <span className="stat-lbl">Partially Checked</span>
        </div>
        <div className="eval-stat-card card-completed">
          <span className="stat-num">{stats.completedEvaluations}</span>
          <span className="stat-lbl">Evaluation Complete</span>
        </div>
        <div className="eval-stat-card card-published">
          <span className="stat-num">{stats.publishedResults}</span>
          <span className="stat-lbl">Results Published</span>
        </div>
      </div>

      {/* Filter Tabs & Search Toolbar */}
      <div className="evaluation-filter-toolbar mb-4 flex-between flex-wrap gap-3">
        {/* Filter Pills */}
        <div className="filter-pills-row flex gap-1 flex-wrap">
          <button
            type="button"
            className={`filter-pill-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Submissions ({activitySubmissions.length})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${activeFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveFilter('pending')}
          >
            Pending Checking ({stats.pendingEvaluations})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${activeFilter === 'partially_checked' ? 'active' : ''}`}
            onClick={() => setActiveFilter('partially_checked')}
          >
            Partially Checked ({stats.partiallyChecked})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${activeFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
            Completed ({stats.completedEvaluations})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${activeFilter === 'published' ? 'active' : ''}`}
            onClick={() => setActiveFilter('published')}
          >
            Published ({stats.publishedResults})
          </button>
        </div>

        {/* Search & Sort Group */}
        <div className="search-sort-group flex-align-center gap-2">
          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search participant name, roll #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sort-box">
            <select
              className="form-input select-input text-xs"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort submissions"
            >
              <option value="Submission Time">Newest First</option>
              <option value="Name">Name (A-Z)</option>
              <option value="Identifier">ID / Roll #</option>
              <option value="Score">Score (High-Low)</option>
              <option value="Status">Evaluation Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Submissions List / Grid */}
      {loading ? (
        <div className="loading-center py-12">
          <div className="spinner large"></div>
          <span className="mt-3 block text-muted text-sm font-semibold">Loading participant submissions...</span>
        </div>
      ) : sortedSubmissions.length === 0 ? (
        <div className="empty-state-card text-center p-12 bg-white border rounded-2xl shadow-sm">
          <div className="empty-icon-box mx-auto mb-3 text-muted">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <h3 className="empty-title font-bold text-lg text-slate-800">No submissions found</h3>
          <p className="empty-desc text-muted text-sm max-w-md mx-auto mt-1">
            {searchQuery
              ? `No participant submissions match "${searchQuery}".`
              : activeFilter !== 'all'
              ? `No submissions found with status "${activeFilter.replace(/_/g, ' ')}".`
              : 'No submissions have been received for this activity yet.'}
          </p>
          {(searchQuery || activeFilter !== 'all') && (
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-4"
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="submissions-evaluation-grid">
          {sortedSubmissions.map((sub) => {
            const pDetails = sub.participantData || sub.participantDetails || {};
            const participantName = pDetails.Name || sub.participantName || 'Participant';
            const rollNo = pDetails['Registration Number'] ||
              pDetails['Student ID'] ||
              pDetails['Roll Number'] ||
              pDetails['Roll No'] ||
              pDetails['Email Address'] ||
              'N/A';

            const evalStatus = getSubmissionEvaluationStatus(sub, currentActivity);
            const pubStatus = getSubmissionPublicationStatus(sub);
            const isPublished = pubStatus === 'published';

            let evalBadgeClass = 'badge-pending';
            let evalLabel = '⏳ Pending Checking';
            if (evalStatus === 'completed') {
              evalBadgeClass = 'badge-completed';
              evalLabel = '✓ Evaluation Complete';
            } else if (evalStatus === 'partially_checked') {
              evalBadgeClass = 'badge-partial';
              evalLabel = '✎ Partially Checked';
            }

            return (
              <div
                key={sub.submissionId}
                className={`submission-evaluation-card ${isPublished ? 'card-published-border' : ''} ${evalStatus}`}
                onClick={() => setSelectedSubmission(sub)}
              >
                {/* Card Top: Participant and Badges */}
                <div className="eval-card-header flex-between align-start">
                  <div>
                    <h3 className="eval-participant-name font-bold text-base text-slate-900 m-0">
                      {participantName}
                    </h3>
                    <span className="eval-identifier-text text-xs text-muted block mt-0.5">
                      ID / Reg: <strong className="text-slate-700">{rollNo}</strong>
                    </span>
                    {sub.selectedSectionName && (
                      <span className="badge badge-secondary text-xxs font-bold mt-1 inline-block">
                        Group: {sub.selectedSectionName}
                      </span>
                    )}
                  </div>

                  <div className="eval-badges-stack flex flex-col items-end gap-1">
                    <span className={`eval-status-pill ${evalBadgeClass}`}>
                      {evalLabel}
                    </span>
                    {isPublished ? (
                      <span className="pub-status-pill pill-published">
                        ● Results Published
                      </span>
                    ) : (
                      <span className="pub-status-pill pill-unpublished">
                        ○ Unpublished
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body: Meta Details */}
                <div className="eval-card-body mt-3 pt-3 border-top">
                  <div className="eval-meta-row flex-between text-xs py-1">
                    <span className="text-muted">Submitted At:</span>
                    <span className="text-slate-800 font-medium">
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>

                  <div className="eval-meta-row flex-between text-xs py-1">
                    <span className="text-muted">Obtained Marks:</span>
                    <span className="font-bold text-primary">
                      {sub.score !== undefined && sub.score !== null ? (
                        <span>{sub.score} / {sub.totalMarks || currentActivity?.totalMarks || '100'} pts {sub.percentage !== undefined && `(${sub.percentage}%)`}</span>
                      ) : (
                        <span className="text-muted italic">Not Evaluated</span>
                      )}
                    </span>
                  </div>

                  {sub.lastEvaluatedBy && (
                    <div className="eval-meta-row flex-between text-[11px] py-1 text-muted">
                      <span>Evaluator:</span>
                      <span className="truncate max-w-[140px]">{sub.lastEvaluatedBy}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Action Button */}
                <div className="eval-card-footer mt-4">
                  <button
                    type="button"
                    className={`btn ${evalStatus === 'completed' ? 'btn-secondary' : 'btn-primary'} btn-sm w-full`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSubmission(sub);
                    }}
                  >
                    {evalStatus === 'completed'
                      ? 'Review Evaluation &amp; Results &rarr;'
                      : evalStatus === 'partially_checked'
                      ? 'Resume Checking &rarr;'
                      : 'Check Answers &amp; Grade &rarr;'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Question-wise Answer Checking Modal (Phase 2-8) */}
      {selectedSubmission && (
        <SubmissionChecker
          submission={selectedSubmission}
          activity={currentActivity || activitiesMap[selectedSubmission.activityId] || { title: selectedSubmission.activityTitle }}
          user={user}
          onClose={() => setSelectedSubmission(null)}
          onGraded={() => {
            loadSubmissionsData();
          }}
        />
      )}
    </div>
  );
}
