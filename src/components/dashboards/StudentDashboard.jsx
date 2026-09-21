import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  doc, 
  getDoc,
  getDocs 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { createNotification } from '../../services/notifications';
import { useLocation, useNavigate } from 'react-router-dom';
import BattalionNetwork from './BattalionNetwork';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

export default function StudentDashboard({ profile }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    return location.hash.replace('#', '') || 'feed';
  });

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && hash !== activeTab) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`#${tab}`, { replace: true });
  };

  // Core Data States
  const [materials, setMaterials] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [timetable, setTimetable] = useState({});
  const [timetableHeaderDate, setTimetableHeaderDate] = useState('');
  const [activeTeachers, setActiveTeachers] = useState([]);
  const [isBattalionEnrolled, setIsBattalionEnrolled] = useState(false);
  const [battalionProfile, setBattalionProfile] = useState(null);
  const [studentRecord, setStudentRecord] = useState(null);
  const [lectureReports, setLectureReports] = useState([]);
  const [directCommunications, setDirectCommunications] = useState([]);
  const [batchTestMarks, setBatchTestMarks] = useState([]);
  const [schoolTestRecords, setSchoolTestRecords] = useState([]);
  const [testCategoryFilter, setTestCategoryFilter] = useState('all'); // 'all' | 'weekly' | 'class' | 'school'
  const [loading, setLoading] = useState(true);

  // Forms
  const [submitForm, setSubmitForm] = useState({
    assignmentId: '',
    assignmentTitle: '',
    driveLink: ''
  });
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [grievanceForm, setGrievanceForm] = useState({ category: '', description: '' });
  const [submittingGrievance, setSubmittingGrievance] = useState(false);

  // Attendance Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  const handlePrevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  const batchName = profile?.batch || studentRecord?.batch;
  const resolvedStudentId = profile?.studentId || studentRecord?.id || profile?.uid;
  const studentFullName = profile?.fullName || profile?.displayName || profile?.studentName || studentRecord?.studentName || 'Student';
  const studentEmailNormalized = (profile?.email || '').toLowerCase().trim();

  // 1. Resolve Student Record (Direct ID -> Normalized Email -> Name Fallback) with Auto-caching
  useEffect(() => {
    let unsubStudent;

    const findBestRecord = (docs) => {
      let best = docs[0];
      for (let d of docs) {
        const data = d.data();
        if (data.status === 'admitted') return d;
        if (data.status === 'passout') best = d;
      }
      return best;
    };

    const resolveIdentity = async () => {
      // Step A: Try direct profile.studentId document lookup
      if (profile?.studentId) {
        try {
          const directRef = doc(db, 'students', profile.studentId);
          unsubStudent = onSnapshot(directRef, (docSnap) => {
            if (docSnap.exists()) {
              setStudentRecord({ id: docSnap.id, ...docSnap.data() });
            } else {
              fallbackEmailLookup();
            }
          });
          return;
        } catch (err) {
          console.warn('Direct studentId lookup failed, falling back:', err);
        }
      }

      fallbackEmailLookup();
    };

    const fallbackEmailLookup = () => {
      if (studentEmailNormalized) {
        const qEmail = query(collection(db, 'students'), where('emailId', '==', studentEmailNormalized));
        unsubStudent = onSnapshot(qEmail, (snap) => {
          if (!snap.empty) {
            const best = findBestRecord(snap.docs);
            const data = { id: best.id, ...best.data() };
            setStudentRecord(data);

            // Auto-cache studentId on user profile for future O(1) reads
            if (profile?.uid && profile.studentId !== best.id) {
              updateDoc(doc(db, 'users', profile.uid), { studentId: best.id }).catch(() => {});
            }
          } else {
            fallbackNameLookup();
          }
        }, () => fallbackNameLookup());
      } else {
        fallbackNameLookup();
      }
    };

    const fallbackNameLookup = () => {
      const qName = query(collection(db, 'students'), where('studentName', '==', studentFullName));
      getDocs(qName).then(nameSnap => {
        if (!nameSnap.empty) {
          const best = findBestRecord(nameSnap.docs);
          setStudentRecord({ id: best.id, ...best.data() });
        } else {
          setStudentRecord({ notFound: true, totalFees: 0, paidInstallments: [] });
        }
      }).catch(err => {
        setStudentRecord({ notFound: true, error: err.message });
      });
    };

    resolveIdentity();

    return () => {
      if (unsubStudent) unsubStudent();
    };
  }, [profile?.studentId, profile?.uid, studentEmailNormalized, studentFullName]);

  // 2. Real-time Batch & Student Listeners
  useEffect(() => {
    let unsubMat, unsubSub, unsubAtt, unsubTimetable, unsubLectureReports, unsubTestMarks;

    if (batchName) {
      // 1. Course Materials
      const qMat = query(collection(db, 'course_materials'), where('batch', '==', batchName));
      unsubMat = onSnapshot(qMat, (snap) => {
        setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      });

      // 2. Attendance
      const qAtt = query(collection(db, 'attendance'), where('batch', '==', batchName));
      unsubAtt = onSnapshot(qAtt, (snap) => {
        const possibleStudentIds = [studentRecord?.id, profile?.studentId, profile?.uid, resolvedStudentId].filter(Boolean);
        const checkMapByIds = (mapObj) => {
          if (!mapObj) return null;
          for (let id of possibleStudentIds) {
            if (mapObj[id]) return mapObj[id];
          }
          return null;
        };

        const attRecords = snap.docs.map(d => {
          const data = d.data();
          const isAbsent = data.absenteeIds && possibleStudentIds.some(id => data.absenteeIds.includes(id));
          const lateInfo = checkMapByIds(data.lateStudents);
          const selfStudyLog = checkMapByIds(data.selfStudyLogs);
          const inOutTime = checkMapByIds(data.inOutTimes);
          return {
            id: d.id,
            date: data.date,
            sessionType: data.sessionType || 'Regular Class',
            status: isAbsent ? 'Absent' : 'Present',
            lateInfo,
            selfStudyLog,
            inOutTime,
            timestamp: data.timestamp
          };
        });
        setAttendance(attRecords.sort((a,b) => new Date(b.date) - new Date(a.date)));
      });

      // 3. Master Timetable
      const qTimetable = doc(db, 'timetables', 'master');
      unsubTimetable = onSnapshot(qTimetable, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTimetable(data.schedule || {});
          setTimetableHeaderDate(data.headerDate || '');
        } else {
          setTimetable({});
        }
      });

      // 4. Lecture Reports
      const qLectureReports = query(collection(db, 'lecture_reports'), where('batch', '==', batchName));
      unsubLectureReports = onSnapshot(qLectureReports, (snap) => {
        setLectureReports(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      });

      // 5. Test Marks (Batch Test Marks Snapshot for Real-time Test Tracking)
      const qTestMarks = query(collection(db, 'test_marks'), where('batch', '==', batchName));
      unsubTestMarks = onSnapshot(qTestMarks, (snap) => {
        setBatchTestMarks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    // 6. Submissions for this student (Multi-attribute matching: ID, email, and name variants)
    const targetSid = resolvedStudentId || studentRecord?.id;
    const targetNameA = studentFullName.toLowerCase().trim();
    const targetNameB = (studentRecord?.studentName || '').toLowerCase().trim();
    const qSub = collection(db, 'submissions');
    unsubSub = onSnapshot(qSub, (snap) => {
      const subs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => {
        const itemSid = item.studentId;
        const itemEmail = (item.studentEmail || '').toLowerCase().trim();
        const itemName = (item.studentName || '').toLowerCase().trim();

        return (
          (targetSid && itemSid === targetSid) ||
          (studentEmailNormalized && itemEmail === studentEmailNormalized) ||
          (targetNameA && itemName === targetNameA) ||
          (targetNameB && itemName === targetNameB)
        );
      });

      subs.sort((a, b) => {
        const timeA = a.timestamp?.seconds || (a.submittedAt ? new Date(a.submittedAt).getTime() : 0);
        const timeB = b.timestamp?.seconds || (b.submittedAt ? new Date(b.submittedAt).getTime() : 0);
        return timeB - timeA;
      });

      setSubmissions(subs);
    });

    // 7. Active Teachers
    const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      setActiveTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 8. Battalion Network status
    const studentNameLower = studentFullName.trim().toLowerCase();
    const unsubBattalion = onSnapshot(collection(db, 'battalion_profiles'), (snap) => {
      let foundMatch = false;
      let matchedProfile = null;

      for (let docSnap of snap.docs) {
        const data = docSnap.data();
        const profileName = (data.fullName || data.name || '').trim().toLowerCase();
        if (
          data.uid === profile?.uid || 
          data.uid === resolvedStudentId || 
          profileName === studentNameLower
        ) {
          foundMatch = true;
          matchedProfile = { id: docSnap.id, ...data };
          break;
        }
      }

      if (foundMatch || studentRecord?.battalionEnrolled || studentRecord?.status === 'passout' || profile?.status === 'passout') {
        setIsBattalionEnrolled(true);
        setBattalionProfile(matchedProfile || {});
      } else {
        setIsBattalionEnrolled(false);
        setBattalionProfile(null);
      }
    });

    // 9. Direct Faculty Communications & Attendance Notices
    const qComm = collection(db, 'student_communications');
    const unsubComm = onSnapshot(qComm, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => {
        const itemSid = item.studentId;
        const itemSName = (item.studentName || '').toLowerCase().trim();
        const itemSEmail = (item.studentEmail || '').toLowerCase().trim();
        const itemBatch = item.batch;

        return (
          (resolvedStudentId && itemSid === resolvedStudentId) ||
          (studentNameLower && itemSName === studentNameLower) ||
          (studentEmailNormalized && itemSEmail === studentEmailNormalized) ||
          (batchName && itemBatch === batchName && !itemSid)
        );
      });

      msgs.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });

      setDirectCommunications(msgs);
    });

    // 10. School Test Marks (Official School Examinations - Category C)
    const possibleStudentIds = [studentRecord?.id, profile?.studentId, profile?.uid, resolvedStudentId].filter(Boolean);
    const possibleStudentNames = [
      studentFullName.toLowerCase().trim(),
      (studentRecord?.studentName || '').toLowerCase().trim(),
      (studentRecord?.fullName || '').toLowerCase().trim()
    ].filter(Boolean);

    let unsubSchoolTest = null;
    const qSchool = batchName
      ? query(collection(db, 'school_test_marks'), where('batch', '==', batchName))
      : collection(db, 'school_test_marks');

    unsubSchoolTest = onSnapshot(qSchool, (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(exam => {
        const eSid = exam.studentId;
        const eName = (exam.studentName || '').toLowerCase().trim();
        return (
          (eSid && possibleStudentIds.includes(eSid)) ||
          (eName && possibleStudentNames.includes(eName))
        );
      });
      setSchoolTestRecords(records);
    }, (err) => console.warn('School test marks listener error:', err));

    setLoading(false);

    return () => {
      if (unsubMat) unsubMat();
      if (unsubSub) unsubSub();
      if (unsubAtt) unsubAtt();
      if (unsubTimetable) unsubTimetable();
      if (unsubLectureReports) unsubLectureReports();
      if (unsubTestMarks) unsubTestMarks();
      if (unsubSchoolTest) unsubSchoolTest();
      unsubTeachers();
      unsubBattalion();
      unsubComm();
    };
  }, [batchName, resolvedStudentId, studentFullName, studentEmailNormalized, studentRecord?.id]);

  // Handle Notice Acknowledgment
  const handleAcknowledgeNotice = async (noticeId) => {
    try {
      await updateDoc(doc(db, 'student_communications', noticeId), {
        readByStudent: true,
        acknowledgedAt: new Date()
      });
    } catch (err) {
      console.error("Failed to acknowledge notice:", err);
    }
  };

  // Submit Assignment
  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (!submitForm.assignmentId || !submitForm.driveLink.trim()) {
      return alert('Please select an assignment and provide your Google Drive link.');
    }

    setSubmittingAssignment(true);
    try {
      await addDoc(collection(db, 'submissions'), {
        studentId: resolvedStudentId,
        studentName: studentFullName,
        studentEmail: studentEmailNormalized,
        batch: batchName,
        assignmentId: submitForm.assignmentId,
        assignmentTitle: submitForm.assignmentTitle,
        driveLink: submitForm.driveLink.trim(),
        graded: false,
        timestamp: serverTimestamp()
      });

      setSubmitForm({ assignmentId: '', assignmentTitle: '', driveLink: '' });
      alert('✅ Assignment submitted successfully! Your teacher will grade and review it shortly.');
    } catch (err) {
      console.error('Submission error:', err);
      alert('Failed to submit assignment: ' + err.message);
    } finally {
      setSubmittingAssignment(false);
    }
  };

  // Submit Support Ticket
  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    if (!grievanceForm.category || !grievanceForm.description.trim()) {
      return alert('Please fill in all fields.');
    }

    setSubmittingGrievance(true);
    try {
      await addDoc(collection(db, 'grievances'), {
        studentId: resolvedStudentId,
        studentName: studentFullName,
        batch: batchName,
        category: grievanceForm.category,
        description: grievanceForm.description.trim(),
        status: 'Pending',
        timestamp: serverTimestamp()
      });

      await createNotification('branch_manager', 'grievance_new', {
        studentName: studentFullName,
        category: grievanceForm.category
      });
      await createNotification('service_manager', 'grievance_new', {
        studentName: studentFullName,
        category: grievanceForm.category
      });

      setGrievanceForm({ category: '', description: '' });
      alert('✅ Support ticket submitted successfully. Our Service Manager will attend to it within 24 hours.');
    } catch (err) {
      console.error(err);
      alert('Failed to submit ticket: ' + err.message);
    } finally {
      setSubmittingGrievance(false);
    }
  };

  // --- UNIFIED TEST & PERFORMANCE ANALYTICS CALCULATION ---
  const {
    unifiedTests,
    testTrendData,
    subjectAnalytics,
    overallAverageScore,
    bestRank,
    totalTestsCount
  } = useMemo(() => {
    const testsMap = new Map();

    const possibleStudentIds = [studentRecord?.id, profile?.studentId, profile?.uid, resolvedStudentId].filter(Boolean);
    const possibleStudentNames = [
      studentFullName.toLowerCase().trim(),
      (studentRecord?.studentName || '').toLowerCase().trim(),
      (studentRecord?.fullName || '').toLowerCase().trim(),
      (studentRecord?.name || '').toLowerCase().trim()
    ].filter(Boolean);

    // 1. From Batch Test Marks Listener (test_marks)
    batchTestMarks.forEach(docData => {
      const results = docData.results || [];
      const myResult = results.find(r => 
        (r.studentId && possibleStudentIds.includes(r.studentId)) ||
        (r.studentName && possibleStudentNames.includes(r.studentName.toLowerCase().trim()))
      );

      if (myResult) {
        const key = docData.id || `${docData.testDate}-${docData.subject}-${docData.topic}`;
        const maxM = Number(docData.maxMarks) || 100;
        const obtM = Number(myResult.marks) || 0;
        const pct = myResult.percentage !== undefined ? Number(myResult.percentage) : Math.round((obtM / maxM) * 100);

        testsMap.set(key, {
          id: key,
          date: docData.testDate || 'N/A',
          subject: docData.subject || 'General',
          topic: docData.topic || 'Class Test',
          type: docData.type || 'Weekly Test',
          maxMarks: maxM,
          obtainedMarks: obtM,
          percentage: pct,
          rank: myResult.batchRank || myResult.rank || null,
          remarks: myResult.remarks || (pct >= 80 ? 'Distinction' : pct >= 60 ? 'Satisfactory' : 'Needs Focus')
        });
      }
    });

    // 2. From studentRecord.testHistory
    const hist = studentRecord?.testHistory || [];
    hist.forEach(h => {
      const key = h.testId || `${h.date}-${h.subject}-${h.topic}`;
      if (!testsMap.has(key)) {
        const maxM = Number(h.maxMarks) || 100;
        const obtM = Number(h.obtainedMarks ?? h.marks ?? 0);
        const pct = h.percentage !== undefined ? Number(h.percentage) : Math.round((obtM / maxM) * 100);

        testsMap.set(key, {
          id: key,
          date: h.date || 'N/A',
          subject: h.subject || 'General',
          topic: h.topic || 'Class Test',
          type: h.type || 'Weekly Test',
          maxMarks: maxM,
          obtainedMarks: obtM,
          percentage: pct,
          rank: h.rank || h.batchRank || null,
          remarks: h.remarks || (pct >= 80 ? 'Distinction' : pct >= 60 ? 'Satisfactory' : 'Needs Focus')
        });
      }
    });

    // 3. From School Test Marks (Official School Exams - Category C)
    schoolTestRecords.forEach(exam => {
      const key = `school-${exam.id}`;
      const subjects = Object.keys(exam.marks || {});
      let obtM = 0;
      let maxM = 0;
      const subBreakdown = [];
      subjects.forEach(s => {
        const d = exam.marks[s];
        let val = typeof d === 'object' && d !== null ? Number(d.obtained || 0) : Number(d || 0);
        let mx = typeof d === 'object' && d !== null ? Number(d.max || 100) : Number(exam.maxMarks || 100);
        obtM += val;
        maxM += mx;
        subBreakdown.push(`${s}: ${val}/${mx}`);
      });
      if (maxM === 0) maxM = Number(exam.maxMarks) || 100;
      const pct = maxM > 0 ? Math.round((obtM / maxM) * 100) : 0;
      testsMap.set(key, {
        id: key,
        date: exam.createdAt ? (new Date(exam.createdAt).toLocaleDateString() || exam.createdAt) : 'N/A',
        subject: subjects.length > 0 ? subjects.join(', ') : 'School Subjects',
        topic: exam.testType || 'School Examination',
        type: 'School Exam',
        maxMarks: maxM,
        obtainedMarks: obtM,
        percentage: pct,
        rank: null,
        remarks: `Official School Exam (${exam.teacherName || 'Faculty'})` + (subBreakdown.length > 0 ? ` • ${subBreakdown.join(' | ')}` : '')
      });
    });

    const testList = Array.from(testsMap.values());

    // Sort newest first for table
    testList.sort((a, b) => {
      const parseD = (str) => {
        if (!str || typeof str !== 'string') return 0;
        if (str.includes('/')) {
          const parts = str.split('/');
          return new Date(parts.reverse().join('-')).getTime() || 0;
        }
        return new Date(str).getTime() || 0;
      };
      return parseD(b.date) - parseD(a.date);
    });

    // Trend data sorted chronologically (oldest to newest) for chart
    const trend = [...testList].reverse().map((t, idx) => ({
      name: t.date !== 'N/A' ? t.date : `Test #${idx + 1}`,
      percentage: t.percentage,
      score: t.obtainedMarks,
      subject: t.subject,
      rank: t.rank
    }));

    // Subject Breakdown
    const subMap = {};
    testList.forEach(t => {
      const s = t.subject || 'Other';
      if (!subMap[s]) subMap[s] = { count: 0, totalPct: 0 };
      subMap[s].count += 1;
      subMap[s].totalPct += t.percentage;
    });

    const subAnalytics = Object.keys(subMap).map(sub => ({
      subject: sub,
      average: Math.round(subMap[sub].totalPct / subMap[sub].count),
      testsCount: subMap[sub].count
    }));

    let totalPctSum = 0;
    let minRank = null;
    testList.forEach(t => {
      totalPctSum += t.percentage;
      if (t.rank && (minRank === null || t.rank < minRank)) {
        minRank = t.rank;
      }
    });

    const avg = testList.length > 0 ? Math.round(totalPctSum / testList.length) : 0;

    return {
      unifiedTests: testList,
      testTrendData: trend,
      subjectAnalytics: subAnalytics,
      overallAverageScore: avg,
      bestRank: minRank,
      totalTestsCount: testList.length
    };
  }, [batchTestMarks, schoolTestRecords, studentRecord?.testHistory, resolvedStudentId, studentRecord?.id, studentFullName]);

  // Category-filtered test list for UI table
  const filteredTests = useMemo(() => {
    if (testCategoryFilter === 'weekly') {
      return unifiedTests.filter(t => t.type?.toLowerCase().includes('weekly') || t.type?.toLowerCase().includes('saturday'));
    }
    if (testCategoryFilter === 'class') {
      return unifiedTests.filter(t => t.type?.toLowerCase().includes('class') || t.type?.toLowerCase().includes('surprise'));
    }
    if (testCategoryFilter === 'school') {
      return unifiedTests.filter(t => t.type?.toLowerCase().includes('school'));
    }
    return unifiedTests;
  }, [unifiedTests, testCategoryFilter]);

  // Derived Values
  const assignments = materials.filter(m => m.type === 'Assignment');
  const gradedSubmissions = submissions.filter(s => s.graded);
  const totalAssignments = assignments.length;
  const assignmentCompletionRate = totalAssignments > 0 ? Math.round((gradedSubmissions.length / totalAssignments) * 100) : 0;

  const allFeedbacks = studentRecord?.feedbacks || [];
  const allPtms = studentRecord?.ptmNotices || [];
  const pendingPtms = allPtms.filter(p => p.status === 'pending');
  const unreadNoticesCount = directCommunications.filter(c => !c.readByStudent).length;

  const totalClasses = attendance.length;
  const totalPresent = attendance.filter(a => a.status === 'Present').length;
  const attPercent = totalClasses ? Math.round((totalPresent / totalClasses) * 100) : 100;

  // Sidebar Badges Sync
  useEffect(() => {
    const performanceBadge = allFeedbacks.length;
    const noticeBadge = pendingPtms.length + unreadNoticesCount;
    const event = new CustomEvent('updateSidebarBadges', { 
      detail: { 
        'Performance': { count: performanceBadge, id: performanceBadge }, 
        'Teacher Feeds & Notices': { count: noticeBadge, id: noticeBadge } 
      } 
    });
    window.dispatchEvent(event);
  }, [allFeedbacks.length, pendingPtms.length, unreadNoticesCount]);

  const isAlumniOnly = profile?.status === 'passout' || studentRecord?.status === 'passout';
  useEffect(() => {
    if (isAlumniOnly && activeTab !== 'battalion') {
      setActiveTab('battalion');
    }
  }, [isAlumniOnly, activeTab]);

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading your dashboard...</p>
      </div>
    );
  }

  // --- TIMETABLE RESOLUTION HELPER ---
  let mySlot = null;
  let myRoom = null;
  let myData = null;

  for (const slot of Object.keys(timetable || {})) {
    for (const room of Object.keys(timetable[slot] || {})) {
      if (timetable[slot][room]?.batch === batchName) {
        mySlot = slot;
        myRoom = room;
        myData = timetable[slot][room];
        break;
      }
    }
    if (myData) break;
  }

  const daysOfWeekFull = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const todayDayStr = daysOfWeekFull[new Date().getDay()];
  let todayClass = null;
  if (myData) {
    if (['MONDAY','TUESDAY','WEDNESDAY'].includes(todayDayStr)) todayClass = myData.monWed;
    else if (['THURSDAY','FRIDAY','SATURDAY'].includes(todayDayStr)) todayClass = myData.thursSat;
    else if (todayDayStr === 'SUNDAY') todayClass = myData.extra;
  }

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="dashboard student-dashboard" style={{ paddingBottom: 60 }}>
      {/* Top Banner (Hidden on feed tab because feed has Hero Banner) */}
      {activeTab !== 'feed' && (
        <div className="dashboard-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
              {activeTab === 'performance' && 'Academic Performance & Analytics'}
              {activeTab === 'timetable' && 'Master Class Schedule'}
              {activeTab === 'submit' && 'Assignments & Course Materials'}
              {activeTab === 'attendance' && 'Attendance & Self-Study Logs'}
              {activeTab === 'feedback_ptm' && 'Faculty Advisories & Notices'}
              {activeTab === 'finances' && 'Student Financial Ledger'}
              {activeTab === 'support' && 'Help Desk & Grievances'}
              {activeTab === 'battalion' && 'The Shishyakul Battalion'}
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
              {studentFullName} • Batch: <strong style={{ color: 'var(--brand-primary)' }}>{batchName || 'General'}</strong>
            </p>
          </div>
        </div>
      )}

      {!batchName && !isAlumniOnly ? (
        <div className="empty-state" style={{ background: 'var(--surface-card)', padding: 40, borderRadius: 16, border: '1px solid var(--surface-border)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--status-warning)', marginBottom: 12 }}>school</span>
          <h3>Batch Allocation in Progress</h3>
          <p style={{ color: 'var(--text-secondary)' }}>You have not been assigned to an active classroom batch yet. Please contact the administration or center manager.</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: COCKPIT / FEED                                                     */}
          {/* ========================================================================= */}
          {activeTab === 'feed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* 1. Hero Greeting Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                padding: '32px 36px',
                borderRadius: 20,
                color: '#ffffff',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  width: '260px',
                  height: '260px',
                  background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0) 70%)',
                  borderRadius: '50%'
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span className="portal-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      {batchName}
                    </span>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h2 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                    Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {studentFullName.split(' ')[0]} 👋
                  </h2>
                  <p style={{ fontSize: 15, color: '#cbd5e1', margin: '0 0 24px 0', maxWidth: 640 }}>
                    Here is your live academic briefing. Stay disciplined, track your daily class targets, and maintain top attendance.
                  </p>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(10px)', padding: '10px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 20 }}>verified</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{attPercent}% Attendance</span>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(10px)', padding: '10px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: 20 }}>analytics</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Overall Average: {overallAverageScore}%</span>
                    </div>

                    {bestRank && (
                      <div style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(10px)', padding: '10px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <span className="material-symbols-outlined" style={{ color: '#fbbf24', fontSize: 20 }}>emoji_events</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Top Rank: #{bestRank}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. 4-Card KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {/* Attendance Card */}
                <div 
                  onClick={() => handleTabChange('attendance')}
                  style={{ 
                    background: '#ffffff', 
                    padding: '20px 24px', 
                    borderRadius: 16, 
                    border: '1px solid var(--surface-border)', 
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined">event_available</span>
                    </div>
                    <span className="portal-badge" style={{ background: attPercent >= 75 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: attPercent >= 75 ? '#10b981' : '#ef4444' }}>
                      {attPercent >= 75 ? 'Good' : 'Needs Attention'}
                    </span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{attPercent}%</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Attendance Record ({totalPresent}/{totalClasses} Classes)</div>
                </div>

                {/* Academic Average Card */}
                <div 
                  onClick={() => handleTabChange('performance')}
                  style={{ 
                    background: '#ffffff', 
                    padding: '20px 24px', 
                    borderRadius: 16, 
                    border: '1px solid var(--surface-border)', 
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined">military_tech</span>
                    </div>
                    <span className="portal-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                      {totalTestsCount} Tests
                    </span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{overallAverageScore}%</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Overall Academic Average</div>
                </div>

                {/* Assignments Completed Card */}
                <div 
                  onClick={() => handleTabChange('submit')}
                  style={{ 
                    background: '#ffffff', 
                    padding: '20px 24px', 
                    borderRadius: 16, 
                    border: '1px solid var(--surface-border)', 
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined">assignment_turned_in</span>
                    </div>
                    <span className="portal-badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                      {gradedSubmissions.length}/{totalAssignments} Done
                    </span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{assignmentCompletionRate}%</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Homework Completion Rate</div>
                </div>

                {/* Action Items Card */}
                <div 
                  onClick={() => handleTabChange('feedback_ptm')}
                  style={{ 
                    background: '#ffffff', 
                    padding: '20px 24px', 
                    borderRadius: 16, 
                    border: '1px solid var(--surface-border)', 
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: (unreadNoticesCount + pendingPtms.length > 0) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: (unreadNoticesCount + pendingPtms.length > 0) ? '#ef4444' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined">notifications_active</span>
                    </div>
                    {(unreadNoticesCount + pendingPtms.length > 0) && (
                      <span className="portal-badge" style={{ background: '#ef4444', color: '#fff', fontWeight: 700 }}>
                        ACTION REQ
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: (unreadNoticesCount + pendingPtms.length > 0) ? '#ef4444' : 'var(--text-primary)', lineHeight: 1 }}>
                    {unreadNoticesCount + pendingPtms.length}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Unread Advisories & PTMs</div>
                </div>
              </div>

              {/* 3. Bento Grid: 2 Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 24 }}>
                
                {/* Left Column (Primary Cockpit) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Today's Class at a Glance */}
                  <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>today</span>
                        Today's Scheduled Lecture ({todayDayStr})
                      </h3>
                      <button className="btn-ghost btn-sm" onClick={() => handleTabChange('timetable')} style={{ fontSize: 12, color: 'var(--brand-primary)', fontWeight: 600 }}>
                        View Full Week
                      </button>
                    </div>

                    {todayClass && todayClass.subject ? (
                      <div style={{ background: 'var(--surface-sunken)', padding: 20, borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <span className="portal-badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontWeight: 700 }}>
                              {mySlot || 'Scheduled Time'}
                            </span>
                            <h4 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--text-primary)' }}>
                              {todayClass.subject}
                            </h4>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                              Topic: <strong>{todayClass.topic || 'Regular Syllabus'}</strong>
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="portal-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontWeight: 600 }}>
                              Room: {myRoom || 'Kaksh 1'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--surface-border)', fontSize: 13, color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--brand-primary)' }}>person</span>
                            Faculty: {activeTeachers.find(t => t.id === todayClass.teacherId)?.fullName || 'Assigned Guru'}
                          </span>
                          <span style={{ color: 'var(--status-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span> Scheduled
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 32, background: 'var(--surface-sunken)', borderRadius: 12, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--surface-border)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 36, marginBottom: 8, color: 'var(--text-muted)' }}>event_busy</span>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No Lectures Scheduled Today</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>Take this opportunity for dedicated self-study and assignment revisions.</div>
                      </div>
                    )}
                  </div>

                  {/* Recently Taught & Class Homework Reports */}
                  <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ color: '#8b5cf6' }}>history_edu</span>
                        Recently Taught & Homework Log
                      </h3>
                      <button className="btn-ghost btn-sm" onClick={() => handleTabChange('feedback_ptm')} style={{ fontSize: 12, color: 'var(--brand-primary)', fontWeight: 600 }}>
                        View All
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {lectureReports.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, padding: 16 }}>No recent lecture summaries recorded yet.</p>
                      ) : (
                        lectureReports.slice(0, 3).map(lr => (
                          <div key={lr.id} style={{ padding: 16, background: 'var(--surface-sunken)', borderRadius: 12, border: '1px solid var(--surface-border)', borderLeft: '4px solid #8b5cf6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                              <div>
                                <span className="portal-badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', marginRight: 8 }}>{lr.subject}</span>
                                <strong style={{ fontSize: 14 }}>{lr.topicTaught}</strong>
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {lr.date || (lr.timestamp ? new Date(lr.timestamp.seconds * 1000).toLocaleDateString() : '')}
                              </span>
                            </div>

                            {lr.homework && (
                              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '8px 12px', borderRadius: 8, marginTop: 8, fontSize: 13, color: '#065f46', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <strong>Homework: </strong>{lr.homework}
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                              <span>Taught by: <strong>{lr.teacherName}</strong></span>
                              {lr.nextTarget && <span>Next Target: <em>{lr.nextTarget}</em></span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* Right Column (Secondary / Action Center) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Urgent Direct Teacher Communications & Notices */}
                  <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>campaign</span>
                        Action Center & Advisories
                      </h3>
                      {unreadNoticesCount > 0 && (
                        <span className="portal-badge" style={{ background: '#ef4444', color: '#fff', fontWeight: 700 }}>
                          {unreadNoticesCount} New
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {directCommunications.length === 0 && pendingPtms.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-sunken)', borderRadius: 12, border: '1px dashed var(--surface-border)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#10b981', marginBottom: 6 }}>task_alt</span>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>All clear!</div>
                          <div style={{ fontSize: 12 }}>No pending attendance warnings or PTM requests.</div>
                        </div>
                      ) : (
                        <>
                          {/* Direct Communications */}
                          {directCommunications.slice(0, 3).map(comm => {
                            const isAlert = comm.type === 'attendance_alert';
                            return (
                              <div key={comm.id} style={{
                                padding: 14,
                                background: isAlert ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-sunken)',
                                borderRadius: 12,
                                border: `1px solid ${isAlert ? 'rgba(239, 68, 68, 0.2)' : 'var(--surface-border)'}`
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                  <strong style={{ fontSize: 13, color: isAlert ? '#dc2626' : 'var(--text-primary)' }}>
                                    {comm.subject || 'Faculty Notice'}
                                  </strong>
                                  {!comm.readByStudent ? (
                                    <span className="portal-badge" style={{ background: '#ef4444', color: '#fff', fontSize: 10 }}>UNREAD</span>
                                  ) : (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Read</span>
                                  )}
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                                  "{comm.message}"
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                                  <span style={{ color: 'var(--text-muted)' }}>By {comm.teacherName}</span>
                                  {!comm.readByStudent && (
                                    <button 
                                      className="btn-ghost" 
                                      style={{ fontSize: 11, padding: '2px 8px', color: 'var(--brand-primary)', fontWeight: 600 }}
                                      onClick={() => handleAcknowledgeNotice(comm.id)}
                                    >
                                      Mark Read
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* PTM Notices */}
                          {pendingPtms.map((ptm, i) => (
                            <div key={`ptm-${i}`} style={{ padding: 14, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d97706', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
                                PTM Scheduled by {ptm.teacherName}
                              </div>
                              <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 6px 0' }}>
                                Date: <strong>{new Date(ptm.dateScheduled).toLocaleString()}</strong>. Reason: {ptm.reason}
                              </p>
                              {ptm.requiresManager && (
                                <span className="portal-badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: 10 }}>
                                  Manager Escalate
                                </span>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Latest Teacher Feedbacks */}
                  <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ color: '#0d9488' }}>rate_review</span>
                        Faculty Reviews
                      </h3>
                      <button className="btn-ghost btn-sm" onClick={() => handleTabChange('feedback_ptm')} style={{ fontSize: 12, color: 'var(--brand-primary)', fontWeight: 600 }}>
                        View All
                      </button>
                    </div>

                    {allFeedbacks.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, fontSize: 13 }}>No weekly teacher reviews published yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {allFeedbacks.slice(-2).reverse().map((fb, idx) => (
                          <div key={idx} style={{ padding: 14, background: 'rgba(13, 148, 136, 0.05)', borderRadius: 12, border: '1px solid rgba(13, 148, 136, 0.15)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <strong style={{ fontSize: 13, color: '#0f766e' }}>{fb.teacherName || 'Faculty'}</strong>
                              <div style={{ display: 'flex', gap: 2 }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                  <span key={star} className="material-symbols-outlined" style={{ fontSize: 14, color: star <= fb.rating ? '#f59e0b' : '#cbd5e1' }}>
                                    star
                                  </span>
                                ))}
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                              "{fb.review || fb.feedback}"
                            </p>
                            {fb.focusArea && (
                              <div style={{ fontSize: 11, color: '#d97706', marginTop: 6, fontWeight: 600 }}>
                                Focus Area: {fb.focusArea}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PERFORMANCE & ANALYTICS                                            */}
          {/* ========================================================================= */}
          {activeTab === 'performance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* 4 Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Overall Score Average</span>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--brand-primary)', margin: '8px 0 4px 0' }}>
                    {overallAverageScore}%
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Across all graded class & weekly tests</span>
                </div>

                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Highest Batch Rank</span>
                  <div style={{ fontSize: 32, fontWeight: 800, color: bestRank ? '#f59e0b' : 'var(--text-muted)', margin: '8px 0 4px 0' }}>
                    {bestRank ? `#${bestRank} 🏆` : 'N/A'}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>In scheduled Saturday Weekly Tests</span>
                </div>

                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Tests Graded</span>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6', margin: '8px 0 4px 0' }}>
                    {totalTestsCount}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Weekly & classroom examinations</span>
                </div>

                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Homework Completion</span>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981', margin: '8px 0 4px 0' }}>
                    {assignmentCompletionRate}%
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{gradedSubmissions.length} of {totalAssignments} assignments graded</span>
                </div>
              </div>

              {/* Progression Chart & Subject Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 24 }}>
                
                {/* Score Progression Trend Chart */}
                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>show_chart</span>
                    Test Score Progression Trend
                  </h3>

                  {testTrendData.length === 0 ? (
                    <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      No historical test scores recorded yet. Scores will plot here automatically.
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={testTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                          <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12 }}
                            formatter={(value, name, item) => [`${value}% (${item.payload.score} marks)`, item.payload.subject]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="percentage" 
                            stroke="var(--brand-primary)" 
                            strokeWidth={3} 
                            dot={{ fill: 'var(--brand-primary)', r: 4 }} 
                            activeDot={{ r: 7 }} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Subject-Wise Mastery Breakdown */}
                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: '#8b5cf6' }}>pie_chart</span>
                    Subject Mastery Breakdown
                  </h3>

                  {subjectAnalytics.length === 0 ? (
                    <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      No subject-wise test data available yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {subjectAnalytics.map((sub, i) => (
                        <div key={sub.subject} style={{ padding: '12px 14px', background: 'var(--surface-sunken)', borderRadius: 10, border: '1px solid var(--surface-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <strong style={{ fontSize: 14 }}>{sub.subject}</strong>
                            <span className="portal-badge" style={{ 
                              background: sub.average >= 75 ? 'rgba(16, 185, 129, 0.1)' : sub.average >= 50 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: sub.average >= 75 ? '#10b981' : sub.average >= 50 ? '#f59e0b' : '#ef4444'
                            }}>
                              {sub.average}% Avg ({sub.testsCount} tests)
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(sub.average, 100)}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Comprehensive Historical Tests Table with 3-Category Filter */}
              <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>fact_check</span>
                    Test Series & Examination Log
                  </h3>
                  {/* Category Filter Pills */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button 
                      className={`portal-btn ${testCategoryFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setTestCategoryFilter('all')}
                      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20 }}
                    >
                      All Tests ({unifiedTests.length})
                    </button>
                    <button 
                      className={`portal-btn ${testCategoryFilter === 'weekly' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setTestCategoryFilter('weekly')}
                      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20 }}
                    >
                      📅 Saturday Weekly ({unifiedTests.filter(t => t.type?.toLowerCase().includes('weekly') || t.type?.toLowerCase().includes('saturday')).length})
                    </button>
                    <button 
                      className={`portal-btn ${testCategoryFilter === 'class' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setTestCategoryFilter('class')}
                      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20 }}
                    >
                      ⚡ Class & Surprise ({unifiedTests.filter(t => t.type?.toLowerCase().includes('class') || t.type?.toLowerCase().includes('surprise')).length})
                    </button>
                    <button 
                      className={`portal-btn ${testCategoryFilter === 'school' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setTestCategoryFilter('school')}
                      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20 }}
                    >
                      🏫 Official School Exams ({unifiedTests.filter(t => t.type?.toLowerCase().includes('school')).length})
                    </button>
                  </div>
                </div>

                {filteredTests.length === 0 ? (
                  <div className="empty-state">No examination or test marks found for the selected category filter.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Subject & Topic</th>
                          <th>Type</th>
                          <th>Marks Obtained</th>
                          <th>Percentage</th>
                          <th>Batch Rank</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTests.map(test => {
                          const pct = test.percentage;
                          const rankDisplay = test.rank 
                            ? (test.rank === 1 ? '🥇 #1' : test.rank === 2 ? '🥈 #2' : test.rank === 3 ? '🥉 #3' : `#${test.rank}`) 
                            : '—';

                          return (
                            <tr key={test.id}>
                              <td style={{ fontWeight: 500 }}>{test.date}</td>
                              <td>
                                <strong>{test.subject}</strong>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{test.topic}</div>
                              </td>
                              <td>
                                <span className="portal-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                  {test.type}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {test.obtainedMarks} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {test.maxMarks}</span>
                              </td>
                              <td>
                                <span style={{ 
                                  fontWeight: 700, 
                                  color: pct >= 80 ? 'var(--status-success)' : pct >= 50 ? 'var(--status-warning)' : 'var(--status-error)' 
                                }}>
                                  {pct}%
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: test.rank <= 3 ? 700 : 500,
                                  background: test.rank === 1 ? '#fff8e1' : test.rank <= 3 ? '#eff6ff' : 'transparent',
                                  color: test.rank === 1 ? '#b45309' : test.rank <= 3 ? '#1d4ed8' : 'inherit'
                                }}>
                                  {rankDisplay}
                                </span>
                              </td>
                              <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{test.remarks}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: TIMETABLE (MASTER MATRIX WITH DYNAMIC TODAY HIGHLIGHT)            */}
          {/* ========================================================================= */}
          {activeTab === 'timetable' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.keys(timetable || {}).length === 0 || !myData ? (
                <div className="empty-state" style={{ background: '#ffffff', padding: 40, borderRadius: 16, border: '1px solid var(--surface-border)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 12 }}>calendar_month</span>
                  <h3>No Active Timetable Published</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>The master schedule for {batchName} has not been published yet.</p>
                </div>
              ) : (() => {
                const mapCycleToDays = (label, defaultDays) => {
                  const l = (label || '').toUpperCase();
                  if (!l) return defaultDays;
                  if (l === 'ALL DAYS') return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
                  if (l === 'MON-WED-FRI') return ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
                  if (l === 'TUES-THURS-SAT') return ['TUESDAY', 'THURSDAY', 'SATURDAY'];
                  if (l === 'WEEKENDS') return ['SATURDAY', 'SUNDAY'];

                  const DAYS_MAP = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                  const FULL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

                  if (l.includes('-')) {
                    let parts = l.split('-');
                    let sStr = parts[0].replace('THURS', 'THU').replace('TUES', 'TUE');
                    let eStr = parts[1].replace('THURS', 'THU').replace('TUES', 'TUE');
                    let sIdx = DAYS_MAP.indexOf(sStr);
                    let eIdx = DAYS_MAP.indexOf(eStr);
                    if (sIdx !== -1 && eIdx !== -1) {
                      let result = [];
                      for (let i = Math.min(sIdx, eIdx); i <= Math.max(sIdx, eIdx); i++) {
                        result.push(FULL_DAYS[i]);
                      }
                      return result;
                    }
                  }
                  return defaultDays;
                };

                const cycle1Days = mapCycleToDays(myData.monWedLabel, ['MONDAY', 'TUESDAY', 'WEDNESDAY']);
                const cycle2Days = mapCycleToDays(myData.thursSatLabel, ['THURSDAY', 'FRIDAY', 'SATURDAY']);

                const scheduleByDay = {};
                cycle1Days.forEach(d => { scheduleByDay[d] = { ...myData.monWed, type: 'regular' }; });
                cycle2Days.forEach(d => { scheduleByDay[d] = { ...myData.thursSat, type: 'regular' }; });

                if (myData?.test?.topic) {
                  scheduleByDay['SATURDAY'] = { type: 'test', topic: myData.test.topic, subject: 'WEEKLY TEST' };
                }
                if (myData?.extra?.subject || myData?.extra?.teacherId) {
                  scheduleByDay['SUNDAY'] = { ...myData.extra, type: 'extra' };
                }

                const parseStartDate = (text) => {
                  const match = (text || '').match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/);
                  if (match) {
                    let [_, d, m, y] = match;
                    return new Date(y.length === 2 ? 2000 + parseInt(y) : parseInt(y), parseInt(m) - 1, parseInt(d));
                  }
                  return null;
                };
                const startDate = parseStartDate(timetableHeaderDate);
                const formatDate = (dateObj) => {
                  if (!dateObj) return '';
                  return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear().toString().slice(-2)}`;
                };

                const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

                return (
                  <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid var(--surface-border)', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    {/* Header Info Strip */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Master Schedule: {batchName}</h2>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cycle Starting: {timetableHeaderDate || 'Active Session'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--surface-sunken)', border: '1px solid var(--surface-border)', fontSize: 13 }}>
                          <strong>Slot: </strong>{mySlot}
                        </div>
                        <div style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--surface-sunken)', border: '1px solid var(--surface-border)', fontSize: 13 }}>
                          <strong>Kaksh: </strong>{myRoom}
                        </div>
                      </div>
                    </div>

                    {/* Table Matrix */}
                    <div style={{ overflowX: 'auto' }}>
                      <table className="portal-table" style={{ margin: 0, minWidth: 700 }}>
                        <thead>
                          <tr>
                            <th style={{ width: '160px' }}>Day & Date</th>
                            <th>Subject</th>
                            <th>Topic / Syllabus</th>
                            <th>Assigned Guru</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {daysOfWeek.map((day, idx) => {
                            const cellData = scheduleByDay[day] || {};
                            const isToday = todayDayStr === day;
                            let dateDisplay = day;
                            if (startDate) {
                              const currentDate = new Date(startDate);
                              currentDate.setDate(startDate.getDate() + idx);
                              dateDisplay = (
                                <div>
                                  <div style={{ fontWeight: 700 }}>{day}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(currentDate)}</div>
                                </div>
                              );
                            }

                            const teacherName = activeTeachers?.find(t => t.id === cellData.teacherId)?.fullName || '';
                            const isHoliday = !cellData.subject && !cellData.topic && day === 'SUNDAY';

                            return (
                              <tr 
                                key={day} 
                                style={{ 
                                  background: isToday ? 'rgba(245, 158, 11, 0.05)' : undefined,
                                  borderLeft: isToday ? '4px solid var(--brand-primary)' : undefined
                                }}
                              >
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {isToday && (
                                      <span className="portal-badge" style={{ background: 'var(--brand-primary)', color: '#fff', fontSize: 10, padding: '1px 6px' }}>
                                        TODAY
                                      </span>
                                    )}
                                    {dateDisplay}
                                  </div>
                                </td>
                                <td>
                                  {isHoliday ? (
                                    <span style={{ color: '#06b6d4', fontWeight: 600 }}>Weekly Holiday</span>
                                  ) : cellData.type === 'test' ? (
                                    <span style={{ color: '#ef4444', fontWeight: 700 }}>WEEKLY TEST</span>
                                  ) : (
                                    <strong>{cellData.subject || '—'}</strong>
                                  )}
                                </td>
                                <td>{cellData.topic || '—'}</td>
                                <td>
                                  {isHoliday ? '—' : (
                                    <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                                      {teacherName || (cellData.type === 'test' ? 'Evaluation Squad' : 'Assigned Guru')}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {isHoliday ? (
                                    <span className="portal-badge" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>Off</span>
                                  ) : cellData.type === 'test' ? (
                                    <span className="portal-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Mandatory Test</span>
                                  ) : (
                                    <span className="portal-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Class Lecture</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: SUBMIT WORK & COURSE MATERIALS                                     */}
          {/* ========================================================================= */}
          {activeTab === 'submit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* 2-Column Split: Submit Form + My Submissions Log */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 24 }}>
                
                {/* Submit Form */}
                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>upload_file</span>
                    Submit Homework Work
                  </h3>

                  <form onSubmit={handleSubmitAssignment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Select Assignment</label>
                      <select 
                        className="portal-select"
                        value={submitForm.assignmentId}
                        onChange={e => {
                          const target = assignments.find(a => a.id === e.target.value);
                          setSubmitForm({
                            ...submitForm,
                            assignmentId: e.target.value,
                            assignmentTitle: target ? target.title : ''
                          });
                        }}
                        required
                      >
                        <option value="">-- Choose Assignment Task --</option>
                        {assignments.map(a => (
                          <option key={a.id} value={a.id}>{a.title} ({a.teacherName || 'Faculty'})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Your Google Drive Link</label>
                      <input 
                        type="url"
                        className="portal-input"
                        placeholder="https://drive.google.com/..."
                        value={submitForm.driveLink}
                        onChange={e => setSubmitForm({ ...submitForm, driveLink: e.target.value })}
                        required
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        Ensure permission is set to <strong>"Anyone with the link can view"</strong> so your teacher can review it.
                      </span>
                    </div>

                    <button 
                      type="submit" 
                      className="portal-btn btn-primary" 
                      disabled={submittingAssignment}
                      style={{ marginTop: 8 }}
                    >
                      {submittingAssignment ? 'Submitting Work...' : 'Submit Work for Review'}
                    </button>
                  </form>
                </div>

                {/* My Submissions & Teacher Feedback */}
                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: '#10b981' }}>grading</span>
                    My Submitted Homework & Grades
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {submissions.length === 0 ? (
                      <div className="empty-state">You have not submitted any assignments yet.</div>
                    ) : (
                      submissions.map(sub => (
                        <div key={sub.id} style={{ padding: 16, background: 'var(--surface-sunken)', borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <strong style={{ fontSize: 15 }}>{sub.assignmentTitle || 'Assignment Task'}</strong>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                Submitted on: {sub.timestamp?.toDate ? sub.timestamp.toDate().toLocaleDateString() : 'Recently'}
                              </div>
                            </div>

                            <div>
                              {sub.graded ? (
                                <span className="portal-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 700 }}>
                                  GRADED: {sub.marks} / 100
                                </span>
                              ) : (
                                <span className="portal-badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontWeight: 600 }}>
                                  Pending Grading
                                </span>
                              )}
                            </div>
                          </div>

                          {sub.feedback && (
                            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid var(--surface-border)', margin: '8px 0', fontSize: 13 }}>
                              <strong style={{ color: 'var(--brand-primary)', display: 'block', marginBottom: 2 }}>Teacher Feedback:</strong>
                              <p style={{ margin: 0, color: 'var(--text-primary)' }}>"{sub.feedback}"</p>
                              {sub.gradedBy && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>— Reviewed by {sub.gradedBy}</div>}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                            <a 
                              href={sub.driveLink} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                              View Submitted File
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Course Materials Resource Feed */}
              <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>menu_book</span>
                  Batch Study Materials & Question Banks
                </h3>

                {materials.length === 0 ? (
                  <div className="empty-state">No course materials or question banks published for your batch yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {materials.map(mat => (
                      <div key={mat.id} style={{ padding: 18, background: 'var(--surface-sunken)', borderRadius: 12, border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span className="portal-badge" style={{ background: mat.type === 'Assignment' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: mat.type === 'Assignment' ? '#f59e0b' : '#3b82f6' }}>
                            {mat.type}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mat.teacherName}</span>
                        </div>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700 }}>{mat.title}</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
                          {mat.description || 'No additional instructions.'}
                        </p>
                        <a 
                          href={mat.driveLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="portal-btn"
                          style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, textDecoration: 'none' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                          Access Resource
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: ATTENDANCE & BIOMETRIC LOGS                                        */}
          {/* ========================================================================= */}
          {activeTab === 'attendance' && (() => {
            const currentYear = calendarDate.getFullYear();
            const currentMonth = calendarDate.getMonth();
            const daysInMonth = getDaysInMonth(currentYear, currentMonth);
            const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Month Calendar Card */}
                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Biometric Attendance Calendar</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button className="btn-ghost btn-sm" onClick={handlePrevMonth} style={{ padding: '4px 8px' }}>
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      <strong style={{ fontSize: 16, minWidth: 140, textAlign: 'center' }}>
                        {monthNames[currentMonth]} {currentYear}
                      </strong>
                      <button className="btn-ghost btn-sm" onClick={handleNextMonth} style={{ padding: '4px 8px' }}>
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ maxWidth: 500, margin: '0 auto' }}>
                    <div className="grid-7" style={{ textAlign: 'center', marginBottom: 8 }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>{d}</div>
                      ))}
                    </div>

                    <div className="grid-7">
                      {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} style={{
                          aspectRatio: '1',
                          border: '1px solid var(--surface-border)',
                          borderRadius: 8,
                          background: 'rgba(0,0,0,0.02)'
                        }} />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const attRecord = attendance.find(a => a.date === dateString);

                        let bgColor = 'var(--surface-base)';
                        let color = 'var(--text-primary)';
                        let border = '1px solid var(--surface-border)';
                        let tooltipTitle = '';

                        if (attRecord) {
                          if (attRecord.status === 'Present') {
                            if (attRecord.lateInfo) {
                              bgColor = 'rgba(249, 115, 22, 0.15)';
                              color = '#f97316';
                              border = '1px solid #f97316';
                              tooltipTitle = `Late by ${attRecord.lateInfo.minutes} mins (${attRecord.lateInfo.reason})`;
                            } else {
                              bgColor = 'rgba(16, 185, 129, 0.15)';
                              color = 'var(--status-success)';
                              border = '1px solid var(--status-success)';
                              tooltipTitle = 'Present';
                            }
                          } else {
                            bgColor = 'rgba(239, 68, 68, 0.15)';
                            color = 'var(--status-error)';
                            border = '1px solid var(--status-error)';
                            tooltipTitle = 'Absent';
                          }
                        }

                        return (
                          <div 
                            key={day} 
                            title={tooltipTitle}
                            style={{
                              aspectRatio: '1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: bgColor,
                              color: color,
                              border: border,
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: tooltipTitle ? 'help' : 'default'
                            }}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Attendance Log Table */}
                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 700 }}>Detailed Attendance Log</h3>
                  {attendance.length === 0 ? (
                    <div className="empty-state">No attendance records logged for your batch yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="portal-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Session Type</th>
                            <th>Status</th>
                            <th>Biometric In / Out</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendance.map(att => (
                            <tr key={att.id}>
                              <td>{new Date(att.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td>{att.sessionType}</td>
                              <td>
                                <span className="portal-badge" style={{
                                  background: att.status === 'Present' && !att.lateInfo ? 'rgba(16, 185, 129, 0.1)' : att.lateInfo ? 'rgba(249, 115, 22, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  color: att.status === 'Present' && !att.lateInfo ? '#10b981' : att.lateInfo ? '#ea580c' : '#ef4444'
                                }}>
                                  {att.lateInfo ? `Late (${att.lateInfo.minutes}m)` : att.status}
                                </span>
                              </td>
                              <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {att.inOutTime ? `${att.inOutTime.in || '--'} to ${att.inOutTime.out || '--'}` : '—'}
                              </td>
                              <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {att.lateInfo?.reason || 'Regular attendance'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Extra Lecture & Self-Study Activity Logs (Front Desk Manager) */}
                {(() => {
                  const selfStudyRecords = attendance.filter(att => 
                    att.selfStudyLog || att.sessionType === 'Self-Study' || att.sessionType === 'Extra Lecture'
                  );

                  return (
                    <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="material-symbols-outlined" style={{ color: '#0d9488' }}>self_improvement</span>
                          Extra Lecture & Self-Study Activity Logs (Front Desk Manager)
                        </h3>
                        <span className="portal-badge" style={{ background: 'rgba(13, 148, 136, 0.1)', color: '#0d9488', fontWeight: 600 }}>
                          {selfStudyRecords.length} Sessions Logged
                        </span>
                      </div>

                      {selfStudyRecords.length === 0 ? (
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                          No self-study sessions or extra lecture logs recorded yet.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                          {selfStudyRecords.map(att => {
                            const log = att.selfStudyLog || {};
                            const inOut = att.inOutTime || {};
                            return (
                              <div key={att.id} style={{ background: 'var(--surface-sunken)', padding: 16, borderRadius: 12, border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <span className="portal-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontSize: 11, marginBottom: 4, display: 'inline-block' }}>
                                      {att.sessionType || 'Self-Study Session'}
                                    </span>
                                    <strong style={{ display: 'block', fontSize: 14 }}>
                                      {new Date(att.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                    </strong>
                                  </div>
                                  {log.teacherScore !== undefined && log.teacherScore !== null && (
                                    <span className="portal-badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: 12 }}>
                                      ⭐ {log.teacherScore} / 10
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div><strong>Subject:</strong> <span style={{ color: 'var(--text-secondary)' }}>{log.subject || 'Independent Study'}</span></div>
                                  {log.topic && <div><strong>Topic:</strong> <span style={{ color: 'var(--text-secondary)' }}>{log.topic}</span></div>}
                                  {log.notes && <div><strong>Notes:</strong> <span style={{ color: 'var(--text-secondary)' }}>{log.notes}</span></div>}
                                </div>

                                <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--surface-border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Biometric In/Out: <strong>{inOut.in || '--'} to {inOut.out || '--'}</strong></span>
                                  <span>Logged by Front Desk</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* TAB 6: FEEDBACK & PTM NOTICES                                             */}
          {/* ========================================================================= */}
          {activeTab === 'feedback_ptm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Direct Faculty Advisories & Attendance Notices */}
              <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>outgoing_mail</span>
                    Faculty Advisories & Attendance Notices
                  </h3>
                  {unreadNoticesCount > 0 && (
                    <span className="portal-badge" style={{ background: '#dc2626', color: '#fff', fontWeight: 700 }}>
                      {unreadNoticesCount} Unread
                    </span>
                  )}
                </div>

                {directCommunications.length === 0 ? (
                  <div className="empty-state">No direct advisories or notices posted yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {directCommunications.map(comm => {
                      const isAlert = comm.type === 'attendance_alert';
                      const dateStr = comm.createdAt?.toDate 
                        ? comm.createdAt.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                        : (comm.createdAt?.seconds ? new Date(comm.createdAt.seconds * 1000).toLocaleString() : 'Recent');

                      return (
                        <div key={comm.id} style={{
                          padding: 18,
                          background: isAlert ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-sunken)',
                          borderRadius: 12,
                          border: `1px solid ${isAlert ? 'rgba(239, 68, 68, 0.25)' : 'var(--surface-border)'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <strong style={{ fontSize: 15, color: isAlert ? '#991b1b' : 'var(--text-primary)' }}>
                                {comm.subject || 'Faculty Advisory'}
                              </strong>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>From: {comm.teacherName} ({comm.teacherRole || 'Faculty'}) • {dateStr}</div>
                            </div>

                            <div>
                              {comm.readByStudent ? (
                                <span className="portal-badge" style={{ background: '#e2e8f0', color: '#475569' }}>Read</span>
                              ) : (
                                <button 
                                  className="portal-btn btn-primary"
                                  style={{ padding: '4px 12px', fontSize: 12 }}
                                  onClick={() => handleAcknowledgeNotice(comm.id)}
                                >
                                  Mark as Acknowledged
                                </button>
                              )}
                            </div>
                          </div>

                          <p style={{ margin: '8px 0', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {comm.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PTM Notices */}
              <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: '#d97706' }}>warning</span>
                  Parent-Teacher Meeting (PTM) Notices
                </h3>

                {allPtms.length === 0 ? (
                  <div className="empty-state">No PTM meetings scheduled at this time.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...allPtms].reverse().map((ptm, idx) => (
                      <div key={idx} style={{ padding: 16, background: ptm.status === 'pending' ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-sunken)', borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <strong style={{ fontSize: 15 }}>Requested by Guru: {ptm.teacherName}</strong>
                          <span className="portal-badge" style={{ background: ptm.status === 'pending' ? '#ef4444' : '#64748b', color: '#fff' }}>
                            {ptm.status.toUpperCase()}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 4px 0', fontSize: 14 }}>Scheduled Time: <strong>{new Date(ptm.dateScheduled).toLocaleString()}</strong></p>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Reason: {ptm.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: FINANCES & STUDENT LEDGER                                         */}
          {/* ========================================================================= */}
          {activeTab === 'finances' && (() => {
            if (!studentRecord) {
              return <div className="empty-state"><div className="spinner" /> Fetching ledger details...</div>;
            }

            const totalFees = studentRecord.totalFees || 0;
            const paidInstallments = studentRecord.paidInstallments || [];
            const paymentDetails = studentRecord.paymentDetails || {};
            const installmentAmount = studentRecord.installments ? totalFees / studentRecord.installments : 0;
            const paidAmount = paidInstallments.length * installmentAmount;
            const pendingAmount = totalFees - paidAmount;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', borderLeft: '4px solid var(--brand-primary)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Course Fee</span>
                    <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                      ₹{totalFees.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', borderLeft: '4px solid #10b981', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Amount Paid</span>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#10b981', marginTop: 6 }}>
                      ₹{paidAmount.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', borderLeft: '4px solid #ef4444', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Pending Dues</span>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#ef4444', marginTop: 6 }}>
                      ₹{pendingAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 700 }}>Payment Installment Ledger</h3>
                  {paidInstallments.length === 0 ? (
                    <div className="empty-state">No payment receipts recorded yet.</div>
                  ) : (
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Installment #</th>
                          <th>Amount</th>
                          <th>Payment Date</th>
                          <th>Mode</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paidInstallments.map((instIdx) => {
                          const details = paymentDetails[instIdx] || {};
                          return (
                            <tr key={instIdx}>
                              <td style={{ fontWeight: 600 }}>Installment {instIdx + 1}</td>
                              <td style={{ color: '#10b981', fontWeight: 700 }}>₹{Math.round(installmentAmount).toLocaleString()}</td>
                              <td>{details.paidAt ? new Date(details.paidAt).toLocaleDateString() : 'Confirmed'}</td>
                              <td><span className="portal-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>{details.mode || 'Direct Cash'}</span></td>
                              <td><span className="portal-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Paid</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* TAB 8: SUPPORT & GRIEVANCE                                                */}
          {/* ========================================================================= */}
          {activeTab === 'support' && (
            <div style={{ maxWidth: 640, margin: '0 auto', background: '#ffffff', padding: 32, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 44, color: 'var(--brand-primary)' }}>support_agent</span>
                <h2 style={{ margin: '8px 0 4px 0', fontSize: '1.35rem', fontWeight: 800 }}>Student Support & Helpdesk</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Submit a grievance or request. Our Service Manager will resolve it within 24 hours.</p>
              </div>

              <form onSubmit={handleSupportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Category</label>
                  <select 
                    className="portal-select"
                    value={grievanceForm.category}
                    onChange={e => setGrievanceForm({ ...grievanceForm, category: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Category --</option>
                    <option value="Academic">Academic (Teacher / Syllabus Pacing)</option>
                    <option value="Infrastructure">Infrastructure (AC, Seating, Study Room)</option>
                    <option value="Batch Change">Batch Change Request</option>
                    <option value="Fee Issue">Fee / Installment Issue</option>
                    <option value="Other">Other Query</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Detailed Description</label>
                  <textarea 
                    className="portal-input"
                    rows={5}
                    placeholder="Provide details about your query or grievance..."
                    value={grievanceForm.description}
                    onChange={e => setGrievanceForm({ ...grievanceForm, description: e.target.value })}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="portal-btn btn-primary"
                  disabled={submittingGrievance}
                >
                  {submittingGrievance ? 'Submitting...' : 'Dispatch Ticket to Service Manager'}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 9: BATTALION NETWORK                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'battalion' && isBattalionEnrolled && (
            <BattalionNetwork profile={{ ...profile, ...studentRecord, ...battalionProfile }} />
          )}
        </>
      )}
    </div>
  );
}
