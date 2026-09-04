import { useState, useEffect, useCallback, useMemo } from 'react';
import { getActivityById } from '../../services/activityService';
import { submitStudentActivity } from '../../services/submissionService';
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

  // Clock state synced per second for live countdowns
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Tick clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
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

  // Compute activity status based on start/end times
  const activityStatus = useMemo(() => {
    if (!activity) return 'UNKNOWN';

    const now = currentTime.getTime();
    const startTime = activity.startTime ? new Date(activity.startTime).getTime() : null;
    const endTime = activity.endTime ? new Date(activity.endTime).getTime() : null;

    if (startTime && now < startTime) {
      return 'NOT_STARTED';
    }

    if (endTime && now >= endTime) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }, [activity, currentTime]);

  // Calculate Countdown to Start Time (DD : HH : MM : SS)
  const startCountdown = useMemo(() => {
    if (!activity?.startTime) return { days: '00', hours: '00', minutes: '00', seconds: '00', totalSec: 0 };

    const startMs = new Date(activity.startTime).getTime();
    const nowMs = currentTime.getTime();
    const diffSec = Math.max(0, Math.floor((startMs - nowMs) / 1000));

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
  }, [activity, currentTime]);

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
        user={user}
      />
    );
  }

  // 6. Participant Details Form Screen (Before Starting Questions)
  if (screenFlow === 'participant_form') {
    const fields = activity.participantForm || [];

    return (
      <div className="student-access-viewport fade-in">
        <div className="student-access-container">
          <div className="access-brand-header text-center mb-5">
            <img src={logoImg} alt="Quizora" className="access-brand-logo" />
            <h2 className="access-brand-title">Quizora</h2>
          </div>

          <div className="access-status-card bg-white p-7 rounded-2xl shadow-lg border border-slate-100">
            <div className="participant-form-header text-center mb-5">
              <span className="badge badge-primary text-xs uppercase font-bold tracking-wider mb-2 inline-block">
                Participant Details
              </span>
              <h3 className="text-xl font-bold text-dark m-0">{activity.title}</h3>
              <p className="text-xs text-muted mt-1">
                Please enter your identification details below to proceed to your {activity.purpose || 'activity'}.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStartExamFlow();
              }}
              className="student-form-fields-stack flex flex-col gap-4"
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
                      placeholder={`Enter your ${f.label.toLowerCase()}...`}
                      value={participantValues[fieldKey] || ''}
                      onChange={(e) => handleParticipantChange(fieldKey, e.target.value)}
                    />
                    {err && <span className="text-xs text-danger block mt-1">{err}</span>}
                  </div>
                );
              })}

              <div className="participant-form-actions flex flex-col gap-2 mt-3">
                <button type="submit" className="btn btn-primary btn-lg w-full font-bold">
                  <span>Enter &amp; Start Questions &rarr;</span>
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
          <div className="access-brand-header text-center mb-6">
            <img src={logoImg} alt="Quizora" className="access-brand-logo" />
            <h2 className="access-brand-title">Quizora</h2>
          </div>

          <div className="access-status-card not-started-card bg-white p-8 rounded-2xl shadow-lg border border-slate-100 text-center">
            {/* STATUS BADGE */}
            <div className="status-badge-header not-started-badge mb-4">
              <span className="status-badge-pill-not-started">🕐 NOT STARTED YET</span>
            </div>

            <p className="access-status-message text-sm text-muted font-medium mb-4">
              This activity has not started yet.
            </p>

            {/* ACTIVITY INFO */}
            <div className="activity-info-box mb-6">
              <span className="activity-purpose-label text-xs uppercase font-bold text-primary tracking-wider block mb-1">
                {activity.purpose || 'Exam / Assignment'}
              </span>
              <h2 className="activity-title-headline font-extrabold text-2xl text-dark mb-2">
                {activity.title}
              </h2>
              {activity.subject && (
                <span className="badge badge-secondary text-xs">
                  Subject: {activity.subject}
                </span>
              )}
            </div>

            {/* SCHEDULE TIME */}
            <div className="scheduled-time-card p-3 bg-slate-50 border rounded-xl mb-6 text-center">
              <span className="text-xs font-semibold text-muted block mb-1">Starts on:</span>
              <span className="text-sm font-bold text-dark block">
                {formatDisplayDateTime(activity.startTime)}
              </span>
            </div>

            {/* LIVE COUNTDOWN DISPLAY (DD : HH : MM : SS) */}
            <div className="live-countdown-section mb-6">
              <span className="countdown-label-title text-xs font-bold uppercase tracking-widest text-muted block mb-2">
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

            {/* START BUTTON (DISABLED IN NOT STARTED STATE) */}
            <button
              type="button"
              className="btn btn-primary btn-lg w-full disabled cursor-not-allowed opacity-60 mb-3"
              disabled
            >
              Start Activity
            </button>

            <p className="text-xs text-muted m-0">
              Activity will be available when the scheduled time begins.
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
        <div className="access-brand-header text-center mb-6">
          <img src={logoImg} alt="Quizora" className="access-brand-logo" />
          <h2 className="access-brand-title">Quizora</h2>
        </div>

        <div className="access-status-card active-card bg-white p-8 rounded-2xl shadow-lg border border-slate-100 text-center">
          {/* ACTIVE STATUS BADGE */}
          <div className="status-badge-header active-badge mb-4">
            <span className="status-badge-pill-active">🟢 ACTIVE</span>
          </div>

          <h2 className="activity-title-headline font-extrabold text-2xl text-dark mb-4">
            {activity.title}
          </h2>

          {/* ACTIVITY SUMMARY DETAILS */}
          <div className="active-details-box p-4 bg-slate-50 border rounded-xl text-left mb-6">
            {activity.subject && (
              <div className="info-detail-row flex-between py-2 border-bottom">
                <span className="text-xs font-semibold text-muted">Subject</span>
                <span className="text-xs font-bold text-dark">{activity.subject}</span>
              </div>
            )}

            {activity.totalMarks && (
              <div className="info-detail-row flex-between py-2 border-bottom">
                <span className="text-xs font-semibold text-muted">Total Marks</span>
                <span className="text-xs font-bold text-primary">{activity.totalMarks}</span>
              </div>
            )}

            {activity.endTime && (
              <div className="info-detail-row flex-between py-2 border-bottom">
                <span className="text-xs font-semibold text-muted">Available Until</span>
                <span className="text-xs font-bold text-dark">{formatDisplayDateTime(activity.endTime)}</span>
              </div>
            )}

            <div className="info-detail-row flex-between py-2">
              <span className="text-xs font-semibold text-muted">Type</span>
              <span className="text-xs font-bold text-dark">{activity.purpose || 'Exam'}</span>
            </div>
          </div>

          {/* START ACTIVITY BUTTON (ENABLED) */}
          <button
            type="button"
            className="btn btn-primary btn-lg w-full font-bold shadow-md hover:shadow-lg transition-all mb-4"
            onClick={handleStartExamFlow}
          >
            START ACTIVITY &rarr;
          </button>

          {activity.endTime && (
            <div className="active-remaining-time-hint text-xs text-muted">
              Make sure to complete and submit before the end time.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
