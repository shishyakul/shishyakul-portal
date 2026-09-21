import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Label } from 'recharts';

export default function PersonalAttendance({ profile }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = profile?.id || user?.uid;
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Flippable States
  const [isStatsFlipped, setIsStatsFlipped] = useState(false);
  const [isHolidayStatsFlipped, setIsHolidayStatsFlipped] = useState(false);
  const [isYearlyAttendanceFlipped, setIsYearlyAttendanceFlipped] = useState(false);
  
  // Leave and Holiday States
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({ type: 'summer', startDate: '', endDate: '', reason: '', days: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [holidayDetailsType, setHolidayDetailsType] = useState(null);

  // Fetch Attendance Records
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'teacher_attendance'),
      where('teacherId', '==', userId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      records.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAttendanceRecords(records);
    });
    return () => unsub();
  }, [userId]);

  // Fetch Leave Requests
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'leave_requests'),
      where('teacherId', '==', userId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      setLeaveRequests(records);
    });
    return () => unsub();
  }, [userId]);

  // Calendar Date Helpers
  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  // Dynamic Holiday Analytics
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

  // Calculate stats for current month and year
  const calculateRealStats = (year, month = null) => {
    let presentDays = 0, absentDays = 0, lateMarks = 0, sundays = 0, holidaysTook = 0;
    let totalDays = 0;

    const today = new Date();

    if (month !== null) {
      totalDays = getDaysInMonth(year, month);
      // Count sundays
      for (let i = 1; i <= totalDays; i++) {
        if (new Date(year, month, i).getDay() === 0) sundays++;
      }
      // Count approved leaves
      leaveRequests.forEach(lr => {
        if (lr.status === 'approved') {
          const start = new Date(lr.startDate);
          const end = lr.endDate ? new Date(lr.endDate) : start;
          // Count overlapping days in current month
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getFullYear() === year && d.getMonth() === month) {
              if (d.getDay() !== 0) { // exclude sundays from leaves count since sundays are already blue
                holidaysTook++;
              }
            }
          }
        }
      });
    } else {
      // Yearly stats: from April 1st to today
      let academicYearStart;
      if (today.getMonth() < 3) {
        academicYearStart = new Date(today.getFullYear() - 1, 3, 1);
      } else {
        academicYearStart = new Date(today.getFullYear(), 3, 1);
      }

      const timeDiff = today.getTime() - academicYearStart.getTime();
      let daysPassed = Math.ceil(timeDiff / (1000 * 3600 * 24));
      if (daysPassed < 0) daysPassed = 0;
      totalDays = daysPassed;

      for (let i = 0; i < daysPassed; i++) {
        const d = new Date(academicYearStart);
        d.setDate(d.getDate() + i);
        if (d.getDay() === 0) sundays++;
      }

      leaveRequests.forEach(lr => {
        if (lr.status === 'approved') {
          const start = new Date(lr.startDate);
          const end = lr.endDate ? new Date(lr.endDate) : start;
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d >= academicYearStart && d <= today) {
              if (d.getDay() !== 0) {
                holidaysTook++;
              }
            }
          }
        }
      });
    }

    // Filter attendance records by month/year
    const filtered = attendanceRecords.filter(r => {
      const d = new Date(r.date);
      if (month !== null) {
        return d.getFullYear() === year && d.getMonth() === month;
      } else {
        let academicYearStart;
        if (today.getMonth() < 3) {
          academicYearStart = new Date(today.getFullYear() - 1, 3, 1);
        } else {
          academicYearStart = new Date(today.getFullYear(), 3, 1);
        }
        return d >= academicYearStart && d <= today;
      }
    });

    filtered.forEach(r => {
      if (r.status === 'Present' || r.status === 'On Time') {
        presentDays++;
      } else if (r.status === 'Late') {
        presentDays++;
        lateMarks++;
      } else {
        absentDays++;
      }
    });

    const workingDays = totalDays - sundays - holidaysTook;
    return { workingDays, presentDays, absentDays, lateMarks, sundays, holidaysTook, totalDays };
  };

  const monthlyStats = calculateRealStats(currentYear, currentMonth);
  const yearlyAttendanceStats = calculateRealStats(currentYear);

  const formatDateForAttendance = (date) => {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Leave Form Submission
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
        teacherId: userId,
        teacherName: profile?.fullName || 'Manager',
        type: leaveFormData.type,
        startDate: leaveFormData.startDate,
        endDate: leaveFormData.endDate,
        totalDays: days,
        reason: leaveFormData.reason,
        status: 'pending',
        timestamp: serverTimestamp()
      });

      alert("Leave Request Submitted successfully!");
      setLeaveModalOpen(false);
      setLeaveFormData({ type: 'summer', startDate: '', endDate: '', reason: '', days: '' });
    } catch (e) {
      console.error(e);
      alert("Failed to submit leave request.");
    } finally {
      setLeaveSaving(false);
    }
  };

  // Inject Fake Attendance Data for testing
  const injectFakeAttendanceData = async () => {
    const fakeRecords = [
      { teacherId: userId, date: new Date().toISOString().split('T')[0], punchIn: '09:45 AM', punchOut: '--:-- --', status: 'On Time', totalHours: '--', roleCompleted: true },
      { teacherId: userId, date: new Date(Date.now() - 86400000).toISOString().split('T')[0], punchIn: '09:50 AM', punchOut: '06:15 PM', status: 'On Time', totalHours: '8h 25m', roleCompleted: true },
      { teacherId: userId, date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], punchIn: '10:15 AM', punchOut: '06:30 PM', status: 'Late', totalHours: '8h 15m', roleCompleted: true },
      { teacherId: userId, date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0], punchIn: '09:40 AM', punchOut: '06:00 PM', status: 'On Time', totalHours: '8h 20m', roleCompleted: true },
      { teacherId: userId, date: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0], punchIn: '09:55 AM', punchOut: '06:05 PM', status: 'On Time', totalHours: '8h 10m', roleCompleted: true },
    ];
    for (const rec of fakeRecords) {
      await addDoc(collection(db, 'teacher_attendance'), rec);
    }
    alert('Fake records injected!');
  };

  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 'bold' }}>Sunday</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#475569' }}>{monthlyStats.sundays}</p>
                </div>
                <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#9333ea', fontWeight: 'bold' }}>Approved Leaves</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#7e22ce' }}>{monthlyStats.holidaysTook}</p>
                </div>
                <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#0284c7', fontWeight: 'bold' }}>Working Days</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#0369a1' }}>{monthlyStats.workingDays}</p>
                </div>
                <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#16a34a', fontWeight: 'bold' }}>Present Days</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#15803d' }}>{monthlyStats.presentDays}</p>
                </div>
                <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#ea580c', fontWeight: 'bold' }}>Late</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#c2410c' }}>{monthlyStats.lateMarks}</p>
                </div>
                <div style={{ background: 'white', padding: '12px 8px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e0f2fe' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#e11d48', fontWeight: 'bold' }}>Absent</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: '900', color: '#be123c' }}>{monthlyStats.absentDays}</p>
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
                        { name: 'Leaves', value: monthlyStats.holidaysTook, color: '#9c27b0' },
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
                          { name: 'Leaves', value: monthlyStats.holidaysTook, color: '#9c27b0' },
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
                const dateObj = new Date(currentYear, currentMonth, day);
                const dayOfWeekStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
                const dateStr = dateObj.toISOString().split('T')[0];

                const isSunday = dayOfWeekStr === 'SUNDAY';

                // Check actual attendance records for this date
                const record = attendanceRecords.find(r => r.date === dateStr);

                // Check leaves
                let isApprovedLeave = false;
                if (leaveRequests) {
                  isApprovedLeave = leaveRequests.some(lr => {
                    if (lr.status !== 'approved') return false;
                    const start = new Date(lr.startDate);
                    const end = lr.endDate ? new Date(lr.endDate) : start;
                    return dateObj >= start && dateObj <= end;
                  });
                }

                let bgColor = 'var(--surface-base)';
                let color = 'var(--text-primary)';
                let border = '1px solid var(--surface-border)';
                let statusTitle = '';

                if (isSunday) {
                  bgColor = 'rgba(59, 130, 246, 0.15)'; // Blue for Sunday
                  color = '#3b82f6';
                  border = '1px solid #3b82f6';
                  statusTitle = 'Sunday';
                } else if (isApprovedLeave) {
                  bgColor = 'rgba(156, 39, 176, 0.15)'; // Purple for Leave
                  color = '#9c27b0';
                  border = '1px solid #9c27b0';
                  statusTitle = 'Approved Leave';
                } else if (record) {
                  if (record.status === 'Present' || record.status === 'On Time') {
                    bgColor = 'rgba(16, 185, 129, 0.15)'; // Green for Present
                    color = 'var(--status-success)';
                    border = '1px solid var(--status-success)';
                    statusTitle = `Present (${record.punchIn})`;
                  } else if (record.status === 'Late') {
                    bgColor = 'rgba(249, 115, 22, 0.15)'; // Orange for Late
                    color = '#f97316';
                    border = '1px solid #f97316';
                    statusTitle = `Late (${record.punchIn})`;
                  } else if (record.status === 'Absent') {
                    bgColor = 'rgba(239, 68, 68, 0.15)'; // Red for Absent
                    color = 'var(--status-error)';
                    border = '1px solid var(--status-error)';
                    statusTitle = 'Absent';
                  }
                } else {
                  // No record: check if past date
                  const todayStr = new Date().toISOString().split('T')[0];
                  if (dateStr < todayStr) {
                    bgColor = 'rgba(239, 68, 68, 0.08)'; // Light Red for Unexcused Absence
                    color = 'var(--status-error)';
                    border = '1px solid rgba(239, 68, 68, 0.3)';
                    statusTitle = 'Absent (No Punch)';
                  }
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

      <div className="portal-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>Recent Punch Records</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {attendanceRecords.length === 0 && (
              <button className="btn btn-sm btn-ghost" onClick={injectFakeAttendanceData} style={{ padding: '4px 12px', border: '1px solid var(--surface-border)' }}>Inject Test Data</button>
            )}
            <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', fontSize: 12 }}>Biometric Sync Active</span>
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
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Status Icon</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No punch records found yet.
                  </td>
                </tr>
              ) : attendanceRecords.map(record => (
                <tr key={record.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: '12px 16px' }}>{formatDateForAttendance(new Date(record.date))}</td>
                  <td style={{ padding: '12px 16px', fontWeight: record.punchOut === '--:-- --' ? 'bold' : 'normal' }}>{record.punchIn}</td>
                  <td style={{ padding: '12px 16px', color: record.punchOut === '--:-- --' ? 'var(--text-secondary)' : 'inherit' }}>{record.punchOut}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      color: record.status === 'Late' ? '#c62828' : '#2e7d32',
                      fontWeight: 'bold',
                      background: record.status === 'Late' ? '#ffebee' : '#e8f5e9',
                      padding: '4px 8px', borderRadius: 4,
                      fontSize: 12
                    }}>
                      {record.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: record.punchOut !== '--:-- --' ? 'bold' : 'normal', color: record.punchOut === '--:-- --' ? 'var(--text-secondary)' : 'inherit' }}>{record.totalHours}</td>
                  <td style={{ padding: '12px 16px' }} title={record.roleCompleted ? "All operational tasks and reports submitted" : (record.punchOut === '--:-- --' ? "Pending: Shift incomplete" : "Tasks or check-out incomplete")}>
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
                    <button className="btn btn-sm" style={{ background: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); setLeaveModalOpen(true); }}>+ Request Leave</button>
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

              {/* BACK: Quota Usage Pie Chart */}
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

          {/* Right Column: Yearly Overall Attendance (Flippable) */}
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
                  <div style={{ background: '#eff6ff', padding: '16px 12px', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #bfdbfe' }}>
                    <p style={{ margin: 0, fontSize: 14, color: '#2563eb', fontWeight: 'bold' }}>Yearly Working Days</p>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: '900', color: '#1d4ed8', lineHeight: 1 }}>{yearlyAttendanceStats.workingDays}</span>
                      <span style={{ fontSize: 14, color: '#2563eb', marginBottom: 4 }}>Days</span>
                    </div>
                  </div>
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
                  <div style={{ background: '#fffbeb', padding: '16px 12px', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #fef3c7' }}>
                    <p style={{ margin: 0, fontSize: 14, color: '#d97706', fontWeight: 'bold' }}>Approved Leaves</p>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: '900', color: '#b45309', lineHeight: 1 }}>{totalHolidaysUsed}</span>
                      <span style={{ fontSize: 14, color: '#d97706', marginBottom: 4 }}>Days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BACK: Yearly Overall Attendance Chart */}
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
                <h3 style={{ color: '#1e293b', margin: '0 0 12px 0', fontSize: 16 }}>Yearly Breakdown</h3>
                <div style={{ flex: 1, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Present', value: yearlyAttendanceStats.presentDays, color: '#10b981' },
                          { name: 'Absent', value: yearlyAttendanceStats.absentDays, color: '#ef4444' },
                          { name: 'Holidays', value: totalHolidaysUsed, color: '#f59e0b' },
                          { name: 'Sundays', value: yearlyAttendanceStats.sundays, color: '#64748b' }
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={true}
                        stroke="none"
                      >
                        <Label
                          value={yearlyAttendanceStats.totalDays}
                          position="centerBottom"
                          dy={-10}
                          fill="#1e293b"
                          style={{ fontSize: '18px', fontWeight: '900' }}
                        />
                        <Label
                          value="Total Days"
                          position="centerTop"
                          dy={10}
                          fill="#64748b"
                          style={{ fontSize: '12px', fontWeight: 'bold' }}
                        />
                        {
                          [
                            { name: 'Present', value: yearlyAttendanceStats.presentDays, color: '#10b981' },
                            { name: 'Absent', value: yearlyAttendanceStats.absentDays, color: '#ef4444' },
                            { name: 'Holidays', value: totalHolidaysUsed, color: '#f59e0b' },
                            { name: 'Sundays', value: yearlyAttendanceStats.sundays, color: '#64748b' }
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))
                        }
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontWeight: 'bold' }}
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

      {/* Leave Request Modal */}
      {leaveModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 12, width: 500, maxWidth: '90%', border: '1px solid #e0e0e0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Request Leave</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Select the type of leave and the dates.</p>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: 6 }}>How many days leave do you want?</label>
              <input type="number" min="1" className="portal-input" value={leaveFormData.days} onChange={e => setLeaveFormData({ ...leaveFormData, days: e.target.value })} placeholder="e.g. 2" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--surface-border)' }} />
            </div>

            <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: 6 }}>Start Date</label>
                <input type="date" className="portal-input" value={leaveFormData.startDate} onChange={e => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--surface-border)' }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: 6 }}>End Date</label>
                <input type="date" className="portal-input" value={leaveFormData.endDate} onChange={e => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--surface-border)' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: 6 }}>Leave Category</label>
              <select className="portal-input" value={leaveFormData.type} onChange={e => setLeaveFormData({ ...leaveFormData, type: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'white' }}>
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
              <label className="form-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: 6 }}>Reason</label>
              <textarea className="portal-input" style={{ minHeight: 60, width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--surface-border)', resize: 'vertical' }} value={leaveFormData.reason} onChange={e => setLeaveFormData({ ...leaveFormData, reason: e.target.value })} placeholder="Provide a brief reason for the leave" />
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
              <button className="btn btn-outline btn-sm" onClick={() => setHolidayDetailsType(null)}>Close</button>
            </div>

            <table className="portal-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
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
                    <td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>No holidays of this type recorded.</td>
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
    </div>
  );
}
