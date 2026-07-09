import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  console.log("Starting migration...");
  const q = query(collection(db, 'students'), where('status', '==', 'admitted'));
  const snapshot = await getDocs(q);
  
  let count = 0;
  for (const studentDoc of snapshot.docs) {
    const data = studentDoc.data();
    if (data.studentName === 'Browser Agent') {
      console.log(`Reverting ${data.studentName}...`);
      await updateDoc(doc(db, 'students', studentDoc.id), {
        status: 'enquiry',
        admissionDate: null,
        isFullyAdmitted: null,
        batch: null
      });
      count++;
    }
  }
  
  console.log(`Migration complete. Updated ${count} students.`);
  process.exit(0);
}

migrate();
