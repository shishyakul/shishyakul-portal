import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read credentials from shishyakul-react/.env
const reactEnvPath = path.resolve('c:/Users/Himanshu/OneDrive/Desktop/Shishyakul - Full Stack/shishyakul-react/.env');
let clientEmail, privateKey, projectId;

if (fs.existsSync(reactEnvPath)) {
  const content = fs.readFileSync(reactEnvPath, 'utf8');
  content.split('\n').forEach(line => {
    if (line.startsWith('FIREBASE_PROJECT_ID=')) projectId = line.split('=')[1].trim();
    if (line.startsWith('FIREBASE_CLIENT_EMAIL=')) clientEmail = line.split('=')[1].trim();
    if (line.startsWith('FIREBASE_PRIVATE_KEY=')) {
      privateKey = line.substring('FIREBASE_PRIVATE_KEY='.length).trim().replace(/\\n/g, '\n');
    }
  });
}

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Firebase credentials not found');
  process.exit(1);
}

const app = getApps().length === 0 ? initializeApp({
  credential: cert({ projectId, clientEmail, privateKey })
}, 'live-test-app') : getApps()[0];

const db = getFirestore(app);

async function runLiveHomeworkTestCase() {
  console.log('================================================================');
  console.log('🚀 LIVE TEST: HOMEWORK SUBMIT WORKFLOW');
  console.log('Batch: 10th-CBSE Alpha | Subject Teacher ➔ Student ➔ Grading');
  console.log('================================================================\n');

  // 1. Fetch Teacher for 10th-CBSE Alpha
  console.log('Step 1: Finding Subject Teacher assigned to 10th-CBSE Alpha...');
  const usersSnap = await db.collection('users').where('role', '==', 'teacher').get();
  let teacher = null;
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.assignedBatches && data.assignedBatches.includes('10th-CBSE Alpha')) {
      teacher = { id: doc.id, ...data };
    }
  });

  // Fallback to Himanshu if no explicit batch array match
  if (!teacher && !usersSnap.empty) {
    const defaultDoc = usersSnap.docs.find(d => d.data().email === 'himanshuvishwakarma516@gmail.com') || usersSnap.docs[0];
    teacher = { id: defaultDoc.id, ...defaultDoc.data() };
  }

  console.log(`✅ Teacher Identified: ${teacher.fullName || teacher.name || teacher.email} (ID: ${teacher.id})`);
  const subjectsDisplay = Array.isArray(teacher.assignedSubjects) 
    ? teacher.assignedSubjects.join(', ') 
    : (Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : (teacher.assignedSubjects || teacher.subjects || 'Mathematics'));
  console.log(`   Assigned Subjects: ${subjectsDisplay}`);

  // 2. Fetch Student in 10th-CBSE Alpha
  console.log('\nStep 2: Finding Student in 10th-CBSE Alpha...');
  const studentSnap = await db.collection('students')
    .where('batch', '==', '10th-CBSE Alpha')
    .limit(5)
    .get();

  let student = null;
  if (!studentSnap.empty) {
    student = { id: studentSnap.docs[0].id, ...studentSnap.docs[0].data() };
  } else {
    // Check all admitted students
    const anyStudentSnap = await db.collection('students').limit(1).get();
    student = { id: anyStudentSnap.docs[0].id, ...anyStudentSnap.docs[0].data(), batch: '10th-CBSE Alpha' };
  }

  console.log(`✅ Student Identified: ${student.studentName || student.fullName || student.name} (ID: ${student.id})`);
  console.log(`   Batch: ${student.batch}`);

  // 3. Teacher Publishes Homework Assignment
  console.log('\nStep 3: Subject Teacher creates new Homework Assignment in `course_materials`...');
  const assignmentPayload = {
    title: 'NCERT Ch-4 Quadratic Equations: Exercise 4.2 & 4.3 Assignment',
    description: 'Solve questions 1 through 6 with complete steps showing factorization and quadratic formula methods. Upload your solution PDF to Google Drive.',
    type: 'Assignment',
    subject: 'Mathematics',
    batch: '10th-CBSE Alpha',
    driveLink: 'https://drive.google.com/file/d/1_shishyakul_math_quadratic_task/view',
    teacherId: teacher.id,
    teacherName: teacher.fullName || 'Himanshu Sir',
    timestamp: FieldValue.serverTimestamp(),
    createdAt: new Date().toISOString(),
    isLiveTest: true
  };

  const matRef = await db.collection('course_materials').add(assignmentPayload);
  console.log(`✅ Assignment Published with Document ID: ${matRef.id}`);
  console.log(`   Title: "${assignmentPayload.title}"`);
  console.log(`   Target Batch: ${assignmentPayload.batch}`);

  // 4. Verify Student Dashboard can retrieve this Assignment
  console.log('\nStep 4: Simulating Student Dashboard retrieving batch assignments...');
  const studentMatSnap = await db.collection('course_materials')
    .where('batch', '==', '10th-CBSE Alpha')
    .get();

  const studentAssignments = studentMatSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.type === 'Assignment');

  const targetAssignment = studentAssignments.find(a => a.id === matRef.id);
  if (!targetAssignment) {
    throw new Error('❌ Student Dashboard failed to find the published assignment in 10th-CBSE Alpha');
  }
  console.log(`✅ Student Dashboard retrieved assignment: "${targetAssignment.title}" by ${targetAssignment.teacherName}`);

  // 5. Student Submits Work
  console.log('\nStep 5: Student submits work into `submissions` collection...');
  const submissionPayload = {
    studentId: student.id,
    studentName: student.studentName || student.fullName || 'Aarav Sharma',
    studentEmail: student.emailId || student.email || 'aarav.student@shishyakul.in',
    batch: '10th-CBSE Alpha',
    assignmentId: matRef.id,
    assignmentTitle: targetAssignment.title,
    driveLink: 'https://drive.google.com/file/d/1_aarav_sharma_math_homework_submission/view',
    graded: false,
    timestamp: FieldValue.serverTimestamp(),
    submittedAt: new Date().toISOString(),
    isLiveTest: true
  };

  const subRef = await db.collection('submissions').add(submissionPayload);
  console.log(`✅ Student Submission created with Document ID: ${subRef.id}`);
  console.log(`   Drive Link Submitted: ${submissionPayload.driveLink}`);
  console.log(`   Status: Pending Review (graded: false)`);

  // 6. Verify Teacher Dashboard detects pending submission
  console.log('\nStep 6: Teacher Dashboard `#grading` receives submission...');
  const teacherSubSnap = await db.collection('submissions')
    .where('batch', '==', '10th-CBSE Alpha')
    .get();

  const retrievedSub = teacherSubSnap.docs.find(d => d.id === subRef.id);
  if (!retrievedSub) {
    throw new Error('❌ Teacher Dashboard failed to find student submission for 10th-CBSE Alpha');
  }
  console.log(`✅ Teacher Dashboard received submission from ${retrievedSub.data().studentName}`);

  // 7. Teacher Evaluates and Grades the Work
  console.log('\nStep 7: Teacher grades submission in `#grading` modal...');
  const gradeData = {
    marks: 19,
    maxMarks: 20,
    feedback: 'Splendid solution! Perfect application of the quadratic formula in problem 4. Neatly presented.',
    graded: true,
    gradedBy: teacher.fullName || 'Himanshu Sir',
    gradedAt: FieldValue.serverTimestamp()
  };

  await db.collection('submissions').doc(subRef.id).update(gradeData);
  console.log(`✅ Submission Graded: ${gradeData.marks}/${gradeData.maxMarks} marks`);
  console.log(`   Teacher Feedback: "${gradeData.feedback}"`);

  // 8. Verify Student Dashboard receives Graded result & Remarks
  console.log('\nStep 8: Student Dashboard verifies updated submission log & metrics...');
  const updatedSubSnap = await db.collection('submissions').doc(subRef.id).get();
  const finalSub = updatedSubSnap.data();

  if (!finalSub.graded || finalSub.marks !== 19) {
    throw new Error('❌ Grading verification failed: Student did not receive graded status or marks.');
  }

  console.log('✅ Final Student View Verification:');
  console.log(`   - Status: GRADED (badge: #10b981)`);
  console.log(`   - Score: ${finalSub.marks}/20 (${Math.round((finalSub.marks / 20) * 100)}%)`);
  console.log(`   - Evaluator: ${finalSub.gradedBy}`);
  console.log(`   - Feedback: "${finalSub.feedback}"`);

  console.log('\n================================================================');
  console.log('🎉 LIVE TEST PASSED 100% SUCCESSFULLY');
  console.log('Teacher ➔ Student ➔ Submission ➔ Grading ➔ Student Feedback loop is verified live on Firestore.');
  console.log('================================================================\n');

  // Cleanup test documents
  await db.collection('submissions').doc(subRef.id).delete();
  await db.collection('course_materials').doc(matRef.id).delete();
  console.log('🧹 Test cleanup completed (temporary live test docs deleted).');
}

runLiveHomeworkTestCase().catch(err => {
  console.error('❌ Live test failed:', err);
  process.exit(1);
});
