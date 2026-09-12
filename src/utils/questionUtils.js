/**
 * Quizora Unified Question Normalization Utility
 * 
 * Provides consistent, single-source-of-truth normalization for activity question hierarchies:
 * - Single Part
 * - Multiple Parts
 * - Sections / Groups
 * - Sections with Multiple Parts
 * - Root-level Questions
 * - Firestore Map / Object Structures
 */

/**
 * Safely converts an array, object map, or single item into an Array of items.
 * Preserves object structures and filters out null/undefined elements.
 * 
 * @param {any} val 
 * @returns {Array}
 */
export const toArraySafe = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.filter((item) => item !== null && item !== undefined);
  }
  if (typeof val === 'object') {
    // If the object itself is a single question entity (has key question properties), wrap it
    if (
      val.questionText !== undefined ||
      val.type !== undefined ||
      val.options !== undefined ||
      val.marks !== undefined ||
      val.fileName !== undefined ||
      val.paperFileName !== undefined ||
      val.answerGuidelines !== undefined
    ) {
      return [val];
    }
    // If the object itself is a single part entity (has id/title/partTotalMarks with questions)
    if (val.title !== undefined && (val.questions !== undefined || val.partTotalMarks !== undefined)) {
      return [val];
    }
    // If the object itself is a single section entity (has name and parts/questions)
    if (val.name !== undefined && (val.parts !== undefined || val.totalMarks !== undefined)) {
      return [val];
    }
    // Otherwise treat as a key-value dictionary/map of items
    return Object.values(val).filter((item) => item !== null && item !== undefined);
  }
  return [];
};

/**
 * Normalizes a single question object to ensure all required fields, types, and attachments exist.
 * 
 * @param {object} q 
 * @param {string} fallbackId 
 * @param {number} fallbackIndex 
 * @returns {object|null}
 */
