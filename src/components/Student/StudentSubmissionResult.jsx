import React from 'react';
import logoImg from '../../assets/logo.png';

export default function StudentSubmissionResult({
  submission,
  activity,
  onFinish
}) {
  const showScore = activity?.showPercentageScore !== false && submission?.score !== undefined;
  const isAutoGraded = submission?.status === 'Checked';

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="student-submission-result-viewport fade-in">
      <div className="student-result-container">
        {/* Brand Header */}
        <div className="student-result-brand text-center mb-6">
          <img src={logoImg} alt="Quizora" className="student-result-logo" />
          <h2 className="student-result-app-title">Quizora</h2>
        </div>

        {/* Success Card */}
        <div className="student-result-card bg-white p-8 rounded-2xl shadow-lg border border-slate-100 text-center">
          <div className="result-check-icon-circle mx-auto mb-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          <h2 className="result-main-title font-extrabold text-2xl text-dark mb-2">
            Activity Submitted Successfully!
          </h2>
          <p className="result-subtitle text-sm text-muted mb-6">
            Your responses for <strong>"{activity?.title || 'this activity'}"</strong> have been securely recorded.
          </p>

          {/* Submission Details Grid */}
          <div className="result-details-box p-4 bg-slate-50 rounded-xl border border-slate-200 text-left mb-6">
            <div className="result-detail-row flex-between py-2 border-bottom">
              <span className="text-xs font-semibold text-muted">Submission ID</span>
              <span className="text-xs font-mono font-bold text-dark">{submission?.submissionId}</span>
            </div>
            
            {submission?.participantData?.Name && (
              <div className="result-detail-row flex-between py-2 border-bottom">
                <span className="text-xs font-semibold text-muted">Participant Name</span>
                <span className="text-xs font-bold text-dark">{submission.participantData.Name}</span>
              </div>
            )}

            <div className="result-detail-row flex-between py-2 border-bottom">
              <span className="text-xs font-semibold text-muted">Submitted At</span>
              <span className="text-xs font-medium text-dark">{formatDateTime(submission?.submittedAt)}</span>
            </div>

            <div className="result-detail-row flex-between py-2">
              <span className="text-xs font-semibold text-muted">Evaluation Status</span>
              <span className={`badge ${isAutoGraded ? 'badge-success' : 'badge-primary'} text-xs`}>
                {isAutoGraded ? 'Evaluated (Auto-Graded)' : 'Submitted for Review'}
              </span>
            </div>
          </div>

          {/* Score Display (If Exam auto-graded and percentage enabled) */}
          {showScore && isAutoGraded && (
            <div className="result-score-highlight-card p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl mb-6 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
                Your Score
              </span>
              <div className="result-score-number font-black text-4xl text-primary mb-1">
                {submission.score} <span className="text-lg font-bold text-muted">/ {activity?.totalMarks || submission.totalMarks || '100'}</span>
              </div>
              {submission.percentage !== undefined && (
                <span className="text-sm font-semibold text-dark">
                  Percentage: {submission.percentage}%
                </span>
              )}
            </div>
          )}

          <div className="result-actions-row flex-center gap-3">
            <button
              type="button"
              className="btn btn-primary btn-lg w-full"
              onClick={() => {
                if (onFinish) {
                  onFinish();
                } else {
                  window.location.reload();
                }
              }}
            >
              Done &amp; Close
            </button>
          </div>
        </div>

        <div className="result-footer text-center mt-6 text-xs text-muted">
          <p>© {new Date().getFullYear()} Quizora Assessment Platform. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
