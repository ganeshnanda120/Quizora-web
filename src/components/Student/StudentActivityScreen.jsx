import { useState, useEffect, useCallback, useMemo } from 'react';
import { getActivityById } from '../../services/activityService';
import { submitStudentActivity } from '../../services/submissionService';
import { syncServerTime, getSynchronizedTime, parseActivityTime } from '../../services/timeSyncService';
import StudentAttendancePaper from './StudentAttendancePaper';
import StudentSubmissionResult from './StudentSubmissionResult';
import logoImg from '../../assets/logo.png';

export default function StudentActivityScreen({
  activityId,
  user,
  profileData,
  onNavigateHome
}) {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Screen Flow States: 'landing' | 'participant_form' | 'attending' | 'submitted' | 'expired_notice'
  const [screenFlow, setScreenFlow] = useState('landing');
  const [submittedData, setSubmittedData] = useState(null);
  const [expiredReason, setExpiredReason] = useState('');

  // Participant Form Data state
  const [participantValues, setParticipantValues] = useState(() => {
    // Prepopulate name from logged in user if available
    const initial = {};
    if (user || profileData) {
      initial.Name = profileData?.fullName || user?.displayName || '';
      initial['Email Address'] = profileData?.email || user?.email || '';
      if (profileData?.department) initial.Department = profileData.department;
      if (profileData?.regNo) initial['Registration Number'] = profileData.regNo;
      if (profileData?.studentId) initial['Student ID'] = profileData.studentId;
    }
    return initial;
  });
  const [formErrors, setFormErrors] = useState({});

  // Real-time synchronized clock state (epoch milliseconds)
  const [syncedTimestamp, setSyncedTimestamp] = useState(() => getSynchronizedTime());

  // Synchronize server time on mount and periodically
  useEffect(() => {
    syncServerTime().then(() => {
      setSyncedTimestamp(getSynchronizedTime());
    });

    // Re-sync with server every 45 seconds for precision
    const syncInterval = setInterval(() => {
      syncServerTime();
    }, 45000);

    // Live tick every second
    const tickInterval = setInterval(() => {
      setSyncedTimestamp(getSynchronizedTime());
    }, 1000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(tickInterval);
    };
  }, []);

  // Fetch Activity document
  useEffect(() => {
    let isMounted = true;

    const loadActivity = async () => {
      if (!activityId) {
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const data = await getActivityById(activityId);
        if (!isMounted) return;

        if (!data) {
          setNotFound(true);
        } else {
          setActivity(data);
          setNotFound(false);
        }
      } catch (err) {
        console.error("Error loading activity:", err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadActivity();

    return () => {
      isMounted = false;
    };
  }, [activityId]);

  // Compute absolute start & end timestamps in epoch ms
  const startMs = useMemo(() => {
    if (!activity) return null;
    return activity.startTimeMs || parseActivityTime(activity.startTime, activity);
  }, [activity]);

  const endMs = useMemo(() => {
    if (!activity) return null;
    return activity.endTimeMs || parseActivityTime(activity.endTime, activity);
  }, [activity]);

  // Compute activity status based on start/end times synced across all devices
  const activityStatus = useMemo(() => {
    if (!activity) return 'UNKNOWN';

    const now = syncedTimestamp;

    if (startMs && now < startMs) {
      return 'NOT_STARTED';
    }

    if (endMs && now >= endMs) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }, [activity, syncedTimestamp, startMs, endMs]);

  // Calculate Countdown to Start Time (DD : HH : MM : SS) - Identical for all devices
  const startCountdown = useMemo(() => {
    if (!startMs) return { days: '00', hours: '00', minutes: '00', seconds: '00', totalSec: 0 };

    const diffSec = Math.max(0, Math.floor((startMs - syncedTimestamp) / 1000));

    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;

    const pad = (n) => String(n).padStart(2, '0');
    return {
      days: pad(days),
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
      totalSec: diffSec
    };
  }, [startMs, syncedTimestamp]);

  // Format Dates
  const formatDisplayDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  // Participant Form Field Change
  const handleParticipantChange = (fieldKey, value) => {
    setFormErrors((prev) => ({ ...prev, [fieldKey]: '' }));
    setParticipantValues((prev) => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  // Validate Participant Form and Start Exam
  const handleStartExamFlow = () => {
    const participantConfig = activity?.participantForm || [];

    if (participantConfig.length === 0) {
      // No participant form configured -> enter exam directly
      setScreenFlow('attending');
      return;
    }

    if (screenFlow === 'landing') {
      setScreenFlow('participant_form');
      return;
    }

    // Validate required fields
    const errors = {};
    participantConfig.forEach((field) => {
      const isRequired = field.isOptional !== true;
      const val = participantValues[field.label || field.id];

      if (isRequired && (!val || !val.trim())) {
        errors[field.label || field.id] = `${field.label || 'This field'} is required.`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // All valid -> Enter active questions attendance screen
    setScreenFlow('attending');
  };

  // Handle final submission from StudentAttendancePaper
  const handleActivitySubmit = async (answersMap, isAutoSubmit = false) => {
    try {
      const result = await submitStudentActivity(activityId, {
        activity,
        answers: answersMap,
        participantData: participantValues,
        userUid: user?.uid || null,
        isAutoSubmit
      });

      setSubmittedData(result);
      if (isAutoSubmit) {
        setExpiredReason("This activity has reached its end time. Your valid answers have been automatically saved and submitted.");
        setScreenFlow('expired_notice');
      } else {
        setScreenFlow('submitted');
      }
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Failed to submit activity. Please check your internet connection.");
    }
  };

  // Expiration handler while user is active
  const handleSessionExpired = useCallback(() => {
    setExpiredReason("This activity has reached its end time.");
    setScreenFlow('expired_notice');
  }, []);

  // 1. Loading State
  if (loading) {
    return (
      <div className="full-page-loader">
        <div className="loader-brand">
          <img src={logoImg} alt="Quizora" className="loader-logo" />
        </div>
        <div className="spinner large"></div>
        <p>Loading activity details...</p>
      </div>
    );
  }

  // 2. Invalid Link / Activity Not Found
  if (notFound || !activity) {
    return (
      <div className="student-access-viewport fade-in">
        <div className="student-access-container">
          <div className="access-brand-header text-center mb-6">
            <img src={logoImg} alt="Quizora" className="access-brand-logo" />
            <h2 className="access-brand-title">Quizora</h2>
          </div>

          <div className="access-status-card bg-white p-8 rounded-2xl shadow-lg border border-slate-100 text-center">
            <div className="not-found-icon-box mx-auto mb-4">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2 className="text-2xl font-extrabold text-dark mb-2">Activity Not Found</h2>
            <p className="text-muted text-sm mb-6">
              This activity link is invalid or no longer available. Please check the URL or contact your exam coordinator.
            </p>

            <button
              type="button"
              className="btn btn-secondary btn-lg w-full"
              onClick={() => {
                if (onNavigateHome) onNavigateHome();
                else window.location.href = '/';
              }}
            >
              Go to Quizora Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Submitted Success Screen
  if (screenFlow === 'submitted' && submittedData) {
    return (
      <StudentSubmissionResult
        submission={submittedData}
        activity={activity}
        onFinish={() => {
          if (onNavigateHome) onNavigateHome();
          else window.location.href = '/';
        }}
      />
    );
  }

  // 4. Session Expired Notice (If reached end time or auto-submitted upon expiration)
  if (screenFlow === 'expired_notice' || activityStatus === 'EXPIRED') {
    return (
      <div className="student-access-viewport fade-in">
        <div className="student-access-container">
          <div className="access-brand-header text-center mb-6">
            <img src={logoImg} alt="Quizora" className="access-brand-logo" />
            <h2 className="access-brand-title">Quizora</h2>
          </div>

          <div className="access-status-card expired-card bg-white p-8 rounded-2xl shadow-lg border border-slate-100 text-center">
            <div className="status-badge-header expired-badge mb-4">
              <span className="status-badge-pill-expired">🔴 SESSION EXPIRED</span>
            </div>

            <h2 className="access-card-main-title font-extrabold text-2xl text-dark mb-2">
              This session has expired.
            </h2>
            <p className="access-card-subtitle text-sm text-muted mb-6">
              {expiredReason || 'The scheduled time for this exam/assignment is over.'}
            </p>

            <div className="activity-info-details-box p-4 bg-slate-50 border rounded-xl text-left mb-6">
              <div className="info-detail-row flex-between py-2 border-bottom">
                <span className="text-xs font-semibold text-muted">Activity</span>
                <span className="text-xs font-bold text-dark">{activity.title}</span>
              </div>
              <div className="info-detail-row flex-between py-2 border-bottom">
                <span className="text-xs font-semibold text-muted">Type</span>
                <span className="text-xs font-bold text-dark">{activity.purpose || 'Exam'}</span>
              </div>
              {activity.endTime && (
                <div className="info-detail-row flex-between py-2">
                  <span className="text-xs font-semibold text-muted">Ended On</span>
                  <span className="text-xs font-bold text-danger">{formatDisplayDateTime(activity.endTime)}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted mb-6">
              You can no longer start or continue this activity.
            </p>

            <button
              type="button"
              className="btn btn-secondary btn-lg w-full"
              onClick={() => {
                if (onNavigateHome) onNavigateHome();
                else window.location.href = '/';
              }}
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Active Questions Attendance Screen
  if (screenFlow === 'attending') {
    return (
      <StudentAttendancePaper
        activity={activity}
        activityId={activityId}
        participantData={participantValues}
        onSubmit={handleActivitySubmit}
        onExpire={handleSessionExpired}
      />
    );
  }

  // 6. Participant Details Form Screen (Before Starting Questions)
  if (screenFlow === 'participant_form') {
    const fields = activity.participantForm || [];

    return (
      <div className="student-access-viewport fade-in">
        <div className="student-access-container">
          <div className="access-brand-header">
            <img src={logoImg} alt="Quizora" className="access-brand-logo" />
            <h2 className="access-brand-title">Quizora</h2>
          </div>

          <div className="access-status-card">
            <div className="participant-form-header">
              <span className="activity-purpose-label">
                Participant Details
              </span>
              <h3 className="participant-form-title">{activity.title}</h3>
              <p className="access-status-message">
                Please enter your identification details below to proceed to your {activity.purpose || 'activity'}.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStartExamFlow();
              }}
              className="student-form-fields-stack"
            >
              {fields.map((f, idx) => {
                const isRequired = f.isOptional !== true;
                const fieldKey = f.label || f.id;
                const err = formErrors[fieldKey];

                return (
                  <div key={f.id || idx} className="form-group mb-0">
                    <label className="form-label font-semibold text-sm flex-between align-center mb-1">
                      <span>
                        {f.label || `Field ${idx + 1}`}
                        {isRequired && <span className="req-star ml-1 text-danger font-bold">*</span>}
                      </span>
                      {!isRequired && (
                        <span className="badge badge-secondary text-xs font-normal">Optional</span>
                      )}
                    </label>
                    <input
                      type="text"
                      className={`form-input ${err ? 'input-error' : ''}`}
                      placeholder={`Enter your ${(f.label || 'details').toLowerCase()}...`}
                      value={participantValues[fieldKey] || ''}
                      onChange={(e) => handleParticipantChange(fieldKey, e.target.value)}
                    />
                    {err && <span className="text-xs text-danger block mt-1">{err}</span>}
                  </div>
                );
              })}

              <div className="participant-form-actions">
                <button type="submit" className="btn-start-active">
                  <span>Enter &amp; Start Questions</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setScreenFlow('landing')}
                >
                  &larr; Back to Activity Info
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 7. Waiting / Not Started Screen (BEFORE START TIME)
  if (activityStatus === 'NOT_STARTED') {
    return (
      <div className="student-access-viewport fade-in">
        <div className="student-access-container">
          <div className="access-brand-header">
            <img src={logoImg} alt="Quizora" className="access-brand-logo" />
            <h2 className="access-brand-title">Quizora</h2>
          </div>

          <div className="access-status-card not-started-card">
            {/* STATUS BADGE */}
            <div className="status-badge-header not-started-badge">
              <span className="status-badge-pill-not-started">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>NOT STARTED YET</span>
              </span>
            </div>

            <p className="access-status-message">
              This activity has not started yet.
            </p>

            {/* ACTIVITY INFO */}
            <div className="activity-info-box">
              <span className="activity-purpose-label">
                {activity.purpose || 'Exam'}
              </span>
              <h2 className="activity-title-headline">
                {activity.title}
              </h2>
              {activity.subject && (
                <span className="activity-subject-badge">
                  Subject: {activity.subject}
                </span>
              )}
            </div>

            {/* SCHEDULE TIME */}
            <div className="scheduled-time-card">
              <span className="scheduled-time-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Starts on
              </span>
              <span className="scheduled-time-value">
                {formatDisplayDateTime(activity.startTime)}
              </span>
            </div>

            {/* LIVE COUNTDOWN DISPLAY (DD : HH : MM : SEC) */}
            <div className="live-countdown-section">
              <span className="countdown-label-title">
                STARTS IN
              </span>

              <div className="countdown-timer-grid">
                <div className="timer-unit-box">
                  <div className="timer-digit-card">{startCountdown.days}</div>
                  <span className="timer-unit-label">DAYS</span>
                </div>
                <span className="timer-colon-separator">:</span>

                <div className="timer-unit-box">
                  <div className="timer-digit-card">{startCountdown.hours}</div>
                  <span className="timer-unit-label">HOURS</span>
                </div>
                <span className="timer-colon-separator">:</span>

                <div className="timer-unit-box">
                  <div className="timer-digit-card">{startCountdown.minutes}</div>
                  <span className="timer-unit-label">MIN</span>
                </div>
                <span className="timer-colon-separator">:</span>

                <div className="timer-unit-box">
                  <div className="timer-digit-card">{startCountdown.seconds}</div>
                  <span className="timer-unit-label">SEC</span>
                </div>
              </div>
            </div>

            {/* START BUTTON (LOCKED IN NOT STARTED STATE) */}
            <button
              type="button"
              className="btn-start-disabled"
              disabled
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Start Activity</span>
            </button>

            <p className="access-footer-hint">
              Activity will unlock automatically when the scheduled time begins.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 8. ACTIVE Screen (When current time >= start time and < end time)
  return (
    <div className="student-access-viewport fade-in">
      <div className="student-access-container">
        <div className="access-brand-header">
          <img src={logoImg} alt="Quizora" className="access-brand-logo" />
          <h2 className="access-brand-title">Quizora</h2>
        </div>

        <div className="access-status-card active-card">
          {/* ACTIVE STATUS BADGE */}
          <div className="status-badge-header active-badge">
            <span className="status-badge-pill-active">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="8" />
              </svg>
              <span>ACTIVE NOW</span>
            </span>
          </div>

          <div className="activity-info-box">
            <span className="activity-purpose-label">
              {activity.purpose || 'Exam'}
            </span>
            <h2 className="activity-title-headline">
              {activity.title}
            </h2>
          </div>

          {/* ACTIVITY SUMMARY DETAILS */}
          <div className="active-details-box">
            {activity.subject && (
              <div className="info-detail-row">
                <span className="text-xs font-semibold text-muted">Subject</span>
                <span className="text-xs font-bold text-dark">{activity.subject}</span>
              </div>
            )}

            {activity.totalMarks && (
              <div className="info-detail-row">
                <span className="text-xs font-semibold text-muted">Total Marks</span>
                <span className="text-xs font-bold text-primary">{activity.totalMarks} Marks</span>
              </div>
            )}

            {activity.endTime && (
              <div className="info-detail-row">
                <span className="text-xs font-semibold text-muted">Available Until</span>
                <span className="text-xs font-bold text-dark">{formatDisplayDateTime(activity.endTime)}</span>
              </div>
            )}

            <div className="info-detail-row">
              <span className="text-xs font-semibold text-muted">Type</span>
              <span className="text-xs font-bold text-dark">{activity.purpose || 'Exam'}</span>
            </div>
          </div>

          {/* START ACTIVITY BUTTON (ENABLED) */}
          <button
            type="button"
            className="btn-start-active"
            onClick={handleStartExamFlow}
          >
            <span>START ACTIVITY</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          {activity.endTime && (
            <p className="access-footer-hint">
              Make sure to complete and submit your responses before the end time.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
