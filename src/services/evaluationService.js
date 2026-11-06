import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  normalizeActivityQuestions,
  isQuestionAnswered
} from '../utils/questionUtils.js';
import { sortNewestFirst } from '../utils/timeUtils.js';

/**
 * Normalizes the evaluation status of a submission
 * @param {object} submission 
 * @param {object} [activity] 
 * @returns {'pending'|'partially_checked'|'completed'}
 */
export const getSubmissionEvaluationStatus = (submission, activity = null) => {
  if (!submission) return 'pending';
  if (submission.evaluationStatus) return submission.evaluationStatus;
  if (submission.status === 'Checked' || submission.status === 'Graded') return 'completed';
  if (submission.status === 'Partially Checked' || submission.status === 'In Review') return 'partially_checked';

  // If questions are present, check questionGrades
  if (activity) {
    const normalized = normalizeActivityQuestions(activity);
    let targetQuestions = normalized.allQuestions;

    if (submission.selectedSectionId && normalized.isSectionBased && Array.isArray(normalized.sections)) {
      const matchedSec = normalized.sections.find((s) => String(s.id) === String(submission.selectedSectionId));
      if (matchedSec) {
        const secQs = [];
        (matchedSec.parts || []).forEach((p) => {
          (p.questions || []).forEach((q) => {
            if (q) secQs.push(q);
          });
        });
        if (secQs.length > 0) {
          targetQuestions = secQs;
        }
      }
    }

    const grades = submission.questionGrades || {};
    let evaluatedCount = 0;
    targetQuestions.forEach((q) => {
      const g = grades[q.id];
      if (g && g.marksAwarded !== undefined && g.marksAwarded !== null && g.marksAwarded !== '') {
        evaluatedCount++;
      }
    });

    if (evaluatedCount === 0) return 'pending';
    if (evaluatedCount === targetQuestions.length) return 'completed';
    return 'partially_checked';
  }

  return 'pending';
};

/**
 * Normalizes the publication status of a submission
 * @param {object} submission 
 * @returns {'published'|'unpublished'}
 */
export const getSubmissionPublicationStatus = (submission) => {
  if (!submission) return 'unpublished';
  if (submission.isPublished === true || submission.publicationStatus === 'published' || submission.resultsPublished === true) {
    return 'published';
  }
  return 'unpublished';
};

/**
 * Calculates high-level evaluation stats for an activity
 * @param {object} activity 
 * @param {Array} submissions 
 * @returns {object}
 */
export const getEvaluationStats = (activity, submissions = []) => {
  const totalSubmitted = submissions.length;
  let totalRegistered = totalSubmitted;

  if (activity?.participantLimit && !isNaN(parseInt(activity.participantLimit, 10))) {
    totalRegistered = parseInt(activity.participantLimit, 10);
  }

  let pendingEvaluations = 0;
  let partiallyChecked = 0;
  let completedEvaluations = 0;
  let publishedResults = 0;

  submissions.forEach((sub) => {
    const evalStatus = getSubmissionEvaluationStatus(sub, activity);
    const pubStatus = getSubmissionPublicationStatus(sub);

    if (pubStatus === 'published') {
      publishedResults++;
    }

    if (evalStatus === 'completed') {
      completedEvaluations++;
    } else if (evalStatus === 'partially_checked') {
      partiallyChecked++;
    } else {
      pendingEvaluations++;
    }
  });

  return {
    totalRegistered: Math.max(totalRegistered, totalSubmitted),
    totalSubmitted,
    pendingEvaluations,
    partiallyChecked,
    completedEvaluations,
    publishedResults
  };
};

/**
 * Validates individual question marks against limits & rules
 * @param {number|string} rawMarks 
 * @param {object} question 
 * @param {object} activity 
 * @returns {{ valid: boolean, error?: string, numericMarks?: number }}
 */
