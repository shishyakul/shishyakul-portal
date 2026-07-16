import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0BzaGlzaHlha3VsLXBvcnRhbC02MDI0NC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsInN1YiI6ImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQHNoaXNoeWFrdWwtcG9ydGFsLTYwMjQ0LmlhbS5nc2VydmljZWFjY291bnQuY29tIiwiYXVkIjoiaHR0cHM6Ly9pZGVudGl0eXRvb2xraXQuZ29vZ2xlYXBpcy5jb20vZ29vZ2xlLmlkZW50aXR5LmlkZW50aXR5dG9vbGtpdC52MS5JZGVudGl0eVRvb2xraXQiLCJpYXQiOjE3ODQxMTg3MTMsImV4cCI6MTc4NDEyMjMxMywidWlkIjoiM1dTVEtDR1RpR08zdVZwQ3BVWjNiRjdTRDRyMSJ9.Ccpq5yo9be7Y3fq12eSWKag0zR2-uXNj4vg3TRc6GI9Re_kt1jqiVLei-9fi4xgvTFvYfcJigHlVdj8cX7tswKnmYuSjnAiDws71rC1t3ABrPjRUfCujdpMJ7QvLJOWVGj-k5bUp16BQvU_sj2lsG-YchAetfQ9uPkH0CQwVLeRGRUCOjA7Mej0IKbBrl3LLmGWE_gB02EO1BUt3XOq8MrRNQXId1_YmdKkplmAbkRUPhYGZd3ztleGhMu4x4Ei6FXHjYk3Oa9Y9z7yHa9XRtasQiLoPN-x4E_fZ3GQHZVdRwh3MDE106TaVQTPX_rqAXbg6gdnn_BkGqvHTZCmZLA';

import { getFirestore, doc, getDoc, collection, getDocs, limit, query } from 'firebase/firestore';

signInWithCustomToken(auth, token)
  .then(async (cred) => {
    console.log("Success! UID:", cred.user.uid);
    const db = getFirestore(app);
    
    try {
      console.log("Attempting to read OWN profile...");
      const myDoc = await getDoc(doc(db, 'users', cred.user.uid));
      console.log("Own profile read success:", myDoc.exists());
      
      console.log("Attempting to read OTHER profile...");
      const otherDoc = await getDoc(doc(db, 'users', 'some_other_uid_123'));
      console.log("Other profile read success:", otherDoc.exists()); // This should fail!
    } catch (e) {
      console.error("Firestore read error:", e.code || e.message);
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error signing in with custom token:");
    console.error(error.code);
    console.error(error.message);
    process.exit(1);
  });
