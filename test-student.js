import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});

const db = getFirestore();
const auth = getAuth();

async function run() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('role', '==', 'student').limit(5).get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.batch) {
      console.log(`Student found: ${data.email} | UID: ${doc.id} | Batch: ${data.batch}`);
      // Update password so we can test it
      await auth.updateUser(doc.id, { password: 'Password123!' });
      console.log(`Password reset to: Password123!`);
      break;
    }
  }
}

run().catch(console.error);