export const validateQuestionMarks = (rawMarks, question, activity = {}) => {
  if (rawMarks === '' || rawMarks === null || rawMarks === undefined) {
    return { valid: true, numericMarks: null }; // Pending / not entered
  }

  const num = parseFloat(rawMarks);
  if (isNaN(num)) {
    return { valid: false, error: 'Marks must be a valid number.' };
  }

  const maxM = question.marks ? parseFloat(question.marks) : 0;
  const isNegEnabled = !!activity.enableNegativeMarking;
  const defaultNeg = parseFloat(activity.negativeMarkValue || '0.25') || 0;
  const qNeg = question.negativeMark !== undefined ? parseFloat(question.negativeMark) : defaultNeg;
  const minAllowed = isNegEnabled ? -qNeg : 0;

  if (num > maxM) {
    return { valid: false, error: `Awarded marks cannot exceed maximum marks (${maxM}).` };
  }

  if (num < minAllowed) {
    return { valid: false, error: `Awarded marks cannot be less than ${minAllowed}.` };
  }

  return { valid: true, numericMarks: num };
};

/**
 * Calculates complete question-wise, part-wise, section-wise, and overall evaluation
 * @param {object} activity 
 * @param {object} submission 
 * @param {object} currentGrades { [qId]: { marksAwarded, feedback, isManuallyOverridden } }
 * @returns {object}
 */
