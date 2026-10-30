import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB8PM-cwD2YzMReD2uKYCXN0yT-U9Gm_IY",
  authDomain: "quizora-d44bc.firebaseapp.com",
  projectId: "quizora-d44bc",
  storageBucket: "quizora-d44bc.firebasestorage.app",
  messagingSenderId: "1084948977604",
  appId: "1:1084948977604:web:d88c4a31d4d02162893691",
  measurementId: "G-LL0ELWXTLL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics conditionally if supported
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export default app;