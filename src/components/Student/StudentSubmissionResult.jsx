import { useMemo } from 'react';
import logoImg from '../../assets/logo.png';
import {
  normalizeActivityQuestions,
  getQuestionUploadedFiles,
  getQuestionDescriptionText
} from '../../utils/questionUtils';

export default function StudentSubmissionResult({
  submission,
  activity,
  onFinish
}) {
  const isPublished = submission?.isPublished === true || submission?.publicationStatus === 'published';
  const normalized = useMemo(() => normalizeActivityQuestions(activity), [activity]);

  // Isolate review questions to the participant's selected section if applicable
  const displayQuestions = useMemo(() => {
    if (submission?.selectedSectionId && normalized.isSectionBased && Array.isArray(normalized.sections)) {
      const sec = normalized.sections.find((s) => String(s.id) === String(submission.selectedSectionId));
      if (sec) {
        const secQs = [];
        (sec.parts || []).forEach((p) => {
          (p.questions || []).forEach((q) => {
            if (q) secQs.push(q);
          });
        });
        if (secQs.length > 0) return secQs;
      }
    }
    return normalized.allQuestions;
  }, [submission, normalized]);

  const totalMaxMarks = useMemo(() => {
    if (submission?.totalMarksPossible !== undefined && submission.totalMarksPossible !== null) {
      return parseFloat(submission.totalMarksPossible) || 0;
    }
    if (submission?.sectionTotalMarks !== undefined && submission.sectionTotalMarks !== null) {
      return parseFloat(submission.sectionTotalMarks) || 0;
    }
    return displayQuestions.reduce((acc, q) => acc + (parseFloat(q.marks) || 0), 0);
  }, [submission, displayQuestions]);

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

  const participantName = submission?.participantData?.Name ||
    submission?.participantDetails?.Name ||
    submission?.participantName ||
    'Student';

  const rollNumber = submission?.participantData?.['Registration Number'] ||
    submission?.participantData?.['Student ID'] ||
    submission?.participantData?.['Roll Number'] ||
    submission?.participantData?.['Roll No'] ||
    '';

  const questionGrades = submission?.questionGrades || {};

  return (
    <div className="student-submission-result-viewport fade-in">
      <div className="student-result-container max-w-3xl mx-auto py-6">
        {/* Brand Header */}
        <div className="student-result-brand text-center mb-6">
          <img src={logoImg} alt="Task Grade" className="student-result-logo" />
          <h2 className="student-result-app-title">Task Grade</h2>
        </div>

        {/* Main Result Card */}
        <div className="student-result-card bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-100">
          
          {/* Header Icon & Status */}
          <div className="text-center mb-6">
            <div className={`result-check-icon-circle mx-auto mb-3 ${isPublished ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-primary'}`}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <div className="status-badge-wrapper mb-2">
              {isPublished ? (
                <span className="badge badge-success px-3 py-1 font-bold">
                  ✓ Official Results Published
                </span>
              ) : (
                <span className="badge badge-primary px-3 py-1 font-bold">
                  ⏳ Submission Recorded &bull; Pending Evaluation
                </span>
              )}
            </div>

            <h2 className="result-main-title font-extrabold text-2xl text-slate-900 m-0">
              {isPublished ? 'Activity Evaluation & Results' : 'Activity Submitted Successfully!'}
            </h2>
            <p className="result-subtitle text-sm text-muted mt-1">
              {isPublished
                ? `Results for "${activity?.title || 'this activity'}" have been published by your instructor.`
                : `Your responses for "${activity?.title || 'this activity'}" have been securely recorded and are in review.`}
            </p>
          </div>

          {/* Submission Metadata Box */}
          <div className="result-details-box p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex-between py-1 border-bottom">
                <span className="text-muted">Participant:</span>
                <strong className="text-slate-800">{participantName}</strong>
              </div>
              {submission?.selectedSectionName && (
                <div className="flex-between py-1 border-bottom">
                  <span className="text-muted">Section / Group:</span>
                  <strong className="text-primary font-bold">{submission.selectedSectionName}</strong>
                </div>
              )}
              {rollNumber && (
                <div className="flex-between py-1 border-bottom">
                  <span className="text-muted">ID / Roll #:</span>
                  <strong className="text-slate-800">{rollNumber}</strong>
                </div>
              )}
              <div className="flex-between py-1 border-bottom">
                <span className="text-muted">Submission ID:</span>
                <code className="text-slate-700">{submission?.submissionId}</code>
              </div>
              <div className="flex-between py-1 border-bottom">
                <span className="text-muted">Submitted At:</span>
                <span className="text-slate-800 font-medium">{formatDateTime(submission?.submittedAt)}</span>
              </div>
              {isPublished && submission?.publishedAt && (
                <div className="flex-between py-1">
                  <span className="text-muted">Published At:</span>
                  <span className="text-emerald-700 font-bold">{formatDateTime(submission.publishedAt)}</span>
                </div>
              )}
              {isPublished && submission?.publishedBy && (
                <div className="flex-between py-1">
                  <span className="text-muted">Evaluated By:</span>
                  <span className="text-slate-800 font-semibold">{submission.publishedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* PHASE 7: Published Results Section */}
          {isPublished ? (
            <div className="published-results-container fade-in">
              {/* Score Highlight Box */}
              <div className="result-score-highlight-card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl mb-6 text-center shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
                  Total Score Obtained
                </span>
                <div className="result-score-number font-black text-5xl text-primary mb-2">
                  {submission.score ?? 0}{' '}
                  <span className="text-2xl font-bold text-slate-500">
                    / {totalMaxMarks}
                  </span>
                </div>
                {submission.percentage !== undefined && (
                  <div className="inline-block px-3 py-1 bg-white border border-blue-200 rounded-full font-bold text-sm text-slate-800">
                    Percentage: {submission.percentage}%
                  </div>
                )}
              </div>

              {/* Overall Remarks from Evaluator */}
              {submission.overallRemark && (
                <div className="overall-remark-display p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6 text-left">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                    Evaluator's Overall Remarks:
                  </span>
                  <p className="text-sm text-emerald-950 whitespace-pre-wrap m-0">
                    {submission.overallRemark}
                  </p>
                </div>
              )}

              {/* Part-wise Breakdown if available */}
              {submission.partScores && Object.keys(submission.partScores).length > 1 && (
                <div className="part-scores-box mb-6 p-4 bg-slate-50 border rounded-xl text-left">
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">
                    Part-wise Scores:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {Object.entries(submission.partScores).map(([pId, pData]) => (
                      <div key={pId} className="flex-between p-2 bg-white border rounded">
                        <span className="text-muted truncate max-w-[150px]">{pData.title || pId}:</span>
                        <strong>{pData.obtainedMarks} / {pData.maxMarks} pts</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question-wise Answer & Feedback Review */}
              <div className="question-review-section text-left mb-6">
                <h3 className="font-extrabold text-base text-slate-900 mb-3 pb-2 border-bottom">
                  Question-wise Evaluation &amp; Feedback
                </h3>

                <div className="question-review-stack flex flex-col gap-4">
                  {displayQuestions.map((q, qIdx) => {
                    const studentAnswer = submission.answers?.[q.id] || submission.answers?.[`${q.id}_files`];
                    const studentFiles = getQuestionUploadedFiles(q.id, submission.answers);
                    const studentNotes = getQuestionDescriptionText(q.id, submission.answers);
                    const qGrade = questionGrades[q.id] || {};
                    const marksAwarded = qGrade.marksAwarded !== undefined ? qGrade.marksAwarded : '—';
                    const feedback = qGrade.feedback || '';

                    return (
                      <div key={q.id || qIdx} className="student-q-review-card p-4 bg-slate-50 border rounded-xl">
                        <div className="flex-between align-center mb-2">
                          <div className="flex-align-center gap-2">
                            <span className="font-bold text-sm text-slate-900">Q{qIdx + 1}.</span>
                            <span className={`q-type-badge ${q.type}`}>{q.type.toUpperCase()}</span>
                          </div>
                          <div className="awarded-score-tag">
                            <span className="text-xs font-bold text-primary bg-white px-2.5 py-1 border rounded-lg">
                              Awarded: {marksAwarded} / {q.marks || 0} Marks
                            </span>
                          </div>
                        </div>

                        {/* Question Prompt */}
                        <p className="text-xs text-slate-700 mb-3 font-medium">
                          {q.questionText || q.paperFileName || 'Question prompt'}
                        </p>

                        {/* Student Response Display */}
                        <div className="student-submitted-pill p-2.5 bg-white border rounded-lg text-xs mb-2">
                          <span className="text-muted font-semibold block mb-1">Your Submitted Response:</span>
                          {q.type === 'mcq' ? (
                            <div>
                              <span>Selected: <strong>{studentAnswer !== undefined && studentAnswer !== '' ? (q.options?.[studentAnswer] || studentAnswer) : 'No answer selected'}</strong></span>
                            </div>
                          ) : q.type === 'upload' ? (
                            <div>
                              {studentFiles.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {studentFiles.map((f, fIdx) => (
                                    <span key={f.id || fIdx} className="text-slate-800 font-bold">
                                      📁 {f.name || `Uploaded File ${fIdx + 1}`}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted italic">No file attached.</span>
                              )}
                              {studentNotes && (
                                <p className="mt-1 text-slate-700 whitespace-pre-wrap">
                                  {studentNotes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap m-0 text-slate-800">
                              {studentAnswer || 'No response submitted.'}
                            </p>
                          )}
                        </div>

                        {/* Feedback from Evaluator */}
                        {feedback && (
                          <div className="evaluator-feedback-box p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                            <strong className="text-primary block mb-0.5">💬 Evaluator Feedback:</strong>
                            <p className="text-slate-800 m-0">{feedback}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Unpublished State Information */
            <div className="unpublished-notice-box p-6 bg-slate-50 border border-dashed rounded-xl mb-6 text-center">
              <p className="text-sm text-slate-700 font-medium m-0">
                Your responses have been recorded and sent to the evaluator.
              </p>
              <p className="text-xs text-muted mt-2 m-0">
                Official marks, percentage, and teacher feedback will be available here as soon as the evaluation is finalized and published.
              </p>
            </div>
          )}

          {/* Action Row */}
          <div className="result-actions-row flex-center gap-3">
            <button
              type="button"
              className="btn btn-primary btn-lg w-full"
              onClick={() => {
                if (onFinish) {
                  onFinish();
                } else {
                  window.location.href = '/dashboard';
                }
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="result-footer text-center mt-6 text-xs text-muted">
          <p>© {new Date().getFullYear()} Task Grade Assessment Platform. Protected by Task Grade Evaluation System.</p>
        </div>
      </div>
    </div>
  );
}