export const calculateSubmissionEvaluation = (activity, submission, currentGrades = {}) => {
  const isAutoGradeEnabled = activity?.autoGradeMCQ !== false;
  const isNegativeMarking = !!activity?.enableNegativeMarking;
  const defaultNeg = parseFloat(activity?.negativeMarkValue || '0.25') || 0;

  const normalized = normalizeActivityQuestions(activity);
  const answersMap = submission.answers || {};

  const evaluatedQuestionsMap = {};
  let totalMaxMarks = 0;
  let totalObtainedMarks = 0;
  let evaluatedCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let partialCount = 0;
  let unansweredCount = 0;

  const partScores = {};
  const sectionScores = {};

  normalized.allQuestions.forEach((q) => {
    const maxM = q.marks ? parseFloat(q.marks) : 0;
    totalMaxMarks += maxM;

    const answered = isQuestionAnswered(q, answersMap);
    if (!answered) {
      unansweredCount++;
    }

    const currentGrade = currentGrades[q.id] || submission.questionGrades?.[q.id] || {};
    const hasManualEntry = currentGrade.marksAwarded !== undefined &&
      currentGrade.marksAwarded !== null &&
      currentGrade.marksAwarded !== '';

    let awarded;
    let evalStatus;
    let isAutoGraded = false;
    let feedback = currentGrade.feedback || '';

    // A. AUTO-GRADE ENABLED for MCQ
    if (isAutoGradeEnabled && q.type === 'mcq') {
      if (hasManualEntry && currentGrade.isManuallyOverridden) {
        // Evaluator manually overrode the auto-grade
        awarded = parseFloat(currentGrade.marksAwarded);
        evalStatus = 'evaluated';
        isAutoGraded = false;
        evaluatedCount++;
      } else {
        // Automatic MCQ calculation
        isAutoGraded = true;
        evalStatus = 'evaluated';
        evaluatedCount++;

        const studentAns = answersMap[q.id];
        const correctIndices = q.correctIndices || (q.correctOptionIndex !== undefined ? [q.correctOptionIndex] : [0]);

        if (!answered) {
          awarded = 0;
          if (!feedback) feedback = 'Unanswered';
        } else {
          const isCorrect = Array.isArray(studentAns)
            ? [...studentAns].sort().join(',') === [...correctIndices].sort().join(',')
            : correctIndices.includes(Number(studentAns));

          if (isCorrect) {
            awarded = maxM;
            if (!feedback) feedback = 'Correct Answer';
          } else {
            const negVal = q.negativeMark !== undefined && q.negativeMark !== null ? parseFloat(q.negativeMark) : defaultNeg;
            const penalty = isNegativeMarking ? negVal : 0;
            awarded = -penalty;
            if (!feedback) feedback = isNegativeMarking ? `Incorrect Answer (-${penalty} marks)` : 'Incorrect Answer';
          }
        }
      }
    } else {
      // B. MANUAL EVALUATION REQUIRED (Written, Upload, or MCQ with Auto-Grade disabled)
      if (hasManualEntry) {
        awarded = parseFloat(currentGrade.marksAwarded);
        evalStatus = 'evaluated';
        evaluatedCount++;
      } else {
        // Pending evaluation
        evalStatus = 'pending';
        awarded = null;
      }
    }

    // Tally marks if evaluated
    if (evalStatus === 'evaluated' && awarded !== null) {
      totalObtainedMarks += awarded;

      if (awarded === maxM && maxM > 0) {
        correctCount++;
      } else if (awarded > 0 && awarded < maxM) {
        partialCount++;
      } else if (awarded <= 0 && answered) {
        incorrectCount++;
      }
    }

    evaluatedQuestionsMap[q.id] = {
      questionId: q.id,
      marksAwarded: awarded !== null ? awarded : '',
      numericAwarded: awarded,
      maxMarks: maxM,
      feedback,
      evalStatus,
      isAutoGraded,
      isAnswered: answered,
      evaluatedAt: currentGrade.evaluatedAt || new Date().toISOString()
    };
  });

  // Calculate Part-wise and Section-wise scores
  if (normalized.isSectionBased && Array.isArray(normalized.sections)) {
    normalized.sections.forEach((sec) => {
      let secMax = 0;
      let secObtained = 0;

      (sec.parts || []).forEach((part) => {
        let partMax = 0;
        let partObtained = 0;

        (part.questions || []).forEach((q) => {
          const qEval = evaluatedQuestionsMap[q.id];
          if (qEval) {
            partMax += qEval.maxMarks;
            if (qEval.numericAwarded !== null) {
              partObtained += qEval.numericAwarded;
            }
          }
        });

        partScores[part.id] = {
          title: part.title || 'Part',
          maxMarks: partMax,
          obtainedMarks: partObtained
        };

        secMax += partMax;
        secObtained += partObtained;
      });

      sectionScores[sec.id] = {
        title: sec.title || sec.name || 'Section',
        maxMarks: secMax,
        obtainedMarks: secObtained
      };
    });
  } else if (Array.isArray(normalized.parts)) {
    normalized.parts.forEach((part) => {
      let partMax = 0;
      let partObtained = 0;

      (part.questions || []).forEach((q) => {
        const qEval = evaluatedQuestionsMap[q.id];
        if (qEval) {
          partMax += qEval.maxMarks;
          if (qEval.numericAwarded !== null) {
            partObtained += qEval.numericAwarded;
          }
        }
      });

      partScores[part.id] = {
        title: part.title || 'Part',
        maxMarks: partMax,
        obtainedMarks: partObtained
      };
    });
  }

  // If the submission is associated with a specific Section / Group, scope overall marks to that section
  let finalTotalMaxMarks = totalMaxMarks;
  let finalTotalObtained = totalObtainedMarks;
  let finalTotalQuestions = normalized.allQuestions.length;
  let finalEvaluatedCount = evaluatedCount;
  let finalCorrectCount = correctCount;
  let finalIncorrectCount = incorrectCount;
  let finalPartialCount = partialCount;
  let finalUnansweredCount = unansweredCount;

  if (submission.selectedSectionId && normalized.isSectionBased && Array.isArray(normalized.sections)) {
    const matchedSec = normalized.sections.find((s) => String(s.id) === String(submission.selectedSectionId));
    if (matchedSec) {
      const secQIds = new Set();
      (matchedSec.parts || []).forEach((p) => {
        (p.questions || []).forEach((q) => {
          if (q) secQIds.add(q.id);
        });
      });

      if (secQIds.size > 0) {
        finalTotalQuestions = secQIds.size;
        finalTotalMaxMarks = matchedSec.totalMarks
          ? parseFloat(matchedSec.totalMarks)
          : (sectionScores[matchedSec.id]?.maxMarks || 0);
        finalTotalObtained = sectionScores[matchedSec.id]?.obtainedMarks || 0;

        let evalC = 0;
        let corrC = 0;
        let incorrC = 0;
        let partC = 0;
        let unansC = 0;

        secQIds.forEach((qId) => {
          const qEval = evaluatedQuestionsMap[qId];
          if (qEval) {
            if (qEval.evalStatus === 'evaluated') evalC++;
            if (!qEval.isAnswered) unansC++;
            if (qEval.numericAwarded === qEval.maxMarks && qEval.maxMarks > 0) corrC++;
            else if (qEval.numericAwarded > 0 && qEval.numericAwarded < qEval.maxMarks) partC++;
            else if (qEval.numericAwarded <= 0 && qEval.isAnswered) incorrC++;
          }
        });

        finalEvaluatedCount = evalC;
        finalCorrectCount = corrC;
        finalIncorrectCount = incorrC;
        finalPartialCount = partC;
        finalUnansweredCount = unansC;
      }
    }
  }

  const isComplete = finalEvaluatedCount === finalTotalQuestions && finalTotalQuestions > 0;
  const percentage = finalTotalMaxMarks > 0
    ? Math.max(0, parseFloat(((Math.max(0, finalTotalObtained) / finalTotalMaxMarks) * 100).toFixed(1)))
    : 100.0;

  return {
    totalMaxMarks: finalTotalMaxMarks,
    totalObtainedMarks: Math.max(0, finalTotalObtained),
    rawObtainedMarks: finalTotalObtained,
    percentage,
    totalQuestions: finalTotalQuestions,
    evaluatedCount: finalEvaluatedCount,
    isComplete,
    correctCount: finalCorrectCount,
    incorrectCount: finalIncorrectCount,
    partialCount: finalPartialCount,
    unansweredCount: finalUnansweredCount,
    partScores,
    sectionScores,
    questionGrades: evaluatedQuestionsMap
  };
};

