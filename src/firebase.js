import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC9-wJQyt61OtKvoCfu12A0AjeKcz75C-U",
  authDomain: "quizora-8276d.firebaseapp.com",
  projectId: "quizora-8276d",
  storageBucket: "quizora-8276d.firebasestorage.app",
  messagingSenderId: "108042259042",
  appId: "1:108042259042:web:c786b88758be3b26485f3b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
