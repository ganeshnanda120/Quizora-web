import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  calculateSubmissionEvaluation,
  validateQuestionMarks,
  saveEvaluation,
  unpublishSubmissionResult
} from '../../services/evaluationService';
import {
  normalizeActivityQuestions,
  getQuestionUploadedFiles,
  getQuestionDescriptionText
} from '../../utils/questionUtils';

export default function SubmissionChecker({ submission, activity, user, onClose, onGraded }) {
  const normalized = useMemo(() => normalizeActivityQuestions(activity), [activity]);

  // Track initial evaluation state
  const [grades, setGrades] = useState(() => {
    const initMap = {};
    const existingGrades = submission.questionGrades || {};
    const norm = normalizeActivityQuestions(activity);
    const isAutoGradeEnabled = activity?.autoGradeMCQ !== false;

    norm.allQuestions.forEach((q) => {
      const prev = existingGrades[q.id] || {};
      let initialMarks = prev.marksAwarded !== undefined && prev.marksAwarded !== null ? prev.marksAwarded : '';

      // If Auto-Grade is enabled for MCQ and no manual entry yet exists, populate autoMcqMarks
      if (initialMarks === '' && isAutoGradeEnabled && q.type === 'mcq') {
        if (submission.autoMcqMarks?.[q.id] !== undefined) {
          initialMarks = submission.autoMcqMarks[q.id];
        }
      }

      initMap[q.id] = {
        marksAwarded: initialMarks,
        feedback: prev.feedback || '',
        isManuallyOverridden: prev.isManuallyOverridden || false
      };
    });
    return initMap;
  });

  const [overallRemark, setOverallRemark] = useState(submission.overallRemark || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Question refs for smooth scrolling navigation
  const questionRefs = useRef({});

  // Real-time calculation of overall, part-wise, and section-wise results
  const evaluationResult = useMemo(() => {
    return calculateSubmissionEvaluation(activity, submission, grades);
  }, [activity, submission, grades]);

  // Handle individual marks input with validation
  const handleMarksChange = (question, val) => {
    setIsDirty(true);
    setSaveSuccessMsg('');
    setError('');

    const validation = validateQuestionMarks(val, question, activity);
    if (!validation.valid) {
      setValidationErrors((prev) => ({ ...prev, [question.id]: validation.error }));
    } else {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
    }

    setGrades((prev) => ({
      ...prev,
      [question.id]: {
        ...(prev[question.id] || {}),
        marksAwarded: val,
        isManuallyOverridden: question.type === 'mcq' && activity?.autoGradeMCQ !== false
      }
    }));
  };

  // Handle individual question feedback
  const handleFeedbackChange = (questionId, val) => {
    setIsDirty(true);
    setSaveSuccessMsg('');
    setGrades((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        feedback: val
      }
    }));
  };

  // Scroll to selected question
  const scrollToQuestion = useCallback((idx) => {
    setActiveQuestionIdx(idx);
    const q = normalized.allQuestions[idx];
    if (q && questionRefs.current[q.id]) {
      questionRefs.current[q.id].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [normalized.allQuestions]);

  // Save Evaluation (Draft / Progress)
  const handleSaveProgress = async () => {
    setError('');
    setSaveSuccessMsg('');

    // Check if any active validation errors
    if (Object.keys(validationErrors).length > 0) {
      setError('Please resolve invalid mark values before saving.');
      return;
    }

    setSaving(true);
    try {
      const updated = await saveEvaluation(submission.submissionId, {
        activity,
        submission,
        grades,
        overallRemark,
        isPublishing: false,
        evaluator: {
          uid: user?.uid,
          name: user?.displayName || user?.email?.split('@')[0] || activity?.adminName || 'Admin',
          email: user?.email
        }
      });

      setIsDirty(false);
      setSaveSuccessMsg('Evaluation progress saved successfully!');
      if (onGraded) onGraded(updated);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Save evaluation error:", err);
      setError(err.message || "Failed to save evaluation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Publish Results Action
  const handleConfirmPublish = async () => {
    setError('');
    setSaving(true);
    try {
      const updated = await saveEvaluation(submission.submissionId, {
        activity,
        submission,
        grades,
        overallRemark,
        isPublishing: true,
        evaluator: {
          uid: user?.uid,
          name: user?.displayName || user?.email?.split('@')[0] || activity?.adminName || 'Admin',
          email: user?.email
        }
      });

      setIsDirty(false);
      setShowPublishModal(false);
      setSaveSuccessMsg('Results published successfully! Participant can now view their evaluated marks.');
      if (onGraded) onGraded(updated);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err) {
      console.error("Publish results error:", err);
      setError(err.message || "Failed to publish results. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Unpublish Result Action
  const handleUnpublish = async () => {
    if (!window.confirm("Are you sure you want to unpublish this result? The participant will no longer be able to view their marks until republished.")) {
      return;
    }

    setError('');
    setSaving(true);
    try {
      const updated = await unpublishSubmissionResult(submission.submissionId, {
        uid: user?.uid,
        name: user?.displayName || activity?.adminName || 'Admin'
      });
      setIsDirty(false);
      setSaveSuccessMsg('Result unpublished successfully.');
      if (onGraded) onGraded(updated);
    } catch (err) {
      console.error("Unpublish error:", err);
      setError("Failed to unpublish result.");
    } finally {
      setSaving(false);
    }
  };

  // Close with dirty check confirmation
  const handleRequestClose = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved evaluation changes. Are you sure you want to close without saving?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'j') {
        if (activeQuestionIdx < normalized.allQuestions.length - 1) {
          scrollToQuestion(activeQuestionIdx + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'k') {
        if (activeQuestionIdx > 0) {
          scrollToQuestion(activeQuestionIdx - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestionIdx, normalized.allQuestions, scrollToQuestion]);

  const participantDetails = submission.participantData || submission.participantDetails || {
    Name: submission.participantName || 'Student'
  };
  const isPublished = submission.isPublished === true;
  const isAutoGradeEnabled = activity?.autoGradeMCQ !== false;

  return (
    <div className="modal-backdrop" onClick={handleRequestClose}>
      <div className="modal-card extra-wide-modal submission-checker-modal fade-in" onClick={(e) => e.stopPropagation()}>
        
        {/* Sticky Header */}
        <div className="modal-header-bar flex-between checker-top-bar">
          <div className="checker-header-left">
            <div className="flex-align-center gap-2 mb-1">
              <span className="badge badge-primary">{activity?.purpose || 'Exam'} Evaluation</span>
              <span className={`checking-status-badge ${isPublished ? 'checked' : (evaluationResult.isComplete ? 'partially' : 'pending')}`}>
                {isPublished ? '● Results Published' : (evaluationResult.isComplete ? '✓ Evaluation Complete' : '⏳ Checking in Progress')}
              </span>
              {isAutoGradeEnabled ? (
                <span className="badge badge-success text-xs">⚡ Auto-Grade Active</span>
              ) : (
                <span className="badge badge-secondary text-xs">✍ Manual Evaluation</span>
              )}
            </div>
            <h3 className="modal-title-text m-0">
              {submission.participantData?.Name || submission.participantDetails?.Name || submission.participantName || 'Participant'} — {activity?.title}
            </h3>
          </div>

          <div className="checker-header-right flex-align-center gap-2">
            {isPublished && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-danger"
                onClick={handleUnpublish}
                disabled={saving}
                title="Revoke published result"
              >
                Unpublish
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSaveProgress}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowPublishModal(true)}
              disabled={saving || !evaluationResult.isComplete}
              title={!evaluationResult.isComplete ? 'Complete all questions before publishing' : 'Publish result to student'}
            >
              {isPublished ? 'Update & Republish' : 'Publish Result'} &rarr;
            </button>
            <button className="modal-close-btn" onClick={handleRequestClose} aria-label="Close modal">
              &times;
            </button>
          </div>
        </div>

        {/* Alerts / Feedback Message */}
        {error && <div className="alert alert-error m-4 mb-0">{error}</div>}
        {saveSuccessMsg && <div className="alert alert-success m-4 mb-0">{saveSuccessMsg}</div>}

        <div className="checker-workspace-layout">
          {/* Main Question & Answer Checking Area */}
          <div className="checker-main-scroll">
            
            {/* Participant Identification Card */}
            <div className="participant-summary-card mb-4 p-4 bg-slate-50 border rounded-xl">
              <div className="flex-between align-center mb-2">
                <h4 className="text-sm font-bold text-slate-800 m-0">Participant Identification &amp; Submission Metadata</h4>
                <span className="text-xs text-muted">Submission ID: <code>{submission.submissionId}</code></span>
              </div>
              <div className="participant-meta-grid">
                {Object.entries(participantDetails).map(([key, val]) => (
                  <div key={key} className="meta-pair">
                    <span className="meta-label">{key}:</span>
                    <strong className="meta-value">{String(val || 'N/A')}</strong>
                  </div>
                ))}
                <div className="meta-pair">
                  <span className="meta-label">Submitted Date/Time:</span>
                  <span className="meta-value">
                    {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Question Quick Jump Bar */}
            <div className="question-nav-strip mb-4">
              <span className="nav-strip-label">Questions:</span>
              <div className="nav-strip-pills">
                {normalized.allQuestions.map((q, idx) => {
                  const qEval = evaluationResult.questionGrades[q.id];
                  const isChecked = qEval && qEval.evalStatus === 'evaluated';
                  const isAuto = qEval && qEval.isAutoGraded;
                  const isActive = activeQuestionIdx === idx;

                  let pillClass = 'pill-pending';
                  if (isChecked) {
                    pillClass = isAuto ? 'pill-auto' : 'pill-checked';
                  }

                  return (
                    <button
                      key={q.id || idx}
                      type="button"
                      className={`q-nav-pill ${pillClass} ${isActive ? 'active' : ''}`}
                      onClick={() => scrollToQuestion(idx)}
                      title={`Jump to Q${idx + 1} (${q.type}) - ${isChecked ? 'Checked' : 'Pending'}`}
                    >
                      <span>Q{idx + 1}</span>
                      {isChecked && <span className="pill-dot">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Questions List */}
            <div className="questions-evaluation-container">
              {(normalized.isSectionBased && Array.isArray(normalized.sections) && normalized.sections.length > 0
                ? normalized.sections
                : [{ id: 'sec_root', title: '', parts: normalized.parts || [] }]
              ).map((section, sIdx) => (
                <div key={section.id || sIdx} className="section-eval-block mb-6">
                  {normalized.isSectionBased && section.title && (
                    <div className="section-eval-header mb-3 pb-2 border-bottom flex-between">
                      <h4 className="font-extrabold text-primary text-md m-0">
                        📂 Section {sIdx + 1}: {section.title || section.name}
                      </h4>
                      <span className="badge badge-secondary text-xs">
                        Section Score: {evaluationResult.sectionScores[section.id]?.obtainedMarks ?? 0} / {evaluationResult.sectionScores[section.id]?.maxMarks ?? 0} Marks
                      </span>
                    </div>
                  )}

                  {(section.parts || []).map((part, pIdx) => (
                    <div key={part.id || pIdx} className="part-eval-block mb-5">
                      <div className="part-eval-header flex-between align-center mb-3">
                        <h5 className="font-bold text-slate-800 text-sm m-0">
                          {part.title || `Part ${pIdx + 1}`}
                        </h5>
                        <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-1 border rounded">
                          Part Score: {evaluationResult.partScores[part.id]?.obtainedMarks ?? 0} / {evaluationResult.partScores[part.id]?.maxMarks ?? 0}
                        </span>
                      </div>

                      {/* Part Questions */}
                      <div className="questions-card-stack">
                        {part.questions.map((q) => {
                          const globalIdx = normalized.allQuestions.findIndex((item) => item.id === q.id);
                          const studentAnswer = submission.answers?.[q.id] || submission.answers?.[`${q.id}_files`];
                          const studentFiles = getQuestionUploadedFiles(q.id, submission.answers);
                          const studentNotes = getQuestionDescriptionText(q.id, submission.answers);
                          const hasUploadedFiles = studentFiles.length > 0;
                          const hasWrittenNotes = typeof studentNotes === 'string' && studentNotes.trim().length > 0;

                          const qEval = evaluationResult.questionGrades[q.id] || {};
                          const currentMarksAwarded = grades[q.id]?.marksAwarded ?? '';
                          const currentFeedback = grades[q.id]?.feedback ?? '';
                          const err = validationErrors[q.id];

                          return (
                            <div
                              key={q.id}
                              ref={(el) => (questionRefs.current[q.id] = el)}
                              className={`question-eval-card ${activeQuestionIdx === globalIdx ? 'highlighted-q' : ''} ${qEval.evalStatus === 'evaluated' ? 'card-checked' : 'card-pending'}`}
                            >
                              {/* Question Item Header */}
                              <div className="q-card-top flex-between align-center">
                                <div className="flex-align-center gap-2">
                                  <span className="q-badge-num">Q{globalIdx + 1}</span>
                                  <span className={`q-type-badge ${q.type}`}>
                                    {q.type.toUpperCase()}
                                  </span>
                                  <span className="q-marks-pill">
                                    Maximum: <strong>{q.marks || '0'} Marks</strong>
                                  </span>
                                </div>

                                <div className="q-status-indicators flex-align-center gap-2">
                                  {qEval.isAutoGraded && (
                                    <span className="auto-grade-pill text-xs">
                                      ⚡ Auto-Graded
                                    </span>
                                  )}
                                  <span className={`q-eval-state ${qEval.evalStatus}`}>
                                    {qEval.evalStatus === 'evaluated' ? '✓ Evaluated' : '⏳ Pending Check'}
                                  </span>
                                </div>
                              </div>

                              {/* Question Prompt */}
                              <div className="q-prompt-box mt-3">
                                <p className="q-prompt-text">
                                  {q.questionText || q.paperFileName || 'Question Text'}
                                </p>

                                {q.attachedFiles && q.attachedFiles.length > 0 && (
                                  <div className="attached-files-row flex-align-center gap-2 mt-2 flex-wrap">
                                    {q.attachedFiles.map((af, afIdx) => (
                                      <a
                                        key={af.id || afIdx}
                                        href={af.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary btn-sm"
                                      >
                                        {af.type === 'image' ? '🖼️' : '📄'} {af.name || 'View Attachment'} ↗
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {q.paperFileUrl && !q.attachedFiles?.length && (
                                  <div className="paper-url-box mt-2">
                                    <a
                                      href={q.paperFileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-secondary btn-sm"
                                    >
                                      📄 View Question Paper Document ↗
                                    </a>
                                  </div>
                                )}

                                {(q.answerGuidelines || q.description) && (
                                  <div className="guidelines-box mt-2 p-2 bg-slate-50 border rounded text-xs text-muted">
                                    <strong>Evaluator Guidelines / Rubric:</strong> {q.answerGuidelines || q.description}
                                  </div>
                                )}
                              </div>

                              {/* Participant Answer Display */}
                              <div className="student-submitted-box mt-4">
                                <span className="submitted-box-title">
                                  Participant's Submitted Answer:
                                </span>

                                <div className="submitted-content-frame">
                                  {/* 1. MCQ Display */}
                                  {q.type === 'mcq' && (
                                    <div className="mcq-review-display">
                                      <div className="selected-choice-line">
                                        <span className="choice-lbl">Selected Choice:</span>
                                        <strong className="choice-val">
                                          {studentAnswer !== undefined && studentAnswer !== '' && studentAnswer !== null
                                            ? (q.options?.[studentAnswer] || `Option ${Number(studentAnswer) + 1}: ${studentAnswer}`)
                                            : <span className="text-danger italic">Unanswered</span>}
                                        </strong>
                                      </div>

                                      {/* Correct Answer Display (Visible to Evaluator) */}
                                      <div className="correct-choice-reference mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                                        <strong>Correct Key:</strong>{' '}
                                        {Array.isArray(q.correctIndices)
                                          ? q.correctIndices.map((ci) => q.options?.[ci] || `Option ${ci + 1}`).join(', ')
                                          : (q.options?.[q.correctOptionIndex] || 'Option 1')}
                                      </div>
                                    </div>
                                  )}

                                  {/* 2. Upload Type Display */}
                                  {q.type === 'upload' && (
                                    <div className="upload-review-display">
                                      {hasUploadedFiles ? (
                                        <div className="uploaded-files-stack flex flex-col gap-2 mb-2">
                                          {studentFiles.map((fObj, fIdx) => (
                                            <div key={fObj.id || fIdx} className="file-item-card flex-between align-center p-2 bg-white border rounded">
                                              <div className="flex-align-center gap-2">
                                                <span className="file-icon">{fObj.type === 'image' ? '🖼️' : '📄'}</span>
                                                <div>
                                                  <span className="file-name font-bold text-xs block">{fObj.name || `Uploaded File ${fIdx + 1}`}</span>
                                                  {fObj.size && (
                                                    <span className="file-size text-muted text-xs">{(fObj.size / 1024).toFixed(1)} KB</span>
                                                  )}
                                                </div>
                                              </div>
                                              <a
                                                href={fObj.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary btn-sm"
                                              >
                                                Open / Download File ↗
                                              </a>
                                            </div>
                                          ))}
                                        </div>
                                      ) : !hasWrittenNotes ? (
                                        <p className="text-danger text-xs italic m-0">No file or written answer submitted for this question.</p>
                                      ) : null}

                                      {hasWrittenNotes && (
                                        <div className="written-notes-callout mt-2 p-3 bg-slate-50 border rounded">
                                          <span className="text-xs font-bold text-slate-700 block mb-1">
                                            Accompanying Written Explanation:
                                          </span>
                                          <p className="text-xs text-slate-800 whitespace-pre-wrap m-0">
                                            {studentNotes}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* 3. Written / Text Type Display */}
                                  {q.type !== 'mcq' && q.type !== 'upload' && (
                                    <div className="written-review-display">
                                      {studentAnswer ? (
                                        <div className="written-text-box p-3 bg-white border rounded whitespace-pre-wrap text-sm text-slate-800">
                                          {studentAnswer}
                                        </div>
                                      ) : (
                                        <p className="text-danger text-xs italic m-0">No written answer submitted.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Evaluator Marks & Feedback Input */}
                              <div className="evaluation-controls-grid mt-4">
                                <div className="form-group marks-field mb-0">
                                  <label className="form-label font-bold text-xs" htmlFor={`marks_${q.id}`}>
                                    Marks Awarded (Max: {q.marks || 0}):
                                  </label>
                                  <div className="marks-input-wrapper">
                                    <input
                                      type="number"
                                      id={`marks_${q.id}`}
                                      className={`form-input marks-num-input ${err ? 'input-error' : ''}`}
                                      placeholder="Enter marks..."
                                      step="0.25"
                                      value={currentMarksAwarded}
                                      onChange={(e) => handleMarksChange(q, e.target.value)}
                                    />
                                    <span className="marks-suffix">/ {q.marks || 0}</span>
                                  </div>
                                  {err && <span className="text-xs text-danger block mt-1">{err}</span>}
                                </div>

                                <div className="form-group feedback-field mb-0">
                                  <label className="form-label font-bold text-xs" htmlFor={`feedback_${q.id}`}>
                                    Feedback / Evaluator Remarks (Optional):
                                  </label>
                                  <input
                                    type="text"
                                    id={`feedback_${q.id}`}
                                    className="form-input feedback-text-input"
                                    placeholder="Add constructive feedback for participant..."
                                    value={currentFeedback}
                                    onChange={(e) => handleFeedbackChange(q.id, e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Overall Participant Remark (Phase 4) */}
              <div className="overall-remark-card p-4 bg-white border rounded-xl mb-6">
                <h4 className="font-bold text-sm text-slate-800 mb-2">Overall Submission Remarks &amp; Feedback:</h4>
                <p className="text-xs text-muted mb-2">
                  This overall evaluation remark will be visible to the participant alongside their score breakdown once results are published.
                </p>
                <textarea
                  className="form-input w-full"
                  rows="3"
                  placeholder="e.g. Excellent conceptual grasp on written questions. Review MCQ options carefully..."
                  value={overallRemark}
                  onChange={(e) => {
                    setIsDirty(true);
                    setOverallRemark(e.target.value);
                  }}
                ></textarea>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Evaluation Summary & Calculation (Phase 6) */}
          <div className="checker-sidebar-panel">
            <div className="evaluation-summary-box p-4 bg-white border rounded-xl shadow-sm mb-4">
              <h4 className="font-extrabold text-sm text-slate-800 pb-2 border-bottom mb-3">
                Live Result Summary
              </h4>

              {/* Big Score Box */}
              <div className="score-hero-display text-center p-4 bg-gradient-to-b from-blue-50 to-indigo-50 border border-blue-200 rounded-xl mb-4">
                <span className="text-xs font-bold text-primary tracking-wider uppercase block mb-1">Total Score</span>
                <div className="font-black text-3xl text-primary">
                  {evaluationResult.totalObtainedMarks} <span className="text-sm font-semibold text-muted">/ {evaluationResult.totalMaxMarks}</span>
                </div>
                <div className="mt-1 font-bold text-sm text-slate-700">
                  {evaluationResult.percentage}%
                </div>
              </div>

              {/* Progress & Completion Meter */}
              <div className="progress-meter-block mb-4">
                <div className="flex-between text-xs font-semibold mb-1">
                  <span>Evaluation Progress:</span>
                  <span>{evaluationResult.evaluatedCount} / {evaluationResult.totalQuestions} Questions</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${evaluationResult.totalQuestions > 0 ? (evaluationResult.evaluatedCount / evaluationResult.totalQuestions) * 100 : 0}%`
                    }}
                  ></div>
                </div>
                <span className="text-xs text-muted mt-1 block">
                  {evaluationResult.isComplete
                    ? '✓ All questions evaluated. Ready to publish.'
                    : `⏳ ${evaluationResult.totalQuestions - evaluationResult.evaluatedCount} question(s) remaining`}
                </span>
              </div>

              {/* Counts Breakdown */}
              <div className="summary-counts-list text-xs flex flex-col gap-2 pb-3 border-bottom mb-3">
                <div className="flex-between">
                  <span className="text-muted">Correct Answers:</span>
                  <strong className="text-success">{evaluationResult.correctCount}</strong>
                </div>
                <div className="flex-between">
                  <span className="text-muted">Partial Marks:</span>
                  <strong className="text-primary">{evaluationResult.partialCount}</strong>
                </div>
                <div className="flex-between">
                  <span className="text-muted">Incorrect Answers:</span>
                  <strong className="text-danger">{evaluationResult.incorrectCount}</strong>
                </div>
                <div className="flex-between">
                  <span className="text-muted">Unanswered Questions:</span>
                  <strong className="text-slate-600">{evaluationResult.unansweredCount}</strong>
                </div>
              </div>

              {/* Part Breakdown Table */}
              <div className="part-scores-breakdown mb-4">
                <h5 className="font-bold text-xs text-slate-700 mb-2">Part-wise Marks:</h5>
                <div className="flex flex-col gap-1">
                  {Object.entries(evaluationResult.partScores).map(([pId, pData]) => (
                    <div key={pId} className="flex-between text-xs py-1 border-bottom">
                      <span className="text-muted truncate max-w-[140px]">{pData.title || pId}:</span>
                      <strong>{pData.obtainedMarks} / {pData.maxMarks}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="sidebar-actions-stack flex flex-col gap-2">
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={handleSaveProgress}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Draft Progress'}
                </button>

                <button
                  type="button"
                  className={`btn ${evaluationResult.isComplete ? 'btn-primary' : 'btn-disabled'} w-full`}
                  onClick={() => setShowPublishModal(true)}
                  disabled={saving || !evaluationResult.isComplete}
                >
                  {isPublished ? 'Update Published Result' : 'Publish Result'} &rarr;
                </button>
              </div>
            </div>

            {/* Audit History Toggle (Phase 8) */}
            <div className="audit-history-box p-3 bg-white border rounded-xl text-xs">
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full flex-between p-0"
                onClick={() => setShowAuditHistory(!showAuditHistory)}
              >
                <span className="font-bold text-slate-700">📋 Evaluation Audit Records</span>
                <span>{showAuditHistory ? '▲' : '▼'}</span>
              </button>

              {showAuditHistory && (
                <div className="audit-entries-list mt-3 flex flex-col gap-2 pt-2 border-top">
                  {Array.isArray(submission.evaluationHistory) && submission.evaluationHistory.length > 0 ? (
                    submission.evaluationHistory.map((item, hIdx) => (
                      <div key={item.auditId || hIdx} className="audit-item p-2 bg-slate-50 border rounded text-xs">
                        <div className="flex-between font-bold text-slate-800">
                          <span>{item.action}</span>
                          <span className="text-muted text-[10px]">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="text-muted text-[11px] mt-1">
                          Evaluator: {item.evaluatorName || 'Admin'}
                        </div>
                        {item.newScore !== undefined && (
                          <div className="text-primary font-bold text-[11px]">
                            Score: {item.previousScore !== null ? `${item.previousScore} → ` : ''}{item.newScore} pts
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted italic m-0">No prior audit records for this submission.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Modal Before Result Publication (Phase 7) */}
        {showPublishModal && (
          <div className="modal-backdrop" onClick={() => setShowPublishModal(false)}>
            <div className="modal-card small-modal fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-bar flex-between">
                <h3 className="modal-title-text">Confirm Result Publication</h3>
                <button className="modal-close-btn" onClick={() => setShowPublishModal(false)}>&times;</button>
              </div>

              <div className="publish-modal-body p-4 text-center">
                <div className="publish-icon-box mx-auto mb-3">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>

                <h4 className="font-bold text-lg text-slate-900 mb-1">
                  Ready to Publish Results?
                </h4>
                <p className="text-xs text-muted mb-4">
                  Once published, <strong>{participantDetails.Name || 'the participant'}</strong> will be able to view their verified score, question-wise breakdown, and constructive feedback.
                </p>

                <div className="p-3 bg-slate-50 border rounded-xl text-left text-xs mb-4">
                  <div className="flex-between py-1 border-bottom">
                    <span className="text-muted">Participant:</span>
                    <strong>{participantDetails.Name || 'Student'}</strong>
                  </div>
                  <div className="flex-between py-1 border-bottom">
                    <span className="text-muted">Total Marks:</span>
                    <strong className="text-primary font-bold">{evaluationResult.totalObtainedMarks} / {evaluationResult.totalMaxMarks}</strong>
                  </div>
                  <div className="flex-between py-1">
                    <span className="text-muted">Percentage:</span>
                    <strong className="text-primary font-bold">{evaluationResult.percentage}%</strong>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary w-full"
                    onClick={() => setShowPublishModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={handleConfirmPublish}
                    disabled={saving}
                  >
                    {saving ? 'Publishing...' : 'Yes, Publish Result'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
