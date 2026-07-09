import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

// Need to match firebase config
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^VITE_FIREBASE_(.*)=(.*)$/);
  if (match) envVars[match[1]] = match[2].replace(/['"]/g, '').trim();
});

const firebaseConfig = {
  apiKey: envVars.API_KEY,
  authDomain: envVars.AUTH_DOMAIN,
  projectId: envVars.PROJECT_ID,
  storageBucket: envVars.STORAGE_BUCKET,
  messagingSenderId: envVars.MESSAGING_SENDER_ID,
  appId: envVars.APP_ID,
  measurementId: envVars.MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runTest() {
  console.log("=== Dump ALL Johns ===");
  const students = await getDocs(query(collection(db, 'students'), where('studentName', '==', 'John')));
  students.docs.forEach(doc => {
    console.log(`[STUDENT] JSON: ${JSON.stringify(doc.data(), null, 2)}`);
  });

  const users = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
  users.docs.forEach(doc => {
    const data = doc.data();
    if (data.fullName === 'John' || data.email === 'john@gmail.com') {
      console.log(`[USER] ID: ${doc.id} | Name: "${data.fullName}" | Email: "${data.email}"`);
    }
  });
  
  const teachers = await getDocs(query(collection(db, 'users'), where('role', '==', 'faculty')));
  if (teachers.empty) {
    console.log("No teacher found!");
  } else {
    const teacher = teachers.docs[0].data();
    console.log(`Found Teacher: ${teacher.fullName} (${teacher.email})`);
    
    const batches = teacher.assignedBatches || [];
    if (batches.length > 0) {
        console.log(`\nTesting Materials Query for Teacher's Batches (${batches.join(', ')}):`);
        const matQ = await getDocs(query(collection(db, 'course_materials'), where('batch', 'in', batches)));
        console.log(`Fetched ${matQ.size} materials for teacher's batches.`);
    } else {
        console.log("Teacher has no assigned batches.");
    }
  }

  console.log("\n=== Test Complete ===");
  process.exit(0);
}

runTest();
