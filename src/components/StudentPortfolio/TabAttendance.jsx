import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export default function TabAttendance({ student }) {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const q = query(collection(db, 'attendance'), where('batch', '==', student.batch));
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Determine student's joining date to avoid marking them present before they joined
        const joiningDateStr = student.dateOfJoining || (student.admissionDate ? student.admissionDate.substring(0, 10) : null);
        const joiningDate = joiningDateStr ? new Date(joiningDateStr) : new Date(0);
        // Normalize joining date to midnight for comparison
        joiningDate.setHours(0, 0, 0, 0);

        // Filter out records from before the student joined, then map presence/absence
        const processed = logs.filter(log => {
          if (!log.date) return false;
          const logDate = new Date(log.date);
          logDate.setHours(0, 0, 0, 0);
          return logDate >= joiningDate;
        }).map(log => {
          const isAbsent = log.absenteeIds && log.absenteeIds.includes(student.id);
          return {
            ...log,
            status: isAbsent ? 'Absent' : 'Present'
          };
        });
        
        // Sort by date descending
        processed.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAttendanceLogs(processed);
      } catch (err) {
        console.error('Failed to fetch attendance', err);
      } finally {
        setLoading(false);
      }
    };
    if (student.batch) {
      fetchAttendance();
    } else {
      setLoading(false);
    }
  }, [student]);

  if (loading) return <div style={{ padding: '24px' }}>Loading attendance records...</div>;

  const totalClasses = attendanceLogs.length;
  const presentClasses = attendanceLogs.filter(l => l.status === 'Present').length;
  const attendancePercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

  return (
    <div className="sd-profile-body">
      <div className="sd-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="sd-section-title" style={{ margin: 0 }}>
            <span className="material-symbols-outlined">event_available</span>
            Daily Attendance Log
          </h3>
          <div style={{ fontSize: '18px', fontWeight: 600, color: attendancePercentage >= 75 ? 'var(--status-success)' : 'var(--status-error)' }}>
            {attendancePercentage}% Overall
          </div>
        </div>

        {attendanceLogs.length === 0 ? (
          <div className="sd-empty-state" style={{ minHeight: '150px' }}>
            <span className="material-symbols-outlined">calendar_today</span>
            <div>No attendance records found for this batch.</div>
          </div>
        ) : (
          <table className="sd-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Session Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLogs.map(log => (
                <tr key={log.id}>
                  <td>{log.date}</td>
                  <td>{log.sessionType || 'Regular'}</td>
                  <td>
                    <span className={`sd-badge ${log.status === 'Present' ? 'sd-badge-status' : ''}`} style={{ background: log.status === 'Absent' ? 'var(--status-error)' : undefined, color: log.status === 'Absent' ? '#fff' : undefined }}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