/**
 * Saves evaluation progress (draft or complete) and maintains audit history
 * @param {string} submissionId 
 * @param {object} params
 * @returns {Promise<object>} Updated submission
 */
export const saveEvaluation = async (submissionId, {
  activity,
  submission,
  grades,
  overallRemark = '',
  isPublishing = false,
  evaluator = {}
}) => {
  if (!submissionId) throw new Error("Submission ID is required");

  const now = new Date().toISOString();
  const evaluationResult = calculateSubmissionEvaluation(activity, submission, grades);

  if (isPublishing && !evaluationResult.isComplete) {
    const pendingQuestions = evaluationResult.totalQuestions - evaluationResult.evaluatedCount;
    throw new Error(`Cannot publish result: ${pendingQuestions} question(s) are still pending evaluation.`);
  }

  const previousScore = submission.score;
  const previousStatus = submission.evaluationStatus || 'pending';
  const newEvalStatus = evaluationResult.isComplete ? 'completed' : (evaluationResult.evaluatedCount > 0 ? 'partially_checked' : 'pending');

  // Prepare questionGrades to persist
  const persistentQuestionGrades = {};
  Object.entries(evaluationResult.questionGrades).forEach(([qId, qData]) => {
    persistentQuestionGrades[qId] = {
      marksAwarded: qData.marksAwarded,
      maxMarks: qData.maxMarks,
      feedback: qData.feedback || '',
      isAutoGraded: qData.isAutoGraded || false,
      evalStatus: qData.evalStatus,
      evaluatedAt: qData.evaluatedAt || now,
      evaluatorUid: evaluator.uid || submission.adminUid || ''
    };
  });

  // Build audit record (Phase 8)
  const auditAction = isPublishing
    ? (submission.isPublished ? 'republished_with_updates' : 'result_published')
    : (evaluationResult.isComplete ? 'evaluation_completed' : 'evaluation_draft_saved');

  const auditEntry = {
    auditId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: now,
    evaluatorUid: evaluator.uid || submission.adminUid || '',
    evaluatorName: evaluator.name || evaluator.fullName || evaluator.email || 'Admin',
    action: auditAction,
    previousScore: previousScore !== undefined ? previousScore : null,
    newScore: evaluationResult.totalObtainedMarks,
    previousStatus,
    newStatus: newEvalStatus,
    isPublished: isPublishing ? true : Boolean(submission.isPublished)
  };

  const existingHistory = Array.isArray(submission.evaluationHistory) ? submission.evaluationHistory : [];
  const updatedHistory = [...existingHistory, auditEntry];

  const updatedPayload = {
    ...submission,
    submissionId,
    activityId: activity.activityId || submission.activityId,
    adminUid: activity.adminUid || submission.adminUid,
    questionGrades: persistentQuestionGrades,
    overallRemark: overallRemark || submission.overallRemark || '',
    score: evaluationResult.totalObtainedMarks,
    rawScore: evaluationResult.rawObtainedMarks,
    totalMarks: evaluationResult.totalMaxMarks,
    percentage: evaluationResult.percentage,
    partScores: evaluationResult.partScores,
    sectionScores: evaluationResult.sectionScores,
    correctAnswers: evaluationResult.correctCount,
    incorrectAnswers: evaluationResult.incorrectCount,
    partialAnswers: evaluationResult.partialCount,
    unansweredQuestions: evaluationResult.unansweredCount,
    evaluationStatus: newEvalStatus,
    status: evaluationResult.isComplete ? 'Checked' : 'Partially Checked',
    isPublished: isPublishing ? true : Boolean(submission.isPublished),
    publicationStatus: isPublishing ? 'published' : (submission.isPublished ? 'published' : 'unpublished'),
    publishedAt: isPublishing ? (submission.publishedAt || now) : submission.publishedAt || null,
    publishedBy: isPublishing ? (evaluator.name || evaluator.fullName || evaluator.email || 'Admin') : submission.publishedBy || null,
    lastEvaluatedAt: now,
    lastEvaluatedBy: evaluator.name || evaluator.fullName || evaluator.email || 'Admin',
    evaluationHistory: updatedHistory
  };

  // 1. Cache to local storage
  try {
    localStorage.setItem(`quizora_sub_${submissionId}`, JSON.stringify(updatedPayload));
  } catch {
    // Ignore quota issues
  }

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, 'submissions', submissionId);
    await setDoc(docRef, updatedPayload, { merge: true });
    if (import.meta.env.DEV) {
      console.log(`[Task Grade Evaluation] Successfully persisted submission ${submissionId}. Status: ${newEvalStatus}, Published: ${updatedPayload.isPublished}`);
    }
  } catch (err) {
    console.error("Firestore saveEvaluation error:", err);
    throw new Error(`Failed to save evaluation to Firestore: ${err.message}`, { cause: err });
  }

  return updatedPayload;
};

