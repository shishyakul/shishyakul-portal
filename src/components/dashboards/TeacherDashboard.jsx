import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, setDoc, arrayUnion, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchTeacherPerformanceScore, fetchBatchAnalytics } from '../../utils/performanceMetrics';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Label } from 'recharts';
import TicketDrawer from '../TicketDrawer';
import NotificationDrawer from '../NotificationDrawer';
import { subscribeToInbox } from '../../services/tickets';
import NotificationBell from '../NotificationBell';
import { createNotification } from '../../services/notifications';

function StudentFeedbackModal({ student, teacherName, teacherId, onClose }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!review.trim()) return alert("Review is required.");
    setSaving(true);
    try {
      const fbData = {
        date: new Date().toISOString(),
        teacherId,
        teacherName,
        rating,
        review,
        focusArea
      };
      await updateDoc(doc(db, 'students', student.id), {
        feedbacks: arrayUnion(fbData)
      });
      alert('Feedback submitted successfully!');
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to submit feedback.');
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 12, width: 500, maxWidth: '90%', border: '1px solid #e0e0e0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h2>Submit Weekly Student Feedback</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Review for: <strong>{student.fullName}</strong></p>
        
        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label">Performance Rating (Stars)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <span key={star} onClick={() => setRating(star)} className="material-symbols-outlined" style={{ cursor: 'pointer', fontSize: 32, color: star <= rating ? '#fbc02d' : '#e0e0e0' }}>
                star
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Detailed Review</label>
          <textarea className="portal-input" style={{ minHeight: 80 }} placeholder="Write your feedback..." value={review} onChange={e => setReview(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Areas of Focus</label>
          <textarea className="portal-input" style={{ minHeight: 60 }} placeholder="What should they improve?" value={focusArea} onChange={e => setFocusArea(e.target.value)} />
        </div>

        <div className="modal-footer" style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand" onClick={handleSave} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SchedulePTMModal({ student, teacherName, teacherId, onClose }) {
  const [dateScheduled, setDateScheduled] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!dateScheduled || !reason.trim()) return alert("Date and Reason are required.");
    setSaving(true);
    try {
      const ptmData = {
        dateScheduled,
        teacherId,
        teacherName,
        reason,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'students', student.id), {
        ptmNotices: arrayUnion(ptmData)
      });
      alert('PTM Scheduled successfully! Notice sent to student portal.');
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to schedule PTM.');
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 12, width: 500, maxWidth: '90%', border: '1px solid #e0e0e0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h2>Schedule Parent Teacher Meeting</h2>
        <p style={{ color: 'var(--text-secondary)' }}>For: <strong>{student.fullName}</strong></p>
        
        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label">Date & Time</label>
          <input type="datetime-local" className="portal-input" value={dateScheduled} onChange={e => setDateScheduled(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Reason for Meeting</label>
          <textarea className="portal-input" style={{ minHeight: 80 }} placeholder="Why is this PTM being scheduled? (Strict Notice)" value={reason} onChange={e => setReason(e.target.value)} />
        </div>

        <div className="modal-footer" style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand" onClick={handleSave} disabled={saving}>
            {saving ? 'Scheduling...' : 'Send Strict Notice'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostLectureModal({ classData, teacherName, teacherId, onClose }) {
  const [topicTaught, setTopicTaught] = useState('');
  const [amountTaught, setAmountTaught] = useState('');
  const [homework, setHomework] = useState('');
  const [nextTarget, setNextTarget] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!topicTaught.trim() || !amountTaught.trim() || !homework.trim() || !nextTarget.trim()) {
      return alert("Please fill all the required fields.");
    }
    setSaving(true);
    try {
      const reportData = {
        teacherId,
        teacherName,
        batch: classData.batch,
        subject: classData.subject,
        topicTaught,
        amountTaught,
        homework,
        nextTarget,
        remarks,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        timestamp: serverTimestamp()
      };
      await addDoc(collection(db, 'lecture_reports'), reportData);
      alert('Post-Lecture Report submitted successfully!');
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to submit report.');
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 12, width: 500, maxWidth: '90%', border: '1px solid #e0e0e0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Post-Lecture Report</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Class: <strong>{classData.batch} ({classData.subject})</strong> | {classData.startTime} - {classData.endTime}</p>
        
        <div className="form-group">
          <label className="form-label">What did you teach?</label>
          <input type="text" className="portal-input" value={topicTaught} onChange={e => setTopicTaught(e.target.value)} placeholder="e.g. Thermodynamics intro" />
        </div>

        <div className="form-group">
          <label className="form-label">How much was covered?</label>
          <input type="text" className="portal-input" value={amountTaught} onChange={e => setAmountTaught(e.target.value)} placeholder="e.g. 2 Pages / 50%" />
        </div>

        <div className="form-group">
          <label className="form-label">What is the homework?</label>
          <textarea className="portal-input" style={{ minHeight: 60 }} value={homework} onChange={e => setHomework(e.target.value)} placeholder="Specify homework tasks" />
        </div>

        <div className="form-group">
          <label className="form-label">Next Target</label>
          <input type="text" className="portal-input" value={nextTarget} onChange={e => setNextTarget(e.target.value)} placeholder="What will be taught in the next class?" />
        </div>

        <div className="form-group">
          <label className="form-label">Any Remark (Optional)</label>
          <textarea className="portal-input" style={{ minHeight: 60 }} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any additional notes..." />
        </div>

        <div className="modal-footer" style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand" onClick={handleSave} disabled={saving}>
            {saving ? 'Posting...' : 'Post Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
const SUBJECTS = ['Mathematics', 'Science', 'SST', 'English', 'Hindi', 'Marathi', 'Sanskrit', 'Physics', 'Chemistry', 'Biology', 'Computer', 'Economics', 'Accounts'];

const MOTIVATIONAL_QUOTES = [
  "The influence of a good teacher can never be erased.",
  "Education is the most powerful weapon which you can use to change the world.",
  "A good teacher can inspire hope, ignite the imagination, and instill a love of learning.",
  "Teaching is the one profession that creates all other professions.",
  "The beautiful thing about learning is that no one can take it away from you.",
  "It is the supreme art of the teacher to awaken joy in creative expression and knowledge.",
  "To teach is to touch a life forever."
];

export default function TeacherDashboard({ profile }) {
  const { user } = useAuth();
  const teacherId = user?.uid || profile?.id;
  const location = useLocation();
  const navigate = useNavigate();

  const [isTicketOpen, setIsTicketOpen] = useState(false);
  
  // Ticket Notification Logic
  const [hasNewTicketAlert, setHasNewTicketAlert] = useState(false);
  const prevTicketCount = useRef(-1);

  useEffect(() => {
    if (isTicketOpen) {
      setHasNewTicketAlert(false);
    }
  }, [isTicketOpen]);

  useEffect(() => {
    if (!profile?.role || !user?.uid) return;
    return subscribeToInbox(profile.role, user.uid, (tickets) => {
       let count = tickets.length;
       tickets.forEach(t => {
          if (t.remarks) count += t.remarks.length;
       });
       
       if (prevTicketCount.current === -1) {
          if (tickets.some(t => t.status === 'pending')) {
             setHasNewTicketAlert(true);
          }
       } else if (count > prevTicketCount.current) {
          if (!isTicketOpen) {
            setHasNewTicketAlert(true);
          }
       }
       prevTicketCount.current = count;
    });
  }, [profile, user, isTicketOpen]);

  const [showQuote, setShowQuote] = useState(false);
  const quoteOfTheDay = MOTIVATIONAL_QUOTES[Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000) % MOTIVATIONAL_QUOTES.length];

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowQuote(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, []);

  const [activeTab, setActiveTab] = useState(() => {
    return location.hash.replace('#', '') || 'home';
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

  const toggleWeeklyTarget = async (idx) => {
    if (!profile?.currentWeeklyTargets) return;
    const newTargets = [...profile.currentWeeklyTargets];
    newTargets[idx].completed = !newTargets[idx].completed;
    try {
      await updateDoc(doc(db, 'users', teacherId), { currentWeeklyTargets: newTargets });
    } catch (error) {
      console.error('Failed to update weekly target:', error);
    }
  };
  const [materials, setMaterials] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [timetables, setTimetables] = useState([]); // Kept for backward compatibility if needed, but we will use `timetable` object
  const [timetable, setTimetable] = useState({});
  const [timetableHeaderDate, setTimetableHeaderDate] = useState('');
  const [testWorkflows, setTestWorkflows] = useState({});
  const [teacherTasks, setTeacherTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [iProfileOpen, setIProfileOpen] = useState(false);

  const [gradingModal, setGradingModal] = useState({ isOpen: false, testId: null, batch: '', maxMarks: 0, testDate: '', subject: '', topic: '', batchStudents: [] });
  const [classTestModal, setClassTestModal] = useState({ isOpen: false, step: 1, form: { date: '', time: '', subject: SUBJECTS[0], batch: (profile?.assignedBatches || [])[0] || '', maxMarks: '' }, students: [] });
  const [marksData, setMarksData] = useState({});
  const [draftModal, setDraftModal] = useState({ isOpen: false, duty: null, link: '', startDate: null });
  const [postLectureModal, setPostLectureModal] = useState({ isOpen: false, classData: null });

  const [testRecords, setTestRecords] = useState([]);
  const [viewTestRecord, setViewTestRecord] = useState(null);
  const [viewTestRecordStudents, setViewTestRecordStudents] = useState([]);

  const [feedbackStudent, setFeedbackStudent] = useState(null);
  const [teacherAttendanceRecords, setTeacherAttendanceRecords] = useState([]);

  // Fetch Teacher Attendance from Firebase
  useEffect(() => {
    if (!teacherId) return;
    const q = query(
      collection(db, 'teacher_attendance'),
      where('teacherId', '==', teacherId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // sort by date descending
      records.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTeacherAttendanceRecords(records);
    });
    return () => unsub();
  }, [teacherId]);

  const injectFakeAttendanceData = async () => {
    const fakeRecords = [
      { teacherId, date: new Date().toISOString().split('T')[0], punchIn: '09:45 AM', punchOut: '--:-- --', status: 'On Time', totalHours: '--', roleCompleted: false },
      { teacherId, date: new Date(Date.now() - 86400000).toISOString().split('T')[0], punchIn: '09:50 AM', punchOut: '06:15 PM', status: 'On Time', totalHours: '8h 25m', roleCompleted: true },
      { teacherId, date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], punchIn: '10:15 AM', punchOut: '06:30 PM', status: 'Late', totalHours: '8h 15m', roleCompleted: true },
      { teacherId, date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0], punchIn: '09:40 AM', punchOut: '06:00 PM', status: 'On Time', totalHours: '8h 20m', roleCompleted: false },
      { teacherId, date: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0], punchIn: '09:55 AM', punchOut: '06:05 PM', status: 'On Time', totalHours: '8h 10m', roleCompleted: true },
    ];
    for (const rec of fakeRecords) {
      await addDoc(collection(db, 'teacher_attendance'), rec);
    }
    alert('Fake records injected!');
  };
  
  // --- Teacher Attendance Calendar State ---
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [isStatsFlipped, setIsStatsFlipped] = useState(false);
  const [isHolidayStatsFlipped, setIsHolidayStatsFlipped] = useState(false);
  const [isYearlyAttendanceFlipped, setIsYearlyAttendanceFlipped] = useState(false);
  const [holidayDetailsType, setHolidayDetailsType] = useState(null);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({ type: 'summer', startDate: '', endDate: '', reason: '', days: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);

  useEffect(() => {
    if (!teacherId) return;
    const q = query(collection(db, 'leave_requests'), where('teacherId', '==', teacherId));
    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      setLeaveRequests(records);
    });
    return () => unsub();
  }, [teacherId]);

  // --- Dynamic Holiday Analytics ---
  const yearlyHolidayStats = {
    summer: { quota: 15, used: 0, label: 'Summer Vacation', color: '#fbc02d' },
    sick: { quota: 5, used: 0, label: 'Sick Leave', color: '#e53935' },
    festival: { quota: 5, used: 0, label: 'Festival', color: '#8e24aa' },
    travel: { quota: 5, used: 0, label: 'Travel + Village', color: '#039be5' },
  };

  leaveRequests.forEach(req => {
    if (req.status === 'approved' && yearlyHolidayStats[req.type]) {
      yearlyHolidayStats[req.type].used += parseInt(req.totalDays || 0);
    }
  });

  const totalHolidaysQuota = 30;
  const totalHolidaysUsed = Object.values(yearlyHolidayStats).reduce((acc, curr) => acc + curr.used, 0);
  const totalHolidaysLeft = totalHolidaysQuota - totalHolidaysUsed;
  
  const monthlyHolidayBreakdownMap = {};
  leaveRequests.forEach(req => {
     if (req.status === 'approved' && req.startDate) {
        const d = new Date(req.startDate);
        const monthKey = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!monthlyHolidayBreakdownMap[monthKey]) monthlyHolidayBreakdownMap[monthKey] = 0;
        monthlyHolidayBreakdownMap[monthKey] += parseInt(req.totalDays || 0);
     }
  });
  const monthlyHolidayBreakdown = Object.entries(monthlyHolidayBreakdownMap)
     .map(([month, used]) => ({ month, used }))
     .sort((a, b) => new Date(b.month) - new Date(a.month))
     .slice(0, 4);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handleLeaveSubmit = async () => {
    if (!leaveFormData.days || !leaveFormData.startDate || !leaveFormData.endDate || !leaveFormData.reason) {
      alert("Please fill all required fields, including the number of days.");
      return;
    }
    const sDate = new Date(leaveFormData.startDate);
    const eDate = new Date(leaveFormData.endDate);
    if (eDate < sDate) {
      alert("End date cannot be before start date.");
      return;
    }
    const days = parseInt(leaveFormData.days, 10);
    if (isNaN(days) || days <= 0) {
      alert("Please enter a valid number of days.");
      return;
    }

    const selectedTypeStats = yearlyHolidayStats[leaveFormData.type];
    if (selectedTypeStats && (selectedTypeStats.used + days > selectedTypeStats.quota)) {
      alert(`You only have ${selectedTypeStats.quota - selectedTypeStats.used} days left for ${selectedTypeStats.label}.`);
      return;
    }
    
    if (totalHolidaysUsed + days > totalHolidaysQuota) {
      alert(`You only have ${totalHolidaysQuota - totalHolidaysUsed} days left in your total yearly quota of ${totalHolidaysQuota} days.`);
      return;
    }

    setLeaveSaving(true);
    try {
      await addDoc(collection(db, 'leave_requests'), {
        teacherId,
        teacherName: profile?.fullName || 'Teacher',
        type: leaveFormData.type,
        startDate: leaveFormData.startDate,
        endDate: leaveFormData.endDate,
        totalDays: days,
        reason: leaveFormData.reason,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      
      // Notify managers
      await createNotification('branch_manager', 'leave_request_new', {
        teacherName: profile?.fullName || 'Teacher',
        type: leaveFormData.type,
        days: days
      });
      await createNotification('service_manager', 'leave_request_new', {
        teacherName: profile?.fullName || 'Teacher',
        type: leaveFormData.type,
        days: days
      });

      alert("Leave Request Submitted successfully!");
      setLeaveModalOpen(false);
      setLeaveFormData({ type: 'summer', startDate: '', endDate: '', reason: '', days: '' });
    } catch (e) {
      console.error(e);
      alert("Failed to submit leave request.");
    }
    setLeaveSaving(false);
  };

  const handlePrevMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Mock Stats Generator based on month
  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();
  
  const generateMockStats = (year, month) => {
    const totalDays = getDaysInMonth(year, month);
    // Simple deterministic logic based on month index to simulate dynamic data
    const workingDays = Math.floor(totalDays * 0.75); 
    const presentDays = workingDays - (month % 3); 
    const lateMarks = month % 4;
    const holidaysTook = (month % 2) + 1;
    const absentDays = workingDays - presentDays;
    const sundays = 4; // Mock sundays count
    return {
      workingDays,
      absentDays,
      presentDays,
      lateMarks,
      holidaysTook,
      sundays
    };
  };

  const monthlyStats = generateMockStats(currentYear, currentMonth);
  const yearlyAttendanceStats = Array.from({ length: 12 }).reduce((acc, _, idx) => {
    const s = generateMockStats(currentYear, idx);
    acc.workingDays += s.workingDays;
    acc.presentDays += s.presentDays;
    acc.absentDays += s.absentDays;
    return acc;
  }, { workingDays: 0, presentDays: 0, absentDays: 0 });
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // ----------------------------------------
  const [ptmStudent, setPtmStudent] = useState(null);
  const [selectedBatchTab, setSelectedBatchTab] = useState(null);
  
  const [performanceScore, setPerformanceScore] = useState(null);
  const [selectedBatchAnalytics, setSelectedBatchAnalytics] = useState({ avgAttendance: 0, avgMarks: 0, students: [] });
  const [fetchingBatch, setFetchingBatch] = useState(false);

  useEffect(() => {
    if (activeTab === 'batches' && !selectedBatchTab && profile?.assignedBatches?.length > 0) {
      setSelectedBatchTab(profile.assignedBatches[0]);
    }
  }, [activeTab, profile?.assignedBatches, selectedBatchTab]);

  useEffect(() => {
    if (teacherId) {
      fetchTeacherPerformanceScore(teacherId).then(score => setPerformanceScore(score));
    }
  }, [teacherId]);

  const [batchSelfStudyLogs, setBatchSelfStudyLogs] = useState([]);
  const [ratingModal, setRatingModal] = useState({ isOpen: false, docId: null, studentId: null, score: 10 });

  const handleSaveRating = async () => {
    try {
      const attDocRef = doc(db, 'attendance', ratingModal.docId);
      await updateDoc(attDocRef, {
        [`selfStudyLogs.${ratingModal.studentId}.teacherScore`]: ratingModal.score
      });
      setBatchSelfStudyLogs(prev => prev.map(log => 
        (log.docId === ratingModal.docId && log.studentId === ratingModal.studentId)
          ? { ...log, log: { ...log.log, teacherScore: ratingModal.score } }
          : log
      ));
      setRatingModal({ isOpen: false, docId: null, studentId: null, score: 10 });
    } catch(err) {
      console.error(err);
      alert('Failed to save rating');
    }
  };

  useEffect(() => {
    if (selectedBatchTab) {
      setFetchingBatch(true);
      fetchBatchAnalytics(selectedBatchTab).then(data => {
        setSelectedBatchAnalytics(data);
        setFetchingBatch(false);
      });

      // Fetch Self Study Logs for the batch
      const qAtt = query(collection(db, 'attendance'), where('batch', '==', selectedBatchTab), where('sessionType', '==', 'Self-Study'));
      getDocs(qAtt).then(snap => {
        const logs = [];
        snap.forEach(doc => {
          const data = doc.data();
          if (data.selfStudyLogs) {
            Object.keys(data.selfStudyLogs).forEach(studentId => {
              logs.push({
                id: `${doc.id}_${studentId}`,
                docId: doc.id,
                date: data.date,
                studentId: studentId,
                inOutTime: data.inOutTimes ? data.inOutTimes[studentId] : null,
                log: data.selfStudyLogs[studentId]
              });
            });
          }
        });
        logs.sort((a,b) => new Date(b.date) - new Date(a.date));
        setBatchSelfStudyLogs(logs);
      });
    }
  }, [selectedBatchTab]);

  // Material Form
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    type: 'Notes',
    batch: (profile?.assignedBatches || [])[0] || '',
    driveLink: '',
    description: ''
  });
  // Syllabus Tracking State
  const [syllabusData, setSyllabusData] = useState([]);
  const [syllabusUpdates, setSyllabusUpdates] = useState({});
  const [syllabusLogs, setSyllabusLogs] = useState({});
  const [facultyMap, setFacultyMap] = useState({});

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data().fullName || d.data().email || 'Unknown Teacher'; });
      setFacultyMap(map);
    });

    // 1. Listen to Course Materials (only if assigned batches exist)
    let unsubMat = () => {};
    if (profile?.assignedBatches?.length > 0) {
      const qMat = query(collection(db, 'course_materials'), where('batch', 'in', profile.assignedBatches));
      unsubMat = onSnapshot(qMat, (snap) => {
        setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
      });
    }

    // 2. Listen to Submissions (only if assigned batches exist)
    let unsubSub = () => {};
    if (profile?.assignedBatches?.length > 0) {
      const qSub = query(collection(db, 'submissions'), where('batch', 'in', profile.assignedBatches));
      unsubSub = onSnapshot(qSub, (snap) => {
        setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
      });
    }

    // 3. (Removed students onSnapshot to prevent mass read limits. Using lazy loading instead.)

    // 4. Listen to Master Timetable and Workflows
    const unsubTimetable = onSnapshot(doc(db, 'timetables', 'master'), (docSnap) => {
      if(docSnap.exists()) {
        const data = docSnap.data();
        setTimetable(data.schedule || {});
        setTimetableHeaderDate(data.headerDate || '');
      } else {
        setTimetable({});
      }
    });

    const unsubWorkflows = onSnapshot(collection(db, 'test_workflows'), (snapshot) => {
      const w = {};
      snapshot.forEach(d => w[d.id] = d.data());
      setTestWorkflows(w);
    });

    // 5. Listen to Syllabus Progress
    const qSyl = query(collection(db, 'syllabus_progress'), where('teacherId', '==', teacherId));
    const unsubSyl = onSnapshot(qSyl, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSyllabusData(data);
      
      const upds = {};
      const lgs = {};
      data.forEach(d => {
        upds[d.batch] = d.progress;
        lgs[d.batch] = d.lastChapter;
      });
      setSyllabusUpdates(upds);
      setSyllabusLogs(lgs);
    });

    // 6. Listen to Tasks
    let unsubTasks = () => {};
    if (teacherId) {
      const qTasks = query(collection(db, 'tasks'), where('assigneeId', '==', teacherId));
      unsubTasks = onSnapshot(qTasks, (snap) => {
        setTeacherTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    // 7. Listen to Test Records
    let unsubTestRecords = () => {};
    if (teacherId) {
      const qTestRecords = query(collection(db, 'test_marks'), where('uploadedBy', '==', teacherId));
      unsubTestRecords = onSnapshot(qTestRecords, (snap) => {
        setTestRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)));
      });
    }

    setLoading(false);

    return () => {
      unsubMat();
      unsubSub();
      unsubTimetable(); 
      unsubSyl(); 
      unsubUsers();
      unsubWorkflows();
      unsubTasks();
      unsubTestRecords();
    };
  }, [profile?.assignedBatches, teacherId]);

  const handlePostMaterial = async (e) => {
    e.preventDefault();
    if (!newMaterial.title || !newMaterial.driveLink) return alert('Title and Drive Link are required');
    try {
      await addDoc(collection(db, 'course_materials'), {
        ...newMaterial,
        teacherId: profile.uid,
        teacherName: profile.fullName,
        timestamp: serverTimestamp()
      });
      setNewMaterial(p => ({ ...p, title: '', driveLink: '', description: '' }));
      alert('Material posted successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to post material');
    }
  };

  const handleGradeSubmission = async (subId, marks) => {
    try {
      await updateDoc(doc(db, 'submissions', subId), {
        marks: Number(marks),
        graded: true,
        gradedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      alert('Failed to save grade');
    }
  };


  const handleSaveProgress = async (batch) => {
    const progress = syllabusUpdates[batch] || 0;
    const log = syllabusLogs[batch] || '';
    if (!log.trim()) return alert('Please enter a subject log before saving.');
    
    const docId = `${batch.replace(/[^a-zA-Z0-9]/g, '_')}_${teacherId}`;
    try {
      await setDoc(doc(db, 'syllabus_progress', docId), {
        batch,
        teacherId,
        teacherName: profile.fullName,
        subject: profile.subjects || 'General',
        progress: Number(progress),
        lastChapter: log.trim(),
        timestamp: serverTimestamp()
      });
      alert('Syllabus progress updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update progress.');
    }
  };
  if (loading) return <div className="empty-state"><div className="spinner"/></div>;

  const assignedBatches = profile?.assignedBatches || [];

  const parseStartDate = (text) => {
    if (!text) return new Date();
    const match = text.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/);
    if (match) {
      let [_, d, m, y] = match;
      return new Date(y.length === 2 ? 2000 + parseInt(y) : parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d;
    return new Date();
  };
  const startDate = parseStartDate(timetableHeaderDate);
  const formatDate = (dateObj) => {
    if (!dateObj) return '';
    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear().toString().slice(-2)}`;
  };
  const getSaturdayDateStr = () => {
    if (!startDate) return 'UNKNOWN';
    const sat = new Date(startDate);
    sat.setDate(sat.getDate() + 5);
    return formatDate(sat);
  };
  const saturdayDateStr = getSaturdayDateStr();

  // Extract Test Duties Globally (merged per test)
  const allTestDuties = [];
  for (const slot of Object.keys(timetable)) {
    for (const room of Object.keys(timetable[slot] || {})) {
      const cell = timetable[slot][room];
      if (cell?.test) {
        if (cell.test.preparedBy === teacherId || cell.test.checkedBy === teacherId) {
          const testId = `${saturdayDateStr.replace(/\//g, '-')}_${cell.batch}`;
          const workflow = testWorkflows[testId];
          const isPreparer = cell.test.preparedBy === teacherId;
          const isChecker = cell.test.checkedBy === teacherId;
          const prepName = facultyMap[cell.test.preparedBy] || 'Unknown';
          const checkName = facultyMap[cell.test.checkedBy] || 'Unknown';
          
          allTestDuties.push({
            batch: cell.batch,
            topic: cell.test.topic,
            subject: cell.thursSat.subject,
            room,
            testId,
            workflow,
            isPreparer,
            isChecker,
            prepName,
            checkName
          });
        }
      }
    }
  }

  const upcomingTestDuties = allTestDuties.filter(duty => duty.workflow?.status !== 'graded');
  const completedTestDuties = allTestDuties.filter(duty => duty.workflow?.status === 'graded');

  const formatDateForAttendance = (date) => {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Board Countdown logic
  const getDaysLeftForBoard = () => {
    const today = new Date();
    let targetYear = today.getFullYear();
    if (today.getMonth() > 0 || (today.getMonth() === 0 && today.getDate() > 31)) {
       targetYear += 1;
    }
    const targetDate = new Date(targetYear, 0, 31);
    const diffTime = Math.abs(targetDate - today);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };
  const boardDaysLeft = getDaysLeftForBoard();

  const perfData = performanceScore || {
    totalScore: 0,
    breakdown: { attendance: 0, feedback: 0, tasks: 0, syllabus: 0, tests: 0 },
    advice: 'Loading performance data...'
  };

  // Smart Scheduler logic
  const isLectureFinished = (endTimeStr) => {
    try {
      const now = new Date();
      const match = endTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return false;
      let hours = parseInt(match[1]);
      const mins = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      const endTime = new Date();
      endTime.setHours(hours, mins, 0, 0);
      
      return now >= endTime;
    } catch {
      return false;
    }
  };

  const daysOfWeekFull = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayStr = daysOfWeekFull[new Date().getDay()];

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
     } else {
       let sStr = l.replace('THURS', 'THU').replace('TUES', 'TUE');
       let idx = DAYS_MAP.indexOf(sStr);
       if (idx !== -1) return [FULL_DAYS[idx]];
     }
     return defaultDays; 
  };
  
  const todaysClasses = [];
  let classIdCounter = 1;

  for (const slot of Object.keys(timetable || {})) {
    for (const room of Object.keys(timetable[slot] || {})) {
      const cell = timetable[slot][room];
      if (!cell) continue;

      let subjectForToday = null;

      if (teacherId && cell?.monWed?.teacherId === teacherId) {
        const days = mapCycleToDays(cell.monWedLabel, ['MONDAY', 'TUESDAY', 'WEDNESDAY']);
        if (days.includes(todayStr)) {
          subjectForToday = cell.monWed.subject;
        }
      }
      
      if (!subjectForToday && teacherId && cell?.thursSat?.teacherId === teacherId) {
        const days = mapCycleToDays(cell.thursSatLabel, ['THURSDAY', 'FRIDAY', 'SATURDAY']);
        if (days.includes(todayStr)) {
          subjectForToday = cell.thursSat.subject;
        }
      }

      if (!subjectForToday && teacherId && cell?.extra?.teacherId === teacherId) {
        if (todayStr === 'SUNDAY') {
           subjectForToday = cell.extra.subject;
        }
      }

      if (subjectForToday) {
         const times = slot.includes(' TO ') ? slot.split(' TO ') : slot.split(' - ');
         todaysClasses.push({
           id: classIdCounter++,
           startTime: times[0]?.trim() || '',
           endTime: times[1]?.trim() || slot,
           batch: cell.batch,
           subject: subjectForToday
         });
      }
    }
  }

  // Sort by start time roughly
  todaysClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Create dynamic post-lecture reminders
  const dynamicTeacherNotifications = [];
  todaysClasses.forEach(cls => {
    if (isLectureFinished(cls.endTime)) {
      dynamicTeacherNotifications.push({
        id: `local-post-lecture-${cls.id}`,
        notifType: 'lecture',
        topicName: cls.subject,
        batch: cls.batch,
        teacherName: profile?.fullName || 'Teacher',
        durationHours: 2,
        date: new Date().toLocaleDateString()
      });
    }
  });

  return (
    <div>
      <div className="page-header" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '48px', width: '100%' }}>
        
        {/* perfectly centered Animated Text Zone */}
        <div className="quote-container" style={{ position: 'relative', width: '100%', boxSizing: 'border-box', height: '40px', paddingRight: '200px' }}>
          <h1 className="page-title quote-title" style={{ 
            margin: 0, 
            position: 'absolute', left: 0, right: 0, textAlign: 'left',
            opacity: showQuote ? 0 : 1, transform: showQuote ? 'translateY(-20px)' : 'translateY(0)',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: 'clamp(18px, 2.5vw, 28px)',
            fontWeight: 800,
            background: 'linear-gradient(90deg, var(--brand-primary) 0%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px'
          }}>
            👋 We are happy to welcome you on board!
          </h1>
          <h1 className="page-title quote-text" style={{ 
            margin: 0, 
            position: 'absolute', left: 0, right: 0, textAlign: 'left',
            opacity: showQuote ? 1 : 0, transform: showQuote ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 'clamp(15px, 2vw, 22px)',
            letterSpacing: '0.3px',
            color: '#6b7280' // subtle gray for the quote
          }}>
            "{quoteOfTheDay}"
          </h1>
        </div>

        {/* Right Buttons - Anchored to the edge */}
        <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 10 }}>
          {activeTab === 'dashboard_hub' ? (
            <button 
              className="btn" 
              onClick={() => handleTabChange('home')}
              style={{ width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--brand-primary)', color: 'white', border: 'none', transition: 'transform 0.2s' }}
              title="Dashboard"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>dashboard</span>
            </button>
          ) : (
            <button 
              className="btn" 
              onClick={() => handleTabChange('dashboard_hub')}
              style={{ width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--brand-primary)', color: 'white', border: 'none', transition: 'transform 0.2s' }}
              title="Home"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home</span>
            </button>
          )}
          
          <button 
            className="btn btn-ghost" 
            onClick={() => setIProfileOpen(true)}
            style={{ width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid var(--surface-border)', background: 'white', transition: 'transform 0.2s' }}
            title="Profile"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-primary)' }}>person</span>
          </button>
          
          <button 
            className="btn btn-ghost"
            onClick={() => setIsTicketOpen(true)}
            style={{ position: 'relative', width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid var(--surface-border)', background: 'white', color: 'var(--brand-primary)', transition: 'transform 0.2s' }}
            title="Open Tickets"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>confirmation_number</span>
            {hasNewTicketAlert && (
              <span style={{
                position: 'absolute', top: 8, right: 8, width: 8, height: 8, 
                backgroundColor: '#d32f2f', borderRadius: '50%', boxShadow: '0 0 0 2px #fff'
              }} />
            )}
          </button>

          {/* New Notification Button */}
          <NotificationBell dynamicNotifications={dynamicTeacherNotifications} />
        </div>
      </div>

      {/* iProfile Modal */}
      {iProfileOpen && (
        <div className="modal-overlay" onClick={() => setIProfileOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="modal-title">Teacher Profile</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIProfileOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><strong>Name:</strong> {profile?.fullName}</div>
              <div><strong>Email:</strong> {profile?.email}</div>
              <div><strong>Subjects:</strong> {profile?.subjects || 'Not specified'}</div>
              <div><strong>Joining Date:</strong> {profile?.joiningDate || 'Not specified'}</div>
              <div><strong>Class Teacher Of:</strong> {profile?.classTeacherBatch || 'None'}</div>
              <div><strong>CV / Resume:</strong> {profile?.cvLink ? <a href={profile.cvLink} target="_blank" rel="noreferrer">View CV</a> : 'Not uploaded'}</div>
              <div><strong>Assigned Resources:</strong>
                <ul style={{ paddingLeft: 20, marginTop: 4, color: 'var(--text-secondary)' }}>
                  <li>Lenovo ThinkPad (Placeholder)</li>
                  <li>Teacher Kit (Placeholder)</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
               <button className="btn" style={{ background: 'var(--status-error)', color: 'white' }} onClick={user.logout || (() => window.location.href = '/auth')}>
                 <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 18, verticalAlign: 'middle' }}>logout</span>
                 Logout
               </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'home' && (
        <div style={{ padding: '0 8px' }}>
          <div className="responsive-grid-2" style={{ gap: 24, alignItems: 'flex-start' }}>
            
            {/* Left Column (Primary Focus) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Today's Schedule */}
              <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>calendar_today</span>
                    Today's Schedule
                  </h3>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {todaysClasses.length === 0 ? (
                    <div style={{ padding: 32, background: '#f8fafc', borderRadius: 12, textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 32, marginBottom: 8 }}>event_available</span>
                      <br/>No classes scheduled today. Enjoy your day!
                    </div>
                  ) : (
                    todaysClasses.map(cls => {
                      const finished = isLectureFinished(cls.endTime);
                      return (
                        <div key={cls.id} style={{ 
                          padding: '16px 20px', 
                          background: finished ? '#f8fafc' : '#ffffff', 
                          borderRadius: 12, 
                          border: `1px solid ${finished ? '#e2e8f0' : '#e2e8f0'}`,
                          borderLeft: `4px solid ${finished ? '#10b981' : 'var(--brand-primary)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          transition: 'all 0.2s',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 15, color: finished ? '#64748b' : '#0f172a' }}>{cls.startTime} - {cls.endTime}</strong>
                            {finished && <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 18 }}>check_circle</span>}
                          </div>
                          <div style={{ fontSize: 14, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span> 
                            <span style={{ fontWeight: '500' }}>{cls.batch}</span> <span style={{ opacity: 0.7 }}>({cls.subject})</span>
                          </div>
                          {finished && (
                            <div style={{ marginTop: 6 }}>
                               <button className="btn btn-ghost btn-sm" onClick={() => setPostLectureModal({ isOpen: true, classData: cls })} style={{ width: '100%', justifyContent: 'center', border: '1px solid #e2e8f0', color: '#3b82f6', background: '#eff6ff' }}>
                                 <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>assignment_add</span> Fill Post-Lecture Report
                               </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Leave Requests Moved to Left Column */}
              {leaveRequests.length > 0 && (
                <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: 18, color: '#1e293b', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>flight_takeoff</span>
                    My Leave Requests
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {leaveRequests.map(req => (
                      <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 'bold', color: '#334155', fontSize: 14 }}>
                            {req.type === 'summer' ? 'Summer Vacation' : req.type === 'sick' ? 'Sick Leave' : req.type === 'festival' ? 'Festival' : 'Travel'}
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>
                            {req.startDate} to {req.endDate} ({req.totalDays} Days)
                          </p>
                        </div>
                        <div>
                          <span style={{
                            padding: '4px 10px', borderRadius: '12px', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px',
                            background: req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                            color: req.status === 'approved' ? '#15803d' : req.status === 'rejected' ? '#b91c1c' : '#b45309'
                          }}>
                            {req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Right Column (Widgets) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Small Professional Countdown Widget */}
              <div style={{ 
                background: 'linear-gradient(135deg, #ffffff, #f8fafc)', 
                padding: '20px 24px', 
                borderRadius: 16, 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 46, height: 46, borderRadius: '12px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26 }}>timer</span>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#1e293b', fontWeight: 'bold' }}>Board Exams</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>Target Preparation</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 32, fontWeight: '900', color: '#ef4444', lineHeight: 1 }}>{boardDaysLeft}</span>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Days Left</div>
                </div>
              </div>

              {/* My Yearly Targets */}
              <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>sports_score</span>
                  My Yearly Targets
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!profile?.yearlyTarget ? (
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>No targets assigned yet.</span>
                  ) : (
                    profile.yearlyTarget.split(' | ').filter(Boolean).map((target, idx) => (
                      <div key={idx} style={{ 
                        padding: '12px 16px', 
                        background: '#f8fafc', 
                        borderRadius: 10, 
                        fontSize: 14, 
                        color: '#334155', 
                        border: '1px solid #f1f5f9', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12 
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--brand-primary)' }}>adjust</span>
                        <span style={{ fontWeight: '500' }}>{target}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Weekly Targets */}
              <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: '#10b981' }}>track_changes</span>
                  My Weekly Targets
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px 0' }}>Checkpoints set by your Manager for this week.</p>

                {profile?.currentWeeklyTargets?.length > 0 ? (
                  <>
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: '600' }}>
                        <span style={{ color: '#475569' }}>Overall Progress</span>
                        <span style={{ color: '#10b981' }}>
                          {profile.currentWeeklyTargets.filter(t => t.completed).length}/{profile.currentWeeklyTargets.length}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                         <div style={{ 
                           width: `${(profile.currentWeeklyTargets.filter(t => t.completed).length / profile.currentWeeklyTargets.length) * 100}%`, 
                           height: '100%', 
                           background: '#10b981', 
                           borderRadius: 4,
                           transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                         }}></div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {profile.currentWeeklyTargets.map((target, idx) => (
                        <label key={target.id || idx} style={{ 
                          display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', 
                          background: target.completed ? '#f0fdf4' : '#f8fafc', 
                          borderRadius: 10, 
                          border: `1px solid ${target.completed ? '#bbf7d0' : '#e2e8f0'}`, 
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = target.completed ? '#86efac' : '#cbd5e1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = target.completed ? '#bbf7d0' : '#e2e8f0'; }}
                        >
                          <input 
                            type="checkbox" 
                            style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer', margin: 0 }}
                            checked={target.completed}
                            onChange={() => toggleWeeklyTarget(idx)}
                          />
                          <span style={{ fontSize: 14, color: target.completed ? '#94a3b8' : '#334155', textDecoration: target.completed ? 'line-through' : 'none', fontWeight: '500', transition: 'all 0.2s' }}>
                            {target.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 24, background: '#f8fafc', borderRadius: 12, textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                    No weekly targets assigned yet.
                  </div>
                )}
              </div>

              {/* Batch Wise Report & Record Keeping */}
              <div style={{ background: '#ffffff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: '#8b5cf6' }}>folder_supervised</span>
                  Batch Records
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px 0' }}>Select a batch to view detailed progress logs and test performance.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {assignedBatches.map(b => (
                    <button key={b} onClick={() => handleTabChange('batches')} style={{
                      padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px',
                      fontSize: 13, fontWeight: '600', color: '#475569', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard_hub' && (
        <div style={{ padding: '0 8px' }}>
           <h2 style={{ marginBottom: 24, color: 'var(--text-primary)', fontSize: 24 }}>{profile?.fullName || 'Teacher'}'s Arena</h2>

           {/* Grid */}
           <div className="grid-auto-300">
             <div className="portal-card hover-lift" style={{ cursor: 'pointer', textAlign: 'center', padding: '32px 20px', transition: 'all 0.3s ease' }} onClick={() => handleTabChange('attendance')}>
               <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(253,180,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)' }}>event_available</span>
               </div>
               <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Attendance</h3>
               <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Track daily student presence</p>
             </div>
             
             <div className="portal-card hover-lift" style={{ cursor: 'pointer', textAlign: 'center', padding: '32px 20px', transition: 'all 0.3s ease' }} onClick={() => handleTabChange('performance')}>
               <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(253,180,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)' }}>military_tech</span>
               </div>
               <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Performance</h3>
               <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Review test scores & metrics</p>
             </div>
             
             <div className="portal-card hover-lift" style={{ cursor: 'pointer', textAlign: 'center', padding: '32px 20px', transition: 'all 0.3s ease' }} onClick={() => handleTabChange('home')}>
               <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(253,180,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)' }}>calendar_today</span>
               </div>
               <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Today's Schedule</h3>
               <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>View your daily timetable</p>
             </div>
             
             <div className="portal-card hover-lift" style={{ cursor: 'pointer', textAlign: 'center', padding: '32px 20px', transition: 'all 0.3s ease' }} onClick={() => handleTabChange('tasks')}>
               <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(253,180,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)' }}>checklist</span>
               </div>
               <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Weekly Task</h3>
               <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Manage manager-assigned tasks</p>
             </div>
             
             <div className="portal-card hover-lift" style={{ cursor: 'pointer', textAlign: 'center', padding: '32px 20px', transition: 'all 0.3s ease' }} onClick={() => handleTabChange('target')}>
               <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(253,180,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)' }}>target</span>
               </div>
               <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Yearly Target Stand</h3>
               <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Monitor overall annual goals</p>
             </div>
             
             <div className="portal-card hover-lift" style={{ cursor: 'pointer', textAlign: 'center', padding: '32px 20px', transition: 'all 0.3s ease' }} onClick={() => handleTabChange('batches')}>
               <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(253,180,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)' }}>trending_up</span>
               </div>
               <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Progress of Students</h3>
               <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Track syllabus completion</p>
             </div>
             
             <div className="portal-card hover-lift" style={{ cursor: 'pointer', textAlign: 'center', padding: '32px 20px', transition: 'all 0.3s ease' }} onClick={() => handleTabChange('feedbacks')}>
               <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(253,180,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)' }}>reviews</span>
               </div>
               <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Manager Feedback</h3>
               <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>View weekly performance reviews</p>
             </div>
           </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div style={{ padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleTabChange('dashboard_hub')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-primary)' }}>My Attendance Record</h2>
          </div>
          
          <div className="grid-2" style={{ marginBottom: 24 }}>
            {/* Left Column: Stats (Flippable) */}
            <div 
              className="portal-card" 
              style={{ 
                border: 'none', 
                perspective: '1000px',
                padding: 0,
                cursor: 'pointer'
              }}
              onClick={() => setIsStatsFlipped(!isStatsFlipped)}
            >
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '280px'
              }}>
                {/* FRONT: Grid Stats */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                  transform: isStatsFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 20,
                  boxSizing: 'border-box',
                  background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                  border: '1px solid #bae6fd',
                  borderRadius: 16
                }}>
                   <h3 style={{ color: '#0369a1', margin: '0 0 12px 0', fontSize: 16 }}>Monthly Statistics (Click to Flip)</h3>
                   <div className="grid-2" style={{ gap: 12, flex: 1 }}>
                     <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                       <p style={{ margin: 0, fontSize: 13, color: '#0284c7', fontWeight: 'bold' }}>Working Days</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#0369a1' }}>{monthlyStats.workingDays}</p>
                     </div>
                     <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                       <p style={{ margin: 0, fontSize: 13, color: '#e11d48', fontWeight: 'bold' }}>Absent</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#be123c' }}>{monthlyStats.absentDays}</p>
                     </div>
                     <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                       <p style={{ margin: 0, fontSize: 13, color: '#16a34a', fontWeight: 'bold' }}>Present</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#15803d' }}>{monthlyStats.presentDays}</p>
                     </div>
                     <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                       <p style={{ margin: 0, fontSize: 13, color: '#ea580c', fontWeight: 'bold' }}>Late</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#c2410c' }}>{monthlyStats.lateMarks}</p>
                     </div>
                     <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                       <p style={{ margin: 0, fontSize: 13, color: '#9333ea', fontWeight: 'bold' }}>Holiday Took</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#7e22ce' }}>{monthlyStats.holidaysTook}</p>
                     </div>
                     <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                       <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 'bold' }}>Sunday</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#475569' }}>{monthlyStats.sundays}</p>
                     </div>
                   </div>
                </div>

                {/* BACK: Pie Chart */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                  transform: isStatsFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 20,
                  boxSizing: 'border-box',
                  background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                  border: '1px solid #bae6fd',
                  borderRadius: 16
                }}>
                   <h3 style={{ color: '#0369a1', margin: '0 0 12px 0', fontSize: 16 }}>Attendance Breakdown</h3>
                   <div style={{ flex: 1, position: 'relative' }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                         <Pie
                           data={[
                             { name: 'Present', value: monthlyStats.presentDays, color: '#4caf50' },
                             { name: 'Absent', value: monthlyStats.absentDays, color: '#f44336' },
                             { name: 'Late', value: monthlyStats.lateMarks, color: '#ff9800' },
                             { name: 'Holidays', value: monthlyStats.holidaysTook, color: '#9c27b0' },
                             { name: 'Sundays', value: monthlyStats.sundays, color: '#607d8b' }
                           ].filter(d => d.value > 0)}
                           cx="50%"
                           cy="50%"
                           innerRadius={55}
                           outerRadius={80}
                           paddingAngle={4}
                           dataKey="value"
                           label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                           labelLine={true}
                           style={{ filter: 'drop-shadow(0px 8px 12px rgba(0,0,0,0.15))' }}
                         >
                           <Label 
                             value={`${monthlyStats.workingDays} Days`} 
                             position="centerBottom" 
                             dy={-10}
                             fill="#0d47a1" 
                             style={{ fontSize: '18px', fontWeight: '900' }} 
                           />
                           <Label 
                             value="Total" 
                             position="centerTop" 
                             dy={10}
                             fill="#64b5f6" 
                             style={{ fontSize: '12px', fontWeight: 'bold' }} 
                           />
                           {
                             [
                               { name: 'Present', value: monthlyStats.presentDays, color: '#4caf50' },
                               { name: 'Absent', value: monthlyStats.absentDays, color: '#f44336' },
                               { name: 'Late', value: monthlyStats.lateMarks, color: '#ff9800' },
                               { name: 'Holidays', value: monthlyStats.holidaysTook, color: '#9c27b0' },
                               { name: 'Sundays', value: monthlyStats.sundays, color: '#607d8b' }
                             ].filter(d => d.value > 0).map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} />
                             ))
                           }
                         </Pie>
                         <Tooltip 
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} 
                           itemStyle={{ fontWeight: 'bold' }}
                         />
                         <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
                       </PieChart>
                     </ResponsiveContainer>
                   </div>
                </div>
              </div>
            </div>

            {/* Right Column: Calendar */}
            <div className="portal-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Attendance Calendar</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn-ghost btn-sm" onClick={handlePrevMonth} style={{ padding: '2px 6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
                  </button>
                  <strong style={{ fontSize: 14, minWidth: 90, textAlign: 'center' }}>
                    {monthNames[currentMonth]} {currentYear}
                  </strong>
                  <button className="btn-ghost btn-sm" onClick={handleNextMonth} style={{ padding: '2px 6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
                  </button>
                </div>
              </div>

              <div style={{ maxWidth: 360, margin: '0 auto' }}>
                <div className="grid-7" style={{ textAlign: 'center', marginBottom: 6 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: 11 }}>{d}</div>
                  ))}
                </div>

                <div className="grid-7">
                  {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
                    <div key={`empty-${i}`} style={{
                      aspectRatio: '1',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 6,
                      background: 'rgba(0,0,0,0.02)'
                    }} />
                  ))}
                  {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, i) => {
                    const day = i + 1;
                    const isSunday = new Date(currentYear, currentMonth, day).getDay() === 0;
                    let bgColor = 'var(--surface-base)';
                    let color = 'var(--text-primary)';
                    let border = '1px solid var(--surface-border)';
                    let statusTitle = '';
                    
                    if (isSunday) {
                      bgColor = 'rgba(59, 130, 246, 0.15)'; // Blue for Holiday
                      color = '#3b82f6';
                      border = '1px solid #3b82f6';
                      statusTitle = 'Holiday';
                    } else if (day % 14 === 3) {
                      bgColor = 'rgba(239, 68, 68, 0.15)'; // Red for Leave
                      color = 'var(--status-error)';
                      border = '1px solid var(--status-error)';
                      statusTitle = 'Leave';
                    } else if (day % 7 === 2) {
                      bgColor = 'rgba(249, 115, 22, 0.15)'; // Orange for Late
                      color = '#f97316';
                      border = '1px solid #f97316';
                      statusTitle = 'Late';
                    } else if (day < new Date().getDate() || (currentMonth < new Date().getMonth() && currentYear === new Date().getFullYear())) {
                      bgColor = 'rgba(16, 185, 129, 0.15)'; // Green for Present
                      color = 'var(--status-success)';
                      border = '1px solid var(--status-success)';
                      statusTitle = 'Present';
                    }

                    return (
                      <div key={day} title={statusTitle} style={{ 
                        aspectRatio: '1', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: bgColor,
                        color: color,
                        border: border,
                        borderRadius: 6,
                        fontWeight: 'bold',
                        fontSize: 13,
                        cursor: statusTitle ? 'help' : 'default'
                      }}>
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="portal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Recent Punch Records</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {teacherAttendanceRecords.length === 0 && (
                  <button className="btn btn-sm btn-ghost" onClick={injectFakeAttendanceData} style={{ padding: '4px 12px', border: '1px solid var(--surface-border)' }}>Inject Test Data</button>
                )}
                <span className="badge badge-teacher" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' }}>Biometric Sync Active</span>
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="portal-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Punch In</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Punch Out</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Total Hours</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherAttendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No punch records found yet.
                      </td>
                    </tr>
                  ) : teacherAttendanceRecords.map(record => (
                    <tr key={record.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '12px 16px' }}>{formatDateForAttendance(new Date(record.date))}</td>
                      <td style={{ padding: '12px 16px', fontWeight: record.punchOut === '--:-- --' ? 'bold' : 'normal' }}>{record.punchIn}</td>
                      <td style={{ padding: '12px 16px', color: record.punchOut === '--:-- --' ? 'var(--text-secondary)' : 'inherit' }}>{record.punchOut}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          color: record.status === 'Late' ? '#c62828' : '#2e7d32', 
                          fontWeight: 'bold', 
                          background: record.status === 'Late' ? '#ffebee' : '#e8f5e9', 
                          padding: '4px 8px', borderRadius: 4 
                        }}>
                          {record.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: record.punchOut !== '--:-- --' ? 'bold' : 'normal', color: record.punchOut === '--:-- --' ? 'var(--text-secondary)' : 'inherit' }}>{record.totalHours}</td>
                      <td style={{ padding: '12px 16px' }} title={record.roleCompleted ? "All lectures taken and reports submitted" : (record.punchOut === '--:-- --' ? "Pending: Lectures or reports incomplete" : "Lectures missed or report missing")}>
                        <span className="material-symbols-outlined" style={{ color: record.roleCompleted ? 'var(--status-success)' : (record.punchOut === '--:-- --' ? '#9e9e9e' : 'var(--status-error)') }}>
                          {record.roleCompleted ? 'check_circle' : (record.punchOut === '--:-- --' ? 'pending' : 'cancel')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 24, padding: '12px 16px', background: '#f5f5f5', borderRadius: 8, borderLeft: '4px solid #9e9e9e' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#616161', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>info</span>
                This data is a preview. It will automatically populate in real-time once the office biometric fingerprint scanner hardware is integrated.
              </p>
            </div>
          </div>

          {/* Holiday Analytics Section */}
          <div style={{ marginTop: 32 }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 24, color: 'var(--text-primary)' }}>Holiday Analytics</h2>
            
            <div className="grid-2">
              
              {/* Left Column: Yearly Quota (Flippable) */}
                <div 
                  className="portal-card" 
                  style={{ 
                    border: 'none', 
                    perspective: '1000px',
                    padding: 0,
                    cursor: 'pointer',
                    minHeight: 380
                  }}
                  onClick={() => setIsHolidayStatsFlipped(!isHolidayStatsFlipped)}
                >
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  minHeight: 380
                }}>
                  {/* FRONT: Quota Grid */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                  transform: isHolidayStatsFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 20,
                  boxSizing: 'border-box',
                  background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                  border: '1px solid #cbd5e1',
                  borderRadius: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ color: '#1e293b', margin: '0 0 6px 0', fontSize: 16 }}>Yearly Holiday Quota</h3>
                      <button className="btn btn-sm" style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setLeaveModalOpen(true); }}>+ Request Leave</button>
                    </div>
                    <span className="badge" style={{ background: '#0f172a', color: 'white' }}>{totalHolidaysLeft} Left</span>
                  </div>
                    
                    <div className="grid-2" style={{ gap: 12, flex: 1 }}>
                      {Object.entries(yearlyHolidayStats).map(([key, stat]) => (
                        <div key={key} onClick={(e) => { e.stopPropagation(); setHolidayDetailsType(key); }} style={{ background: 'white', padding: '16px 12px', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'transform 0.2s' }} className="hover-lift">
                          <p style={{ margin: 0, fontSize: 14, color: stat.color, fontWeight: 'bold' }}>{stat.label}</p>
                          <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 28, fontWeight: '900', color: '#1e293b', lineHeight: 1 }}>{stat.used}</span>
                            <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>/ {stat.quota} used</span>
                          </div>
                          {/* Progress bar */}
                          <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
                            <div style={{ width: `${(stat.used / stat.quota) * 100}%`, height: '100%', background: stat.color, borderRadius: 3 }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                {/* BACK: Pie Chart */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                  transform: isHolidayStatsFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 20,
                  boxSizing: 'border-box',
                  background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                  border: '1px solid #cbd5e1',
                  borderRadius: 16
                }}>
                  <h3 style={{ color: '#1e293b', margin: '0 0 12px 0', fontSize: 16 }}>Quota Usage Breakdown</h3>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              Object.values(yearlyHolidayStats).some(s => s.used > 0)
                                ? Object.values(yearlyHolidayStats).filter(s => s.used > 0).map(s => ({ name: s.label, value: s.used, color: s.color }))
                                : [{ name: 'No Holidays Used', value: 1, color: '#e2e8f0' }]
                            }
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                              dataKey="value"
                              label={Object.values(yearlyHolidayStats).some(s => s.used > 0) ? ({ name, value }) => `${name}: ${value}` : false}
                              labelLine={Object.values(yearlyHolidayStats).some(s => s.used > 0)}
                              stroke="none"
                            >
                            <Label 
                              value={`${totalHolidaysUsed} Used`} 
                              position="centerBottom" 
                              dy={-10}
                              fill="#1e293b" 
                              style={{ fontSize: '16px', fontWeight: '900' }} 
                            />
                            <Label 
                              value="Total" 
                              position="centerTop" 
                              dy={10}
                              fill="#64748b" 
                              style={{ fontSize: '12px', fontWeight: 'bold' }} 
                            />
                            {
                              Object.values(yearlyHolidayStats).some(s => s.used > 0) 
                                ? Object.values(yearlyHolidayStats).filter(s => s.used > 0).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))
                                : <Cell key="cell-empty" fill="#e2e8f0" />
                            }
                          </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} 
                              itemStyle={{ fontWeight: 'bold' }}
                              cursor={false}
                            />
                            {Object.values(yearlyHolidayStats).some(s => s.used > 0) && (
                              <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
                            )}
                          </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Monthly Breakdown */}
              {/* Right Column: Yearly Attendance Record */}
              <div 
                className="portal-card hover-lift" 
                style={{ 
                  border: 'none', 
                  perspective: '1000px',
                  padding: 0,
                  cursor: 'pointer',
                  minHeight: 380
                }}
                onClick={() => setIsYearlyAttendanceFlipped(!isYearlyAttendanceFlipped)}
              >
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: 380
              }}>
                {/* FRONT: Grid */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                    transform: isYearlyAttendanceFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 20,
                    boxSizing: 'border-box',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: 16
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ color: '#1e293b', margin: '0 0 6px 0', fontSize: 16 }}>Yearly Overall Attendance</h3>
                      <span className="badge" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' }}>{currentYear}</span>
                    </div>
                    
                    <div className="grid-2" style={{ gap: 12, flex: 1 }}>
                      <div style={{ background: '#f0fdf4', padding: '16px 12px', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #bbf7d0' }}>
                        <p style={{ margin: 0, fontSize: 14, color: '#16a34a', fontWeight: 'bold' }}>Present</p>
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 28, fontWeight: '900', color: '#15803d', lineHeight: 1 }}>{yearlyAttendanceStats.presentDays}</span>
                          <span style={{ fontSize: 14, color: '#16a34a', marginBottom: 4 }}>Days</span>
                        </div>
                      </div>
                      <div style={{ background: '#fef2f2', padding: '16px 12px', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #fecaca' }}>
                        <p style={{ margin: 0, fontSize: 14, color: '#dc2626', fontWeight: 'bold' }}>Absent</p>
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 28, fontWeight: '900', color: '#b91c1c', lineHeight: 1 }}>{yearlyAttendanceStats.absentDays}</span>
                          <span style={{ fontSize: 14, color: '#dc2626', marginBottom: 4 }}>Days</span>
                        </div>
                      </div>
                      <div style={{ background: '#fffbeb', padding: '16px 12px', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #fde68a', gridColumn: 'span 2' }}>
                        <p style={{ margin: 0, fontSize: 14, color: '#d97706', fontWeight: 'bold' }}>Holidays Taken</p>
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 28, fontWeight: '900', color: '#b45309', lineHeight: 1 }}>{totalHolidaysUsed}</span>
                          <span style={{ fontSize: 14, color: '#d97706', marginBottom: 4 }}>Days</span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: '#fef3c7', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
                          <div style={{ width: `${(totalHolidaysUsed / totalHolidaysQuota) * 100}%`, height: '100%', background: '#d97706', borderRadius: 3 }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BACK: Pie Chart */}
                  <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                    transform: isYearlyAttendanceFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 20,
                    boxSizing: 'border-box',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: 16
                  }}>
                    <h3 style={{ color: '#1e293b', margin: '0 0 16px 0', fontSize: 16, textAlign: 'center' }}>Yearly Attendance Distribution</h3>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Present', value: yearlyAttendanceStats.presentDays, color: '#10b981' },
                              { name: 'Absent', value: yearlyAttendanceStats.absentDays, color: '#ef4444' },
                              { name: 'Holidays', value: totalHolidaysUsed, color: '#f59e0b' }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                          >
                          <Label 
                            value="Total Days" 
                            position="centerBottom" 
                            dy={-10}
                            fill="#1e293b" 
                            style={{ fontSize: '14px', fontWeight: '900' }} 
                          />
                          <Label 
                            value={yearlyAttendanceStats.workingDays} 
                            position="centerTop" 
                            dy={10}
                            fill="#64748b" 
                            style={{ fontSize: '12px', fontWeight: 'bold' }} 
                          />
                          {[
                            { color: '#10b981' },
                            { color: '#ef4444' },
                            { color: '#f59e0b' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} 
                            itemStyle={{ fontWeight: 'bold' }}
                            cursor={false}
                          />
                          <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'target' && (
        <div style={{ padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleTabChange('dashboard_hub')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-primary)' }}>My Yearly Target Stand</h2>
          </div>
          
          <div className="portal-card" style={{ background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)', border: 'none', padding: 48, textAlign: 'center' }}>
             <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#e65100', marginBottom: 16 }}>flag_circle</span>
             <h3 style={{ color: '#e65100', fontSize: 28, margin: '0 0 24px 0' }}>Your Core Objective</h3>
             
             {profile?.yearlyTarget ? (
               <div style={{ background: 'rgba(255,255,255,0.7)', padding: 32, borderRadius: 16, border: '1px solid rgba(230,81,0,0.2)', maxWidth: 800, margin: '0 auto', boxShadow: '0 8px 24px rgba(230,81,0,0.1)' }}>
                 <p style={{ margin: 0, fontSize: 22, color: '#424242', lineHeight: 1.6, fontStyle: 'italic' }}>
                   "{profile.yearlyTarget}"
                 </p>
               </div>
             ) : (
               <div style={{ background: 'rgba(255,255,255,0.7)', padding: 32, borderRadius: 16, border: '1px solid rgba(230,81,0,0.2)', maxWidth: 600, margin: '0 auto' }}>
                 <p style={{ margin: 0, fontSize: 16, color: '#757575' }}>
                   No specific yearly target has been assigned to you yet. Please check back later or contact your Service Manager.
                 </p>
               </div>
             )}
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div style={{ padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleTabChange('dashboard_hub')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-primary)' }}>Performance Dashboard</h2>
          </div>
          
          <div className="portal-card" style={{ marginBottom: 24, textAlign: 'center', background: 'linear-gradient(135deg, #e3f2fd, #bbdefb)', border: 'none', padding: '40px 20px' }}>
             <h3 style={{ margin: '0 0 16px 0', color: '#1565c0', fontSize: 20 }}>Overall Performance Score</h3>
             
             <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'white', boxShadow: '0 8px 24px rgba(21,101,192,0.15)', border: `8px solid ${perfData.totalScore >= 80 ? '#4caf50' : perfData.totalScore >= 60 ? '#fbc02d' : '#f44336'}` }}>
               <div>
                 <span style={{ fontSize: 48, fontWeight: '900', color: '#1565c0', lineHeight: 1 }}>{perfData.totalScore}</span>
                 <span style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>out of 100</span>
               </div>
             </div>
             
             <div style={{ marginTop: 24 }}>
               {perfData.totalScore >= 80 && <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 14, padding: '8px 16px' }}>🥇 Top Performer</span>}
               {perfData.totalScore >= 60 && perfData.totalScore < 80 && <span className="badge" style={{ background: '#fff8e1', color: '#f57f17', fontSize: 14, padding: '8px 16px' }}>🥈 Great Standing</span>}
               {perfData.totalScore < 60 && <span className="badge" style={{ background: '#ffebee', color: '#c62828', fontSize: 14, padding: '8px 16px' }}>⚠️ Needs Attention</span>}
             </div>
          </div>

          <div className="portal-card" style={{ marginBottom: 24 }}>
             <h3 style={{ margin: '0 0 20px 0' }}>Metric Breakdown (20 Points Each)</h3>
             <div className="grid-auto-200">
                {[
                  { label: 'Attendance', val: perfData.breakdown.attendance, icon: 'event_available', color: '#1976d2', bg: '#e3f2fd' },
                  { label: 'Feedbacks', val: perfData.breakdown.feedback, icon: 'reviews', color: '#e65100', bg: '#fff3e0' },
                  { label: 'Tasks Completed', val: perfData.breakdown.tasks, icon: 'checklist', color: '#2e7d32', bg: '#e8f5e9' },
                  { label: 'Syllabus Progress', val: perfData.breakdown.syllabus, icon: 'trending_up', color: '#6a1b9a', bg: '#f3e5f5' },
                  { label: 'Test Scores', val: perfData.breakdown.tests, icon: 'military_tech', color: '#c2185b', bg: '#fce4ec' }
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--surface-border)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                       <span className="material-symbols-outlined">{m.icon}</span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: m.color, marginTop: 4 }}>{m.val}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 'normal' }}>/20</span></span>
                  </div>
                ))}
             </div>
          </div>

          <div style={{ background: '#fff8e1', padding: '16px 20px', borderRadius: 12, borderLeft: '4px solid #fbc02d', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="material-symbols-outlined" style={{ color: '#fbc02d' }}>lightbulb</span>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#f57f17' }}>Actionable Advice</h4>
              <p style={{ margin: 0, fontSize: 14, color: '#795548' }}>{perfData.advice}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'feedbacks' && (
        <div style={{ padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleTabChange('dashboard_hub')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-primary)' }}>Weekly Manager Feedbacks</h2>
          </div>
          
          {(!profile?.managerFeedbacks || profile.managerFeedbacks.length === 0) ? (
            <div className="empty-state">
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16 }}>reviews</span>
              <p>You have not received any weekly feedback from your manager yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[...profile.managerFeedbacks].reverse().map((fb, idx) => (
                <div key={idx} className="portal-card" style={{ borderLeft: '4px solid var(--brand-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {new Date(fb.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <span className={`badge ${fb.managerId === 'Branch Manager' ? 'badge-branch-manager' : 'badge-service-manager'}`}>
                          {fb.managerId || 'Service Manager'}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{fb.impression}</h3>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2,3,4,5].map(star => (
                        <span key={star} className="material-symbols-outlined" style={{ color: star <= fb.rating ? '#fbc02d' : '#e0e0e0', fontSize: 24 }}>star</span>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ background: 'var(--surface-bg)', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid var(--surface-border)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--text-primary)' }}>Detailed Review</h4>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{fb.review}</p>
                  </div>
                  
                  {fb.focusArea && (
                    <div style={{ background: 'rgba(253,180,42,0.05)', padding: 16, borderRadius: 8, border: '1px dashed var(--brand-primary)' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>target</span> Next Week Focus
                      </h4>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{fb.focusArea}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'batches' && (
        <div style={{ padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleTabChange('dashboard_hub')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-primary)' }}>My Assigned Batches</h2>
          </div>

          {assignedBatches.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-muted)' }}>group_off</span>
              <p>You have no assigned batches yet. Contact the Service Manager.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Tabs Navigation */}
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                {assignedBatches.map(batch => (
                  <button 
                    key={batch}
                    onClick={() => setSelectedBatchTab(batch)}
                    style={{ 
                      padding: '12px 24px', 
                      borderRadius: 30, 
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: selectedBatchTab === batch ? 'var(--brand-primary)' : '#f5f5f5',
                      color: selectedBatchTab === batch ? 'white' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                  >
                    {batch}
                  </button>
                ))}
              </div>

              {/* Render only selected batch */}
              {assignedBatches.filter(b => b === selectedBatchTab).map(batch => {
                
                // Aggregate Batch Stats (from our new smart lazy-loaded utility)
                const avgAttendance = selectedBatchAnalytics.avgAttendance;
                const avgMarks = selectedBatchAnalytics.avgMarks;
                const enrichedStudents = selectedBatchAnalytics.students || [];

                if (fetchingBatch) {
                  return (
                    <div key={batch} className="portal-card" style={{ padding: 40, textAlign: 'center' }}>
                      <div className="spinner" style={{ margin: '0 auto 16px' }} />
                      <p>Loading analytics for {batch}...</p>
                    </div>
                  );
                }

                return (
                  <div key={batch} className="portal-card" style={{ padding: 0, overflow: 'hidden', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
                    {/* Batch Header */}
                    <div style={{ background: 'linear-gradient(135deg, var(--brand-primary), #ff9800)', padding: '24px 32px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 26, fontWeight: 800 }}>{batch}</h3>
                        <div style={{ fontSize: 14, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>group</span>
                          {enrichedStudents.length} Students Enrolled
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.2)', padding: '12px 20px', borderRadius: 12, backdropFilter: 'blur(10px)' }}>
                          <span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.9, fontWeight: 600 }}>Avg Attendance</span>
                          <span style={{ fontSize: 24, fontWeight: 800 }}>{avgAttendance}%</span>
                        </div>
                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.2)', padding: '12px 20px', borderRadius: 12, backdropFilter: 'blur(10px)' }}>
                          <span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.9, fontWeight: 600 }}>Avg Marks</span>
                          <span style={{ fontSize: 24, fontWeight: 800 }}>{avgMarks}%</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: 32 }}>
                      {/* Class Teacher Info */}
                      {profile?.classTeacherBatch === batch && (
                        <div style={{ marginBottom: 24, background: 'linear-gradient(to right, #fff8e1, #ffffff)', padding: 16, borderRadius: 12, borderLeft: '4px solid #fbc02d', display: 'flex', gap: 12 }}>
                          <span className="material-symbols-outlined" style={{ color: '#f57f17', fontSize: 28 }}>stars</span>
                          <div>
                            <strong style={{ color: '#f57f17', fontSize: 15, display: 'block', marginBottom: 4 }}>Class Teacher Responsibilities</strong>
                            <p style={{ margin: 0, fontSize: 13, color: '#795548', lineHeight: 1.5 }}>
                              You are the primary coordinator for this batch. Ensure regular attendance tracking, monitor test performances, and schedule PTMs for students needing attention.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Syllabus Tracker */}
                      <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-end' }}>
                          <div>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: 16, color: 'var(--text-primary)' }}>Syllabus Progress</h4>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Update the overall completion percentage and log the latest topic.</span>
                          </div>
                          <span style={{ color: 'var(--brand-primary)', fontWeight: '900', fontSize: 24 }}>{syllabusUpdates[batch] || 0}%</span>
                        </div>
                        
                        <div style={{ marginBottom: 20 }}>
                           <input 
                            type="range" 
                            min="0" max="100" 
                            value={syllabusUpdates[batch] || 0}
                            onChange={(e) => setSyllabusUpdates(prev => ({ ...prev, [batch]: e.target.value }))}
                            style={{ width: '100%', cursor: 'pointer', accentColor: '#ff9800', height: 8 }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }}>edit_note</span>
                            <input 
                              type="text" 
                              placeholder="Subject Log (e.g. Completed Ch 4: Polynomials)" 
                              className="portal-input"
                              style={{ paddingLeft: 40, height: 44 }}
                              value={syllabusLogs[batch] || ''}
                              onChange={(e) => setSyllabusLogs(prev => ({ ...prev, [batch]: e.target.value }))}
                            />
                          </div>
                          <button className="btn btn-brand" onClick={() => handleSaveProgress(batch)} style={{ height: 44, padding: '0 24px' }}>
                            Save Progress
                          </button>
                        </div>
                      </div>

                      {/* Self Study Activity Logs */}
                      {batchSelfStudyLogs.filter(att => !att.log.teacherScore).length > 0 && (
                        <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--surface-border)' }}>
                          <h4 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>menu_book</span>
                            Batch Self-Study Activity
                          </h4>
                          <div className="grid-auto-300">
                            {batchSelfStudyLogs.filter(att => !att.log.teacherScore).map(att => {
                              const studentInfo = enrichedStudents.find(s => s.id === att.studentId);
                              const studentName = studentInfo ? (studentInfo.fullName || studentInfo.studentName || studentInfo.name) : 'Unknown Student';
                              
                              return (
                                <div key={att.id} style={{ background: 'var(--surface-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottom: '1px solid var(--surface-border)', paddingBottom: 8 }}>
                                    <div>
                                      <strong style={{ fontSize: 15, display: 'block' }}>{studentName}</strong>
                                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(att.date).toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ fontSize: 11, background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                      <span>In: {att.inOutTime?.in || '--'}</span>
                                      <span>Out: {att.inOutTime?.out || '--'}</span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--brand-primary)', marginTop: 2 }}>subject</span>
                                      <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Subject</div>
                                        <div style={{ fontSize: 14, fontWeight: 500 }}>{att.log.subject || 'Not specified'}</div>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f97316', marginTop: 2 }}>import_contacts</span>
                                      <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Topic / Syllabus</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{att.log.topic || 'No details provided'}</div>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#4caf50', marginTop: 2 }}>more_time</span>
                                      <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Time Logged</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{att.log.timeLogged || '--'} mins</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <button 
                                    className="btn btn-brand" 
                                    style={{ marginTop: 16, width: '100%', height: 36, fontSize: 13, display: 'flex', justifyContent: 'center' }}
                                    onClick={() => setRatingModal({ isOpen: true, docId: att.docId, studentId: att.studentId, score: 10 })}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>stars</span>
                                    Rate Effort
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Students List */}
                      <div>
                        <h4 style={{ margin: '0 0 20px 0', fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="material-symbols-outlined" style={{ color: '#1976d2' }}>analytics</span>
                          Student Analytics
                        </h4>
                        
                        <div className="grid-auto-300" style={{ gap: 20 }}>
                          {enrichedStudents.map(student => (
                            <div key={student.id} className="portal-card hover-lift" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(25, 118, 210, 0.1)', color: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold' }}>
                                    {((student.fullName || student.studentName || student.name || '?')?.[0]).toUpperCase()}
                                  </div>
                                  <div>
                                    <h5 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>{student.fullName || student.studentName || student.name || 'Unknown Student'}</h5>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ID: {student.id.slice(0,6)}</span>
                                  </div>
                                </div>
                                {student.needsFeedback && (
                                  <span style={{ background: '#ffebee', color: '#c62828', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                                    Review Due
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1, background: '#f5f5f5', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>Attendance</span>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: student.sAtt < 75 ? '#c62828' : '#2e7d32' }}>{student.sAtt}%</span>
                                </div>
                                <div style={{ flex: 1, background: '#f5f5f5', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>Marks</span>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: student.sMark < 60 ? '#c62828' : '#1565c0' }}>{student.sMark}%</span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                                <button 
                                  className="btn btn-sm" 
                                  onClick={() => setFeedbackStudent(student)}
                                  style={{ flex: 1, background: student.needsFeedback ? '#e65100' : 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none' }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rate_review</span>
                                  Feedback
                                </button>
                                <button 
                                  className="btn btn-sm" 
                                  onClick={() => setPtmStudent(student)}
                                  style={{ flex: 1, background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #ffcdd2' }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>video_camera_front</span>
                                  Call PTM
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {completedTestDuties.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ color: '#4caf50' }}>task_alt</span>
                Completed Test Duties Log
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {completedTestDuties.map((duty, idx) => (
                  <div key={idx} style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', border: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                     <div>
                       <strong style={{ display: 'block', color: '#555', fontSize: 14 }}>{duty.batch} - Weekly Test</strong>
                       <span style={{ fontSize: 12, color: '#777', display: 'block', marginTop: 4 }}>Prepared by: <strong>{duty.prepName}</strong> | Checked by: <strong>{duty.checkName}</strong></span>
                       <span style={{ fontSize: 12, color: '#777', display: 'block', marginTop: 2 }}>Syllabus: {duty.topic || 'N/A'}</span>
                     </div>
                     <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                       {duty.workflow?.finalLink && (
                         <a href={duty.workflow.finalLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, fontWeight: '600', background: '#e8f5e9', color: '#2e7d32', borderRadius: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                           <span className="material-symbols-outlined" style={{ fontSize: 14 }}>description</span>
                           Paper
                         </a>
                       )}
                       {duty.workflow?.solutionsLink && (
                         <a href={duty.workflow.solutionsLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, fontWeight: '600', background: '#e3f2fd', color: '#1565c0', borderRadius: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                           <span className="material-symbols-outlined" style={{ fontSize: 14 }}>task_alt</span>
                           Solutions
                         </a>
                       )}
                       <span style={{ background: '#4caf50', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: 12, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                         Marks Uploaded ✓
                       </span>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

          {activeTab === 'timetable' && (
            <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 16, background: '#fff', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>📅 My Weekly Schedule</h2>
                <div className="badge badge-branch-manager">{timetableHeaderDate || 'CURRENT WEEK'}</div>
              </div>
              
              {Object.keys(timetable).length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>No timetable has been published yet.</div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff' }}>
                  {(() => {
                    const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
                    const slots = ['02:00 PM TO 04:00 PM', '04:30 PM TO 06:30 PM', '07:00 PM TO 09:00 PM'];
                    
                    // scheduleMatrix[slot][day] = array of lectures
                    const scheduleMatrix = {};
                    slots.forEach(slot => {
                      scheduleMatrix[slot] = {};
                      daysOfWeek.forEach(d => { scheduleMatrix[slot][d] = []; });
                    });

                    const mapCycleToDays = (label, defaultDays) => {
                       const l = (label || '').toUpperCase();
                       if (!l) return defaultDays;
                       if (l === 'ALL DAYS') return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
                       
                       // Legacy custom handling
                       if (l === 'MON-WED-FRI') return ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
                       if (l === 'TUES-THURS-SAT') return ['TUESDAY', 'THURSDAY', 'SATURDAY'];
                       if (l === 'WEEKENDS') return ['SATURDAY', 'SUNDAY'];

                       const DAYS_MAP = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                       const FULL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
                       
                       if (l.includes('-')) {
                         let parts = l.split('-');
                         // Normalize legacy THURS/TUES
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
                       } else {
                         // Single day
                         let sStr = l.replace('THURS', 'THU').replace('TUES', 'TUE');
                         let idx = DAYS_MAP.indexOf(sStr);
                         if (idx !== -1) return [FULL_DAYS[idx]];
                       }

                       return defaultDays; 
                    };

                    for (const slot of Object.keys(timetable)) {
                      for (const room of Object.keys(timetable[slot] || {})) {
                        const cell = timetable[slot][room];
                        
                        if (teacherId && cell?.monWed?.teacherId === teacherId) {
                          const days = mapCycleToDays(cell.monWedLabel, ['MONDAY', 'TUESDAY', 'WEDNESDAY']);
                          days.forEach(d => {
                            if (scheduleMatrix[slot] && scheduleMatrix[slot][d]) {
                              scheduleMatrix[slot][d].push({ room, batch: cell.batch, subject: cell.monWed.subject, topic: cell.monWed.topic });
                            }
                          });
                        }
                        
                        if (teacherId && cell?.thursSat?.teacherId === teacherId) {
                          const days = mapCycleToDays(cell.thursSatLabel, ['THURSDAY', 'FRIDAY', 'SATURDAY']);
                          days.forEach(d => {
                            if (scheduleMatrix[slot] && scheduleMatrix[slot][d]) {
                              scheduleMatrix[slot][d].push({ room, batch: cell.batch, subject: cell.thursSat.subject, topic: cell.thursSat.topic });
                            }
                          });
                        }

                        if (teacherId && cell?.extra?.teacherId === teacherId) {
                          if (scheduleMatrix[slot] && scheduleMatrix[slot]['SUNDAY']) {
                            scheduleMatrix[slot]['SUNDAY'].push({ room, batch: cell.batch, subject: cell.extra.subject, topic: '', type: 'extra' });
                          }
                        }
                      }
                    }



                    let totalLectures = 0;
                    slots.forEach(slot => {
                      daysOfWeek.forEach(d => {
                        totalLectures += scheduleMatrix[slot][d].length;
                      });
                    });

                    if (totalLectures === 0) {
                      return <div className="empty-state" style={{ padding: 24 }}>You have no assigned lectures for this week.</div>;
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {upcomingTestDuties.length > 0 && (
                          <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', padding: '16px', borderRadius: '8px' }}>
                            <h3 style={{ color: '#e65100', margin: '0 0 12px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>notification_important</span>
                              Upcoming Saturday Test Duties ({saturdayDateStr})
                            </h3>
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {upcomingTestDuties.map((duty, idx) => (
                                <div key={idx} style={{ background: duty.workflow?.status === 'final_published' ? '#e8f5e9' : '#fff', padding: '12px', borderRadius: '6px', border: duty.workflow?.status === 'final_published' ? '1px solid #a5d6a7' : '1px solid #ffe0b2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                  <div>
                                    <strong style={{ fontSize: '14px', display: 'block', color: duty.workflow?.status === 'final_published' ? '#2e7d32' : '#333' }}>{duty.batch} - Weekly Test</strong>
                                    <span style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: 4 }}>Prepared by: <strong>{duty.prepName}</strong> | Checked by: <strong>{duty.checkName}</strong></span>
                                    <span style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: 2 }}>Syllabus: {duty.topic || 'N/A'}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    
                                    {duty.isPreparer && (!duty.workflow || duty.workflow.status === 'draft_submitted') && (
                                      <button 
                                        className="btn-primary btn-sm"
                                        onClick={() => {
                                          setDraftModal({ isOpen: true, duty, link: '', startDate });
                                        }}
                                        style={{ background: duty.workflow?.status === 'draft_submitted' ? '#4caf50' : '' }}
                                      >
                                        {duty.workflow?.status === 'draft_submitted' ? 'Draft Submitted ✓' : 'Submit Draft Link'}
                                      </button>
                                    )}

                                    {duty.workflow?.finalLink && (
                                      <a href={duty.workflow.finalLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, fontWeight: '600', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>description</span>
                                        Test Paper
                                      </a>
                                    )}
                                    
                                    {duty.workflow?.solutionsLink && (
                                      <a href={duty.workflow.solutionsLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, fontWeight: '600', background: '#e3f2fd', color: '#1565c0', border: '1px solid #bbdefb', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>task_alt</span>
                                        Solutions
                                      </a>
                                    )}

                                    {duty.isChecker && duty.workflow?.status === 'final_published' && (
                                      <button className="btn-primary btn-sm" style={{ padding: '6px 12px', fontSize: 12 }} onClick={async () => {
                                        // Fetch students for grading dynamically
                                        const { getDocs, query, collection, where } = await import('firebase/firestore');
                                        const studentsSnap = await getDocs(query(collection(db, 'students'), where('batch', '==', duty.batch)));
                                        const batchStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                                        setGradingModal({ 
                                          isOpen: true, 
                                          testId: duty.testId, 
                                          batch: duty.batch, 
                                          maxMarks: 0,
                                          testDate: saturdayDateStr,
                                          subject: duty.subject,
                                          topic: duty.topic,
                                          batchStudents
                                        });
                                        const initialMarks = {};
                                        batchStudents.forEach(s => {
                                          initialMarks[s.id] = '';
                                        });
                                        setMarksData(initialMarks);
                                      }}>Upload Marks</button>
                                    )}

                                    <span style={{ background: duty.workflow?.status === 'final_published' ? '#c8e6c9' : '#ffcc80', color: duty.workflow?.status === 'final_published' ? '#2e7d32' : '#e65100', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Kaksh: {duty.room}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontFamily: "'Times New Roman', serif", fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#8bc34a', borderBottom: '2px solid #000' }}>
                            <th style={{ width: '150px', padding: '12px', borderRight: '1px solid #000' }}>TIME SLOT</th>
                            {daysOfWeek.map(day => (
                              <th key={day} style={{ padding: '12px', borderRight: '1px solid #000', minWidth: '120px' }}>{day}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {slots.map((slot, slotIdx) => (
                            <tr key={slot} style={{ borderBottom: '1px solid #000' }}>
                              <td style={{ padding: '12px', borderRight: '1px solid #000', background: '#fafafa', fontWeight: 'bold' }}>
                                {slot}
                              </td>
                              {daysOfWeek.map(day => {
                                const lecs = scheduleMatrix[slot][day] || [];
                                return (
                                  <td key={day} style={{ padding: '8px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                                    {lecs.length === 0 ? (
                                      day === 'SUNDAY' ? (
                                        <div style={{ background: '#e0f7fa', padding: '6px', borderRadius: '4px', border: '1px solid #b2ebf2', color: '#00838f', fontWeight: 'bold', fontSize: '11px' }}>Holiday</div>
                                      ) : (
                                        <span style={{ color: '#ccc' }}>-</span>
                                      )
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {lecs.map((lec, i) => (
                                          <div key={i} style={{ background: '#ffeb3b', padding: '6px', borderRadius: '4px', border: '1px solid #fbc02d', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <strong style={{ fontSize: '12px', color: '#000' }}>{lec.batch}</strong>
                                            <span style={{ fontSize: '11px', color: '#555' }}>Kaksh: {lec.room}</span>
                                            <span style={{ fontSize: '11px', color: '#d32f2f', fontWeight: 'bold' }}>{lec.subject}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

      {activeTab === 'target' && (
        <div className="portal-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleTabChange('dashboard_hub')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Yearly Target Stand</h2>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #1976d2, #1565c0)', color: 'white', padding: 40, borderRadius: 20 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, marginBottom: 16 }}>target</span>
            <h1 style={{ fontSize: 36, margin: '0 0 16px 0' }}>{profile?.yearlyTarget || "Target Not Assigned"}</h1>
            <p style={{ opacity: 0.9 }}>This is your primary performance goal for the current academic year as set by your Service Manager.</p>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="portal-card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleTabChange('dashboard_hub')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Manager-Assigned Tasks</h2>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 18, color: 'var(--brand-primary)', marginBottom: 16 }}>Current Week Checklist</h3>
            <div style={{ background: 'var(--surface-bg)', padding: 24, borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              {profile?.currentWeeklyTargets?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: '500' }}>
                    <span>Overall Progress</span>
                    <strong style={{ color: 'var(--status-success)' }}>
                      {profile.currentWeeklyTargets.filter(t => t.completed).length}/{profile.currentWeeklyTargets.length} Completed
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'var(--surface-border)', borderRadius: 4, overflow: 'hidden' }}>
                     <div style={{ 
                       width: `${(profile.currentWeeklyTargets.filter(t => t.completed).length / profile.currentWeeklyTargets.length) * 100}%`, 
                       height: '100%', 
                       background: 'var(--status-success)', 
                       borderRadius: 4,
                       transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                     }}></div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!profile?.currentWeeklyTargets || profile.currentWeeklyTargets.length === 0 ? (
                  <div style={{ padding: 16, background: 'rgba(0,0,0,0.02)', borderRadius: 12, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No tasks assigned for the current week.
                  </div>
                ) : (
                  profile.currentWeeklyTargets.map((target, idx) => (
                    <label key={target.id || idx} style={{ 
                      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', 
                      background: target.completed ? 'rgba(52,211,153,0.05)' : '#ffffff', 
                      borderRadius: 12, 
                      border: `1px solid ${target.completed ? 'rgba(52,211,153,0.3)' : 'var(--surface-border)'}`, 
                      cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}>
                      <input 
                        type="checkbox" 
                        style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--status-success)', cursor: 'pointer' }}
                        checked={target.completed}
                        onChange={() => toggleWeeklyTarget(idx)}
                      />
                      <span style={{ fontSize: 15, color: target.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: target.completed ? 'line-through' : 'none', lineHeight: 1.4, transition: 'all 0.2s' }}>
                        {target.title}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 16 }}>Historical Task Logs</h3>
            {(!profile?.managerFeedbacks || profile.managerFeedbacks.length === 0) ? (
              <div className="empty-state">No historical task logs available yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[...profile.managerFeedbacks].reverse().map((fb, idx) => (
                  <div key={idx} style={{ padding: 24, borderRadius: 12, background: '#f5f5f5', border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid #e0e0e0', paddingBottom: 12 }}>
                      <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>Week of {new Date(fb.date).toLocaleDateString()}</strong>
                      <span className="badge badge-service-manager">{fb.managerId || 'Service Manager'}</span>
                    </div>
                    {(!fb.targets || fb.targets.length === 0) ? (
                      <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-secondary)' }}>No specific tasks assigned this week.</p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {fb.targets.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="responsive-grid-1-2" style={{ gap: 24 }}>
          <div className="portal-card">
            <h2 style={{ marginBottom: 16 }}>Post New Material</h2>
            <form onSubmit={handlePostMaterial} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Batch</label>
                <select className="portal-select" value={newMaterial.batch} onChange={e => setNewMaterial({...newMaterial, batch: e.target.value})} required>
                  <option value="">Select Batch</option>
                  {assignedBatches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="portal-select" value={newMaterial.type} onChange={e => setNewMaterial({...newMaterial, type: e.target.value})}>
                  <option value="Notes">Notes / PDF</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Video">Video Link</option>
                  <option value="Announcement">Announcement</option>
                  <option value="Live Link">Live Class Link (Zoom/Meet)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="portal-input" value={newMaterial.title} onChange={e => setNewMaterial({...newMaterial, title: e.target.value})} placeholder="e.g. Chapter 1: Real Numbers" required />
              </div>
              <div className="form-group">
                <label className="form-label">Google Drive Link {newMaterial.type === 'Announcement' && '(Optional)'}</label>
                <input className="portal-input" type="url" value={newMaterial.driveLink} onChange={e => setNewMaterial({...newMaterial, driveLink: e.target.value})} placeholder="https://..." required={newMaterial.type !== 'Announcement'} />
              </div>
              <div className="form-group">
                <label className="form-label">Description / Instructions</label>
                <textarea className="portal-input" rows={3} value={newMaterial.description} onChange={e => setNewMaterial({...newMaterial, description: e.target.value})} placeholder="Optional instructions..." />
              </div>
              <button type="submit" className="btn btn-brand">Post Material</button>
            </form>
          </div>

          <div className="portal-card">
            <h2 style={{ marginBottom: 16 }}>Recently Posted</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {materials.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No materials posted yet.</p> : materials.map(mat => (
                <div key={mat.id} style={{ padding: 16, background: 'var(--surface-bg)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong>{mat.title}</strong>
                    <span className="badge badge-branch-manager">{mat.batch}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span className="badge badge-service-manager">{mat.type}</span>
                    {mat.driveLink && mat.driveLink !== '#' && (
                      <a href={mat.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--brand-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span> Open Link
                      </a>
                    )}
                  </div>
                  {mat.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{mat.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'grading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="portal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <span className="material-symbols-outlined" style={{ color: '#1976d2' }}>grading</span>
                Test Records
              </h2>
              <button 
                className="btn btn-brand btn-sm" 
                onClick={() => setClassTestModal({ isOpen: true, step: 1, form: { date: '', time: '', subject: SUBJECTS[0], batch: (profile?.assignedBatches || [])[0] || '', maxMarks: '' }, students: [] })}
              >
                + Add Class Test
              </button>
            </div>
            <div className="table-responsive">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Batch</th>
                    <th>Subject/Topic</th>
                    <th>Max Marks</th>
                    <th>Resources</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {testRecords.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No test records found.</td></tr>
                  ) : testRecords.map(tr => {
                    const workflow = testWorkflows[tr.testId];
                    return (
                      <tr key={tr.id}>
                        <td>{tr.testDate || '-'}</td>
                        <td><span className="badge badge-branch-manager">{tr.batch}</span></td>
                        <td><strong>{tr.subject}</strong> <br/> <span style={{fontSize: 12, color: '#666'}}>{tr.topic}</span></td>
                        <td>{tr.maxMarks}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {tr.isClassTest ? (
                              <span className="badge" style={{ background: 'var(--brand-primary)', color: '#fff', padding: '4px 8px', fontSize: 11 }}>CLASS TEST</span>
                            ) : (
                              <>
                                {workflow?.finalLink ? (
                                   <a href={workflow.finalLink} target="_blank" rel="noreferrer" className="badge badge-admin" style={{ textDecoration: 'none', background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', fontSize: 11 }}>Paper</a>
                                ) : <span style={{ color: '#ccc' }}>-</span>}
                                {workflow?.solutionsLink && (
                                   <a href={workflow.solutionsLink} target="_blank" rel="noreferrer" className="badge badge-admin" style={{ textDecoration: 'none', background: '#e3f2fd', color: '#1565c0', padding: '4px 8px', fontSize: 11 }}>Answers</a>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <button className="btn-primary btn-sm" onClick={async () => {
                            const { getDocs, query, collection, where } = await import('firebase/firestore');
                            const studentsSnap = await getDocs(query(collection(db, 'students'), where('batch', '==', tr.batch)));
                            const batchStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                            setViewTestRecordStudents(batchStudents);
                            setViewTestRecord(tr);
                          }}>View Marks</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="portal-card">
            <h2 style={{ marginBottom: 16 }}>Assignment Submissions</h2>
            <div className="table-responsive">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Batch</th>
                    <th>Assignment</th>
                    <th>Submission Link</th>
                    <th>Marks/Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No submissions found.</td></tr>
                  ) : submissions.map(sub => (
                    <tr key={sub.id}>
                      <td>{sub.studentName}</td>
                      <td><span className="badge badge-branch-manager">{sub.batch}</span></td>
                      <td>{sub.assignmentTitle}</td>
                      <td>
                        <a href={sub.driveLink} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>View Work</a>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input 
                            className="portal-input" 
                            type="number" 
                            placeholder="e.g. 85" 
                            defaultValue={sub.marks || ''}
                            onBlur={(e) => {
                              if(e.target.value) handleGradeSubmission(sub.id, e.target.value);
                            }}
                            style={{ width: 80, padding: 6, fontSize: 14 }}
                          />
                          {sub.graded && <span className="material-symbols-outlined" style={{ color: 'var(--status-success)', fontSize: 18 }}>check_circle</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {gradingModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 16px 0' }}>Upload Marks for {gradingModal.batch}</h2>
            <p style={{ margin: '0 0 16px 0', color: '#666' }}>
              Test: {gradingModal.subject} ({gradingModal.topic})
            </p>
            <div style={{ marginBottom: 20, background: '#f9f9f9', padding: '16px', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Max Marks for this Test</label>
              <input 
                type="number" 
                value={gradingModal.maxMarks || ''}
                onChange={e => setGradingModal({...gradingModal, maxMarks: Number(e.target.value)})}
                className="portal-input"
                style={{ width: '120px' }}
                placeholder="e.g. 50"
              />
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>Student Name</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Marks Obtained</th>
                </tr>
              </thead>
              <tbody>
                {gradingModal.batchStudents.map(student => (
                  <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 12, fontWeight: 500 }}>{student.fullName || student.studentName || student.name || 'Unknown'}</td>
                    <td style={{ padding: 12 }}>
                      <input 
                        type="number"
                        className="portal-input"
                        style={{ width: 100 }}
                        value={marksData[student.id] !== undefined ? marksData[student.id] : ''}
                        onChange={(e) => setMarksData({...marksData, [student.id]: e.target.value})}
                        max={gradingModal.maxMarks}
                        min={0}
                        placeholder="Marks"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-ghost" onClick={() => setGradingModal({ isOpen: false })}>Cancel</button>
              <button className="btn-primary" onClick={async () => {
                const batchStudents = gradingModal.batchStudents;
                
                // Calculate rankings
                const results = batchStudents.map(student => {
                  const marks = Number(marksData[student.id]) || 0;
                  const percentage = gradingModal.maxMarks > 0 ? ((marks / gradingModal.maxMarks) * 100).toFixed(2) : 0;
                  return { studentId: student.id, marks, percentage };
                });
                
                // Sort to assign ranks (highest marks first)
                results.sort((a, b) => b.marks - a.marks);
                results.forEach((res, idx) => {
                  res.batchRank = idx + 1;
                });
                
                try {
                  // Save to test_marks collection
                  const testMarkDoc = {
                    testId: gradingModal.testId,
                    batch: gradingModal.batch,
                    subject: gradingModal.subject,
                    topic: gradingModal.topic,
                    testDate: gradingModal.testDate,
                    maxMarks: gradingModal.maxMarks,
                    results,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: teacherId
                  };
                  await setDoc(doc(db, 'test_marks', gradingModal.testId), testMarkDoc);
                  
                  // Update workflow status to graded so it moves to completed log
                  await setDoc(doc(db, 'test_workflows', gradingModal.testId), { status: 'graded' }, { merge: true });
                  
                  alert('Marks uploaded and rankings calculated successfully!');
                  setGradingModal({ isOpen: false });
                } catch(e) {
                  console.error(e);
                  alert('Failed to save marks.');
                }
              }}>Submit Marks</button>
            </div>
          </div>
        </div>
      )}

      {/* Class Test Modal */}
      {classTestModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface-card)', padding: 32, borderRadius: 12, width: classTestModal.step === 1 ? 500 : 700, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--surface-border)' }}>
            
            {classTestModal.step === 1 && (
              <>
                <h2 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>edit_document</span>
                  Create Class Test
                </h2>
                <div className="grid-2" style={{ gap: 16, marginBottom: 24 }}>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="portal-input" value={classTestModal.form.date} onChange={e => setClassTestModal({ ...classTestModal, form: { ...classTestModal.form, date: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time</label>
                    <input type="time" className="portal-input" value={classTestModal.form.time} onChange={e => setClassTestModal({ ...classTestModal, form: { ...classTestModal.form, time: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <select className="portal-select" value={classTestModal.form.subject} onChange={e => setClassTestModal({ ...classTestModal, form: { ...classTestModal.form, subject: e.target.value } })}>
                      {SUBJECTS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Batch</label>
                    <select className="portal-select" value={classTestModal.form.batch} onChange={e => setClassTestModal({ ...classTestModal, form: { ...classTestModal.form, batch: e.target.value } })}>
                      {(profile?.assignedBatches || []).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Max Marks</label>
                    <input type="number" className="portal-input" placeholder="e.g. 50" value={classTestModal.form.maxMarks} onChange={e => setClassTestModal({ ...classTestModal, form: { ...classTestModal.form, maxMarks: e.target.value } })} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button className="btn btn-ghost" onClick={() => setClassTestModal({ ...classTestModal, isOpen: false })}>Cancel</button>
                  <button className="btn btn-brand" onClick={async () => {
                    const { date, time, subject, batch, maxMarks } = classTestModal.form;
                    if (!date || !time || !subject || !batch || !maxMarks) {
                      alert('Please fill in all fields.');
                      return;
                    }
                    const { getDocs, query, collection, where } = await import('firebase/firestore');
                    const studentsSnap = await getDocs(query(collection(db, 'students'), where('batch', '==', batch)));
                    const batchStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const initialMarks = {};
                    batchStudents.forEach(s => initialMarks[s.id] = '');
                    setMarksData(initialMarks);
                    setClassTestModal({ ...classTestModal, step: 2, students: batchStudents });
                  }}>Next: Enter Marks</button>
                </div>
              </>
            )}

            {classTestModal.step === 2 && (
              <>
                <h2 style={{ margin: '0 0 8px 0' }}>Enter Marks: {classTestModal.form.batch}</h2>
                <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                  {classTestModal.form.subject} • {classTestModal.form.date} ({classTestModal.form.time}) • Max Marks: {classTestModal.form.maxMarks}
                </p>
                
                <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: 24, border: '1px solid var(--surface-border)', borderRadius: 8 }}>
                  <table className="portal-table" style={{ margin: 0 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th>Student Name</th>
                        <th>Marks Obtained</th>
                        <th>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classTestModal.students.length === 0 ? (
                        <tr><td colSpan="3" style={{ textAlign: 'center' }}>No students found in this batch.</td></tr>
                      ) : classTestModal.students.map(student => {
                        const m = Number(marksData[student.id]) || 0;
                        const p = Number(classTestModal.form.maxMarks) > 0 ? ((m / Number(classTestModal.form.maxMarks)) * 100).toFixed(1) : 0;
                        return (
                          <tr key={student.id}>
                            <td>{student.studentName}</td>
                            <td>
                              <input type="number" className="portal-input" style={{ width: 80, padding: 6 }} value={marksData[student.id] || ''} onChange={e => setMarksData({...marksData, [student.id]: e.target.value})} max={classTestModal.form.maxMarks} min={0} />
                            </td>
                            <td>{p}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button className="btn btn-ghost" onClick={() => setClassTestModal({ ...classTestModal, step: 1 })}>Back</button>
                  <button className="btn btn-brand" onClick={async () => {
                    try {
                      const { updateDoc, doc, arrayUnion } = await import('firebase/firestore');
                      const testId = `class_test_${Date.now()}`;
                      
                      const results = classTestModal.students.map(student => {
                        const marks = Number(marksData[student.id]) || 0;
                        const percentage = Number(classTestModal.form.maxMarks) > 0 ? ((marks / Number(classTestModal.form.maxMarks)) * 100).toFixed(2) : 0;
                        return { studentId: student.id, marks, percentage };
                      });
                      
                      results.sort((a, b) => b.marks - a.marks);
                      results.forEach((res, idx) => { res.batchRank = idx + 1; });
                      
                      const testMarkDoc = {
                        testId,
                        batch: classTestModal.form.batch,
                        subject: classTestModal.form.subject,
                        topic: 'Class Test',
                        testDate: classTestModal.form.date,
                        testTime: classTestModal.form.time,
                        maxMarks: Number(classTestModal.form.maxMarks),
                        results,
                        uploadedAt: new Date().toISOString(),
                        uploadedBy: teacherId,
                        isClassTest: true
                      };
                      
                      await setDoc(doc(db, 'test_marks', testId), testMarkDoc);
                      
                      for (const student of classTestModal.students) {
                        const marks = Number(marksData[student.id]) || 0;
                        await updateDoc(doc(db, 'students', student.id), {
                          testHistory: arrayUnion({
                            testId,
                            date: classTestModal.form.date,
                            time: classTestModal.form.time,
                            subject: classTestModal.form.subject,
                            type: 'Class Test',
                            maxMarks: Number(classTestModal.form.maxMarks),
                            obtainedMarks: marks
                          })
                        });
                      }
                      
                      alert('Class Test saved and students updated successfully!');
                      setClassTestModal({ isOpen: false, step: 1, form: { date: '', time: '', subject: SUBJECTS[0], batch: (profile?.assignedBatches || [])[0] || '', maxMarks: '' }, students: [] });
                    } catch(e) {
                      console.error(e);
                      alert('Failed to save Class Test.');
                    }
                  }}>Save Test Record</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Draft Submission Modal */}
      {draftModal.isOpen && draftModal.duty && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface-card)', padding: 32, borderRadius: 12, width: 400, maxWidth: '90%', border: '1px solid var(--surface-border)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Submit Draft Link</h2>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: 14 }}>Batch: {draftModal.duty.batch} - {draftModal.duty.type}</p>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Google Doc / PDF Link</label>
              <input 
                type="url" 
                value={draftModal.link}
                onChange={e => setDraftModal({...draftModal, link: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'var(--surface-bg)' }}
                placeholder="https://docs.google.com/..."
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setDraftModal({ isOpen: false, duty: null, link: '', startDate: null })}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!draftModal.link) {
                    alert('Please provide a link.');
                    return;
                  }
                  const d = new Date(draftModal.startDate);
                  d.setDate(d.getDate() + 3); // Thursday
                  
                  const formatDate = (dateObj) => {
                    if (!dateObj) return '';
                    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear().toString().slice(-2)}`;
                  };

                  setDoc(doc(db, 'test_workflows', draftModal.duty.testId), {
                    batch: draftModal.duty.batch,
                    subject: draftModal.duty.subject,
                    topic: draftModal.duty.topic,
                    draftLink: draftModal.link,
                    status: 'draft_submitted',
                    deadline: formatDate(d),
                    testDate: draftModal.duty.testId.split('_')[0],
                    preparedBy: teacherId,
                    submittedAt: new Date().toISOString()
                  }, { merge: true }).then(() => {
                    alert('Draft submitted successfully!');
                    setDraftModal({ isOpen: false, duty: null, link: '', startDate: null });
                  }).catch(err => {
                    console.error(err);
                    alert('Failed to submit draft.');
                  });
                }}
                style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#4caf50', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Submit Draft
              </button>
            </div>
          </div>
        </div>
      )}
      {feedbackStudent && (
        <StudentFeedbackModal 
          student={feedbackStudent} 
          teacherName={profile?.fullName || profile?.displayName || 'Teacher'} 
          teacherId={teacherId} 
          onClose={() => setFeedbackStudent(null)} 
        />
      )}

      {ptmStudent && (
        <SchedulePTMModal 
          student={ptmStudent} 
          teacherName={profile?.fullName || profile?.displayName || 'Teacher'} 
          teacherId={teacherId} 
          onClose={() => setPtmStudent(null)} 
        />
      )}

      {ratingModal.isOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setRatingModal({ ...ratingModal, isOpen: false }); }}>
          <div className="modal-box" style={{ maxWidth: '300px', width: '100%', animation: 'fadeIn 0.2s ease-out' }}>
            <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#f57c00' }}>star</span>
              Rate Self-Study
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--brand-primary)' }}>{ratingModal.score} <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>/ 10</span></span>
              <input 
                type="range" 
                min="0" max="10" 
                value={ratingModal.score}
                onChange={(e) => setRatingModal({ ...ratingModal, score: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-ghost" onClick={() => setRatingModal({ ...ratingModal, isOpen: false })}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveRating}>Save Rating</button>
            </div>
          </div>
        </div>
      )}

      {postLectureModal.isOpen && (
        <PostLectureModal
          classData={postLectureModal.classData}
          teacherName={profile?.fullName || profile?.displayName || 'Teacher'}
          teacherId={teacherId}
          onClose={() => setPostLectureModal({ isOpen: false, classData: null })}
        />
      )}
      {viewTestRecord && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #e0e0e0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: 22 }}>Test Marks: {viewTestRecord.batch}</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  <strong>{viewTestRecord.subject}</strong> ({viewTestRecord.topic}) | Max Marks: {viewTestRecord.maxMarks}
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setViewTestRecord(null)}>Close</button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: 12, textAlign: 'center' }}>Rank</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Student Name</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Marks</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {viewTestRecord.results?.sort((a,b) => a.batchRank - b.batchRank).map(res => {
                  const student = viewTestRecordStudents.find(s => s.id === res.studentId);
                  const studentName = student ? (student.fullName || student.studentName || student.name || 'Unknown') : 'ID: ' + res.studentId.slice(0, 6);
                  return (
                    <tr key={res.studentId} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold', color: res.batchRank === 1 ? '#fbc02d' : 'inherit' }}>#{res.batchRank}</td>
                      <td style={{ padding: 12, textAlign: 'left' }}>{studentName}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold' }}>{res.marks}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <span style={{ color: Number(res.percentage) < 33 ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>{res.percentage}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Leave Request Modal */}
      {leaveModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 12, width: 500, maxWidth: '90%', border: '1px solid #e0e0e0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 8px 0' }}>Request Leave</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Select the type of leave and the dates.</p>
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">How many days leave do you want?</label>
              <input type="number" min="1" className="portal-input" value={leaveFormData.days} onChange={e => setLeaveFormData({...leaveFormData, days: e.target.value})} placeholder="e.g. 2" />
            </div>

            <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="portal-input" value={leaveFormData.startDate} onChange={e => setLeaveFormData({...leaveFormData, startDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input type="date" className="portal-input" value={leaveFormData.endDate} onChange={e => setLeaveFormData({...leaveFormData, endDate: e.target.value})} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Leave Category</label>
              <select className="portal-input" value={leaveFormData.type} onChange={e => setLeaveFormData({...leaveFormData, type: e.target.value})}>
                {Object.entries(yearlyHolidayStats).map(([key, stat]) => {
                  const left = stat.quota - stat.used;
                  return (
                    <option key={key} value={key} disabled={left <= 0 || totalHolidaysLeft <= 0}>
                      {stat.label} ({left > 0 ? `${left} days left` : 'Quota Reached'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Reason</label>
              <textarea className="portal-input" style={{ minHeight: 60 }} value={leaveFormData.reason} onChange={e => setLeaveFormData({...leaveFormData, reason: e.target.value})} placeholder="Provide a brief reason for the leave" />
            </div>

            <div className="modal-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-ghost" onClick={() => setLeaveModalOpen(false)} disabled={leaveSaving} style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button className="btn-primary" onClick={handleLeaveSubmit} disabled={leaveSaving} style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: 'var(--brand-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {leaveSaving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Details Modal */}
      {holidayDetailsType && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #e0e0e0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: 22 }}>
                  {yearlyHolidayStats[holidayDetailsType]?.label} Details
                </h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  Total Used: {yearlyHolidayStats[holidayDetailsType]?.used} / {yearlyHolidayStats[holidayDetailsType]?.quota} days
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setHolidayDetailsType(null)}>Close</button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>Date Range</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Days</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Reason</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.filter(r => r.type === holidayDetailsType).length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No holidays of this type recorded.</td>
                  </tr>
                ) : (
                  leaveRequests.filter(r => r.type === holidayDetailsType).map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 12, textAlign: 'left' }}>
                        {req.startDate ? new Date(req.startDate).toLocaleDateString('en-GB') : '-'} to {req.endDate ? new Date(req.endDate).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold' }}>{req.totalDays}</td>
                      <td style={{ padding: 12, textAlign: 'left', fontStyle: 'italic', color: 'var(--text-secondary)' }}>{req.reason || 'No reason provided'}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <span style={{ 
                          padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 'bold',
                          background: req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef9c3',
                          color: req.status === 'approved' ? '#166534' : req.status === 'rejected' ? '#991b1b' : '#854d0e'
                        }}>
                          {req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Global Ticket Drawer for Teachers */}
      <TicketDrawer isOpen={isTicketOpen} onClose={() => setIsTicketOpen(false)} />

    </div>
  );
}
