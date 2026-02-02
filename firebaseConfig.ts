import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Replace this with your own Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmHr6PmGGxfVEqSTihxWoXK4UUYz1NmRg",
  authDomain: "bocado-ai.firebaseapp.com",
  projectId: "bocado-ai",
  storageBucket: "bocado-ai.appspot.com",
  messagingSenderId: "990221792293",
  appId: "1:990221792293:web:83ae4624bb09938b4abbcc"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, serverTimestamp };