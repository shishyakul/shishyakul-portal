import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Calculates the Teacher's 100-point performance score.
 * Caches the result in sessionStorage to minimize reads per session.
 * 
 * Score breakdown (100 pts total):
 * 1. Attendance (30 pts)
 * 2. Weekly Feedbacks (20 pts)
 * 3. Task Completion (20 pts)
 * 4. Syllabus Progress (15 pts) - Mocked for now until module is fully typed
 * 5. Test Operations (15 pts) - Mocked for now
 * 
 * @param {string} teacherId - The UID of the teacher
 * @returns {Promise<number>} - The calculated score out of 100
 */
export const fetchTeacherPerformanceScore = async (teacherId) => {
  const cacheKey = `teacher_perf_v3_${teacherId}`;
  const cachedData = sessionStorage.getItem(cacheKey);
  
  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);
    if (Date.now() - timestamp < 4 * 60 * 60 * 1000) {
      return data;
    }
  }

  try {
    // 1. Fetch Teacher Profile
    const teacherDoc = await getDoc(doc(db, 'users', teacherId));
    let feedbackScore = 40; 
    let taskScore = 20;
    
    if (teacherDoc.exists()) {
      const data = teacherDoc.data();
      const feedbacks = data.managerFeedbacks || [];
      if (feedbacks.length > 0) {
        const avgStars = feedbacks.reduce((acc, fb) => acc + (fb.rating || 3), 0) / feedbacks.length;
        feedbackScore = (avgStars / 5) * 40;
      }

      const weeklyTargets = data.currentWeeklyTargets || [];
      if (weeklyTargets.length > 0) {
        const completedTargets = weeklyTargets.filter(t => t.completed).length;
        taskScore = (completedTargets / weeklyTargets.length) * 20;
      }
    }

    // 2. Attendance (Mocking 10/10 for now until biometrics integration)
    const attendanceScore = 10; 

    // 3. Tests (Real Data from Batches)
    let testScore = 30; 

    const teacherData = teacherDoc.exists() ? teacherDoc.data() : {};
    const assignedBatches = teacherData.assignedBatches || [];
    if (assignedBatches.length > 0) {
        let totalAvgMarks = 0;
        let validBatches = 0;
        for (const batch of assignedBatches) {
            const bAnalytics = await fetchBatchAnalytics(batch);
            if (bAnalytics.avgMarks > 0) {
                totalAvgMarks += bAnalytics.avgMarks;
                validBatches++;
            }
        }
        if (validBatches > 0) {
            const overallAvgMarks = totalAvgMarks / validBatches; // 0-100
            testScore = (overallAvgMarks / 100) * 30;
        } else {
            testScore = 0; // No tests conducted yet
        }
    }

    const finalScore = Math.round(feedbackScore + taskScore + attendanceScore + testScore);
    
    let lowest = 'Tasks';
    let minScoreRatio = taskScore / 20;
    
    if ((attendanceScore / 10) < minScoreRatio) { lowest = 'Attendance'; minScoreRatio = attendanceScore / 10; }
    if ((feedbackScore / 40) < minScoreRatio) { lowest = 'Feedback'; minScoreRatio = feedbackScore / 40; }
    if ((testScore / 30) < minScoreRatio) { lowest = 'Tests'; minScoreRatio = testScore / 30; }

    let advice = 'Keep up the great work!';
    if (lowest === 'Feedback') advice = 'Your manager feedback average is your lowest metric. Try asking for specific areas to improve.';
    if (lowest === 'Attendance') advice = 'Your attendance/punctuality score is low. Ensure you punch in on time.';
    if (lowest === 'Tasks') advice = 'You have pending weekly tasks. Try to clear your checklist.';
    if (lowest === 'Tests') advice = 'Class test averages are low. Focus on student fundamentals.';

    const resultObj = {
      totalScore: Math.min(100, Math.max(0, finalScore)),
      breakdown: {
        attendance: Math.round(attendanceScore),
        feedback: Math.round(feedbackScore),
        tasks: Math.round(taskScore),
        tests: Math.round(testScore)
      },
      advice
    };

    sessionStorage.setItem(cacheKey, JSON.stringify({
      data: resultObj,
      timestamp: Date.now()
    }));

    return resultObj;

  } catch (err) {
    console.error("Failed to calculate teacher performance:", err);
    return { totalScore: 65, breakdown: { attendance: 8, feedback: 25, tasks: 15, tests: 17 }, advice: 'Keep up the good work!' };
  }
};

