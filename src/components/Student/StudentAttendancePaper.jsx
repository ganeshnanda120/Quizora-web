import { useState, useEffect, useMemo, useCallback } from 'react';
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
  const enableNegativeMarking = !!activity?.enableNegativeMarking;

  // Sections and parts data
  const sections = useMemo(() => activity?.sections || [], [activity]);
  const rawParts = useMemo(() => activity?.parts || [], [activity]);

  // Session storage key
  const cacheKey = `quizora_active_session_${activityId}`;

  // Read saved session state from localStorage
  const savedState = useMemo(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore parse error
    }
    return null;
  }, [cacheKey]);

  // Navigation indices
  const [activeSecIdx, setActiveSecIdx] = useState(() => savedState?.activeSecIdx || 0);
  const [activePartIdx, setActivePartIdx] = useState(() => savedState?.activePartIdx || 0);
  const [activeQIdx, setActiveQIdx] = useState(() => savedState?.activeQIdx || 0);

  // Answers Map: { [questionId]: value }
  const [answers, setAnswers] = useState(() => savedState?.answers || {});

  // Visited questions tracking: { [questionId]: true }
  const [visitedQuestions, setVisitedQuestions] = useState(() => savedState?.visitedQuestions || {});

  // Completed parts tracking: { [`${secIdx}_${partIdx}`]: true }
  const [completedParts, setCompletedParts] = useState(() => savedState?.completedParts || {});

  // Calculate Total Duration Seconds
  const totalDurationSec = useMemo(() => {
    const dur = activity?.duration;
    if (typeof dur === 'number' && dur > 0) return dur * 60;
    if (typeof dur === 'string' && !isNaN(Number(dur)) && Number(dur) > 0) return Number(dur) * 60;
    if (dur && typeof dur === 'object') {
      const total = ((Number(dur.hours) || 0) * 3600) + ((Number(dur.minutes) || 0) * 60) + (Number(dur.seconds) || 0);
      if (total > 0) return total;
    }
    if (activity?.durationMinutes && Number(activity.durationMinutes) > 0) {
      return Number(activity.durationMinutes) * 60;
    }
    return 45 * 60; // 45 mins default
  }, [activity]);

  // Session start time tracking for accurate timer
  const [sessionStartTime] = useState(() => {
    const now = Date.now();
    if (savedState?.sessionStartTime) {
      const elapsed = Math.floor((now - savedState.sessionStartTime) / 1000);
      if (elapsed < (totalDurationSec || 2700)) {
        return savedState.sessionStartTime;
      }
    }
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        ...(savedState || {}),
        sessionStartTime: now
      }));
    } catch {
      // Ignore
    }
    return now;
  });

  // Current timestamp for live calculations
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Uploading state
  const [uploadingQId, setUploadingQId] = useState(null);
  const [uploadError, setUploadError] = useState('');

  // Modals & Screen States
  const [showPartTransitionModal, setShowPartTransitionModal] = useState(false);
  const [showUnansweredWarningModal, setShowUnansweredWarningModal] = useState(false);
  const [pendingNextPartIdx, setPendingNextPartIdx] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Submitted parts tracking (specifically for individualTime mode where submitted parts cannot be edited)
  const [submittedParts, setSubmittedParts] = useState(() => savedState?.submittedParts || {});

  // Determine active section and parts list
  const activeSection = partMode === 'sections' ? (sections[activeSecIdx] || sections[0]) : null;
  const activePartsList = partMode === 'sections' ? (activeSection?.parts || []) : rawParts;
  const activePart = activePartsList[activePartIdx] || activePartsList[0] || { questions: [] };
  const activeQuestions = activePart?.questions || [];
  const currentQuestion = activeQuestions[activeQIdx] || activeQuestions[0];

  // Part navigation mode ('sequential' | 'free' | 'individualTime')
  const partNavMode = useMemo(() => {
    if (partMode === 'sections' && activeSection?.partNavigationMode) {
      return activeSection.partNavigationMode;
    }
    return activity?.partNavigationMode || 'sequential';
  }, [partMode, activeSection, activity]);

  const isMultiPart = activePartsList.length > 1 || (partMode === 'sections' && sections.length > 1);

  // Total questions list across all parts
  const allQuestionsList = useMemo(() => {
    const list = [];
    if (partMode === 'sections') {
      sections.forEach((sec, sI) => {
        (sec.parts || []).forEach((p, pI) => {
          (p.questions || []).forEach((q) => {
            list.push({ ...q, secIdx: sI, partIdx: pI, partTitle: p.title || `Part ${pI + 1}`, secName: sec.name || `Section ${sI + 1}` });
          });
        });
      });
    } else {
      rawParts.forEach((p, pI) => {
        (p.questions || []).forEach((q) => {
          list.push({ ...q, partIdx: pI, partTitle: p.title || `Part ${pI + 1}` });
        });
      });
    }
    return list;
  }, [partMode, sections, rawParts]);

  // Auto-expire handler
  const handleAutoExpireSubmit = useCallback(async () => {
    try {
      if (onSubmit) {
        await onSubmit(answers, true);
      }
    } catch (err) {
      console.warn("Auto-submit error:", err);
    }
    if (onExpire) {
      onExpire();
    }
  }, [answers, onSubmit, onExpire]);

  // Calculate Global Seconds Remaining (monotonic against real clock)
  const globalSecondsRemaining = useMemo(() => {
    if (activity?.endTime) {
      const endMs = new Date(activity.endTime).getTime();
      return Math.max(0, Math.floor((endMs - currentTime) / 1000));
    }
    if (totalDurationSec !== null) {
      const elapsed = Math.floor((currentTime - sessionStartTime) / 1000);
      return Math.max(0, totalDurationSec - elapsed);
    }
    return null;
  }, [activity?.endTime, totalDurationSec, currentTime, sessionStartTime]);

  // Individual Part Time Remaining calculation
  const partSecondsRemaining = useMemo(() => {
    if (partNavMode !== 'individualTime' || !activePart) return null;
    if (activePart.individualEndTime) {
      const endMs = new Date(activePart.individualEndTime).getTime();
      return Math.max(0, Math.floor((endMs - currentTime) / 1000));
    }
    return null;
  }, [partNavMode, activePart, currentTime]);

  // Tick clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      // Check global time expiration
      if (activity?.endTime) {
        const endMs = new Date(activity.endTime).getTime();
        if (now >= endMs) {
          clearInterval(interval);
          handleAutoExpireSubmit();
        }
      } else if (totalDurationSec !== null) {
        const elapsed = Math.floor((now - sessionStartTime) / 1000);
        if (elapsed >= totalDurationSec) {
          clearInterval(interval);
          handleAutoExpireSubmit();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activity?.endTime, totalDurationSec, sessionStartTime, handleAutoExpireSubmit]);

  // Format seconds as MM:SS or HH:MM:SS
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

  // Mark current question as visited
  useEffect(() => {
    if (currentQuestion?.id) {
      setVisitedQuestions((prev) => {
        if (prev[currentQuestion.id]) return prev;
        return { ...prev, [currentQuestion.id]: true };
      });
    }
  }, [currentQuestion?.id]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        activityId,
        participantData,
        answers,
        visitedQuestions,
        completedParts,
        submittedParts,
        sessionStartTime,
        activeSecIdx,
        activePartIdx,
        activeQIdx,
        updatedAt: new Date().toISOString()
      }));
    } catch {
      // Ignore quota
    }
  }, [cacheKey, activityId, participantData, answers, visitedQuestions, completedParts, submittedParts, sessionStartTime, activeSecIdx, activePartIdx, activeQIdx]);

  // Check if a question is answered
  const isQuestionAnswered = useCallback((questionId) => {
    const val = answers[questionId];
    const files = answers[`${questionId}_files`];
    const notes = answers[`${questionId}_notes`];
    if (files && Array.isArray(files) && files.length > 0) return true;
    if (notes && typeof notes === 'string' && notes.trim() !== '') return true;
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }, [answers]);

  // Count answered questions in active part
  const activePartAnsweredCount = useMemo(() => {
    return activeQuestions.filter((q) => isQuestionAnswered(q.id)).length;
  }, [activeQuestions, isQuestionAnswered]);

  // Total answered questions across all parts
  const totalAnsweredCount = useMemo(() => {
    return allQuestionsList.filter((q) => isQuestionAnswered(q.id)).length;
  }, [allQuestionsList, isQuestionAnswered]);

  // Check if a Part has started (for individualTime mode)
  const isPartStarted = useCallback((pIdx, sIdx = activeSecIdx) => {
    if (partNavMode !== 'individualTime') return true;
    const targetList = partMode === 'sections' ? (sections[sIdx]?.parts || []) : rawParts;
    const targetPart = targetList[pIdx];
    if (!targetPart?.individualStartTime) return true;
    const startMs = new Date(targetPart.individualStartTime).getTime();
    return currentTime >= startMs;
  }, [partNavMode, partMode, sections, rawParts, activeSecIdx, currentTime]);

  // Check if a Part is submitted/locked in individualTime mode
  const isPartSubmitted = useCallback((pIdx, sIdx = activeSecIdx) => {
    const key = `${sIdx}_${pIdx}`;
    return !!submittedParts[key];
  }, [activeSecIdx, submittedParts]);

  // Check if a Part is unlocked
  const isPartUnlocked = useCallback((pIdx, sIdx = activeSecIdx) => {
    // 1. If admin selected "Allow user to move to next part before completing previous" ('free'), NEVER lock parts!
    if (partNavMode === 'free') return true;

    // 2. If in individual time mode:
    if (partNavMode === 'individualTime') {
      if (isPartSubmitted(pIdx, sIdx)) return true;
      return isPartStarted(pIdx, sIdx);
    }

    // 3. Sequential mode: First part is always accessible
    if (pIdx === 0) return true;

    // In 'sequential' mode, unlocked only if previous part completed
    const prevKey = `${sIdx}_${pIdx - 1}`;
    return !!completedParts[prevKey];
  }, [partNavMode, isPartSubmitted, isPartStarted, completedParts]);

  // Check if a Part is completed
  const isPartCompleted = useCallback((pIdx, sIdx = activeSecIdx) => {
    const key = `${sIdx}_${pIdx}`;
    return !!completedParts[key] || !!submittedParts[key];
  }, [activeSecIdx, completedParts, submittedParts]);

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

  const handleFileUpload = async (keyOrQuestionId, file) => {
    if (!file) return;
    setUploadError('');
    setUploadingQId(keyOrQuestionId);

    try {
      const uploadedFile = await uploadStudentAnswerFile(activityId, file);
      if (uploadedFile) {
        setAnswers((prev) => {
          const currentList = Array.isArray(prev[keyOrQuestionId]) ? [...prev[keyOrQuestionId]] : [];
          return {
            ...prev,
            [keyOrQuestionId]: [...currentList, uploadedFile]
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

  const handleRemoveUploadedFile = (keyOrQuestionId, fileId) => {
    setAnswers((prev) => {
      const currentList = Array.isArray(prev[keyOrQuestionId]) ? [...prev[keyOrQuestionId]] : [];
      const updated = currentList.filter((f) => f.id !== fileId);
      return {
        ...prev,
        [keyOrQuestionId]: updated
      };
    });
  };

  const handleClearAnswer = (questionId) => {
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[questionId];
      delete copy[`${questionId}_files`];
      delete copy[`${questionId}_notes`];
      return copy;
    });
  };

  // Switch Active Part safely
  const handleSelectPart = (targetPartIdx, targetSecIdx = activeSecIdx) => {
    if (!isPartUnlocked(targetPartIdx, targetSecIdx)) return;
    setActiveSecIdx(targetSecIdx);
    setActivePartIdx(targetPartIdx);
    setActiveQIdx(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Advance to Next Question
  const handleNextQuestion = () => {
    if (activeQIdx < activeQuestions.length - 1) {
      setActiveQIdx((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleCompletePartAction();
    }
  };

  // Go to Previous Question
  const handlePrevQuestion = () => {
    if (activeQIdx > 0) {
      setActiveQIdx((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (partNavMode === 'free' && activePartIdx > 0 && isPartUnlocked(activePartIdx - 1)) {
      const prevPart = activePartsList[activePartIdx - 1];
      setActivePartIdx((prev) => prev - 1);
      setActiveQIdx(Math.max(0, (prevPart?.questions?.length || 1) - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Complete Part / Advance to Next Part Action
  const handleCompletePartAction = () => {
    const unansweredInPart = activeQuestions.length - activePartAnsweredCount;
    const hasNextPart = activePartIdx < activePartsList.length - 1;
    const hasNextSec = partMode === 'sections' && activeSecIdx < sections.length - 1;

    if (unansweredInPart > 0) {
      setPendingNextPartIdx(hasNextPart ? activePartIdx + 1 : (hasNextSec ? 0 : null));
      setShowUnansweredWarningModal(true);
      return;
    }

    markPartCompletedAndAdvance();
  };

  const markPartCompletedAndAdvance = () => {
    const key = `${activeSecIdx}_${activePartIdx}`;
    setCompletedParts((prev) => ({ ...prev, [key]: true }));
    if (partNavMode === 'individualTime') {
      setSubmittedParts((prev) => ({ ...prev, [key]: true }));
    }
    setShowUnansweredWarningModal(false);

    const hasNextPart = activePartIdx < activePartsList.length - 1;
    const hasNextSec = partMode === 'sections' && activeSecIdx < sections.length - 1;

    if (hasNextPart) {
      if (partNavMode === 'sequential') {
        setShowPartTransitionModal(true);
      } else {
        setActivePartIdx((prev) => prev + 1);
        setActiveQIdx(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (hasNextSec) {
      if (partNavMode === 'sequential') {
        setShowPartTransitionModal(true);
      } else {
        setActiveSecIdx((prev) => prev + 1);
        setActivePartIdx(0);
        setActiveQIdx(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      setShowReviewModal(true);
    }
  };

  const handleStartNextPartFromTransition = () => {
    setShowPartTransitionModal(false);
    const hasNextPart = activePartIdx < activePartsList.length - 1;
    const hasNextSec = partMode === 'sections' && activeSecIdx < sections.length - 1;

    if (hasNextPart) {
      setActivePartIdx((prev) => prev + 1);
      setActiveQIdx(0);
    } else if (hasNextSec) {
      setActiveSecIdx((prev) => prev + 1);
      setActivePartIdx(0);
      setActiveQIdx(0);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      setShowReviewModal(false);
    }
  };

  const isTimerCritical = (globalSecondsRemaining !== null && globalSecondsRemaining <= 300) || (partSecondsRemaining !== null && partSecondsRemaining <= 300);
  const activeTimerDisplay = partSecondsRemaining !== null ? partSecondsRemaining : globalSecondsRemaining;

  // Check if on last question of current part
  const isLastQuestionOfPart = activeQIdx === activeQuestions.length - 1;

  // Check if on final part of the exam
  const isFinalPart = activePartIdx === activePartsList.length - 1 && (partMode !== 'sections' || activeSecIdx === sections.length - 1);

  return (
    <div className="student-attendance-viewport fade-in">
      {/* 1. CLEAN TOP APP BAR (Logo, Activity Title, Live Timer, Answered Pill) */}
      <header className="student-sticky-appbar">
        <div className="student-appbar-inner flex-between align-center">
          {/* Left: Brand Logo & Title */}
          <div className="student-appbar-left flex-align-center gap-3">
            <img src={logoImg} alt="Quizora" className="student-appbar-logo" />
            <div className="student-appbar-title-box">
              <h1 className="student-appbar-title truncate font-bold text-dark m-0">
                {activity?.title || 'Quizora Activity'}
              </h1>
              {activity?.subject && (
                <span className="text-xs text-muted block truncate font-medium">{activity.subject}</span>
              )}
            </div>
          </div>

          {/* Right: Live Countdown Timer & Answered Count */}
          <div className="student-appbar-right flex-align-center gap-3">
            {activeTimerDisplay !== null && (
              <div className={`student-timer-pill flex-align-center gap-2 ${isTimerCritical ? 'timer-critical' : ''}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div className="timer-text-group">
                  <span className="timer-label text-xxs font-bold uppercase block">
                    {partSecondsRemaining !== null ? 'Part Time' : 'Time Left'}
                  </span>
                  <span className="timer-value font-mono font-bold text-xs sm:text-sm leading-none">
                    {formatTimer(activeTimerDisplay)}
                  </span>
                </div>
              </div>
            )}

            <div className="student-progress-pill text-xs font-semibold">
              <span className="answered-num text-primary font-bold">{totalAnsweredCount}</span>/{allQuestionsList.length} Answered
            </div>
          </div>
        </div>

        {/* MOBILE PART NAVIGATION BAR (Shown on small screens when multi-part) */}
        {isMultiPart && (
          <div className="student-part-nav-bar mobile-only-part-nav">
            <div className="student-nav-scroll-row">
              {activePartsList.map((p, pIdx) => {
                const partQs = p.questions || [];
                const partAnsCount = partQs.filter((q) => isQuestionAnswered(q.id)).length;
                const isActive = activePartIdx === pIdx;
                const isCompleted = isPartCompleted(pIdx);
                const isUnlocked = isPartUnlocked(pIdx);

                return (
                  <button
                    key={p.id || pIdx}
                    type="button"
                    className={`student-multipart-nav-pill ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isUnlocked ? 'locked' : ''}`}
                    onClick={() => isUnlocked && handleSelectPart(pIdx)}
                    disabled={!isUnlocked}
                  >
                    <span className="part-indicator-icon">
                      {isCompleted ? '✓' : (!isUnlocked && partNavMode !== 'free') ? '🔒' : isActive ? '●' : '○'}
                    </span>
                    <span className="part-pill-name">{p.title || `Part ${pIdx + 1}`}</span>
                    <span className="part-pill-count">({partAnsCount}/{partQs.length})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* 2. MAIN WORKSPACE WITH DESKTOP LEFT SIDEBAR */}
      <div className="student-workspace-layout">
        {/* DESKTOP LEFT SIDEBAR: PARTS LIST, PART INFO & QUESTION PALETTE */}
        <aside className="student-desktop-sidebar">
          {/* A. MULTI-PART NAVIGATION CARDS */}
          {isMultiPart && (
            <div className="sidebar-card mb-4 p-4 bg-white border rounded-2xl shadow-sm">
              <span className="sidebar-card-label text-xxs font-bold uppercase tracking-wider text-muted block mb-3">
                Activity Parts
              </span>
              <div className="sidebar-parts-list flex flex-col gap-2.5">
                {activePartsList.map((p, pIdx) => {
                  const partQs = p.questions || [];
                  const partAnsCount = partQs.filter((q) => isQuestionAnswered(q.id)).length;
                  const isActive = activePartIdx === pIdx;
                  const isCompleted = isPartCompleted(pIdx);
                  const isUnlocked = isPartUnlocked(pIdx);

                  return (
                    <button
                      key={p.id || pIdx}
                      type="button"
                      className={`sidebar-part-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isUnlocked ? 'locked' : ''}`}
                      onClick={() => isUnlocked && handleSelectPart(pIdx)}
                      disabled={!isUnlocked}
                      title={p.title || `Part ${pIdx + 1}`}
                    >
                      <div className="sidebar-part-btn-main">
                        <span className="part-indicator-icon">
                          {isCompleted ? '✓' : (!isUnlocked && partNavMode !== 'free') ? '🔒' : isActive ? '●' : '○'}
                        </span>
                        <span className="part-btn-title">{p.title || `Part ${pIdx + 1}`}</span>
                      </div>
                      <span className="part-btn-progress">
                        {partAnsCount}/{partQs.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* B. PART INFO CARD */}
          <div className="sidebar-card mb-4 p-4 bg-white border rounded-2xl shadow-sm">
            <span className="text-xxs font-bold uppercase tracking-wider text-primary block mb-2">
              Active Part Details
            </span>
            <h3 className="text-sm font-bold text-dark m-0 mb-2 leading-snug">
              {activePart?.title || `Part ${activePartIdx + 1}`}
            </h3>
            <div className="text-xs text-muted flex-align-center gap-2 mb-3.5 font-medium">
              <span>{activeQuestions.length} Questions</span>
              {activePart?.partTotalMarks && <span>• {activePart.partTotalMarks} Marks</span>}
            </div>
            <div className="part-progress-bar-wrap bg-slate-100 h-2.5 rounded-full overflow-hidden mb-2.5">
              <div
                className="part-progress-bar-fill bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${activeQuestions.length > 0 ? (activePartAnsweredCount / activeQuestions.length) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="flex-between align-center text-xs font-semibold text-muted">
              <span>Part Progress</span>
              <span className="text-dark font-bold">{activePartAnsweredCount}/{activeQuestions.length} Answered</span>
            </div>
          </div>

          {/* C. QUESTION PALETTE */}
          {activeQuestions.length > 0 && (
            <div className="sidebar-card p-4 bg-white border rounded-2xl shadow-sm">
              <div className="flex-between align-center mb-3">
                <span className="text-xxs font-bold uppercase tracking-wider text-muted">Question Palette</span>
              </div>

              <div className="palette-legend flex-align-center gap-3 text-xxs font-semibold text-muted mb-3.5 flex-wrap">
                <span className="flex-align-center gap-1.5"><span className="legend-dot current"></span> Current</span>
                <span className="flex-align-center gap-1.5"><span className="legend-dot answered"></span> Ans</span>
                <span className="flex-align-center gap-1.5"><span className="legend-dot visited"></span> Visited</span>
                <span className="flex-align-center gap-1.5"><span className="legend-dot unvisited"></span> New</span>
              </div>

              <div className="student-q-palette-grid">
                {activeQuestions.map((q, idx) => {
                  const isCurrent = activeQIdx === idx;
                  const isAns = isQuestionAnswered(q.id);
                  const isVis = !!visitedQuestions[q.id];

                  let stateClass = 'unvisited';
                  if (isCurrent) stateClass = 'current';
                  else if (isAns) stateClass = 'answered';
                  else if (isVis) stateClass = 'visited';

                  return (
                    <button
                      key={q.id || idx}
                      type="button"
                      className={`palette-btn ${stateClass}`}
                      onClick={() => {
                        setActiveQIdx(idx);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      title={`Question ${idx + 1}${isAns ? ' (Answered)' : isVis ? ' (Visited)' : ''}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT / MAIN CONTENT AREA */}
        <main className="student-main-content">
          {uploadError && (
            <div className="alert alert-error mb-4">
              <span>{uploadError}</span>
            </div>
          )}

          {/* MOBILE PART INFO & PALETTE (Displayed on top only on small screens) */}
          <div className="mobile-only-part-summary mb-4">
            <div className="p-4 bg-white border rounded-xl shadow-sm mb-3 flex-between align-center">
              <div>
                <span className="text-xs font-bold text-dark block">{activePart?.title || `Part ${activePartIdx + 1}`}</span>
                <span className="text-xxs text-muted">{activeQuestions.length} Questions • {activePart?.partTotalMarks || 0} Marks</span>
              </div>
              <span className="text-xs font-bold text-primary bg-indigo-50 px-2.5 py-1 rounded-md">
                {activePartAnsweredCount}/{activeQuestions.length} Answered
              </span>
            </div>

            {activeQuestions.length > 1 && (
              <div className="p-4 bg-white border rounded-xl shadow-sm">
                <div className="student-q-palette-grid">
                  {activeQuestions.map((q, idx) => {
                    const isCurrent = activeQIdx === idx;
                    const isAns = isQuestionAnswered(q.id);
                    const isVis = !!visitedQuestions[q.id];

                    let stateClass = 'unvisited';
                    if (isCurrent) stateClass = 'current';
                    else if (isAns) stateClass = 'answered';
                    else if (isVis) stateClass = 'visited';

                    return (
                      <button
                        key={q.id || idx}
                        type="button"
                        className={`palette-btn ${stateClass}`}
                        onClick={() => {
                          setActiveQIdx(idx);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* FOCUSED QUESTION CARD */}
          {partNavMode === 'individualTime' && !isPartStarted(activePartIdx) ? (
            <div className="part-locked-card p-8 bg-white border rounded-2xl text-center shadow-sm">
              <div className="lock-icon-circle mx-auto mb-3 bg-amber-50 text-amber-600 w-14 h-14 rounded-full flex-center text-2xl">
                🔒
              </div>
              <h3 className="text-lg font-bold text-dark mb-1">{activePart?.title || `Part ${activePartIdx + 1}`} is Locked</h3>
              <p className="text-sm text-muted mb-4 max-w-md mx-auto">
                This part has individual timing and will unlock at{' '}
                <strong>{activePart?.individualStartTime ? new Date(activePart.individualStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'its scheduled start time'}</strong>.
              </p>
              <div className="text-xs font-semibold text-slate-600 bg-slate-50 border rounded-lg px-4 py-2.5 inline-block">
                ⏳ Please wait for the scheduled start time or switch to an available Part.
              </div>
            </div>
          ) : partNavMode === 'individualTime' && isPartSubmitted(activePartIdx) ? (
            <div className="part-submitted-card p-8 bg-white border rounded-2xl text-center shadow-sm">
              <div className="check-icon-circle mx-auto mb-3 bg-emerald-50 text-emerald-600 w-14 h-14 rounded-full flex-center text-2xl font-bold">
                ✓
              </div>
              <h3 className="text-lg font-bold text-dark mb-1">{activePart?.title || `Part ${activePartIdx + 1}`} Submitted</h3>
              <p className="text-sm text-muted mb-0 max-w-md mx-auto">
                Your responses for this part have been submitted and locked. You can view or proceed to the next available Part.
              </p>
            </div>
          ) : !currentQuestion ? (
            <div className="empty-part-box p-8 bg-white border rounded-2xl text-center">
              <p className="text-muted font-medium m-0">No questions found in this Part.</p>
            </div>
          ) : (
            <div
              id={`q-card-${currentQuestion.id}`}
              className={`student-question-card bg-white rounded-2xl border shadow-sm transition-all ${isQuestionAnswered(currentQuestion.id) ? 'question-answered' : ''}`}
            >
              {/* Question Header: Number, Type Badge, Marks */}
              <div className="student-q-header flex-between align-center mb-5 pb-3.5 border-bottom">
                <div className="student-q-title-group flex-align-center gap-2.5">
                  <span className="student-q-num font-extrabold text-dark text-lg sm:text-xl">
                    Question {activeQIdx + 1} <span className="text-xs font-normal text-muted">of {activeQuestions.length}</span>
                  </span>
                  <span className={`badge-type-pill text-xs uppercase font-bold ${currentQuestion.type || 'mcq'}`}>
                    {currentQuestion.type === 'written' ? 'Written' : (currentQuestion.type === 'upload' || currentQuestion.type === 'upload_paper') ? 'Upload File' : 'Multiple Choice'}
                  </span>
                  {isQuestionAnswered(currentQuestion.id) && (
                    <span className="badge badge-success text-xxs font-bold">✓ Answered</span>
                  )}
                </div>

                <div className="student-q-marks-group flex-align-center gap-2">
                  {currentQuestion.marks !== null && currentQuestion.marks !== undefined && currentQuestion.marks !== '' && (
                    <span className="student-q-marks-pill font-bold text-xs bg-indigo-50 text-primary border border-indigo-100 px-3 py-1 rounded-md">
                      {currentQuestion.marks} {Number(currentQuestion.marks) === 1 ? 'Mark' : 'Marks'}
                    </span>
                  )}
                  {currentQuestion.type === 'mcq' && enableNegativeMarking && (
                    <span className="student-q-neg-marks-pill font-bold text-xs bg-red-50 text-danger border border-red-100 px-3 py-1 rounded-md">
                      -{currentQuestion.negativeMark || activity?.negativeMarkValue || '0.25'} Neg
                    </span>
                  )}
                </div>
              </div>

              {/* Question Prompt */}
              {currentQuestion.questionText && (
                <div className="student-q-prompt mb-5">
                  <p className="student-q-text font-medium text-base sm:text-lg text-dark leading-relaxed m-0">
                    {currentQuestion.questionText}
                  </p>
                </div>
              )}

              {/* Attached Media / Diagrams (Images or PDFs) */}
              {((currentQuestion.attachedFiles && currentQuestion.attachedFiles.length > 0) || currentQuestion.imageUrl || currentQuestion.paperFileUrl) && (
                <div className="student-q-attachments-grid mb-5">
                  {(currentQuestion.attachedFiles || []).map((fileItem, fIdx) => (
                    <div key={fileItem.id || fIdx} className="student-attachment-card mb-3">
                      {fileItem.type === 'image' || (!fileItem.type && fileItem.url?.match(/\.(jpg|jpeg|png|webp)/i)) ? (
                        <div className="attachment-image-wrapper p-2 bg-slate-50 border rounded-xl">
                          <img
                            src={fileItem.url}
                            alt={fileItem.name || 'Question attachment'}
                            className="attachment-img max-h-80 object-contain rounded-lg border cursor-pointer hover:opacity-95"
                            onClick={() => window.open(fileItem.url, '_blank')}
                          />
                          <span className="click-to-expand-hint text-xxs text-muted block mt-1.5 font-medium">
                            ↗ Click image to view full size
                          </span>
                        </div>
                      ) : (
                        <div className="attachment-pdf-row flex-between align-center p-3.5 bg-slate-50 border rounded-xl">
                          <div className="flex-align-center gap-2.5">
                            <span className="pdf-icon-badge text-xs font-bold bg-danger text-white px-2.5 py-1 rounded">PDF</span>
                            <span className="text-sm font-semibold text-dark truncate max-w-xs">{fileItem.name || 'Question Document'}</span>
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

                  {/* Legacy Attachment Fallback */}
                  {(!currentQuestion.attachedFiles || currentQuestion.attachedFiles.length === 0) && (currentQuestion.imageUrl || currentQuestion.paperFileUrl) && (
                    <div className="student-attachment-card mb-3">
                      {currentQuestion.imageUrl ? (
                        <div className="attachment-image-wrapper p-2 bg-slate-50 border rounded-xl">
                          <img
                            src={currentQuestion.imageUrl}
                            alt="Question illustration"
                            className="attachment-img max-h-80 object-contain rounded-lg border cursor-pointer hover:opacity-95"
                            onClick={() => window.open(currentQuestion.imageUrl, '_blank')}
                          />
                          <span className="click-to-expand-hint text-xxs text-muted block mt-1.5 font-medium">
                            ↗ Click image to view full size
                          </span>
                        </div>
                      ) : (
                        <div className="attachment-pdf-row flex-between align-center p-3.5 bg-slate-50 border rounded-xl">
                          <div className="flex-align-center gap-2.5">
                            <span className="pdf-icon-badge text-xs font-bold bg-danger text-white px-2.5 py-1 rounded">PDF</span>
                            <span className="text-sm font-semibold text-dark">{currentQuestion.paperFileName || 'Question Paper'}</span>
                          </div>
                          <a
                            href={currentQuestion.paperFileUrl}
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

              {/* Instructions / Description / Guidelines Box */}
              {(currentQuestion.answerGuidelines || currentQuestion.description || currentQuestion.explanation) && (
                <div className="student-guidelines-box mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="guidelines-header flex-align-center gap-2 mb-1.5 text-slate-600">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span className="guidelines-title font-bold text-xs uppercase tracking-wider">
                      Instructions &amp; Description
                    </span>
                  </div>
                  <p className="guidelines-content text-sm text-dark m-0 leading-relaxed">
                    {currentQuestion.answerGuidelines || currentQuestion.description || currentQuestion.explanation}
                  </p>
                </div>
              )}

              {/* 1. MCQ OPTIONS RENDERER */}
              {(currentQuestion.type === 'mcq' || !currentQuestion.type) && (
                <div className="student-mcq-options-container mt-4">
                  <div className="student-mcq-options-grid flex flex-col gap-3">
                    {(currentQuestion.options || []).map((opt, optIdx) => {
                      const optLetter = String.fromCharCode(65 + optIdx);
                      const isMulti = !!currentQuestion.allowMultipleChoices;
                      const val = answers[currentQuestion.id];
                      const isSelected = isMulti
                        ? Array.isArray(val) && val.includes(optIdx)
                        : val === optIdx;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          className={`student-mcq-option-btn flex-align-center gap-3.5 p-4 border-2 rounded-xl text-left transition-all ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleMcqSelect(currentQuestion.id, optIdx, isMulti)}
                        >
                          <span className={`option-letter-circle font-bold text-sm ${isSelected ? 'selected' : ''}`}>
                            {optLetter}
                          </span>
                          <span className="option-text text-sm sm:text-base font-medium text-dark flex-1 leading-snug">
                            {typeof opt === 'string' ? opt : opt?.text || `Option ${optIdx + 1}`}
                          </span>
                          <div className={`option-selection-indicator ${isSelected ? 'checked' : ''}`}>
                            {isMulti ? (
                              <span className="checkbox-indicator">{isSelected ? '✓' : ''}</span>
                            ) : (
                              <span className="radio-indicator">{isSelected ? '●' : ''}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {isQuestionAnswered(currentQuestion.id) && (
                    <div className="q-clear-row mt-3.5 text-right">
                      <button
                        type="button"
                        className="btn-clear-selection text-xs text-muted hover:text-danger font-semibold"
                        onClick={() => handleClearAnswer(currentQuestion.id)}
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. WRITTEN ANSWER TEXTAREA + OPTIONAL FILE UPLOAD */}
              {currentQuestion.type === 'written' && (
                <div className="student-written-input-container mt-4">
                  <label className="form-label font-semibold text-sm mb-2.5 block" htmlFor={`written-ans-${currentQuestion.id}`}>
                    Your Written Response:
                  </label>
                  <textarea
                    id={`written-ans-${currentQuestion.id}`}
                    className="form-input text-area student-written-textarea w-full p-4 border-2 rounded-xl text-base"
                    rows="7"
                    placeholder="Type your complete response here..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleWrittenChange(currentQuestion.id, e.target.value)}
                  />
                  <div className="written-textarea-footer flex-between align-center mt-2.5 text-xs text-muted font-medium">
                    <div></div>
                    {isQuestionAnswered(currentQuestion.id) && (
                      <button
                        type="button"
                        className="btn-clear-selection text-xs text-muted hover:text-danger font-semibold"
                        onClick={() => handleClearAnswer(currentQuestion.id)}
                      >
                        Clear Answer
                      </button>
                    )}
                  </div>

                  {/* USER-SIDE UPLOAD OPTION FOR WRITTEN QUESTION */}
                  <div className="student-written-attachment-section mt-4 pt-3 border-top">
                    <div className="flex-between align-center mb-2">
                      <label className="form-label font-semibold text-xs text-slate-700 m-0">
                        Attach Handwritten Paper / Photo Scan:
                      </label>
                      <div>
                        <input
                          type="file"
                          id={`written-file-input-${currentQuestion.id}`}
                          className="hidden-file-input"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(`${currentQuestion.id}_files`, f);
                            e.target.value = '';
                          }}
                          disabled={uploadingQId === `${currentQuestion.id}_files`}
                        />
                        <label
                          htmlFor={`written-file-input-${currentQuestion.id}`}
                          className="btn btn-secondary btn-sm font-semibold cursor-pointer inline-flex align-center gap-1.5 py-1 px-3 m-0"
                        >
                          {uploadingQId === `${currentQuestion.id}_files` ? 'Uploading...' : '📁 Upload'}
                        </label>
                      </div>
                    </div>

                    {Array.isArray(answers[`${currentQuestion.id}_files`]) && answers[`${currentQuestion.id}_files`].length > 0 && (
                      <div className="uploaded-answers-list mt-2 flex flex-col gap-2">
                        {answers[`${currentQuestion.id}_files`].map((fileObj) => (
                          <div key={fileObj.id} className="uploaded-answer-card flex-between align-center p-2.5 bg-slate-50 border rounded-xl shadow-sm">
                            <div className="flex-align-center gap-2">
                              <span className={`text-xxs font-bold px-2 py-0.5 rounded text-white ${fileObj.type === 'image' ? 'bg-indigo-600' : 'bg-red-600'}`}>
                                {fileObj.type === 'image' ? 'IMG' : 'PDF'}
                              </span>
                              <a href={fileObj.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline truncate max-w-xs">
                                {fileObj.name || 'Attached Answer File'} ↗
                              </a>
                            </div>
                            <button
                              type="button"
                              className="btn-delete-uploaded text-xs text-danger hover:text-red-800 font-bold px-2 py-0.5 rounded"
                              onClick={() => handleRemoveUploadedFile(`${currentQuestion.id}_files`, fileObj.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. UPLOAD FILES ANSWER AREA */}
              {(currentQuestion.type === 'upload' || currentQuestion.type === 'upload_paper') && (
                <div className="student-upload-input-container mt-4">
                  <div className="flex-between align-center mb-3">
                    <label className="form-label font-semibold text-sm text-slate-800 m-0">
                      Upload Answer Document / Photo:
                    </label>
                    <div>
                      <input
                        type="file"
                        id={`file-input-${currentQuestion.id}`}
                        className="hidden-file-input"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(currentQuestion.id, f);
                          e.target.value = '';
                        }}
                        disabled={uploadingQId === currentQuestion.id}
                      />
                      <label
                        htmlFor={`file-input-${currentQuestion.id}`}
                        className="btn btn-primary btn-sm font-semibold cursor-pointer inline-flex align-center gap-1.5 py-1.5 px-4 m-0"
                      >
                        {uploadingQId === currentQuestion.id ? 'Uploading...' : '📁 Upload'}
                      </label>
                    </div>
                  </div>

                  {Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].length > 0 && (
                    <div className="uploaded-answers-list mt-4 flex flex-col gap-2.5">
                      {answers[currentQuestion.id].map((fileObj) => (
                        <div key={fileObj.id} className="uploaded-answer-card flex-between align-center p-3.5 bg-white border rounded-xl shadow-sm">
                          <div className="flex-align-center gap-3">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded text-white ${fileObj.type === 'image' ? 'bg-indigo-600' : 'bg-red-600'}`}>
                              {fileObj.type === 'image' ? 'IMG' : 'PDF'}
                            </span>
                            <a
                              href={fileObj.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-semibold text-primary hover:underline truncate max-w-xs"
                            >
                              {fileObj.name || 'Answer File'} ↗
                            </a>
                          </div>
                          <button
                            type="button"
                            className="btn-delete-uploaded text-xs text-danger hover:text-red-800 font-bold px-2.5 py-1 rounded"
                            onClick={() => handleRemoveUploadedFile(currentQuestion.id, fileObj.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* DESCRIPTION / NOTES BOX FOR UPLOAD */}
                  <div className="student-upload-notes-box mt-4 pt-3">
                    <label className="form-label font-semibold text-xs text-muted mb-1.5 block" htmlFor={`upload-notes-${currentQuestion.id}`}>
                      Description / Notes for your submission:
                    </label>
                    <textarea
                      id={`upload-notes-${currentQuestion.id}`}
                      className="form-input text-area w-full p-3 border rounded-xl text-sm"
                      rows="3"
                      placeholder="Add any additional notes or details about your uploaded solution..."
                      value={answers[`${currentQuestion.id}_notes`] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [`${currentQuestion.id}_notes`]: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. BOTTOM NAVIGATION ACTIONS (Top: Question progress; Below: Previous & Next / Save & Move / Submit) */}
          <div className="student-bottom-actions-container mt-7 bg-white border rounded-2xl p-4 sm:p-5 shadow-sm">
            {/* Top Row: Question progress in this Part */}
            <div className="student-bottom-counter-row text-center mb-3 pb-3 border-bottom">
              <span className="font-bold text-xs sm:text-sm text-slate-700">
                Question {activeQIdx + 1} of {activeQuestions.length} in this Part
              </span>
            </div>

            {/* Bottom Row: Previous and Next / Save & Move buttons */}
            <div className="student-bottom-btns-row flex-between align-center flex-wrap gap-3">
              {/* Left: Previous Button (HIDDEN on Question 1) */}
              <div className="student-bottom-btn-left">
                {activeQIdx > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-md font-semibold"
                    onClick={handlePrevQuestion}
                  >
                    &larr; Previous Question
                  </button>
                )}
              </div>

              {/* Right: Next / Save & Move / Submit Button */}
              <div className="student-bottom-btn-right ml-auto">
                {!isLastQuestionOfPart ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-md font-bold"
                    onClick={handleNextQuestion}
                  >
                    Next Question &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-md font-bold"
                    onClick={handleCompletePartAction}
                  >
                    {!isMultiPart
                      ? 'Submit Activity →'
                      : partNavMode === 'individualTime'
                        ? (isFinalPart ? 'Submit Part & Review Activity →' : 'Submit This Part →')
                        : (isFinalPart ? 'Review & Submit Activity →' : 'Save & Move to Next Part →')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* UNANSWERED WARNING MODAL */}
      {showUnansweredWarningModal && (
        <div className="modal-backdrop" onClick={() => setShowUnansweredWarningModal(false)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between align-center">
              <h3 className="modal-title-text font-bold text-dark text-base sm:text-lg">Unanswered Questions in this Part</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowUnansweredWarningModal(false)}>&times;</button>
            </div>

            <div className="modal-body-content py-4">
              <div className="alert alert-warning mb-3">
                <span>⚠️ You have <strong>{activeQuestions.length - activePartAnsweredCount} unanswered question(s)</strong> in {activePart?.title || `Part ${activePartIdx + 1}`}.</span>
              </div>
              <p className="text-sm text-dark mb-0 leading-normal">
                Would you like to stay and review your unanswered questions, or save this Part and proceed?
              </p>
            </div>

            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowUnansweredWarningModal(false)}
              >
                Stay &amp; Review Questions
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm font-bold"
                onClick={markPartCompletedAndAdvance}
              >
                Save &amp; Continue &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PART TRANSITION MODAL */}
      {showPartTransitionModal && (
        <div className="modal-backdrop" onClick={() => setShowPartTransitionModal(false)}>
          <div className="modal-card small-modal text-center" onClick={(e) => e.stopPropagation()}>
            <div className="part-completed-check-icon mx-auto mb-3">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <h3 className="text-xl font-extrabold text-dark mb-1">
              {activePart?.title || `Part ${activePartIdx + 1}`} Completed ✓
            </h3>
            <p className="text-sm text-muted mb-5">
              Great job! You have completed this Part and are ready to move on.
            </p>

            <div className="transition-next-part-box p-4 bg-slate-50 border rounded-xl mb-5 text-left">
              <span className="text-xxs font-bold uppercase tracking-wider text-primary block mb-1">Next Up</span>
              <h4 className="text-base font-bold text-dark m-0">
                {activePartsList[activePartIdx + 1]?.title || `Part ${activePartIdx + 2}`}
              </h4>
              <span className="text-xs text-muted">
                {activePartsList[activePartIdx + 1]?.questions?.length || 0} Questions
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-primary btn-lg w-full font-bold"
                onClick={handleStartNextPartFromTransition}
              >
                Start Next Part &rarr;
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPartTransitionModal(false)}
              >
                Review Current Part
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINAL REVIEW MODAL */}
      {showReviewModal && (
        <div className="modal-backdrop" onClick={() => setShowReviewModal(false)}>
          <div className="modal-card review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between align-center">
              <div>
                <h3 className="modal-title-text font-extrabold text-dark text-lg sm:text-xl m-0">Review Your Attempt</h3>
                <span className="text-xs text-muted">{activity?.title}</span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowReviewModal(false)}>&times;</button>
            </div>

            <div className="modal-body-content py-4">
              <div className="review-overall-summary-card p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl mb-4 flex-between align-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary block">Overall Completion</span>
                  <div className="text-xl font-extrabold text-dark">
                    {totalAnsweredCount} <span className="text-sm font-semibold text-muted">/ {allQuestionsList.length} Questions Answered</span>
                  </div>
                </div>
                <div className="overall-percent-badge text-base font-black text-primary px-3 py-1.5 bg-white rounded-lg border shadow-sm">
                  {allQuestionsList.length > 0 ? Math.round((totalAnsweredCount / allQuestionsList.length) * 100) : 0}%
                </div>
              </div>

              <div className="review-parts-breakdown flex flex-col gap-3 mb-4">
                {rawParts.map((p, pI) => {
                  const partQs = p.questions || [];
                  const pAns = partQs.filter((q) => isQuestionAnswered(q.id)).length;
                  const pUnans = partQs.length - pAns;

                  return (
                    <div key={p.id || pI} className="flex-between align-center p-3.5 bg-slate-50 rounded-xl border">
                      <div>
                        <span className="text-sm font-bold text-dark block">{p.title || `Part ${pI + 1}`}</span>
                        <span className="text-xs text-muted">
                          {pAns === partQs.length ? (
                            <strong className="text-success">✓ {pAns}/{partQs.length} answered</strong>
                          ) : (
                            <span>✓ {pAns}/{partQs.length} answered {pUnans > 0 && <span className="text-danger ml-1">({pUnans} unanswered)</span>}</span>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm text-xs py-1.5 px-3.5"
                        onClick={() => {
                          setShowReviewModal(false);
                          handleSelectPart(pI);
                        }}
                      >
                        Review &rarr;
                      </button>
                    </div>
                  );
                })}
              </div>

              {allQuestionsList.length - totalAnsweredCount > 0 && (
                <div className="alert alert-warning py-2.5 text-xs mb-0">
                  <span>⚠️ You have {allQuestionsList.length - totalAnsweredCount} unanswered question(s) remaining. You can still submit or go back to complete them.</span>
                </div>
              )}
            </div>

            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
              >
                Go Back &amp; Review
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm font-bold"
                onClick={handleConfirmSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting Final Answer...' : 'Submit Final Answer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