export const normalizeQuestion = (q, fallbackId = 'q_1', fallbackIndex = 0) => {
  if (!q || typeof q !== 'object') return null;

  // Stable Question ID: preserve existing or assign deterministic fallback
  const stableId = q.id || q._id || q.questionId || fallbackId;

  // Normalized question type: 'mcq' | 'written' | 'upload'
  let qType = String(q.type || 'mcq').toLowerCase().trim();
  if (qType === 'upload_paper' || qType === 'uploadpaper' || qType === 'paper' || qType === 'file') {
    qType = 'upload';
  } else if (qType === 'text' || qType === 'descriptive') {
    qType = 'written';
  } else if (qType !== 'written' && qType !== 'upload') {
    qType = 'mcq';
  }

  // Marks normalization
  let rawMarks = q.marks;
  if (rawMarks === undefined || rawMarks === null || rawMarks === '') {
    rawMarks = q.mark !== undefined && q.mark !== null && q.mark !== '' ? q.mark : null;
  }
  const numericMarks = rawMarks !== null && rawMarks !== undefined && !isNaN(Number(rawMarks))
    ? Number(rawMarks)
    : null;

  // Negative marks normalization
  let rawNeg = q.negativeMark !== undefined && q.negativeMark !== null ? q.negativeMark : q.negativeMarks;
  const numericNeg = rawNeg !== null && rawNeg !== undefined && !isNaN(Number(rawNeg))
    ? Number(rawNeg)
    : null;

  // Options normalization (for MCQ)
  const rawOptions = q.options || q.choices || q.answers;
  const options = toArraySafe(rawOptions).map((opt, optIdx) => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object') return opt.text || opt.label || opt.value || `Option ${optIdx + 1}`;
    return String(opt || `Option ${optIdx + 1}`);
  });

  // Correct options/indices normalization
  let correctIndices = [];
  if (Array.isArray(q.correctIndices)) {
    correctIndices = q.correctIndices.map((n) => Number(n)).filter((n) => !isNaN(n));
  } else if (q.correctOptionIndex !== undefined && q.correctOptionIndex !== null && !isNaN(Number(q.correctOptionIndex))) {
    correctIndices = [Number(q.correctOptionIndex)];
  } else if (Array.isArray(q.correctOptions)) {
    correctIndices = q.correctOptions.map((n) => Number(n)).filter((n) => !isNaN(n));
  } else if (q.correctOption !== undefined && q.correctOption !== null && !isNaN(Number(q.correctOption))) {
    correctIndices = [Number(q.correctOption)];
  } else if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
    if (typeof q.correctAnswer === 'number') {
      correctIndices = [q.correctAnswer];
    } else if (typeof q.correctAnswer === 'string' && !isNaN(Number(q.correctAnswer))) {
      correctIndices = [Number(q.correctAnswer)];
    }
  }

  // Attached files normalization (Images / PDFs uploaded by Admin)
  const rawAttached = q.attachedFiles || q.files || q.attachments;
  let attachedFiles = toArraySafe(rawAttached).map((fItem, fIdx) => {
    if (!fItem || typeof fItem !== 'object') return null;
    return {
      id: fItem.id || `file_${fIdx + 1}`,
      url: fItem.url || fItem.downloadUrl || '',
      name: fItem.name || fItem.fileName || 'Attached File',
      type: fItem.type || (fItem.url?.match(/\.(jpg|jpeg|png|webp)/i) ? 'image' : 'pdf'),
      size: fItem.size || null,
      sizeFormatted: fItem.sizeFormatted || ''
    };
  }).filter(Boolean);

  // Fallback if legacy single file property was used
  const singleUrl = q.fileUrl || q.imageUrl || q.paperFileUrl;
  if (attachedFiles.length === 0 && singleUrl) {
    attachedFiles = [{
      id: 'file_0',
      url: singleUrl,
      name: q.fileName || q.paperFileName || 'Attached Document',
      type: q.fileType || (singleUrl.match(/\.(jpg|jpeg|png|webp)/i) ? 'image' : 'pdf'),
      size: q.size || null,
      sizeFormatted: q.sizeFormatted || ''
    }];
  }

  const primaryFile = attachedFiles[0] || null;

  return {
    ...q,
    id: String(stableId),
    index: fallbackIndex,
    type: qType,
    questionText: q.questionText || q.text || q.prompt || q.title || '',
    marks: numericMarks,
    negativeMark: numericNeg,
    options,
    correctIndices,
    allowMultipleChoices: !!q.allowMultipleChoices,
    enableExplanation: !!q.enableExplanation,
    explanation: q.explanation || q.answerGuidelines || q.description || '',
    answerRequired: q.answerRequired !== false,
    answerGuidelines: q.answerGuidelines || q.description || q.explanation || '',
    description: q.description || q.answerGuidelines || q.explanation || '',
    attachedFiles,
    fileUrl: q.fileUrl || primaryFile?.url || '',
    fileName: q.fileName || q.paperFileName || primaryFile?.name || '',
    fileType: q.fileType || primaryFile?.type || '',
    imageUrl: q.imageUrl || (primaryFile?.type === 'image' ? primaryFile.url : ''),
    paperFileUrl: q.paperFileUrl || q.fileUrl || primaryFile?.url || '',
    paperFileName: q.paperFileName || q.fileName || primaryFile?.name || ''
  };
};

/**
 * Extracts raw questions array from any container object (part, section, or activity).
 * 
 * @param {object} container 
 * @returns {Array}
 */
export const extractRawQuestionsFromContainer = (container) => {
  if (!container || typeof container !== 'object') return [];

  if (Array.isArray(container)) {
    return container;
  }

  const raw = container.questions ??
    container.questionList ??
    container.items ??
    container.questionListObj ??
    container.questionsMap ??
    container.data;

  return toArraySafe(raw);
};

/**
 * Normalizes a Part object and its enclosed questions.
 * 
 * @param {object} rawPart 
 * @param {string} fallbackId 
 * @param {string} fallbackTitle 
 * @param {number} partIndex 
 * @param {string} secPrefix 
 * @returns {object}
 */
export const normalizePart = (rawPart, fallbackId = 'part_1', fallbackTitle = 'Part 1', partIndex = 0, secPrefix = '') => {
  const p = (rawPart && typeof rawPart === 'object') ? rawPart : {};
  const partId = p.id || fallbackId;
  const partTitle = p.title || fallbackTitle;
  const prefix = secPrefix ? `${secPrefix}_p_${partIndex + 1}` : `p_${partIndex + 1}`;

  const rawQuestions = extractRawQuestionsFromContainer(p);
  const normalizedQuestions = rawQuestions.map((q, qIdx) => {
    return normalizeQuestion(q, `${prefix}_q_${qIdx + 1}`, qIdx);
  }).filter(Boolean);

  return {
    ...p,
    id: String(partId),
    title: String(partTitle),
    partTotalMarks: p.partTotalMarks !== undefined ? p.partTotalMarks : '',
    individualStartTime: p.individualStartTime || '',
    individualEndTime: p.individualEndTime || '',
    individualStartTimeMs: p.individualStartTimeMs || null,
    individualEndTimeMs: p.individualEndTimeMs || null,
    questions: normalizedQuestions
  };
};

