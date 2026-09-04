import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { uploadStudentAnswerFile } from '../../services/submissionService';
import logoImg from '../../assets/logo.png';

export default function StudentAttendancePaper({
  activity,
  activityId,
  participantData,
  onSubmit,
  onExpire,
  user
}) {
  const partMode = activity?.partMode || 'parts';
  const isExam = activity?.purpose === 'Exam';
  const enableNegativeMarking = !!activity?.enableNegativeMarking;

  // Normal parts list or sections list
  const sections = useMemo(() => activity?.sections || [], [activity]);
  const parts = useMemo(() => activity?.parts || [], [activity]);

  // Active navigation indices
  const [activeSecIdx, setActiveSecIdx] = useState(0);
  const [activePartIdx, setActivePartIdx] = useState(0);

  // Answers Map state: { [questionId]: value }
  // value can be: number (MCQ index), array of numbers (multi-MCQ), string (written answer), or array of file objects (upload answer)
  const [answers, setAnswers] = useState(() => {
    try {
      const cached = localStorage.getItem(`quizora_active_session_${activityId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.answers) return parsed.answers;
      }
    } catch {
      // Ignore cache error
    }
    return {};
  });

  // Uploading state for upload questions
  const [uploadingQId, setUploadingQId] = useState(null);
  const [uploadError, setUploadError] = useState('');

  // Review & Submit Confirmation Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Time remaining state (in seconds)
  const [timeRemaining, setTimeRemaining] = useState(() => {
    if (activity?.endTime) {
      const endMs = new Date(activity.endTime).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((endMs - nowMs) / 1000));
      return diffSec;
    }
    // Fallback to configured duration if any
    const duration = activity?.duration;
    if (duration) {
      const totalSec = ((duration.hours || 0) * 3600) + ((duration.minutes || 0) * 60) + (duration.seconds || 0);
      if (totalSec > 0) return totalSec;
    }
    return null; // Unlimited
  });

  // Flat list of all questions across parts / sections for counting
  const allQuestionsList = useMemo(() => {
    const list = [];
    if (partMode === 'sections') {
      sections.forEach((sec, sI) => {
        (sec.parts || []).forEach((p, pI) => {
          (p.questions || []).forEach((q) => {
            list.push({ ...q, secIdx: sI, partIdx: pI });
          });
        });
      });
    } else {
      parts.forEach((p, pI) => {
        (p.questions || []).forEach((q) => {
          list.push({ ...q, partIdx: pI });
        });
      });
    }
    return list;
  }, [partMode, sections, parts]);

  // Persist answers to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(`quizora_active_session_${activityId}`, JSON.stringify({
        activityId,
        participantData,
        answers,
        updatedAt: new Date().toISOString()
      }));
    } catch {
      // Ignore quota
    }
  }, [answers, activityId, participantData]);

  // Session countdown timer and expiration check
  const handleAutoExpireSubmit = useCallback(async () => {
    try {
      if (onSubmit) {
        await onSubmit(answers, true); // true indicates auto-submitted on expiration
      }
    } catch (err) {
      console.warn("Auto-submit error:", err);
    }
    if (onExpire) {
      onExpire();
    }
  }, [answers, onSubmit, onExpire]);

  useEffect(() => {
    if (timeRemaining === null) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          // Trigger auto-submit upon time expiration
          handleAutoExpireSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, handleAutoExpireSubmit]);

  // Format seconds into HH : MM : SS
  const formatTimer = (sec) => {
    if (sec === null || sec === undefined) return 'Unlimited';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Answer change handlers
  const handleMcqSelect = (questionId, optionIndex, isMulti = false) => {
    setAnswers((prev) => {
      const current = prev[questionId];
      if (isMulti) {
        const currentArr = Array.isArray(current) ? [...current] : (current !== undefined && current !== null ? [current] : []);
        const exists = currentArr.includes(optionIndex);
        const updated = exists ? currentArr.filter((i) => i !== optionIndex) : [...currentArr, optionIndex];
        return { ...prev, [questionId]: updated };
      }
      return { ...prev, [questionId]: optionIndex };
    });
  };

  const handleWrittenChange = (questionId, text) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: text
    }));
  };

  const handleFileUpload = async (questionId, file) => {
    if (!file) return;
    setUploadError('');
    setUploadingQId(questionId);

    try {
      const uploadedFile = await uploadStudentAnswerFile(activityId, file);
      if (uploadedFile) {
        setAnswers((prev) => {
          const currentList = Array.isArray(prev[questionId]) ? [...prev[questionId]] : [];
          return {
            ...prev,
            [questionId]: [...currentList, uploadedFile]
          };
        });
      }
    } catch (err) {
      console.error("Upload answer error:", err);
      setUploadError("Failed to upload file. Please try again.");
    } finally {
      setUploadingQId(null);
    }
  };

  const handleRemoveUploadedFile = (questionId, fileId) => {
    setAnswers((prev) => {
      const currentList = Array.isArray(prev[questionId]) ? [...prev[questionId]] : [];
      const updated = currentList.filter((f) => f.id !== fileId);
      return {
        ...prev,
        [questionId]: updated
      };
    });
  };

  const handleClearAnswer = (questionId) => {
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[questionId];
      return copy;
    });
  };

  // Determine active section and active part
  const activeSection = partMode === 'sections' ? sections[activeSecIdx] : null;
  const activePartsList = partMode === 'sections' ? (activeSection?.parts || []) : parts;
  const activePart = activePartsList[activePartIdx] || activePartsList[0];
  const activeQuestions = activePart?.questions || [];

  // Count answered questions
  const answeredCount = useMemo(() => {
    return allQuestionsList.filter((q) => {
      const val = answers[q.id];
      if (val === undefined || val === null || val === '') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    }).length;
  }, [allQuestionsList, answers]);

  const totalQuestionsCount = allQuestionsList.length;

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(answers, false);
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  const isTimerCritical = timeRemaining !== null && timeRemaining <= 300; // < 5 mins

  return (
    <div className="student-attendance-viewport fade-in">
      {/* STICKY TOP APP BAR */}
      <header className="student-sticky-appbar">
        <div className="student-appbar-inner flex-between align-center">
          <div className="student-appbar-left flex-align-center gap-3">
            <img src={logoImg} alt="Quizora" className="student-appbar-logo" />
            <div className="student-appbar-title-box">
              <h1 className="student-appbar-title truncate text-base font-bold text-dark m-0">
                {activity?.title || 'Quizora Activity'}
              </h1>
              <div className="student-appbar-submeta flex-align-center gap-2 text-xs text-muted">
                <span>{participantData?.Name || user?.displayName || 'Student'}</span>
                {activity?.subject && <span>• {activity.subject}</span>}
              </div>
            </div>
          </div>

          <div className="student-appbar-right flex-align-center gap-3">
            {/* TIMER DISPLAY */}
            {timeRemaining !== null && (
              <div className={`student-timer-pill flex-align-center gap-2 ${isTimerCritical ? 'timer-critical' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div className="timer-text-group">
                  <span className="timer-label text-xxs font-bold uppercase block">Time Remaining</span>
                  <span className="timer-value font-mono font-bold text-sm leading-none">
                    {formatTimer(timeRemaining)}
                  </span>
                </div>
              </div>
            )}

            {/* PROGRESS PILL */}
            <div className="student-progress-pill text-xs font-semibold">
              <span className="answered-num text-primary font-bold">{answeredCount}</span> / {totalQuestionsCount} Answered
            </div>

            {/* FINISH & SUBMIT BUTTON */}
            <button
              type="button"
              className="btn btn-primary btn-sm btn-finish-exam font-bold"
              onClick={() => setShowSubmitModal(true)}
            >
              Submit
            </button>
          </div>
        </div>

        {/* SECTION NAVIGATION TABS (IF SECTIONS MODE) */}
        {partMode === 'sections' && sections.length > 1 && (
          <div className="student-section-nav-bar">
            <div className="student-nav-scroll-row">
              {sections.map((sec, sIdx) => {
                const secParts = sec.parts || [];
                const secQs = secParts.flatMap((p) => p.questions || []);
                const secAnsCount = secQs.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '' && (!Array.isArray(answers[q.id]) || answers[q.id].length > 0)).length;

                return (
                  <button
                    key={sec.id || sIdx}
                    type="button"
                    className={`student-section-nav-tab ${activeSecIdx === sIdx ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSecIdx(sIdx);
                      setActivePartIdx(0);
                    }}
                  >
                    <span className="sec-tab-title">{sec.name || `Section ${sIdx + 1}`}</span>
                    <span className="sec-tab-progress">{secAnsCount}/{secQs.length}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PART NAVIGATION PILLS */}
        {activePartsList.length > 1 && (
          <div className="student-part-nav-bar">
            <div className="student-nav-scroll-row">
              {activePartsList.map((p, pIdx) => {
                const partQs = p.questions || [];
                const partAnsCount = partQs.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '' && (!Array.isArray(answers[q.id]) || answers[q.id].length > 0)).length;

                return (
                  <button
                    key={p.id || pIdx}
                    type="button"
                    className={`student-part-nav-pill ${activePartIdx === pIdx ? 'active' : ''}`}
                    onClick={() => setActivePartIdx(pIdx)}
                  >
                    <span>{p.title || `Part ${pIdx + 1}`}</span>
                    <span className="part-pill-count">({partAnsCount}/{partQs.length})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* MAIN QUESTIONS CONTENT AREA */}
      <main className="student-paper-container py-6">
        {uploadError && (
          <div className="alert alert-error mb-4">
            <span>{uploadError}</span>
          </div>
        )}

        {/* PART HEADER CARD */}
        <div className="student-part-header-banner p-4 bg-white border rounded-xl shadow-sm mb-6 flex-between align-center flex-wrap gap-2">
          <div>
            <span className="badge badge-primary text-xs uppercase font-bold tracking-wider mb-1 block">
              {activeSection ? `${activeSection.name} • ` : ''}{activePart?.title || `Part ${activePartIdx + 1}`}
            </span>
            <h2 className="text-lg font-bold text-dark m-0">
              Questions ({activeQuestions.length})
            </h2>
          </div>
          {activePart?.partTotalMarks && (
            <span className="badge badge-outline font-semibold text-xs">
              Part Total: {activePart.partTotalMarks} Marks
            </span>
          )}
        </div>

        {/* QUESTIONS LIST */}
        {activeQuestions.length === 0 ? (
          <div className="empty-part-box p-8 bg-white border rounded-xl text-center">
            <p className="text-muted font-medium m-0">No questions in this part.</p>
          </div>
        ) : (
          <div className="student-questions-stack flex flex-col gap-6">
            {activeQuestions.map((q, qIdx) => {
              const isMcq = q.type === 'mcq';
              const isWritten = q.type === 'written';
              const isUpload = q.type === 'upload' || q.type === 'upload_paper';
              const currentAnswer = answers[q.id];
              const isAnswered = currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '' && (!Array.isArray(currentAnswer) || currentAnswer.length > 0);
              const guidelines = q.answerGuidelines || q.description || q.explanation;
              const attachedFiles = q.attachedFiles || [];

              return (
                <div
                  key={q.id || qIdx}
                  id={`q-card-${q.id}`}
                  className={`student-question-card bg-white p-5 rounded-xl border shadow-sm transition-all ${isAnswered ? 'question-answered' : ''}`}
                >
                  {/* QUESTION CARD HEADER */}
                  <div className="student-q-header flex-between align-center mb-3">
                    <div className="student-q-title-group flex-align-center gap-2">
                      <span className="student-q-num font-bold text-dark text-lg">Q{qIdx + 1}.</span>
                      <span className={`badge-type-pill text-xs uppercase font-bold ${q.type}`}>
                        {isMcq ? 'MCQ' : isWritten ? 'Written' : 'Upload File'}
                      </span>
                      {isAnswered && (
                        <span className="badge badge-success text-xxs font-bold">✓ Answered</span>
                      )}
                    </div>

                    <div className="student-q-marks-group flex-align-center gap-2">
                      {q.marks !== null && q.marks !== undefined && q.marks !== '' && (
                        <span className="student-q-marks-pill font-semibold text-xs bg-primary-light text-primary px-2 py-1 rounded">
                          {q.marks} {Number(q.marks) === 1 ? 'Mark' : 'Marks'}
                        </span>
                      )}
                      {isMcq && enableNegativeMarking && (
                        <span className="student-q-neg-marks-pill font-semibold text-xs bg-red-50 text-danger px-2 py-1 rounded">
                          -{q.negativeMark || activity?.negativeMarkValue || '0.25'} Neg
                        </span>
                      )}
                    </div>
                  </div>

                  {/* QUESTION TEXT */}
                  {q.questionText && (
                    <div className="student-q-prompt mb-3">
                      <p className="student-q-text font-medium text-base text-dark leading-relaxed m-0">
                        {q.questionText}
                      </p>
                    </div>
                  )}

                  {/* ATTACHED QUESTION MEDIA / QUESTION PAPER (IMAGES OR PDFS) */}
                  {(attachedFiles.length > 0 || q.imageUrl || q.paperFileUrl) && (
                    <div className="student-q-attachments-grid mb-4">
                      {attachedFiles.map((fileItem, fIdx) => (
                        <div key={fileItem.id || fIdx} className="student-attachment-card mb-2">
                          {fileItem.type === 'image' || (!fileItem.type && fileItem.url?.match(/\.(jpg|jpeg|png|webp)/i)) ? (
                            <div className="attachment-image-wrapper">
                              <img
                                src={fileItem.url}
                                alt={fileItem.name || 'Question attachment'}
                                className="attachment-img max-h-72 object-contain rounded border cursor-pointer"
                                onClick={() => window.open(fileItem.url, '_blank')}
                              />
                              <span className="click-to-expand-hint text-xxs text-muted block mt-1">
                                ↗ Click image to view in full size
                              </span>
                            </div>
                          ) : (
                            <div className="attachment-pdf-row flex-between align-center p-3 bg-slate-50 border rounded-lg">
                              <div className="flex-align-center gap-2">
                                <span className="pdf-icon-badge text-xs font-bold bg-danger text-white px-2 py-1 rounded">PDF</span>
                                <span className="text-sm font-semibold text-dark">{fileItem.name || 'Question Document'}</span>
                              </div>
                              <a
                                href={fileItem.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                              >
                                View PDF ↗
                              </a>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Legacy Single Attachment Fallback */}
                      {attachedFiles.length === 0 && (q.imageUrl || q.paperFileUrl) && (
                        <div className="student-attachment-card mb-2">
                          {q.imageUrl ? (
                            <div className="attachment-image-wrapper">
                              <img
                                src={q.imageUrl}
                                alt="Question illustration"
                                className="attachment-img max-h-72 object-contain rounded border cursor-pointer"
                                onClick={() => window.open(q.imageUrl, '_blank')}
                              />
                              <span className="click-to-expand-hint text-xxs text-muted block mt-1">
                                ↗ Click image to expand
                              </span>
                            </div>
                          ) : (
                            <div className="attachment-pdf-row flex-between align-center p-3 bg-slate-50 border rounded-lg">
                              <div className="flex-align-center gap-2">
                                <span className="pdf-icon-badge text-xs font-bold bg-danger text-white px-2 py-1 rounded">PDF</span>
                                <span className="text-sm font-semibold text-dark">{q.paperFileName || 'Question Paper'}</span>
                              </div>
                              <a
                                href={q.paperFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                              >
                                View PDF ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* DESCRIPTION / ANSWER GUIDELINES */}
                  {guidelines && (
                    <div className="student-guidelines-box mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="guidelines-header flex-align-center gap-2 mb-1">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span className="guidelines-title font-bold text-xs uppercase tracking-wider text-muted">
                          Instructions / Description
                        </span>
                      </div>
                      <p className="guidelines-content text-sm text-dark m-0 leading-normal">
                        {guidelines}
                      </p>
                    </div>
                  )}

                  {/* 1. MCQ OPTIONS RENDERER */}
                  {isMcq && (
                    <div className="student-mcq-options-container mt-2">
                      <div className="student-mcq-options-grid flex flex-col gap-2">
                        {(q.options || []).map((opt, optIdx) => {
                          const optLetter = String.fromCharCode(65 + optIdx);
                          const isMulti = !!q.allowMultipleChoices;
                          const isSelected = isMulti
                            ? Array.isArray(currentAnswer) && currentAnswer.includes(optIdx)
                            : currentAnswer === optIdx;

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              className={`student-mcq-option-btn flex-align-center gap-3 p-3.5 border-2 rounded-xl text-left transition-all ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleMcqSelect(q.id, optIdx, isMulti)}
                            >
                              <span className={`option-letter-circle font-bold text-sm ${isSelected ? 'selected' : ''}`}>
                                {optLetter}
                              </span>
                              <span className="option-text text-sm font-medium text-dark flex-1 leading-snug">
                                {typeof opt === 'string' ? opt : opt?.text || `Option ${optIdx + 1}`}
                              </span>
                              <div className={`option-selection-indicator ${isSelected ? 'checked' : ''}`}>
                                {isMulti ? (
                                  <div className="checkbox-indicator">{isSelected ? '✓' : ''}</div>
                                ) : (
                                  <div className="radio-indicator">{isSelected ? '●' : ''}</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {isAnswered && (
                        <div className="q-clear-row mt-2 text-right">
                          <button
                            type="button"
                            className="btn-clear-selection text-xs text-muted hover:text-danger"
                            onClick={() => handleClearAnswer(q.id)}
                          >
                            Clear Selection
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. WRITTEN ANSWER TEXTAREA */}
                  {isWritten && (
                    <div className="student-written-input-container mt-3">
                      <label className="form-label font-semibold text-sm mb-1.5 block" htmlFor={`written-ans-${q.id}`}>
                        Your Typed Answer:
                      </label>
                      <textarea
                        id={`written-ans-${q.id}`}
                        className="form-input text-area student-written-textarea"
                        rows="6"
                        placeholder="Type your response here..."
                        value={currentAnswer || ''}
                        onChange={(e) => handleWrittenChange(q.id, e.target.value)}
                      />
                      <div className="written-textarea-footer flex-between align-center mt-1 text-xs text-muted">
                        <span>{(currentAnswer || '').trim().split(/\s+/).filter(Boolean).length} Words</span>
                        {isAnswered && (
                          <button
                            type="button"
                            className="btn-clear-selection text-xs text-muted hover:text-danger"
                            onClick={() => handleClearAnswer(q.id)}
                          >
                            Clear Answer
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. UPLOAD FILES ANSWER AREA */}
                  {isUpload && (
                    <div className="student-upload-input-container mt-3">
                      <label className="form-label font-semibold text-sm mb-1.5 block">
                        Upload Your Answer Sheet (Images or PDFs):
                      </label>

                      {/* Dropzone / Upload button */}
                      <div className="student-file-dropzone p-5 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50 hover:bg-slate-100 transition-all">
                        <input
                          type="file"
                          id={`file-input-${q.id}`}
                          className="hidden-file-input"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(q.id, f);
                            e.target.value = '';
                          }}
                          disabled={uploadingQId === q.id}
                        />
                        <label htmlFor={`file-input-${q.id}`} className="cursor-pointer block">
                          <svg className="mx-auto mb-2 text-primary" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          <span className="text-sm font-bold text-primary block">
                            {uploadingQId === q.id ? 'Uploading File...' : '+ Click to Upload Answer File'}
                          </span>
                          <span className="text-xs text-muted mt-1 block">
                            Supports JPG, PNG, WEBP, and PDF up to 15MB
                          </span>
                        </label>
                      </div>

                      {/* Uploaded files list */}
                      {Array.isArray(currentAnswer) && currentAnswer.length > 0 && (
                        <div className="uploaded-answers-list mt-3 flex flex-col gap-2">
                          {currentAnswer.map((fileObj) => (
                            <div key={fileObj.id} className="uploaded-answer-card flex-between align-center p-3 bg-white border rounded-lg shadow-sm">
                              <div className="flex-align-center gap-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded text-white ${fileObj.type === 'image' ? 'bg-indigo-600' : 'bg-red-600'}`}>
                                  {fileObj.type === 'image' ? 'IMG' : 'PDF'}
                                </span>
                                <a
                                  href={fileObj.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-semibold text-primary hover-underline truncate max-w-xs"
                                >
                                  {fileObj.name || 'Answer File'} ↗
                                </a>
                              </div>
                              <button
                                type="button"
                                className="btn-delete-uploaded text-xs text-danger hover:text-red-800 font-bold px-2 py-1"
                                onClick={() => handleRemoveUploadedFile(q.id, fileObj.id)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        <div className="student-bottom-actions-bar mt-8 flex-between align-center flex-wrap gap-3 p-4 bg-white border rounded-xl shadow-sm">
          <div className="student-bottom-progress text-sm font-medium text-dark">
            Answered: <strong>{answeredCount}</strong> of <strong>{totalQuestionsCount}</strong> Questions
          </div>

          <div className="student-bottom-nav-btns flex-align-center gap-2">
            {activePartIdx > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setActivePartIdx((prev) => prev - 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                &larr; Previous Part
              </button>
            )}

            {activePartIdx < activePartsList.length - 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setActivePartIdx((prev) => prev + 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Next Part &rarr;
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => setShowSubmitModal(true)}
            >
              Submit Activity &rarr;
            </button>
          </div>
        </div>
      </main>

      {/* SUBMISSION CONFIRMATION / REVIEW MODAL */}
      {showSubmitModal && (
        <div className="modal-backdrop" onClick={() => setShowSubmitModal(false)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between align-center">
              <h3 className="modal-title-text font-bold text-dark text-lg">Confirm Final Submission</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowSubmitModal(false)}>&times;</button>
            </div>

            <div className="modal-body-content py-4">
              <p className="text-sm font-semibold text-dark mb-3">
                Are you ready to submit your responses for <strong>"{activity?.title || 'this activity'}"</strong>?
              </p>

              <div className="submission-summary-box p-4 bg-slate-50 border rounded-xl mb-4">
                <div className="flex-between py-1 border-bottom">
                  <span className="text-xs font-semibold text-muted">Total Questions:</span>
                  <span className="text-xs font-bold text-dark">{totalQuestionsCount}</span>
                </div>
                <div className="flex-between py-1 border-bottom">
                  <span className="text-xs font-semibold text-muted">Answered Questions:</span>
                  <span className="text-xs font-bold text-success">{answeredCount}</span>
                </div>
                <div className="flex-between py-1">
                  <span className="text-xs font-semibold text-muted">Unanswered Questions:</span>
                  <span className={`text-xs font-bold ${totalQuestionsCount - answeredCount > 0 ? 'text-danger' : 'text-muted'}`}>
                    {totalQuestionsCount - answeredCount}
                  </span>
                </div>
              </div>

              {totalQuestionsCount - answeredCount > 0 && (
                <div className="alert alert-warning py-2 text-xs mb-0">
                  <span>⚠️ You have {totalQuestionsCount - answeredCount} unanswered question(s). You can still submit or go back to review.</span>
                </div>
              )}
            </div>

            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
              >
                Go Back &amp; Review
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting Responses...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
