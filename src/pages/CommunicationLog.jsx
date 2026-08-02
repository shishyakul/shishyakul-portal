import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { BATCH_DEF } from './Batches';

export default function CommunicationLog() {
  const { profile } = useAuth();
  
  // Data States
  const [communications, setCommunications] = useState([]);
  const [studentGrievances, setStudentGrievances] = useState([]);
  const [facultyGrievances, setFacultyGrievances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'attendance', 'notices', 'student_grievance', 'faculty_grievance'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'today', '7days', '30days'

  // Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Batches list from BATCH_DEF
  const allBatches = useMemo(() => {
    const list = Object.values(BATCH_DEF).flat().map(b => b.id);
    return Array.from(new Set(list));
  }, []);

  // 1. Real-time Firebase Subscriptions
  useEffect(() => {
    setLoading(true);

    // a. Teacher to Student Direct Communications
    const qComm = collection(db, 'student_communications');
    const unsubComm = onSnapshot(qComm, (snap) => {
      const docs = snap.docs.map(d => {
        const data = d.data();
        const createdDate = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.dateFormatted || Date.now()));
        return {
          id: d.id,
          sourceType: 'teacher_message',
          ...data,
          parsedDate: createdDate
        };
      });
      setCommunications(docs);
    }, (err) => console.error("Error fetching communications:", err));

    // b. Student Support Grievances
    const qStuGriev = collection(db, 'grievances');
    const unsubStuGriev = onSnapshot(qStuGriev, (snap) => {
      const docs = snap.docs.map(d => {
        const data = d.data();
        const createdDate = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date());
        return {
          id: d.id,
          sourceType: 'student_grievance',
          teacherName: 'Student Support Desk',
          teacherRole: 'student_portal',
          subject: `Student Grievance: [${data.category || 'General'}]`,
          message: data.description || '',
          batch: data.batch || 'N/A',
          type: 'student_grievance',
          ...data,
          parsedDate: createdDate
        };
      });
      setStudentGrievances(docs);
    }, (err) => console.error("Error fetching student grievances:", err));

    // c. Faculty Grievances
    const qFacGriev = collection(db, 'faculty_grievances');
    const unsubFacGriev = onSnapshot(qFacGriev, (snap) => {
      const docs = snap.docs.map(d => {
        const data = d.data();
        const createdDate = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date());
        return {
          id: d.id,
          sourceType: 'faculty_grievance',
          studentName: 'Service Manager (Rohan Sir)',
          batch: 'Internal Faculty',
          subject: `Faculty Grievance [Priority: ${data.priority || 'Normal'}]`,
          message: data.request || '',
          type: 'faculty_grievance',
          ...data,
          parsedDate: createdDate
        };
      });
      setFacultyGrievances(docs);
      setLoading(false);
    }, (err) => console.error("Error fetching faculty grievances:", err));

    return () => {
      unsubComm();
      unsubStuGriev();
      unsubFacGriev();
    };
  }, []);

  // Aggregate and Sort All Logs
  const combinedLogs = useMemo(() => {
    let logs = [];
    if (activeTab === 'all') {
      logs = [...communications, ...studentGrievances, ...facultyGrievances];
    } else if (activeTab === 'attendance') {
      logs = communications.filter(c => c.type === 'attendance_alert' || (c.subject && c.subject.toLowerCase().includes('attendance')));
    } else if (activeTab === 'notices') {
      logs = communications.filter(c => c.type !== 'attendance_alert' && !(c.subject && c.subject.toLowerCase().includes('attendance')));
    } else if (activeTab === 'student_grievance') {
      logs = studentGrievances;
    } else if (activeTab === 'faculty_grievance') {
      logs = facultyGrievances;
    }

    // Filter by Batch
    if (selectedBatch !== 'all') {
      logs = logs.filter(item => (item.batch || '').toLowerCase().includes(selectedBatch.toLowerCase()));
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(item => 
        (item.studentName && item.studentName.toLowerCase().includes(q)) ||
        (item.teacherName && item.teacherName.toLowerCase().includes(q)) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.message && item.message.toLowerCase().includes(q)) ||
        (item.batch && item.batch.toLowerCase().includes(q))
      );
    }

    // Filter by Time Range
    if (timeFilter !== 'all') {
      const now = new Date();
      logs = logs.filter(item => {
        if (!item.parsedDate) return true;
        const diffMs = now - item.parsedDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (timeFilter === 'today') return diffDays <= 1;
        if (timeFilter === '7days') return diffDays <= 7;
        if (timeFilter === '30days') return diffDays <= 30;
        return true;
      });
    }

    // Sort descending by date
    return logs.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0));
  }, [communications, studentGrievances, facultyGrievances, activeTab, selectedBatch, searchQuery, timeFilter]);

  // KPI Calculations
  const totalCommunicationsCount = communications.length;
  const attendanceAlertsCount = communications.filter(c => c.type === 'attendance_alert' || (c.subject && c.subject.toLowerCase().includes('attendance'))).length;
  const directNoticesCount = communications.length - attendanceAlertsCount;
  const pendingStudentGrievances = studentGrievances.filter(g => (g.status || '').toLowerCase() === 'pending').length;
  const pendingFacultyGrievances = facultyGrievances.filter(g => (g.status || '').toLowerCase() === 'pending').length;

  const formatDate = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return 'Recently';
    return dateObj.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleUpdateGrievanceStatus = async (item, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      if (item.sourceType === 'student_grievance') {
        await updateDoc(doc(db, 'grievances', item.id), {
          status: newStatus,
          resolvedAt: new Date(),
          resolvedBy: profile?.fullName || 'Service Manager',
          resolutionNote: resolutionNote.trim()
        });
      } else if (item.sourceType === 'faculty_grievance') {
        await updateDoc(doc(db, 'faculty_grievances', item.id), {
          status: newStatus,
          resolvedAt: new Date(),
          resolvedBy: profile?.fullName || 'Service Manager',
          resolutionNote: resolutionNote.trim()
        });
      } else if (item.sourceType === 'teacher_message') {
        await updateDoc(doc(db, 'student_communications', item.id), {
          serviceManagerStatus: newStatus,
          smReviewedAt: new Date(),
          smReviewedBy: profile?.fullName || 'Service Manager',
          resolutionNote: resolutionNote.trim()
        });
      }
      setSelectedItem(prev => prev ? { ...prev, status: newStatus, serviceManagerStatus: newStatus, resolutionNote } : null);
      alert(`Status updated to ${newStatus}!`);
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--brand-primary)' }}>mark_chat_read</span>
            Communication & Grievance Log
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
            Central audit trail recording all Teacher-Student direct notices, batch attendance warnings, and academic grievances.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="btn btn-ghost" 
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>print</span>
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div className="portal-card" style={{ borderLeft: '4px solid #3b82f6', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Notices</span>
            <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>chat</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0 4px', color: 'var(--text-primary)' }}>
            {totalCommunicationsCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Teacher-to-Student messages</div>
        </div>

        <div className="portal-card" style={{ borderLeft: '4px solid #ef4444', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance Alerts</span>
            <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>warning</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0 4px', color: '#ef4444' }}>
            {attendanceAlertsCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Low attendance direct notices</div>
        </div>

        <div className="portal-card" style={{ borderLeft: '4px solid #10b981', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Direct Notices</span>
            <span className="material-symbols-outlined" style={{ color: '#10b981' }}>description</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0 4px', color: 'var(--text-primary)' }}>
            {directNoticesCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Academic & test guidance</div>
        </div>

        <div className="portal-card" style={{ borderLeft: '4px solid #f59e0b', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student Tickets</span>
            <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>support_agent</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0 4px', color: pendingStudentGrievances > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
            {pendingStudentGrievances} <span style={{ fontSize: 14, fontWeight: 'normal', color: 'var(--text-secondary)' }}>Pending</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>From student support desk</div>
        </div>

        <div className="portal-card" style={{ borderLeft: '4px solid #8b5cf6', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faculty Grievances</span>
            <span className="material-symbols-outlined" style={{ color: '#8b5cf6' }}>engineering</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0 4px', color: pendingFacultyGrievances > 0 ? '#8b5cf6' : 'var(--text-primary)' }}>
            {pendingFacultyGrievances} <span style={{ fontSize: 14, fontWeight: 'normal', color: 'var(--text-secondary)' }}>Pending</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>From internal teachers</div>
        </div>
      </div>

      {/* Main Filter & Navigation Panel */}
      <div className="portal-card" style={{ padding: 20, marginBottom: 20 }}>
        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #eee', paddingBottom: 16, marginBottom: 16, overflowX: 'auto' }}>
          <button 
            className={`btn ${activeTab === 'all' ? 'btn-brand' : 'btn-ghost'}`}
            onClick={() => setActiveTab('all')}
            style={{ borderRadius: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>list_alt</span>
            All Communications ({communications.length + studentGrievances.length + facultyGrievances.length})
          </button>
          
          <button 
            className={`btn ${activeTab === 'attendance' ? 'btn-brand' : 'btn-ghost'}`}
            onClick={() => setActiveTab('attendance')}
            style={{ borderRadius: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', color: activeTab === 'attendance' ? '#fff' : '#ef4444' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
            Attendance Alerts ({attendanceAlertsCount})
          </button>

          <button 
            className={`btn ${activeTab === 'notices' ? 'btn-brand' : 'btn-ghost'}`}
            onClick={() => setActiveTab('notices')}
            style={{ borderRadius: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
            Direct Notices ({directNoticesCount})
          </button>

          <button 
            className={`btn ${activeTab === 'student_grievance' ? 'btn-brand' : 'btn-ghost'}`}
            onClick={() => setActiveTab('student_grievance')}
            style={{ borderRadius: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>support_agent</span>
            Student Grievances ({studentGrievances.length})
          </button>

          <button 
            className={`btn ${activeTab === 'faculty_grievance' ? 'btn-brand' : 'btn-ghost'}`}
            onClick={() => setActiveTab('faculty_grievance')}
            style={{ borderRadius: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>engineering</span>
            Faculty Grievances ({facultyGrievances.length})
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: 20 }}>search</span>
            <input 
              type="text"
              placeholder="Search by student, teacher, subject, message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="portal-input"
              style={{ paddingLeft: 40 }}
            />
          </div>

          {/* Batch Selector */}
          <div>
            <select 
              value={selectedBatch} 
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="portal-select"
            >
              <option value="all">🎓 All Batches</option>
              {allBatches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Time Range Filter */}
          <div>
            <select 
              value={timeFilter} 
              onChange={(e) => setTimeFilter(e.target.value)}
              className="portal-select"
            >
              <option value="all">📅 All Time</option>
              <option value="today">Today (Last 24 Hours)</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Communications Table */}
      <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, animation: 'spin 1.5s linear infinite' }}>progress_activity</span>
            <p style={{ marginTop: 12 }}>Loading communication logs...</p>
          </div>
        ) : combinedLogs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#cbd5e1' }}>inbox</span>
            <h3 style={{ margin: '12px 0 4px', color: 'var(--text-primary)' }}>No Communication Logs Found</h3>
            <p style={{ margin: 0, fontSize: 14 }}>Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="portal-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#475569', width: 140 }}>Date & Time</th>
                  <th style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#475569', width: 140 }}>Category</th>
                  <th style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#475569' }}>From</th>
                  <th style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#475569' }}>To / Batch</th>
                  <th style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#475569' }}>Subject & Snippet</th>
                  <th style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#475569', width: 100, textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#475569', width: 90, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {combinedLogs.map((log) => {
                  const isAttAlert = log.type === 'attendance_alert' || (log.subject && log.subject.toLowerCase().includes('attendance'));
                  const isStuGriev = log.sourceType === 'student_grievance';
                  const isFacGriev = log.sourceType === 'faculty_grievance';

                  const badgeBg = isAttAlert ? '#fee2e2' : isStuGriev ? '#fef3c7' : isFacGriev ? '#ede9fe' : '#e0f2fe';
                  const badgeColor = isAttAlert ? '#dc2626' : isStuGriev ? '#b45309' : isFacGriev ? '#6d28d9' : '#0369a1';
                  const badgeLabel = isAttAlert ? 'Attendance Alert' : isStuGriev ? 'Student Ticket' : isFacGriev ? 'Faculty Grievance' : 'Direct Notice';

                  return (
                    <tr 
                      key={log.id} 
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' }}
                      onClick={() => {
                        setSelectedItem(log);
                        setResolutionNote(log.resolutionNote || '');
                      }}
                      className="hover-row"
                    >
                      {/* Date */}
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatDate(log.parsedDate)}
                      </td>

                      {/* Category Tag */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ 
                          display: 'inline-block', 
                          padding: '4px 10px', 
                          borderRadius: 12, 
                          fontSize: 12, 
                          fontWeight: 600, 
                          background: badgeBg, 
                          color: badgeColor,
                          whiteSpace: 'nowrap'
                        }}>
                          {badgeLabel}
                        </span>
                      </td>

                      {/* From */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                          {log.teacherName || 'Faculty'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {log.teacherEmail || (isStuGriev ? 'Student Portal' : 'Faculty')}
                        </div>
                      </td>

                      {/* To / Batch */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                          {log.studentName || log.recipientName || 'Batch Students'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--brand-primary)', fontWeight: 500 }}>
                          🎓 {log.batch || 'General'}
                        </div>
                      </td>

                      {/* Subject & Preview */}
                      <td style={{ padding: '14px 16px', maxWidth: 380 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {log.subject || 'Direct Communication'}
                        </div>
                        <div style={{ 
                          fontSize: 13, 
                          color: '#64748b', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }}>
                          {log.message || log.request || 'No text preview.'}
                        </div>
                        {log.attendancePercent !== undefined && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '2px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 11, color: '#475569' }}>
                            <span>Recorded Attendance: <strong>{log.attendancePercent}%</strong></span>
                            <span>({log.attendedClasses || 0} / {log.totalClasses || 0} classes)</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {isStuGriev || isFacGriev ? (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 'bold',
                            background: (log.status || '').toLowerCase() === 'pending' ? '#fef3c7' : '#dcfce7',
                            color: (log.status || '').toLowerCase() === 'pending' ? '#b45309' : '#15803d'
                          }}>
                            {(log.status || 'Pending').toUpperCase()}
                          </span>
                        ) : (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 'bold',
                            background: log.readByStudent ? '#dcfce7' : '#f1f5f9',
                            color: log.readByStudent ? '#15803d' : '#64748b'
                          }}>
                            {log.readByStudent ? 'DELIVERED' : 'SENT'}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button 
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(log);
                            setResolutionNote(log.resolutionNote || '');
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details & Thread Modal */}
      {selectedItem && (
        <div className="fees-modal-overlay" style={{ zIndex: 1000 }}>
          <div className="fees-modal" style={{ maxWidth: 650, width: '90%', padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--brand-primary)' }}>
                  {selectedItem.type === 'attendance_alert' ? 'warning' : 'mark_chat_read'}
                </span>
                <h2 style={{ margin: 0, fontSize: 20 }}>Log Details</h2>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedItem(null)} style={{ padding: 6, borderRadius: '50%', display: 'flex' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Header Info Block */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12, display: 'block' }}>FROM (SENDER)</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedItem.teacherName || 'Faculty'}</strong>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedItem.teacherEmail || selectedItem.teacherRole || 'Faculty'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12, display: 'block' }}>TO (RECIPIENT)</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedItem.studentName || 'Student'}</strong>
                  <div style={{ fontSize: 12, color: 'var(--brand-primary)', fontWeight: 500 }}>Batch: {selectedItem.batch || 'N/A'}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px dashed #cbd5e1', fontSize: 13 }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12, display: 'block' }}>LOGGED DATE</span>
                  <span>{formatDate(selectedItem.parsedDate)}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12, display: 'block' }}>CATEGORY</span>
                  <span style={{ fontWeight: 600 }}>{selectedItem.type || selectedItem.category || 'General Notice'}</span>
                </div>
              </div>
            </div>

            {/* Attendance Snapshot Metrics (if present) */}
            {selectedItem.attendancePercent !== undefined && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>analytics</span>
                  Attendance Snapshot at Time of Notice
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <div>Attendance Rate: <strong>{selectedItem.attendancePercent}%</strong></div>
                  <div>Attended: <strong>{selectedItem.attendedClasses || 0}</strong></div>
                  <div>Absent: <strong style={{ color: '#dc2626' }}>{selectedItem.absentClasses || 0}</strong></div>
                  <div>Total Lectures: <strong>{selectedItem.totalClasses || 0}</strong></div>
                </div>
              </div>
            )}

            {/* Subject & Message Content */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Subject</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, background: '#f1f5f9', padding: '10px 14px', borderRadius: 6 }}>
                {selectedItem.subject || 'Direct Message'}
              </div>

              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Full Message Content</div>
              <div style={{ 
                fontSize: 14, 
                lineHeight: '1.6', 
                color: 'var(--text-primary)', 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                padding: 16, 
                borderRadius: 8,
                whiteSpace: 'pre-wrap'
              }}>
                {selectedItem.message || selectedItem.request || 'No content provided.'}
              </div>
            </div>

            {/* Service Manager Internal Notes / Status Action */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--brand-primary)' }}>rate_review</span>
                Service Manager Resolution & Notes
              </h4>
              <textarea 
                className="portal-input"
                rows="3"
                placeholder="Add internal resolution notes or follow-up actions..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {(selectedItem.sourceType === 'student_grievance' || selectedItem.sourceType === 'faculty_grievance') ? (
                  <>
                    <button 
                      className="btn btn-ghost btn-sm"
                      disabled={isUpdatingStatus}
                      onClick={() => handleUpdateGrievanceStatus(selectedItem, 'Pending')}
                    >
                      Mark as Pending
                    </button>
                    <button 
                      className="btn btn-brand btn-sm"
                      disabled={isUpdatingStatus}
                      onClick={() => handleUpdateGrievanceStatus(selectedItem, 'Resolved')}
                    >
                      Mark as Resolved
                    </button>
                  </>
                ) : (
                  <button 
                    className="btn btn-brand btn-sm"
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateGrievanceStatus(selectedItem, 'Reviewed')}
                  >
                    Save Review Note
                  </button>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setSelectedItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
