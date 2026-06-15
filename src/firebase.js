// Firebase configuration for shishyakul-portal
// ⚠️ These values come from Vite environment variables (.env file)
// NEVER hardcode real values here — always use import.meta.env.*
// Create a .env file in the portal root (it is gitignored) with:
//
//   VITE_FIREBASE_API_KEY=your_api_key_here
//   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
//   VITE_FIREBASE_PROJECT_ID=your_project_id
//   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
//   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
//   VITE_FIREBASE_APP_ID=your_app_id

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