/**
 * Normalizes a Section object and its enclosed Parts and Questions.
 * 
 * @param {object} rawSec 
 * @param {string} fallbackId 
 * @param {string} fallbackName 
 * @param {number} sIdx 
 * @returns {object}
 */
export const normalizeSection = (rawSec, fallbackId = 'sec_1', fallbackName = 'Section 1', sIdx = 0) => {
  const sec = (rawSec && typeof rawSec === 'object') ? rawSec : {};
  const secId = sec.id || fallbackId;
  const secName = sec.name || fallbackName;
  const secPrefix = `sec_${sIdx + 1}`;

  const rawParts = toArraySafe(sec.parts);
  let normalizedParts;
  if (rawParts.length > 0) {
    normalizedParts = rawParts.map((p, pIdx) => {
      return normalizePart(p, `${secPrefix}_p_${pIdx + 1}`, `Part ${pIdx + 1}`, pIdx, secPrefix);
    });
    // Check if section itself also has direct questions that aren't inside any part
    const directQuestions = extractRawQuestionsFromContainer(sec);
    const partsQuestionsCount = normalizedParts.reduce((acc, p) => acc + (p.questions?.length || 0), 0);
    if (partsQuestionsCount === 0 && directQuestions.length > 0) {
      normalizedParts[0] = normalizePart({
        ...normalizedParts[0],
        questions: directQuestions
      }, `${secPrefix}_p_1`, normalizedParts[0]?.title || 'Part 1', 0, secPrefix);
    }
  } else {
    // If section has direct questions instead of a parts array, wrap in Part 1
    const directQuestions = extractRawQuestionsFromContainer(sec);
    if (directQuestions.length > 0) {
      const p1 = normalizePart({
        id: `${secPrefix}_p_1`,
        title: 'Part 1',
        questions: directQuestions
      }, `${secPrefix}_p_1`, 'Part 1', 0, secPrefix);
      normalizedParts = [p1];
    } else {
      // Empty section skeleton
      normalizedParts = [{
        id: `${secPrefix}_p_1`,
        title: 'Part 1',
        partTotalMarks: '',
        questions: []
      }];
    }
  }

  return {
    ...sec,
    id: String(secId),
    name: String(secName),
    totalMarks: sec.totalMarks !== undefined ? sec.totalMarks : '',
    partNavigationMode: sec.partNavigationMode || 'sequential',
    isMultiPart: normalizedParts.length > 1,
    parts: normalizedParts
  };
};

/**
 * Universal Activity Questions Normalizer
 * 
 * Inspects the activity document and determines the single source of truth
 * for questions, parts, and sections. Safely handles:
 * - Empty default part skeletons (never hides real questions in sections or root)
 * - Single part / Multi-part activities
 * - Section-based activities
 * - Maps / object collections from Firestore
 * - Question deduplication and unique ID stability
 * 
 * @param {object} activity 
 * @returns {object} { isSectionBased, structureType, sections, parts, allQuestions, questionsById, totalQuestionCount }
 */
