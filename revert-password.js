import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('../shishyakul-react/.env') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});

const auth = getAuth();

async function revert() {
  try {
    const userRecord = await auth.getUserByEmail('john@gmail.com');
    await auth.updateUser(userRecord.uid, { password: 'fmjwc5htShishyakul@1' });
    console.log("Successfully reverted John's password back to fmjwc5htShishyakul@1 in Firebase Auth!");
  } catch (error) {
    console.error("Error reverting password:", error);
  }
}

revert();