/**
 * Unpublishes a submission result
 * @param {string} submissionId 
 * @param {object} evaluator 
 * @returns {Promise<object>}
 */
export const unpublishSubmissionResult = async (submissionId, evaluator = {}) => {
  if (!submissionId) throw new Error("Submission ID is required");

  let submission = null;
  try {
    const raw = localStorage.getItem(`quizora_sub_${submissionId}`);
    if (raw) submission = JSON.parse(raw);
  } catch {
    // Ignore
  }

  const now = new Date().toISOString();
  const auditEntry = {
    auditId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: now,
    evaluatorUid: evaluator.uid || '',
    evaluatorName: evaluator.name || evaluator.fullName || evaluator.email || 'Admin',
    action: 'result_unpublished',
    isPublished: false
  };

  const existingHistory = Array.isArray(submission?.evaluationHistory) ? submission.evaluationHistory : [];
  const updatedHistory = [...existingHistory, auditEntry];

  const updatedPayload = {
    ...(submission || {}),
    submissionId,
    isPublished: false,
    publicationStatus: 'unpublished',
    unpublishedAt: now,
    evaluationHistory: updatedHistory
  };

  try {
    localStorage.setItem(`quizora_sub_${submissionId}`, JSON.stringify(updatedPayload));
  } catch {
    // Ignore
  }

  try {
    const docRef = doc(db, 'submissions', submissionId);
    await setDoc(docRef, updatedPayload, { merge: true });
  } catch (err) {
    console.error("Firestore unpublish error:", err);
    throw err;
  }

  return updatedPayload;
};

/**
 * Fetches all student submissions for a specific participant user
 * @param {string} userUid 
 * @param {string} [email] 
 * @returns {Promise<Array>}
 */
export const getStudentHistorySubmissions = async (userUid) => {
  if (!userUid) return [];

  const submissionMap = new Map();

  // 1. Query Firestore for genuine submissions strictly belonging to authenticated userUid
  try {
    const q = query(collection(db, 'submissions'), where('userUid', '==', userUid));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.activityId) {
        submissionMap.set(docSnap.id, {
          ...data,
          submissionId: docSnap.id
        });
      }
    });
  } catch (err) {
    console.warn("Firestore getStudentHistorySubmissions notice:", err.message);
  }

  // 2. Check local storage cache strictly for this userUid
  const localKeys = Object.keys(localStorage).filter((k) => k.startsWith('quizora_sub_'));
  localKeys.forEach((key) => {
    try {
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      if (item && item.userUid === userUid && item.activityId && item.submissionId) {
        if (!submissionMap.has(item.submissionId)) {
          submissionMap.set(item.submissionId, item);
        }
      }
    } catch {
      // Ignore
    }
  });

  return sortNewestFirst(Array.from(submissionMap.values()));
};
