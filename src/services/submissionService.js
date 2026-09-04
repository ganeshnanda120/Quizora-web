import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Uploads a student answer file (e.g. photo or PDF of written work) to Firebase Storage
 * @param {string} activityId 
 * @param {File} file 
 * @returns {Promise<{ url: string, name: string, type: string, size: number }>}
 */
export const uploadStudentAnswerFile = async (activityId, file) => {
  if (!file || !activityId) return null;

  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
  const fileType = isImage ? 'image' : 'pdf';
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${Date.now()}_${cleanName}`;

  try {
    const storageRef = ref(storage, `submissions/${activityId}/answers/${filename}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      url: downloadURL,
      name: file.name,
      type: fileType,
      size: file.size
    };
  } catch (err) {
    console.warn("Storage upload notice (falling back to Data URL for student submission):", err.message);
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

    return {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      url: dataUrl,
      name: file.name,
      type: fileType,
      size: file.size
    };
  }
};

/**
 * Calculate automated MCQ scores & negative marking
 * @param {object} activity 
 * @param {object} answersMap { [questionId]: answerValue }
 * @returns {object}
 */
export const calculateMcqAutoGrades = (activity, answersMap = {}) => {
  const isAutoGrade = activity?.autoGradeMCQ !== false;
  const isNegativeMarking = !!activity?.enableNegativeMarking;
  const defaultNeg = parseFloat(activity?.negativeMarkValue || '0.25') || 0;

  const autoMcqMarks = {};
  const questionGrades = {};
  let totalMcqMax = 0;
  let totalMcqObtained = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const allQuestions = [];
  if (activity?.partMode === 'sections') {
    (activity.sections || []).forEach((sec) => {
      (sec.parts || []).forEach((p) => {
        (p.questions || []).forEach((q) => allQuestions.push(q));
      });
    });
  } else {
    (activity?.parts || []).forEach((p) => {
      (p.questions || []).forEach((q) => allQuestions.push(q));
    });
  }

  allQuestions.forEach((q) => {
    if (q.type !== 'mcq') return;

    const maxM = parseFloat(q.marks || 0);
    totalMcqMax += maxM;

    const studentAns = answersMap[q.id];
    const correctIndices = q.correctIndices || (q.correctOptionIndex !== undefined ? [q.correctOptionIndex] : [0]);

    if (studentAns === undefined || studentAns === null || studentAns === '' || (Array.isArray(studentAns) && studentAns.length === 0)) {
      unansweredCount++;
      autoMcqMarks[q.id] = 0;
      questionGrades[q.id] = {
        marksAwarded: 0,
        feedback: 'Unanswered',
        isAutoGraded: true
      };
      return;
    }

    if (!isAutoGrade) {
      // Manual grading designated by admin
      return;
    }

    // Single choice vs multiple choice matching
    let isCorrect = false;
    if (Array.isArray(studentAns)) {
      // Multiple selection
      const sortedStudent = [...studentAns].sort().join(',');
      const sortedCorrect = [...correctIndices].sort().join(',');
      isCorrect = sortedStudent === sortedCorrect;
    } else {
      // Single selection
      const numAns = Number(studentAns);
      isCorrect = correctIndices.includes(numAns);
    }

    if (isCorrect) {
      correctCount++;
      totalMcqObtained += maxM;
      autoMcqMarks[q.id] = maxM;
      questionGrades[q.id] = {
        marksAwarded: maxM,
        feedback: 'Correct Answer',
        isAutoGraded: true
      };
    } else {
      incorrectCount++;
      const negValue = q.negativeMark !== undefined && q.negativeMark !== null ? parseFloat(q.negativeMark) : defaultNeg;
      const penalty = isNegativeMarking ? negValue : 0;
      const finalMarks = -penalty;

      totalMcqObtained += finalMarks;
      autoMcqMarks[q.id] = finalMarks;
      questionGrades[q.id] = {
        marksAwarded: finalMarks,
        feedback: isNegativeMarking ? `Incorrect Answer (-${penalty} marks)` : 'Incorrect Answer',
        isAutoGraded: true
      };
    }
  });

  return {
    totalMcqMax,
    totalMcqObtained: Math.max(0, totalMcqObtained),
    correctCount,
    incorrectCount,
    unansweredCount,
    autoMcqMarks,
    questionGrades
  };
};

/**
 * Saves a student's submission to Firestore & local storage
 * @param {string} activityId 
 * @param {object} submissionPayload 
 * @returns {Promise<object>}
 */
export const submitStudentActivity = async (activityId, submissionPayload) => {
  if (!activityId) throw new Error("Activity ID is required");

  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
  const now = new Date().toISOString();

  // Calculate MCQ grades if autoGradeMCQ is on
  const mcqGrading = calculateMcqAutoGrades(submissionPayload.activity, submissionPayload.answers);

  // Check if entire activity is MCQs only
  let hasManualQuestions = false;
  const parts = submissionPayload.activity?.parts || [];
  parts.forEach((p) => {
    (p.questions || []).forEach((q) => {
      if (q.type !== 'mcq') hasManualQuestions = true;
    });
  });

  const finalPayload = {
    ...submissionPayload,
    submissionId,
    activityId,
    adminUid: submissionPayload.activity?.adminUid || '',
    submittedAt: now,
    status: hasManualQuestions ? 'Submitted' : 'Checked',
    autoMcqMarks: mcqGrading.autoMcqMarks,
    questionGrades: mcqGrading.questionGrades,
    score: mcqGrading.totalMcqObtained,
    correctAnswers: mcqGrading.correctCount,
    incorrectAnswers: mcqGrading.incorrectCount,
    unansweredQuestions: mcqGrading.unansweredCount
  };

  // Cache locally
  try {
    localStorage.setItem(`quizora_sub_${submissionId}`, JSON.stringify(finalPayload));
    // Clear active in-progress student session
    localStorage.removeItem(`quizora_active_session_${activityId}`);
  } catch {
    // Ignore quota
  }

  // Write to Firestore submissions collection
  try {
    const docRef = doc(db, 'submissions', submissionId);
    await setDoc(docRef, finalPayload);
  } catch (err) {
    console.warn("Firestore submission write notice:", err.message);
  }

  return finalPayload;
};
