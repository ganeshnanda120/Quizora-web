import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Generates a unique permanent activity ID
 */
export const generateActivityId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'qzk_';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Upload question paper (PDF/PNG/JPG) or question image to Firebase Storage at activities/{activityId}/questions/...
 * @param {string} activityId 
 * @param {File} file 
 * @returns {Promise<string>} Download URL or Data URL fallback
 */
export const uploadActivityFile = async (activityId, file) => {
  if (!file || !activityId) return null;

  try {
    const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storageRef = ref(storage, `activities/${activityId}/questions/${filename}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (err) {
    console.warn("Storage upload notice (falling back to Data URL preview):", err.message);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
};

/**
 * Save activity draft to Firestore and localStorage
 * @param {string} activityId 
 * @param {object} activityData 
 * @returns {Promise<object>} Saved payload
 */
export const saveActivityDraft = async (activityId, activityData) => {
  if (!activityId) throw new Error("Activity ID is required");

  const now = new Date().toISOString();
  const payload = {
    ...activityData,
    activityId,
    updatedAt: now,
    status: activityData.status || 'draft'
  };

  if (!payload.createdAt) {
    payload.createdAt = now;
  }

  // Cache locally
  try {
    localStorage.setItem(`quizora_activity_${activityId}`, JSON.stringify(payload));
  } catch {
    // Ignore quota issues
  }

  // Write to Firestore with permission resilience
  try {
    const docRef = doc(db, 'activities', activityId);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn("Firestore activity draft write notice:", err.message);
  }

  return payload;
};

/**
 * Finalize activity document with permanent share URL
 * @param {string} activityId 
 * @param {object} fullPayload 
 * @returns {Promise<object>} Published payload with permanent URL
 */
export const publishActivity = async (activityId, fullPayload) => {
  const origin = window.location.origin;
  const permanentUrl = `${origin}/activity/${activityId}`;
  const now = new Date().toISOString();

  const finalPayload = {
    ...fullPayload,
    activityId,
    shareUrl: permanentUrl,
    status: 'published',
    updatedAt: now
  };

  try {
    localStorage.setItem(`quizora_activity_${activityId}`, JSON.stringify(finalPayload));
  } catch {
    // Ignore quota issues
  }

  try {
    const docRef = doc(db, 'activities', activityId);
    await setDoc(docRef, finalPayload, { merge: true });
  } catch (err) {
    console.warn("Firestore activity publish write notice:", err.message);
  }

  return finalPayload;
};

const createDemoActivity = (activityId = 'demo') => {
  const bstSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 280" width="500" height="280">
    <rect width="500" height="280" fill="%23f8fafc" rx="12"/>
    <text x="250" y="32" font-family="sans-serif" font-size="15" font-weight="bold" fill="%231e293b" text-anchor="middle">Balanced Binary Search Tree (BST)</text>
    <line x1="250" y1="70" x2="160" y2="120" stroke="%236366f1" stroke-width="2.5"/>
    <line x1="250" y1="70" x2="340" y2="120" stroke="%236366f1" stroke-width="2.5"/>
    <line x1="160" y1="120" x2="110" y2="180" stroke="%236366f1" stroke-width="2.5"/>
    <line x1="160" y1="120" x2="200" y2="180" stroke="%236366f1" stroke-width="2.5"/>
    <line x1="340" y1="120" x2="300" y2="180" stroke="%236366f1" stroke-width="2.5"/>
    <line x1="340" y1="120" x2="390" y2="180" stroke="%236366f1" stroke-width="2.5"/>
    <circle cx="250" cy="70" r="22" fill="%234f46e5"/>
    <text x="250" y="76" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23ffffff" text-anchor="middle">50</text>
    <circle cx="160" cy="120" r="20" fill="%236366f1"/>
    <text x="160" y="125" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23ffffff" text-anchor="middle">25</text>
    <circle cx="340" cy="120" r="20" fill="%236366f1"/>
    <text x="340" y="125" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23ffffff" text-anchor="middle">75</text>
    <circle cx="110" cy="180" r="18" fill="%23818cf8"/>
    <text x="110" y="185" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff" text-anchor="middle">10</text>
    <circle cx="200" cy="180" r="18" fill="%23818cf8"/>
    <text x="200" y="185" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff" text-anchor="middle">30</text>
    <circle cx="300" cy="180" r="18" fill="%23818cf8"/>
    <text x="300" y="185" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff" text-anchor="middle">60</text>
    <circle cx="390" cy="180" r="18" fill="%23818cf8"/>
    <text x="390" y="185" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff" text-anchor="middle">90</text>
    <text x="250" y="245" font-family="sans-serif" font-size="12" fill="%2364748b" text-anchor="middle">Root: 50 | Height: 3 | Leaves: 10, 30, 60, 90</text>
  </svg>`;

  const graphSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 260" width="500" height="260">
    <rect width="500" height="260" fill="%23f8fafc" rx="12"/>
    <text x="250" y="28" font-family="sans-serif" font-size="14" font-weight="bold" fill="%231e293b" text-anchor="middle">Undirected Graph Traversal Reference</text>
    <line x1="120" y1="80" x2="250" y2="80" stroke="%234f46e5" stroke-width="2"/>
    <line x1="120" y1="80" x2="180" y2="170" stroke="%234f46e5" stroke-width="2"/>
    <line x1="250" y1="80" x2="380" y2="80" stroke="%234f46e5" stroke-width="2"/>
    <line x1="250" y1="80" x2="320" y2="170" stroke="%234f46e5" stroke-width="2"/>
    <line x1="180" y1="170" x2="320" y2="170" stroke="%234f46e5" stroke-width="2"/>
    <line x1="380" y1="80" x2="320" y2="170" stroke="%234f46e5" stroke-width="2"/>
    <circle cx="120" cy="80" r="22" fill="%234f46e5"/>
    <text x="120" y="86" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23ffffff" text-anchor="middle">A</text>
    <circle cx="250" cy="80" r="22" fill="%236366f1"/>
    <text x="250" y="86" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23ffffff" text-anchor="middle">B</text>
    <circle cx="380" cy="80" r="22" fill="%236366f1"/>
    <text x="380" y="86" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23ffffff" text-anchor="middle">C</text>
    <circle cx="180" cy="170" r="22" fill="%236366f1"/>
    <text x="180" y="176" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23ffffff" text-anchor="middle">D</text>
    <circle cx="320" cy="170" r="22" fill="%236366f1"/>
    <text x="320" y="176" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23ffffff" text-anchor="middle">E</text>
    <text x="250" y="235" font-family="sans-serif" font-size="12" fill="%2364748b" text-anchor="middle">Start Vertex: A | Adjacent: B, D</text>
  </svg>`;

  if (activityId === 'demo-single') {
    return {
      activityId,
      title: 'General Computer Science Knowledge Assessment',
      subject: 'Computer Science',
      purpose: 'Quiz',
      totalMarks: '25',
      partMode: 'parts',
      duration: { hours: 0, minutes: 20, seconds: 0 },
      participantForm: [
        { id: 'f1', label: 'Full Name', isOptional: false },
        { id: 'f2', label: 'Student ID / Reg No', isOptional: false }
      ],
      parts: [
        {
          id: 'part_single',
          title: 'All Questions',
          partTotalMarks: '25',
          questions: [
            {
              id: 'sq_1',
              type: 'mcq',
              questionText: 'Which data structure follows the LIFO (Last In First Out) principle?',
              marks: '5',
              options: ['Queue', 'Stack', 'Array', 'Linked List'],
              correctOptionIndex: 1
            },
            {
              id: 'sq_2',
              type: 'mcq',
              questionText: 'What is the time complexity of searching in a balanced BST?',
              marks: '5',
              imageUrl: bstSvg,
              options: ['O(1)', 'O(log N)', 'O(N)', 'O(N²)'],
              correctOptionIndex: 1
            },
            {
              id: 'sq_3',
              type: 'written',
              questionText: 'Briefly explain the difference between RAM and ROM.',
              marks: '10',
              answerGuidelines: 'Mention volatility, read/write speed, and primary usage.'
            },
            {
              id: 'sq_4',
              type: 'upload',
              questionText: 'Draw a flowchart or block diagram showing how a CPU fetches and executes an instruction. Upload a photo or PDF of your diagram.',
              marks: '5'
            }
          ]
        }
      ]
    };
  }

  const isFreeMode = activityId === 'demo-free';
  const isTimedMode = activityId === 'demo-timed';

  const now = new Date();
  const startTimePart2 = new Date(now.getTime() - 60000).toISOString(); // Started 1 min ago
  const startTimePart3 = new Date(now.getTime() + 15 * 60000).toISOString(); // Starts in 15 mins (locked)

  return {
    activityId,
    title: isFreeMode
      ? 'Midterm Exam — DSA (Free Navigation Mode)'
      : isTimedMode
        ? 'Midterm Exam — DSA (Individual Timed Mode)'
        : 'Midterm Examination — Data Structures & Algorithms',
    subject: 'Computer Science',
    purpose: 'Exam',
    totalMarks: '50',
    partMode: 'parts',
    partNavigationMode: isFreeMode ? 'free' : isTimedMode ? 'individualTime' : 'sequential',
    duration: { hours: 0, minutes: 45, seconds: 0 },
    participantForm: [
      { id: 'f1', label: 'Full Name', isOptional: false },
      { id: 'f2', label: 'Registration Number', isOptional: false },
      { id: 'f3', label: 'Department', isOptional: true }
    ],
    parts: [
      {
        id: 'part_1',
        title: 'Part 1 — Multiple Choice',
        partTotalMarks: '20',
        individualStartTime: isTimedMode ? new Date(now.getTime() - 5 * 60000).toISOString() : undefined,
        individualEndTime: isTimedMode ? new Date(now.getTime() + 20 * 60000).toISOString() : undefined,
        questions: [
          {
            id: 'q1_1',
            type: 'mcq',
            questionText: 'Which fundamental data structure operates strictly on the First-In, First-Out (FIFO) principle?',
            marks: '5',
            options: ['Stack', 'Queue', 'Binary Tree', 'Graph'],
            correctOptionIndex: 1
          },
          {
            id: 'q1_2',
            type: 'mcq',
            questionText: 'Refer to the diagram below. What is the average time complexity for searching an element in a balanced Binary Search Tree (BST) with N nodes?',
            marks: '5',
            imageUrl: bstSvg,
            answerGuidelines: 'Consider the height of a balanced tree with N nodes.',
            options: ['O(1)', 'O(log N)', 'O(N)', 'O(N²)'],
            correctOptionIndex: 1
          },
          {
            id: 'q1_3',
            type: 'mcq',
            questionText: 'Which of the following are linear data structures? (Select all that apply)',
            marks: '5',
            allowMultipleChoices: true,
            options: ['Array', 'Linked List', 'Binary Search Tree', 'Queue'],
            correctIndices: [0, 1, 3]
          },
          {
            id: 'q1_4',
            type: 'mcq',
            questionText: 'What is the worst-case time complexity of QuickSort algorithm?',
            marks: '5',
            options: ['O(N log N)', 'O(log N)', 'O(N²)', 'O(N)'],
            correctOptionIndex: 2
          }
        ]
      },
      {
        id: 'part_2',
        title: 'Part 2 — Written Analysis',
        partTotalMarks: '15',
        individualStartTime: isTimedMode ? startTimePart2 : undefined,
        individualEndTime: isTimedMode ? new Date(now.getTime() + 30 * 60000).toISOString() : undefined,
        questions: [
          {
            id: 'q2_1',
            type: 'written',
            questionText: 'Explain the key differences between Depth First Search (DFS) and Breadth First Search (BFS). Mention the underlying data structures used by each.',
            marks: '10',
            answerGuidelines: 'Compare traversal order, memory complexity, and data structures (Stack vs Queue).'
          },
          {
            id: 'q2_2',
            type: 'written',
            questionText: 'Examine the graph diagram below. Write the step-by-step vertex visit order when executing BFS starting from vertex A.',
            marks: '5',
            imageUrl: graphSvg,
            answerGuidelines: 'List the vertices in order of visitation starting with A.'
          }
        ]
      },
      {
        id: 'part_3',
        title: 'Part 3 — Diagram & Solution Upload',
        partTotalMarks: '15',
        individualStartTime: isTimedMode ? startTimePart3 : undefined,
        individualEndTime: isTimedMode ? new Date(now.getTime() + 60 * 60000).toISOString() : undefined,
        questions: [
          {
            id: 'q3_1',
            type: 'upload',
            questionText: 'Draw the step-by-step AVL Tree rotations when inserting the key sequence: [10, 20, 30, 40, 50]. Upload a clear photo or PDF scan of your handwritten work.',
            marks: '15',
            imageUrl: bstSvg,
            answerGuidelines: 'Show the tree state after each insertion and specify which rotation (LL, RR, LR, RL) is applied.'
          }
        ]
      }
    ]
  };
};

/**
 * Fetch an activity by ID from Firestore, demo preset, or local cache
 * @param {string} activityId 
 * @returns {Promise<object|null>}
 */
export const getActivityById = async (activityId) => {
  if (!activityId) return null;

  // Built-in Demo Presets
  if (
    activityId === 'demo' ||
    activityId === 'demo-exam' ||
    activityId === 'demo-free' ||
    activityId === 'demo-single' ||
    activityId === 'demo-timed' ||
    activityId === 'sample'
  ) {
    return createDemoActivity(activityId);
  }

  // Check local cache
  let localData = null;
  try {
    const raw = localStorage.getItem(`quizora_activity_${activityId}`);
    if (raw) localData = JSON.parse(raw);
  } catch {
    // Ignore JSON error
  }

  try {
    const docRef = doc(db, 'activities', activityId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { activityId, ...snap.data() };
    }
    return localData;
  } catch (err) {
    console.warn("Firestore getActivityById notice:", err.message);
    return localData;
  }
};