export const normalizeActivityQuestions = (activity) => {
  if (!activity || typeof activity !== 'object') {
    return {
      isSectionBased: false,
      structureType: 'empty',
      sections: [],
      parts: [{ id: 'part_1', title: 'Part 1', questions: [] }],
      allQuestions: [],
      questionsById: {},
      totalQuestionCount: 0
    };
  }

  const rawSections = toArraySafe(activity.sections);
  const rawParts = toArraySafe(activity.parts);
  const rawRootQuestions = extractRawQuestionsFromContainer(activity);

  // 1. Process Sections
  const normalizedSections = rawSections.map((sec, sIdx) => {
    return normalizeSection(sec, `sec_${sIdx + 1}`, `Section ${sIdx + 1}`, sIdx);
  });

  const sectionQuestionsCount = normalizedSections.reduce((total, sec) => {
    return total + (sec.parts || []).reduce((pTotal, p) => pTotal + (p.questions?.length || 0), 0);
  }, 0);

  // 2. Process Parts
  const normalizedParts = rawParts.map((p, pIdx) => {
    return normalizePart(p, `part_${pIdx + 1}`, `Part ${pIdx + 1}`, pIdx);
  });

  const partQuestionsCount = normalizedParts.reduce((total, p) => {
    return total + (p.questions?.length || 0), 0;
  }, 0);

  // 3. Process Root Questions
  const normalizedRootQuestions = rawRootQuestions.map((q, idx) => {
    return normalizeQuestion(q, `q_root_${idx + 1}`, idx);
  }).filter(Boolean);

  const rootQuestionsCount = normalizedRootQuestions.length;

  // 4. Decision Logic for Source of Truth
  const explicitPartMode = activity.partMode; // 'parts' | 'sections' | undefined
  let isSectionBased;
  let finalSections;
  let finalParts;
  let structureType;

  if (explicitPartMode === 'sections' && sectionQuestionsCount > 0) {
    // Explicitly section-based with questions in sections
    isSectionBased = true;
    finalSections = normalizedSections;
    structureType = 'sections';
  } else if (explicitPartMode === 'sections' && sectionQuestionsCount === 0 && partQuestionsCount > 0) {
    // Fallback to parts if sections has 0 questions but parts has real questions
    isSectionBased = false;
    finalParts = normalizedParts;
    structureType = normalizedParts.length > 1 ? 'multi_parts' : 'single_part';
  } else if (sectionQuestionsCount > 0 && partQuestionsCount === 0) {
    // CRITICAL FIX: Default empty Part skeleton in activity.parts had 0 questions,
    // but activity.sections contains the real questions!
    isSectionBased = true;
    finalSections = normalizedSections;
    structureType = 'sections';
  } else if (partQuestionsCount > 0) {
    // Direct parts have real questions
    isSectionBased = false;
    finalParts = normalizedParts;
    structureType = normalizedParts.length > 1 ? 'multi_parts' : 'single_part';
  } else if (sectionQuestionsCount > 0) {
    // Sections have questions
    isSectionBased = true;
    finalSections = normalizedSections;
    structureType = 'sections';
  } else if (rootQuestionsCount > 0) {
    // Questions stored at root level (activity.questions / questionList / items)
    isSectionBased = false;
    finalParts = [
      {
        id: (normalizedParts[0]?.id) || 'part_1',
        title: (normalizedParts[0]?.title) || 'Part 1',
        partTotalMarks: normalizedParts[0]?.partTotalMarks || '',
        questions: normalizedRootQuestions
      }
    ];
    structureType = 'direct_questions';
  } else {
    // No questions found anywhere (Empty activity)
    if (explicitPartMode === 'sections' && normalizedSections.length > 0) {
      isSectionBased = true;
      finalSections = normalizedSections;
      structureType = 'sections';
    } else if (normalizedParts.length > 0) {
      isSectionBased = false;
      finalParts = normalizedParts;
      structureType = normalizedParts.length > 1 ? 'multi_parts' : 'single_part';
    } else {
      isSectionBased = false;
      finalParts = [{ id: 'part_1', title: 'Part 1', questions: [] }];
      structureType = 'empty';
    }
  }

  // 5. Build global allQuestions list with guaranteed uniqueness and stable indexing
  const allQuestions = [];
  const questionsById = {};
  const seenIds = new Set();

  const registerQuestion = (q, fallbackId) => {
    if (!q || typeof q !== 'object') return null;
    let finalId = q.id || fallbackId;
    if (seenIds.has(finalId)) {
      finalId = `${finalId}_${allQuestions.length + 1}`;
    }
    seenIds.add(finalId);
    const updatedQ = { ...q, id: String(finalId) };
    allQuestions.push(updatedQ);
    questionsById[finalId] = updatedQ;
    return updatedQ;
  };

  if (isSectionBased) {
    finalSections = finalSections.map((sec, sIdx) => {
      const updatedParts = (sec.parts || []).map((p, pIdx) => {
        const updatedQs = (p.questions || []).map((q, qIdx) => {
          return registerQuestion(q, `sec_${sIdx + 1}_p_${pIdx + 1}_q_${qIdx + 1}`);
        }).filter(Boolean);
        return { ...p, questions: updatedQs };
      });
      return { ...sec, parts: updatedParts };
    });
  } else {
    finalParts = finalParts.map((p, pIdx) => {
      const updatedQs = (p.questions || []).map((q, qIdx) => {
        return registerQuestion(q, `p_${pIdx + 1}_q_${qIdx + 1}`);
      }).filter(Boolean);
      return { ...p, questions: updatedQs };
    });
  }

  return {
    isSectionBased,
    structureType,
    sections: finalSections,
    parts: finalParts,
    allQuestions,
    questionsById,
    totalQuestionCount: allQuestions.length
  };
};

