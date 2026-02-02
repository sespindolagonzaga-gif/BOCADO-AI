import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { env } from './src/environment/env';

const app = !getApps().length ? initializeApp(env.firebase) : getApp();

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, serverTimestamp };
