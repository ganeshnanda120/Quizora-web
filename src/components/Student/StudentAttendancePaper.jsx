import { useState, useEffect, useMemo, useCallback } from 'react';
import { uploadStudentAnswerFile } from '../../services/submissionService';
import { getSynchronizedTime, parseActivityTime } from '../../services/timeSyncService';
import { normalizeActivityQuestions } from '../../utils/questionUtils';
import logoImg from '../../assets/logo.png';

export default function StudentAttendancePaper({
  activity,
  activityId,
  participantData,
  onSubmit,
  onExpire
}) {
  const enableNegativeMarking = !!activity?.enableNegativeMarking;

  // Universal Single Source of Truth Question Normalizer
  const normalizedData = useMemo(() => normalizeActivityQuestions(activity), [activity]);
  const {
    isSectionBased,
    sections,
    parts: normalizedParts,
    allQuestions: allQuestionsList
  } = normalizedData;

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

  // Raw Navigation indices from state
  const [activeSecIdx, setActiveSecIdx] = useState(() => savedState?.activeSecIdx || 0);
  const [activePartIdx, setActivePartIdx] = useState(() => savedState?.activePartIdx || 0);
  const [activeQIdx, setActiveQIdx] = useState(() => savedState?.activeQIdx || 0);

  // Safe bounds indices
  const safeSecIdx = useMemo(() => {
    if (!isSectionBased || !sections || sections.length === 0) return 0;
    return Math.min(Math.max(0, activeSecIdx), sections.length - 1);
  }, [isSectionBased, sections, activeSecIdx]);

  const activeSection = useMemo(() => {
    if (isSectionBased && sections.length > 0) {
      return sections[safeSecIdx] || sections[0];
    }
    return null;
  }, [isSectionBased, sections, safeSecIdx]);

  const activePartsList = useMemo(() => {
    if (isSectionBased && activeSection?.parts && activeSection.parts.length > 0) {
      return activeSection.parts;
    }
    return normalizedParts;
  }, [isSectionBased, activeSection, normalizedParts]);

  const safePartIdx = useMemo(() => {
    if (!activePartsList || activePartsList.length === 0) return 0;
    return Math.min(Math.max(0, activePartIdx), activePartsList.length - 1);
  }, [activePartsList, activePartIdx]);

  const activePart = useMemo(() => {
    return activePartsList[safePartIdx] || activePartsList[0] || { id: 'part_1', title: 'Part 1', questions: [] };
  }, [activePartsList, safePartIdx]);

  const activeQuestions = useMemo(() => {
    return activePart?.questions || [];
  }, [activePart]);

  const safeQIdx = useMemo(() => {
    if (!activeQuestions || activeQuestions.length === 0) return 0;
    return Math.min(Math.max(0, activeQIdx), activeQuestions.length - 1);
  }, [activeQIdx, activeQuestions]);

  const currentQuestion = activeQuestions[safeQIdx] || activeQuestions[0];

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
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Submitted parts tracking (specifically for individualTime mode where submitted parts cannot be edited)
  const [submittedParts, setSubmittedParts] = useState(() => savedState?.submittedParts || {});

  // Part navigation mode ('sequential' | 'free' | 'individualTime')
  const partNavMode = useMemo(() => {
    if (isSectionBased && activeSection?.partNavigationMode) {
      return activeSection.partNavigationMode;
    }
    return activity?.partNavigationMode || 'sequential';
  }, [isSectionBased, activeSection, activity]);

  const isMultiPart = activePartsList.length > 1 || (isSectionBased && sections.length > 1);

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

  const activityEndTimeMs = useMemo(() => {
    if (!activity) return null;
    return activity.endTimeMs || parseActivityTime(activity.endTime, activity);
  }, [activity]);

  // Calculate Global Seconds Remaining (monotonic against real synchronized clock)
  const globalSecondsRemaining = useMemo(() => {
    if (activityEndTimeMs) {
      return Math.max(0, Math.floor((activityEndTimeMs - currentTime) / 1000));
    }
    if (totalDurationSec !== null) {
      const elapsed = Math.floor((currentTime - sessionStartTime) / 1000);
      return Math.max(0, totalDurationSec - elapsed);
    }
    return null;
  }, [activityEndTimeMs, totalDurationSec, currentTime, sessionStartTime]);

  // Individual Part Time Remaining calculation
  const partSecondsRemaining = useMemo(() => {
    if (partNavMode !== 'individualTime' || !activePart) return null;
    const partEndMs = activePart.individualEndTimeMs || parseActivityTime(activePart.individualEndTime, activity);
    if (partEndMs) {
      return Math.max(0, Math.floor((partEndMs - currentTime) / 1000));
    }
    return null;
  }, [partNavMode, activePart, activity, currentTime]);

  // Tick clock every second with synchronized timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      const now = getSynchronizedTime();
      setCurrentTime(now);

      // Check global time expiration
      if (activityEndTimeMs) {
        if (now >= activityEndTimeMs) {
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
  }, [activityEndTimeMs, totalDurationSec, sessionStartTime, handleAutoExpireSubmit]);

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
      const timer = setTimeout(() => {
        setVisitedQuestions((prev) => {
          if (prev[currentQuestion.id]) return prev;
          return { ...prev, [currentQuestion.id]: true };
        });
      }, 0);
      return () => clearTimeout(timer);
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
    const targetList = isSectionBased ? (sections[sIdx]?.parts || []) : normalizedParts;
    const targetPart = targetList[pIdx];
    if (!targetPart?.individualStartTime) return true;
    const startMs = targetPart.individualStartTimeMs || parseActivityTime(targetPart.individualStartTime, activity);
    return currentTime >= startMs;
  }, [partNavMode, isSectionBased, sections, normalizedParts, activeSecIdx, currentTime, activity]);

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
  }, [partNavMode, isPartSubmitted, isPartStarted, completedParts, activeSecIdx]);

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

  // Switch Active Section safely
  const handleSelectSection = (targetSecIdx) => {
    setActiveSecIdx(targetSecIdx);
    setActivePartIdx(0);
    setActiveQIdx(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switch Active Part safely
  const handleSelectPart = (targetPartIdx, targetSecIdx = safeSecIdx) => {
    if (!isPartUnlocked(targetPartIdx, targetSecIdx)) return;
    setActiveSecIdx(targetSecIdx);
    setActivePartIdx(targetPartIdx);
    setActiveQIdx(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Advance to Next Question
  const handleNextQuestion = () => {
    if (safeQIdx < activeQuestions.length - 1) {
      setActiveQIdx((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleCompletePartAction();
    }
  };

  // Go to Previous Question
  const handlePrevQuestion = () => {
    if (safeQIdx > 0) {
      setActiveQIdx((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (partNavMode === 'free' && safePartIdx > 0 && isPartUnlocked(safePartIdx - 1)) {
      const prevPart = activePartsList[safePartIdx - 1];
      setActivePartIdx((prev) => prev - 1);
      setActiveQIdx(Math.max(0, (prevPart?.questions?.length || 1) - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Complete Part / Advance to Next Part Action
  const handleCompletePartAction = () => {
    const unansweredInPart = activeQuestions.length - activePartAnsweredCount;

    if (unansweredInPart > 0) {
      setShowUnansweredWarningModal(true);
      return;
    }

    markPartCompletedAndAdvance();
  };

  const markPartCompletedAndAdvance = () => {
    const key = `${safeSecIdx}_${safePartIdx}`;
    setCompletedParts((prev) => ({ ...prev, [key]: true }));
    if (partNavMode === 'individualTime') {
      setSubmittedParts((prev) => ({ ...prev, [key]: true }));
    }
    setShowUnansweredWarningModal(false);

    const hasNextPart = safePartIdx < activePartsList.length - 1;
    const hasNextSec = isSectionBased && safeSecIdx < sections.length - 1;

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
    const hasNextPart = safePartIdx < activePartsList.length - 1;
    const hasNextSec = isSectionBased && safeSecIdx < sections.length - 1;

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
  const isLastQuestionOfPart = safeQIdx === activeQuestions.length - 1;

  // Check if on final part of the activity
  const isFinalPart = safePartIdx === activePartsList.length - 1 && (!isSectionBased || safeSecIdx === sections.length - 1);

  // Next part metadata for transition modal
  const nextPartInfo = useMemo(() => {
    const hasNextPart = safePartIdx < activePartsList.length - 1;
    if (hasNextPart) {
      const nextP = activePartsList[safePartIdx + 1];
      return {
        title: nextP?.title || `Part ${safePartIdx + 2}`,
        questionCount: nextP?.questions?.length || 0,
        sectionName: activeSection?.name || ''
      };
    }
    const hasNextSec = isSectionBased && safeSecIdx < sections.length - 1;
    if (hasNextSec) {
      const nextSec = sections[safeSecIdx + 1];
      const nextP = (nextSec?.parts || [])[0];
      return {
        title: `${nextSec?.name || `Section ${safeSecIdx + 2}`} - ${nextP?.title || 'Part 1'}`,
        questionCount: nextP?.questions?.length || 0,
        sectionName: nextSec?.name || ''
      };
    }
    return null;
  }, [safePartIdx, activePartsList, isSectionBased, safeSecIdx, sections, activeSection]);

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

        {/* SECTION NAVIGATION BAR (When 2+ Sections configured) */}
        {isSectionBased && sections.length > 1 && (
          <div className="student-section-nav-row">
            <span className="text-xxs font-bold uppercase tracking-wider text-muted mr-1">Section:</span>
            {sections.map((sec, sIdx) => {
              const isSecActive = safeSecIdx === sIdx;
              const secQuestions = (sec.parts || []).reduce((acc, p) => acc + (p.questions?.length || 0), 0);
              const secAnswered = (sec.parts || []).reduce((acc, p) => {
                return acc + (p.questions || []).filter((q) => isQuestionAnswered(q.id)).length;
              }, 0);

              return (
                <button
                  key={sec.id || sIdx}
                  type="button"
                  className={`section-nav-pill ${isSecActive ? 'active' : ''}`}
                  onClick={() => handleSelectSection(sIdx)}
                >
                  <span className="section-nav-name font-bold">{sec.name || `Section ${sIdx + 1}`}</span>
                  <span className="section-nav-counts text-xs">({secAnswered}/{secQuestions})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* MOBILE PART NAVIGATION BAR (Shown on small screens when multi-part) */}
        {isMultiPart && (
          <div className="student-part-nav-bar mobile-only-part-nav">
            <div className="student-nav-scroll-row">
              {activePartsList.map((p, pIdx) => {
                const partQs = p.questions || [];
                const partAnsCount = partQs.filter((q) => isQuestionAnswered(q.id)).length;
                const isActive = safePartIdx === pIdx;
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
        {/* DESKTOP LEFT SIDEBAR: SECTIONS, PARTS LIST, PART INFO & QUESTION PALETTE */}
        <aside className="student-desktop-sidebar">
          {/* A1. SECTIONS CARD (When 2+ Sections) */}
          {isSectionBased && sections.length > 1 && (
            <div className="sidebar-card mb-4 p-4 bg-white border rounded-2xl shadow-sm">
              <span className="sidebar-card-label text-xxs font-bold uppercase tracking-wider text-muted block mb-2.5">
                Sections / Groups
              </span>
              <div className="sidebar-sections-list flex flex-col gap-2">
                {sections.map((sec, sIdx) => {
                  const isSecActive = safeSecIdx === sIdx;
                  const secQuestions = (sec.parts || []).reduce((acc, p) => acc + (p.questions?.length || 0), 0);
                  const secAnswered = (sec.parts || []).reduce((acc, p) => {
                    return acc + (p.questions || []).filter((q) => isQuestionAnswered(q.id)).length;
                  }, 0);

                  return (
                    <button
                      key={sec.id || sIdx}
                      type="button"
                      className={`sidebar-part-btn ${isSecActive ? 'active' : ''}`}
                      onClick={() => handleSelectSection(sIdx)}
                    >
                      <div className="sidebar-part-btn-main">
                        <span className="part-indicator-icon">{isSecActive ? '●' : '○'}</span>
                        <span className="part-btn-title">{sec.name || `Section ${sIdx + 1}`}</span>
                      </div>
                      <span className="part-btn-progress">{secAnswered}/{secQuestions}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* A2. MULTI-PART NAVIGATION CARDS */}
          {isMultiPart && (
            <div className="sidebar-card mb-4 p-4 bg-white border rounded-2xl shadow-sm">
              <span className="sidebar-card-label text-xxs font-bold uppercase tracking-wider text-muted block mb-3">
                {isSectionBased ? `${activeSection?.name || 'Section'} Parts` : 'Activity Parts'}
              </span>
              <div className="sidebar-parts-list flex flex-col gap-2.5">
                {activePartsList.map((p, pIdx) => {
                  const partQs = p.questions || [];
                  const partAnsCount = partQs.filter((q) => isQuestionAnswered(q.id)).length;
                  const isActive = safePartIdx === pIdx;
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
              {activePart?.title || `Part ${safePartIdx + 1}`}
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
                  const isCurrent = safeQIdx === idx;
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
                <span className="text-xs font-bold text-dark block">{activePart?.title || `Part ${safePartIdx + 1}`}</span>
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
                    const isCurrent = safeQIdx === idx;
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
          {partNavMode === 'individualTime' && !isPartStarted(safePartIdx) ? (
            <div className="part-locked-card p-8 bg-white border rounded-2xl text-center shadow-sm">
              <div className="lock-icon-circle mx-auto mb-3 bg-amber-50 text-amber-600 w-14 h-14 rounded-full flex-center text-2xl">
                🔒
              </div>
              <h3 className="text-lg font-bold text-dark mb-1">{activePart?.title || `Part ${safePartIdx + 1}`} is Locked</h3>
              <p className="text-sm text-muted mb-4 max-w-md mx-auto">
                This part has individual timing and will unlock at{' '}
                <strong>{activePart?.individualStartTime ? new Date(activePart.individualStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'its scheduled start time'}</strong>.
              </p>
              <div className="text-xs font-semibold text-slate-600 bg-slate-50 border rounded-lg px-4 py-2.5 inline-block">
                ⏳ Please wait for the scheduled start time or switch to an available Part.
              </div>
            </div>
          ) : partNavMode === 'individualTime' && isPartSubmitted(safePartIdx) ? (
            <div className="part-submitted-card p-8 bg-white border rounded-2xl text-center shadow-sm">
              <div className="check-icon-circle mx-auto mb-3 bg-emerald-50 text-emerald-600 w-14 h-14 rounded-full flex-center text-2xl font-bold">
                ✓
              </div>
              <h3 className="text-lg font-bold text-dark mb-1">{activePart?.title || `Part ${safePartIdx + 1}`} Submitted</h3>
              <p className="text-sm text-muted mb-0 max-w-md mx-auto">
                Your responses for this part have been submitted and locked. You can view or proceed to the next available Part.
              </p>
            </div>
          ) : !currentQuestion || activeQuestions.length === 0 ? (
            <div className="empty-part-box p-8 bg-white border rounded-2xl text-center shadow-sm">
              <div className="empty-icon-box mx-auto mb-3" style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-dark mb-1">No Questions in this Part</h3>
              <p className="text-muted font-medium text-sm mb-4">No questions have been configured for {activePart?.title || 'this part'} yet.</p>
              {activePartsList.length > 1 && (
                <div className="flex-center gap-2 flex-wrap">
                  {activePartsList.map((p, pIdx) => (
                    pIdx !== safePartIdx && (
                      <button
                        key={p.id || pIdx}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSelectPart(pIdx)}
                      >
                        Switch to {p.title || `Part ${pIdx + 1}`} ({(p.questions || []).length} Qs)
                      </button>
                    )
                  ))}
                </div>
              )}
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
                    Question {safeQIdx + 1} <span className="text-xs font-normal text-muted">of {activeQuestions.length}</span>
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
              {(currentQuestion.questionText || currentQuestion.type === 'upload' || currentQuestion.type === 'upload_paper') && (
                <div className="student-q-prompt mb-5">
                  <p className="student-q-text font-medium text-base sm:text-lg text-dark leading-relaxed m-0">
                    {currentQuestion.questionText || (
                      currentQuestion.fileName || currentQuestion.paperFileName
                        ? `Question Document: ${currentQuestion.fileName || currentQuestion.paperFileName}`
                        : 'Please review the attached question document below and submit your answers.'
                    )}
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
                        <div
                          key={optIdx}
                          className={`student-option-card flex-align-center gap-3.5 p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'option-selected' : 'option-default'}`}
                          onClick={() => handleMcqSelect(currentQuestion.id, optIdx, isMulti)}
                        >
                          <div className={`option-selector-circle flex-center font-bold text-xs rounded-full border ${isSelected ? 'selector-selected' : 'selector-default'}`}>
                            {isSelected ? '✓' : optLetter}
                          </div>
                          <span className="option-label-text font-semibold text-sm text-dark flex-1">
                            {opt}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {answers[currentQuestion.id] !== undefined && (
                    <div className="mt-3 flex-end">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-muted"
                        onClick={() => handleClearAnswer(currentQuestion.id)}
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. WRITTEN QUESTION RENDERER */}
              {currentQuestion.type === 'written' && (
                <div className="student-written-answer-container mt-4">
                  <div className="form-group mb-0">
                    <label className="form-label font-bold text-sm text-dark mb-2 block">
                      Type Your Answer:
                    </label>
                    <textarea
                      rows="6"
                      className="form-input written-textarea p-3.5 text-sm leading-relaxed"
                      placeholder="Type your response here clearly..."
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleWrittenChange(currentQuestion.id, e.target.value)}
                    ></textarea>
                  </div>
                </div>
              )}

              {/* 3. UPLOAD QUESTION RENDERER */}
              {(currentQuestion.type === 'upload' || currentQuestion.type === 'upload_paper') && (
                <div className="student-upload-answer-container mt-4">
                  <div className="upload-instructions mb-3 text-xs text-muted">
                    <span>Upload your answer sheet (Photos of written paper or PDF document). Maximum 15MB per file.</span>
                  </div>

                  <div className="upload-dropzone border-dashed border-2 p-6 rounded-xl text-center bg-slate-50">
                    <input
                      type="file"
                      id={`file_input_${currentQuestion.id}`}
                      className="hidden-file-input"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(currentQuestion.id, file);
                        e.target.value = '';
                      }}
                      disabled={uploadingQId === currentQuestion.id}
                    />
                    <label
                      htmlFor={`file_input_${currentQuestion.id}`}
                      className="btn btn-secondary btn-sm cursor-pointer inline-flex items-center gap-2"
                    >
                      {uploadingQId === currentQuestion.id ? (
                        <>
                          <div className="spinner-xs"></div>
                          <span>Uploading File...</span>
                        </>
                      ) : (
                        <>
                          <span>📁 Choose File / Photo to Upload</span>
                        </>
                      )}
                    </label>
                  </div>

                  {/* Uploaded Files List */}
                  {Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].length > 0 && (
                    <div className="uploaded-files-list mt-3 flex flex-col gap-2">
                      {answers[currentQuestion.id].map((fileObj, fIdx) => (
                        <div key={fileObj.id || fIdx} className="uploaded-file-row flex-between align-center p-3 bg-white border rounded-xl shadow-xs">
                          <div className="flex-align-center gap-2.5">
                            <span className="file-icon-badge text-xs font-bold bg-primary text-white px-2 py-0.5 rounded">
                              {fileObj.type === 'image' ? 'IMG' : 'PDF'}
                            </span>
                            <span className="text-xs font-semibold text-dark truncate max-w-xs">{fileObj.name}</span>
                          </div>
                          <div className="flex-align-center gap-2">
                            <a href={fileObj.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs text-primary font-bold">
                              Preview ↗
                            </a>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-danger"
                              onClick={() => handleRemoveUploadedFile(currentQuestion.id, fileObj.id)}
                            >
                              ✕ Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Optional Notes for Upload Question */}
                  <div className="form-group mt-3 mb-0">
                    <label className="form-label text-xs font-semibold text-muted mb-1 block">
                      Optional Notes / Written Explanation:
                    </label>
                    <textarea
                      rows="3"
                      className="form-input text-xs"
                      placeholder="Add any additional notes or details about your uploaded solution..."
                      value={answers[`${currentQuestion.id}_notes`] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [`${currentQuestion.id}_notes`]: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. BOTTOM NAVIGATION ACTIONS (Only rendered when part has questions) */}
          {activeQuestions.length > 0 && (
            <div className="student-bottom-actions-container mt-7 bg-white border rounded-2xl p-4 sm:p-5 shadow-sm">
              {/* Top Row: Question progress in this Part */}
              <div className="student-bottom-counter-row text-center mb-3 pb-3 border-bottom">
                <span className="font-bold text-xs sm:text-sm text-slate-700">
                  Question {safeQIdx + 1} of {activeQuestions.length} in this Part
                </span>
              </div>

              {/* Bottom Row: Previous and Next / Save & Move buttons */}
              <div className="student-bottom-btns-row flex-between align-center flex-wrap gap-3">
                {/* Left: Previous Button (HIDDEN on Question 1) */}
                <div className="student-bottom-btn-left">
                  {safeQIdx > 0 && (
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
          )}
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
                <span>⚠️ You have <strong>{activeQuestions.length - activePartAnsweredCount} unanswered question(s)</strong> in {activePart?.title || `Part ${safePartIdx + 1}`}.</span>
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
              {activePart?.title || `Part ${safePartIdx + 1}`} Completed ✓
            </h3>
            <p className="text-sm text-muted mb-5">
              Great job! You have completed this Part and are ready to move on.
            </p>

            {nextPartInfo && (
              <div className="transition-next-part-box p-4 bg-slate-50 border rounded-xl mb-5 text-left">
                <span className="text-xxs font-bold uppercase tracking-wider text-primary block mb-1">Next Up</span>
                <h4 className="text-base font-bold text-dark m-0">
                  {nextPartInfo.title}
                </h4>
                <span className="text-xs text-muted">
                  {nextPartInfo.questionCount} Questions
                </span>
              </div>
            )}

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
                {isSectionBased ? (
                  sections.map((sec, sI) => (
                    <div key={sec.id || sI} className="mb-2">
                      <span className="text-xs font-bold text-dark uppercase block mb-1.5 tracking-wider">
                        {sec.name || `Section ${sI + 1}`}
                      </span>
                      <div className="flex flex-col gap-2">
                        {(sec.parts || []).map((p, pI) => {
                          const partQs = p.questions || [];
                          const pAns = partQs.filter((q) => isQuestionAnswered(q.id)).length;
                          const pUnans = partQs.length - pAns;

                          return (
                            <div key={p.id || pI} className="flex-between align-center p-3 bg-slate-50 rounded-xl border">
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
                                  handleSelectSection(sI);
                                  handleSelectPart(pI, sI);
                                }}
                              >
                                Review &rarr;
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  normalizedParts.map((p, pI) => {
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
                  })
                )}
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