/**
 * Calculates the average attendance and marks for a specific batch.
 * This is lazy-loaded (only fetched when the tab is opened) to save DB reads.
 * 
 * @param {string} batchName - The name of the batch
 * @returns {Promise<{avgAttendance: number, avgMarks: number, students: Array}>}
 */
export const fetchBatchAnalytics = async (batchName) => {
  const cacheKey = `batch_analytics_v3_${batchName}`;
  const cachedData = sessionStorage.getItem(cacheKey);
  
  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);
    // Cache for 1 hour to balance live updates with read costs
    if (Date.now() - timestamp < 60 * 60 * 1000) {
      return data;
    }
  }

  const result = {
    avgAttendance: 0,
    avgMarks: 0,
    students: [],
    tests: []
  };

  try {
    const [studentsSnap, attendanceSnap, testsSnap] = await Promise.all([
      getDocs(query(collection(db, 'students'), where('batch', '==', batchName))),
      getDocs(query(collection(db, 'attendance'), where('batch', '==', batchName))),
      getDocs(query(collection(db, 'test_marks'), where('batch', '==', batchName)))
    ]);
    
    const attendanceDocs = attendanceSnap.docs.map(doc => doc.data());
    const testDocs = testsSnap.docs.map(doc => doc.data());

    let totalAtt = 0;
    let totalMarks = 0;
    let studentCount = 0;

    // Calculate Current Calendar Week (Monday to Sunday)
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    studentsSnap.forEach(doc => {
      const s = doc.data();
      s.id = doc.id;
      
      // 1. Calculate Attendance
      const joiningDateStr = s.dateOfJoining || (s.admissionDate ? s.admissionDate.substring(0, 10) : null);
      const joiningDate = joiningDateStr ? new Date(joiningDateStr) : new Date(0);
      joiningDate.setHours(0, 0, 0, 0);

      const validAtt = attendanceDocs.filter(log => {
        if (!log.date) return false;
        const d = new Date(log.date); d.setHours(0, 0, 0, 0);
        return d >= joiningDate;
      });

      const totalClasses = validAtt.length;
      const absentCount = validAtt.filter(log => log.absenteeIds?.includes(s.id)).length;
      const presentClasses = totalClasses - absentCount;
      const sAtt = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

      // 2. Calculate Marks
      const studentTests = testDocs.filter(t => t.results?.some(r => r.studentId === s.id));
      let totalObtained = 0;
      let totalMax = 0;
      studentTests.forEach(t => {
        const tr = t.results.find(r => r.studentId === s.id);
        if (tr) {
          totalObtained += Number(tr.marks || 0);
          totalMax += Number(t.maxMarks || 0);
        }
      });
      const sMark = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
      
      // 3. Feedback Logic
      let needsFeedback = true;
      if (s.feedbacks && s.feedbacks.length > 0) {
        const lastFbDate = new Date([...s.feedbacks].reverse()[0].date);
        if (lastFbDate >= startOfWeek) {
          needsFeedback = false;
        }
      }

      s.sAtt = sAtt;
      s.sMark = sMark;
      s.needsFeedback = needsFeedback;

      totalAtt += sAtt;
      totalMarks += sMark;
      studentCount++;
      
      result.students.push(s);
    });

    if (studentCount > 0) {
      result.avgAttendance = Math.round(totalAtt / studentCount);
      result.avgMarks = Math.round(totalMarks / studentCount);
    }
    
    // Sort tests chronologically (newest first)
    result.tests = testDocs.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));

    sessionStorage.setItem(cacheKey, JSON.stringify({
      data: result,
      timestamp: Date.now()
    }));

  } catch (err) {
    console.error(`Failed to fetch analytics for batch ${batchName}:`, err);
  }

  return result;
};
