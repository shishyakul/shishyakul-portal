import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation, Link } from 'react-router-dom';
import PersonalAttendance from './shared/PersonalAttendance';
import PersonalSalary from './shared/PersonalSalary';
import './SystemAdminDashboard.css';

export default function SystemAdminDashboard({ profile }) {
  const location = useLocation();
  const activeTabHash = location.hash.replace('#', '');

  // Subtab State: 'recovery' (Installments), 'reconcile' (Today's Collections), 'funnel' (Admissions), 'absentee' (Truancy Calls)
  const [activeSubtab, setActiveSubtab] = useState('recovery');

  // Firestore Data
  const [students, setStudents] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  // Call Note Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedStudentForNote, setSelectedStudentForNote] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Realtime Subscriptions
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(docs);
      setLoading(false);
    }, (err) => {
      console.error("Fetch students error:", err);
      setLoading(false);
    });

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendanceLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubStudents();
      unsubAttendance();
    };
  }, []);

  // Time & Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Commercial & Admissions KPIs
  const metrics = useMemo(() => {
    let totalExpected = 0;
    let totalCollected = 0;
    const funnel = { enquiry: 0, demo: 0, admitted: 0, dropped: 0 };

    students.forEach(s => {
      const st = s.status || 'enquiry';
      if (funnel[st] !== undefined) funnel[st]++;

      if (st === 'admitted' && s.totalFees) {
        totalExpected += Number(s.totalFees);
        const instCount = Number(s.installments) || 1;
        const instAmount = s.totalFees / instCount;
        const paidCount = (s.paidInstallments || []).length;
        totalCollected += (instAmount * paidCount);
      }
    });

    totalExpected = Math.round(totalExpected);
    totalCollected = Math.round(totalCollected);
    const totalPending = Math.max(0, totalExpected - totalCollected);
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
    const conversionRate = (funnel.enquiry + funnel.demo + funnel.admitted) > 0
      ? Math.round((funnel.admitted / (funnel.enquiry + funnel.demo + funnel.admitted + funnel.dropped)) * 100)
      : 0;

    return { totalExpected, totalCollected, totalPending, collectionRate, conversionRate, funnel };
  }, [students]);

  // 2. Installment Recovery Calling Queue (Admitted students with pending installments)
  const installmentQueue = useMemo(() => {
    return students
      .filter(s => s.status === 'admitted' && s.totalFees && Number(s.installments) > 1)
      .map(s => {
        const total = Number(s.totalFees);
        const totalInst = Number(s.installments);
        const paidList = s.paidInstallments || [];
        const paidCount = paidList.length;
        const pendingCount = Math.max(0, totalInst - paidCount);
        const instAmount = Math.round(total / totalInst);
        const pendingAmount = Math.max(0, total - (instAmount * paidCount));
        const nextInstIndex = paidCount; // 0-indexed

        return {
          id: s.id,
          studentName: s.studentName || s.fullName || 'Student',
          batch: s.batch || 'Unassigned',
          contactNo: s.contactNo || s.phone || '',
          fatherContact: s.fatherContact || s.parentContact || '',
          totalFees: total,
          totalInst,
          paidCount,
          pendingCount,
          instAmount,
          pendingAmount,
          nextInstIndex,
          paymentDetails: s.paymentDetails || {},
          followupNotes: s.followupNotes || [],
          admissionDate: s.admissionDate || s.createdAt || ''
        };
      })
      .filter(item => item.pendingCount > 0)
      .sort((a, b) => b.pendingAmount - a.pendingAmount);
  }, [students]);

  // 3. Today's Collections Reconciliation (Cash vs UPI vs Cheque)
  const todayReconciliation = useMemo(() => {
    let cashTotal = 0;
    let upiTotal = 0;
    let chequeTotal = 0;
    let razorpayTotal = 0;
    const receipts = [];

    students.forEach(s => {
      const details = s.paymentDetails;
      if (!details || typeof details !== 'object') return;

      Object.entries(details).forEach(([instIdx, p]) => {
        if (!p || typeof p !== 'object') return;
        const paidDate = (p.paidAt || '').split('T')[0];
        const amt = Number(p.amount || 0);

        if (paidDate === todayStr) {
          const mode = (p.mode || 'Cash').toLowerCase();
          if (mode.includes('cash')) cashTotal += amt;
          else if (mode.includes('upi')) upiTotal += amt;
          else if (mode.includes('cheque') || mode.includes('check')) chequeTotal += amt;
          else razorpayTotal += amt;

          receipts.push({
            studentId: s.id,
            studentName: s.studentName || s.fullName || 'Student',
            batch: s.batch || 'Unassigned',
            amount: amt,
            mode: p.mode || 'Cash',
            instIndex: Number(instIdx) + 1,
            paidAt: p.paidAt,
            transactionId: p.transactionId || p.proofUrl || 'Manual Desk'
          });
        }
      });
    });

    const grandTotal = cashTotal + upiTotal + chequeTotal + razorpayTotal;
    return { cashTotal, upiTotal, chequeTotal, razorpayTotal, grandTotal, receipts };
  }, [students, todayStr]);

  // 4. Truancy / 2-Day Consecutive Absentees (for phone follow-up)
  const consecutiveAbsentees = useMemo(() => {
    const attendanceByBatch = {};
    attendanceLogs.forEach(log => {
      if (!attendanceByBatch[log.batch]) attendanceByBatch[log.batch] = [];
      attendanceByBatch[log.batch].push(log);
    });
    Object.keys(attendanceByBatch).forEach(b => {
      attendanceByBatch[b].sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    const absentees = [];
    students.filter(s => s.status === 'admitted').forEach(s => {
      const bLogs = attendanceByBatch[s.batch] || [];
      if (bLogs.length >= 2) {
        if (bLogs[0].absenteeIds?.includes(s.id) && bLogs[1].absenteeIds?.includes(s.id)) {
          absentees.push({
            id: s.id,
            fullName: s.studentName || s.fullName,
            batch: s.batch,
            phone: s.contactNo || s.fatherContact || s.phone || 'N/A',
            lastAbsentDate: bLogs[0].date
          });
        }
      }
    });
    return absentees;
  }, [attendanceLogs, students]);

  // Handle adding follow-up calling note
  const handleSaveFollowupNote = async () => {
    if (!selectedStudentForNote || !newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const studentRef = doc(db, 'students', selectedStudentForNote.id);
      const noteEntry = {
        text: newNoteText.trim(),
        caller: profile?.fullName || 'Vaishali Mam (Admin)',
        date: new Date().toISOString()
      };
      await updateDoc(studentRef, {
        followupNotes: arrayUnion(noteEntry),
        lastCallRemark: newNoteText.trim(),
        lastCallDate: todayStr
      });
      setShowNoteModal(false);
      setNewNoteText('');
      setSelectedStudentForNote(null);
    } catch (err) {
      alert("Error saving note: " + err.message);
    } finally {
      setSavingNote(false);
    }
  };

  // Filtered Recovery List
  const filteredQueue = useMemo(() => {
    return installmentQueue.filter(item => {
      const matchSearch = !searchQuery.trim() ||
        item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.contactNo.includes(searchQuery) ||
        item.fatherContact.includes(searchQuery);
      const matchBatch = batchFilter === 'all' || item.batch === batchFilter;
      return matchSearch && matchBatch;
    });
  }, [installmentQueue, searchQuery, batchFilter]);

  // Unique batches list for filter
  const uniqueBatches = useMemo(() => {
    const set = new Set(installmentQueue.map(i => i.batch).filter(Boolean));
    return Array.from(set);
  }, [installmentQueue]);

  // Route support for personal attendance/salary
  if (activeTabHash === 'personal_attendance') {
    return <PersonalAttendance profile={profile} />;
  }
  if (activeTabHash === 'personal_salary') {
    return <PersonalSalary profile={profile} />;
  }

  return (
    <div className="sad-container">
      {/* ── 1. Commercial Header Card ── */}
      <div className="sad-header-card">
        <div className="sad-header-left">
          <div className="sad-header-badge-row">
            <span className="sad-badge-live">
              <span className="sad-live-dot" /> Live Commercial Hub
            </span>
            <span className="sad-badge-role">System Admin • Vaishali Ma'am</span>
          </div>
          <h1 className="sad-header-title">
            {greeting}, <span style={{ color: '#d97706' }}>{profile?.fullName?.split(' ')[0] || 'Vaishali Mam'}</span> 👋
          </h1>
          <p className="sad-header-subtitle">
            Admissions, Fee Installments Recovery & Parent Communications Controller
          </p>
        </div>

        <div className="sad-header-actions">
          <Link to="/pending-admissions" className="sad-btn sad-btn-primary">
            <span className="material-symbols-outlined">assignment_ind</span>
            4-Step Admission
          </Link>
          <Link to="/fees" className="sad-btn sad-btn-emerald">
            <span className="material-symbols-outlined">payments</span>
            Fees Ledger
          </Link>
          <Link to="/admissions" className="sad-btn sad-btn-ghost">
            <span className="material-symbols-outlined">how_to_reg</span>
            Admissions CRM
          </Link>
        </div>
      </div>

      {/* ── 2. Primary Commercial KPIs (Apple Bento Grid) ── */}
      <div className="sad-kpi-grid">
        <div className="sad-kpi-card">
          <div className="sad-kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>payments</span>
          </div>
          <div className="sad-kpi-info">
            <span className="sad-kpi-label">Total Collected</span>
            <span className="sad-kpi-value" style={{ color: '#059669' }}>₹{metrics.totalCollected.toLocaleString()}</span>
            <span className="sad-kpi-sub">
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#10b981' }}>trending_up</span>
              {metrics.collectionRate}% recovery rate
            </span>
          </div>
        </div>

        <div className="sad-kpi-card">
          <div className="sad-kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>pending_actions</span>
          </div>
          <div className="sad-kpi-info">
            <span className="sad-kpi-label">Pending Dues</span>
            <span className="sad-kpi-value" style={{ color: '#d97706' }}>₹{metrics.totalPending.toLocaleString()}</span>
            <span className="sad-kpi-sub">Expected: ₹{metrics.totalExpected.toLocaleString()}</span>
          </div>
        </div>

        <div className="sad-kpi-card">
          <div className="sad-kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>phone_in_talk</span>
          </div>
          <div className="sad-kpi-info">
            <span className="sad-kpi-label">Installments Pending</span>
            <span className="sad-kpi-value">{installmentQueue.length}</span>
            <span className="sad-kpi-sub">Students awaiting reminder calls</span>
          </div>
        </div>

        <div className="sad-kpi-card">
          <div className="sad-kpi-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>school</span>
          </div>
          <div className="sad-kpi-info">
            <span className="sad-kpi-label">Admitted Students</span>
            <span className="sad-kpi-value">{metrics.funnel.admitted}</span>
            <span className="sad-kpi-sub">Pipeline Conv: {metrics.conversionRate}%</span>
          </div>
        </div>
      </div>

      {/* ── 3. Navigation Subtabs Bar ── */}
      <div className="sad-tabs-bar">
        <button
          className={`sad-tab-btn ${activeSubtab === 'recovery' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('recovery')}
        >
          <span className="material-symbols-outlined">call_log</span>
          Installment Calling Queue
          <span className="sad-tab-pill">{installmentQueue.length}</span>
        </button>

        <button
          className={`sad-tab-btn ${activeSubtab === 'reconcile' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('reconcile')}
        >
          <span className="material-symbols-outlined">receipt_long</span>
          Today's Collections Reconciliation
          <span className="sad-tab-pill">₹{todayReconciliation.grandTotal.toLocaleString()}</span>
        </button>

        <button
          className={`sad-tab-btn ${activeSubtab === 'funnel' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('funnel')}
        >
          <span className="material-symbols-outlined">filter_alt</span>
          Admissions Funnel
          <span className="sad-tab-pill">{metrics.funnel.demo} in Demo</span>
        </button>

        <button
          className={`sad-tab-btn ${activeSubtab === 'absentee' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('absentee')}
        >
          <span className="material-symbols-outlined">person_alert</span>
          2-Day Absentee Follow-ups
          <span className="sad-tab-pill" style={{ background: consecutiveAbsentees.length > 0 ? '#fee2e2' : undefined, color: consecutiveAbsentees.length > 0 ? '#dc2626' : undefined }}>
            {consecutiveAbsentees.length}
          </span>
        </button>
      </div>

      {/* ── 4. SUBTAB 1: Installment Recovery Calling Queue ── */}
      {activeSubtab === 'recovery' && (
        <div className="sad-card">
          <div className="sad-card-header">
            <div>
              <h2 className="sad-card-title">
                <span className="material-symbols-outlined" style={{ color: '#d97706' }}>pending_actions</span>
                Fee Installment Recovery & Reminder Desk
              </h2>
              <p className="sad-card-desc">
                Real-time queue of admitted students with pending installments. Call parents and log reminder remarks.
              </p>
            </div>
            <Link to="/fees" className="sad-btn sad-btn-ghost" style={{ fontSize: 12 }}>
              Open Master Fees Ledger →
            </Link>
          </div>

          <div className="sad-card-body">
            {/* Filter Bar */}
            <div className="sad-filter-bar">
              <input
                type="text"
                placeholder="Search student or phone number..."
                className="sad-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="sad-select"
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              >
                <option value="all">All Batches ({installmentQueue.length})</option>
                {uniqueBatches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="sad-empty-state"><div className="spinner" /></div>
            ) : filteredQueue.length === 0 ? (
              <div className="sad-empty-state">
                <span className="material-symbols-outlined sad-empty-icon">task_alt</span>
                <p>No students match your filter criteria or all installments are up to date!</p>
              </div>
            ) : (
              <div className="sad-table-wrapper">
                <table className="sad-table">
                  <thead>
                    <tr>
                      <th>Student & Batch</th>
                      <th>Installment Progress</th>
                      <th>Next Due Amount</th>
                      <th>Pending Balance</th>
                      <th>Parent Contacts</th>
                      <th>Last Note</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.map(item => {
                      const latestNote = item.followupNotes[item.followupNotes.length - 1];
                      const primaryPhone = item.contactNo || item.fatherContact;

                      return (
                        <tr key={item.id}>
                          <td>
                            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.studentName}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Batch: {item.batch}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="sad-badge sad-badge-emerald">
                                {item.paidCount} of {item.totalInst} Paid
                              </span>
                              <span className="sad-badge sad-badge-amber">
                                {item.pendingCount} Due
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              Next: Installment #{item.nextInstIndex + 1}
                            </div>
                          </td>
                          <td>
                            <strong style={{ fontSize: 14, color: '#d97706' }}>
                              ₹{item.instAmount.toLocaleString()}
                            </strong>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: '#b91c1c' }}>
                              ₹{item.pendingAmount.toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {item.fatherContact && (
                                <span style={{ fontSize: 12 }}>Father: {item.fatherContact}</span>
                              )}
                              {item.contactNo && item.contactNo !== item.fatherContact && (
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Student: {item.contactNo}</span>
                              )}
                              {!item.fatherContact && !item.contactNo && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No contact</span>
                              )}
                            </div>
                          </td>
                          <td style={{ maxWidth: 220 }}>
                            {latestNote ? (
                              <div style={{ fontSize: 11, background: '#f9fafb', padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                                <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>"{latestNote.text}"</span>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {new Date(latestNote.date).toLocaleDateString()} by {latestNote.caller?.split(' ')[0]}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No calls logged</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              {primaryPhone && (
                                <>
                                  <a href={`tel:${primaryPhone}`} className="sad-action-btn sad-action-call" title="Call Parent">
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>call</span>
                                    Call
                                  </a>
                                  <a
                                    href={`https://wa.me/91${primaryPhone.replace(/\D/g, '')}?text=Dear%20Parent%2C%20greeting%20from%20Shishyakul.%20This%20is%20a%20reminder%20regarding%20the%20installment%20payment%20of%20Rs.${item.instAmount}%20for%20${encodeURIComponent(item.studentName)}.%20Kindly%20clear%20at%20the%20earliest.`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="sad-action-btn sad-action-wa"
                                    title="Send WhatsApp Reminder"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>chat</span>
                                    WhatsApp
                                  </a>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedStudentForNote(item);
                                  setShowNoteModal(true);
                                }}
                                className="sad-action-btn"
                                style={{ background: '#f3f4f6', color: '#374151' }}
                                title="Add Call Remark"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit_note</span>
                                Note
                              </button>
                            </div>
                          </td>
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

      {/* ── 5. SUBTAB 2: Today's Collections & Reconciliation Ledger ── */}
      {activeSubtab === 'reconcile' && (
        <div className="sad-card">
          <div className="sad-card-header">
            <div>
              <h2 className="sad-card-title">
                <span className="material-symbols-outlined" style={{ color: '#059669' }}>receipt_long</span>
                Today's Collections Reconciliation ({todayStr})
              </h2>
              <p className="sad-card-desc">
                Cross-verify offline cash, UPI transfers, and cheques with your daily WhatsApp Finance group receipts.
              </p>
            </div>
            <Link to="/fees" className="sad-btn sad-btn-emerald" style={{ fontSize: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_card</span>
              Log Offline Payment
            </Link>
          </div>

          <div className="sad-card-body">
            {/* Reconciliation Breakdown Cards */}
            <div className="sad-reconcile-grid">
              <div className="sad-reconcile-card cash">
                <div className="sad-reconcile-title">
                  <span>Cash Payments</span>
                  <span className="material-symbols-outlined" style={{ color: '#16a34a' }}>payments</span>
                </div>
                <div className="sad-reconcile-amount" style={{ color: '#15803d' }}>
                  ₹{todayReconciliation.cashTotal.toLocaleString()}
                </div>
                <span className="sad-reconcile-count">Received at Admin Desk</span>
              </div>

              <div className="sad-reconcile-card upi">
                <div className="sad-reconcile-title">
                  <span>UPI / Bank Transfer</span>
                  <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>qr_code_scanner</span>
                </div>
                <div className="sad-reconcile-amount" style={{ color: '#1d4ed8' }}>
                  ₹{todayReconciliation.upiTotal.toLocaleString()}
                </div>
                <span className="sad-reconcile-count">Matched to Bank / QR</span>
              </div>

              <div className="sad-reconcile-card cheque">
                <div className="sad-reconcile-title">
                  <span>Cheque / Other</span>
                  <span className="material-symbols-outlined" style={{ color: '#9333ea' }}>account_balance</span>
                </div>
                <div className="sad-reconcile-amount" style={{ color: '#7e22ce' }}>
                  ₹{todayReconciliation.chequeTotal.toLocaleString()}
                </div>
                <span className="sad-reconcile-count">In clearing / deposits</span>
              </div>

              <div className="sad-reconcile-card" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                <div className="sad-reconcile-title">
                  <span>Today's Total Tally</span>
                  <span className="material-symbols-outlined" style={{ color: '#334155' }}>calculate</span>
                </div>
                <div className="sad-reconcile-amount" style={{ color: '#0f172a' }}>
                  ₹{todayReconciliation.grandTotal.toLocaleString()}
                </div>
                <span className="sad-reconcile-count">{todayReconciliation.receipts.length} transactions logged today</span>
              </div>
            </div>

            {/* Today's Transactions Log */}
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 10px 0' }}>
              Logged Receipts Today
            </h3>
            {todayReconciliation.receipts.length === 0 ? (
              <div className="sad-empty-state" style={{ padding: '30px 0' }}>
                <span className="material-symbols-outlined sad-empty-icon">point_of_sale</span>
                <p>No fee receipts recorded today yet ({todayStr}). New payments logged in Fees Ledger will appear here instantly.</p>
              </div>
            ) : (
              <div className="sad-table-wrapper">
                <table className="sad-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Student</th>
                      <th>Batch</th>
                      <th>Installment</th>
                      <th>Mode</th>
                      <th>Amount</th>
                      <th>Proof / Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayReconciliation.receipts.map((rec, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {rec.paidAt ? new Date(rec.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                        </td>
                        <td><strong>{rec.studentName}</strong></td>
                        <td><span className="sad-badge sad-badge-blue">{rec.batch}</span></td>
                        <td>Installment #{rec.instIndex}</td>
                        <td>
                          <span className={`sad-badge ${rec.mode?.toLowerCase().includes('cash') ? 'sad-badge-emerald' : 'sad-badge-blue'}`}>
                            {rec.mode}
                          </span>
                        </td>
                        <td><strong style={{ color: '#059669', fontSize: 14 }}>₹{rec.amount.toLocaleString()}</strong></td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rec.transactionId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 6. SUBTAB 3: Admissions Funnel ── */}
      {activeSubtab === 'funnel' && (
        <div className="sad-card">
          <div className="sad-card-header">
            <div>
              <h2 className="sad-card-title">
                <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>filter_alt</span>
                Admissions & Demo Conversion Journey
              </h2>
              <p className="sad-card-desc">
                From Enquiry Kiosk to 3-day Trial Demo and Final Admission Form Completion.
              </p>
            </div>
            <Link to="/pending-admissions" className="sad-btn sad-btn-primary" style={{ fontSize: 12 }}>
              Process Pending Admissions Form →
            </Link>
          </div>

          <div className="sad-card-body">
            {/* Visual Funnel Bar */}
            <div className="sad-funnel-bar-container">
              <div
                className="sad-funnel-segment"
                style={{
                  width: `${(metrics.funnel.enquiry / Math.max(1, students.length)) * 100}%`,
                  background: '#60a5fa'
                }}
                title={`Enquiries: ${metrics.funnel.enquiry}`}
              />
              <div
                className="sad-funnel-segment"
                style={{
                  width: `${(metrics.funnel.demo / Math.max(1, students.length)) * 100}%`,
                  background: '#a855f7'
                }}
                title={`Taking Demo: ${metrics.funnel.demo}`}
              />
              <div
                className="sad-funnel-segment"
                style={{
                  width: `${(metrics.funnel.admitted / Math.max(1, students.length)) * 100}%`,
                  background: '#10b981'
                }}
                title={`Admitted: ${metrics.funnel.admitted}`}
              />
              <div
                className="sad-funnel-segment"
                style={{
                  width: `${(metrics.funnel.dropped / Math.max(1, students.length)) * 100}%`,
                  background: '#f87171'
                }}
                title={`Dropped: ${metrics.funnel.dropped}`}
              />
            </div>

            <div className="sad-funnel-legend">
              <div className="sad-funnel-legend-item">
                <span className="sad-funnel-color-box" style={{ background: '#60a5fa' }} />
                <span>Walk-in Enquiries ({metrics.funnel.enquiry})</span>
              </div>
              <div className="sad-funnel-legend-item">
                <span className="sad-funnel-color-box" style={{ background: '#a855f7' }} />
                <span>Taking Demo ({metrics.funnel.demo})</span>
              </div>
              <div className="sad-funnel-legend-item">
                <span className="sad-funnel-color-box" style={{ background: '#10b981' }} />
                <span>Admitted / Enrolled ({metrics.funnel.admitted})</span>
              </div>
              <div className="sad-funnel-legend-item">
                <span className="sad-funnel-color-box" style={{ background: '#f87171' }} />
                <span>Dropped / Left ({metrics.funnel.dropped})</span>
              </div>
            </div>

            {/* Students Currently in Demo Stage */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                Students in 3-Day Demo Phase ({metrics.funnel.demo})
              </h3>
              {students.filter(s => s.status === 'demo').length === 0 ? (
                <div className="sad-empty-state" style={{ padding: '20px 0' }}>
                  <p>No students currently in demo. Walk-in enquiries can be moved to Demo via Admissions CRM.</p>
                </div>
              ) : (
                <div className="sad-table-wrapper">
                  <table className="sad-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Class & Board</th>
                        <th>Parent Contact</th>
                        <th>Demo Days Progress</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.filter(s => s.status === 'demo').slice(0, 8).map(s => {
                        const sched = s.demoSchedule || {};
                        return (
                          <tr key={s.id}>
                            <td><strong>{s.studentName || s.fullName}</strong></td>
                            <td>{s.standard} • {s.board}</td>
                            <td>{s.contactNo || s.fatherContact || 'N/A'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <span className={`sad-badge ${sched.day1?.attendance === 'present' ? 'sad-badge-emerald' : 'sad-badge-amber'}`}>
                                  Day 1
                                </span>
                                <span className={`sad-badge ${sched.day2?.attendance === 'present' ? 'sad-badge-emerald' : 'sad-badge-amber'}`}>
                                  Day 2
                                </span>
                                <span className={`sad-badge ${sched.day3?.attendance === 'present' ? 'sad-badge-emerald' : 'sad-badge-amber'}`}>
                                  Day 3
                                </span>
                              </div>
                            </td>
                            <td>
                              <Link to="/pending-admissions" className="sad-action-btn sad-action-wa">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>assignment</span>
                                Admit Student
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. SUBTAB 4: 2-Day Absentee Follow-ups ── */}
      {activeSubtab === 'absentee' && (
        <div className="sad-card">
          <div className="sad-card-header">
            <div>
              <h2 className="sad-card-title">
                <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>person_alert</span>
                2-Day Consecutive Absentee Calling Register
              </h2>
              <p className="sad-card-desc">
                High-priority truancy follow-up: Students absent for 2 consecutive sessions requiring parent check-in call.
              </p>
            </div>
          </div>

          <div className="sad-card-body">
            {consecutiveAbsentees.length === 0 ? (
              <div className="sad-empty-state" style={{ padding: '30px 0' }}>
                <span className="material-symbols-outlined sad-empty-icon" style={{ color: '#10b981' }}>check_circle</span>
                <p style={{ color: '#059669', fontWeight: 600 }}>Zero 2-day consecutive absentees! Daily student attendance is healthy.</p>
              </div>
            ) : (
              <div className="sad-table-wrapper">
                <table className="sad-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Batch</th>
                      <th>Absent Since</th>
                      <th>Phone Number</th>
                      <th style={{ textAlign: 'right' }}>Follow-up Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consecutiveAbsentees.map(s => (
                      <tr key={s.id}>
                        <td><strong style={{ color: '#dc2626' }}>{s.fullName}</strong></td>
                        <td><span className="sad-badge sad-badge-amber">{s.batch}</span></td>
                        <td>{s.lastAbsentDate}</td>
                        <td>{s.phone}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {s.phone !== 'N/A' && (
                              <a href={`tel:${s.phone}`} className="sad-action-btn sad-action-call">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>call</span>
                                Call Parent
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setSelectedStudentForNote({ id: s.id, studentName: s.fullName });
                                setShowNoteModal(true);
                              }}
                              className="sad-action-btn"
                              style={{ background: '#f3f4f6', color: '#374151' }}
                            >
                              Log Reason
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 8. Call Remark / Note Modal ── */}
      {showNoteModal && (
        <div className="sad-modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="sad-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sad-modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Log Fee / Attendance Follow-up Note
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>
            <div className="sad-modal-body">
              <div>
                <strong>Student:</strong> {selectedStudentForNote?.studentName}
              </div>
              <textarea
                rows={4}
                placeholder="Enter remarks (e.g., 'Spoke with father, promised to transfer next installment of ₹7000 by Friday via UPI')..."
                value={newNoteText}
                onChange={e => setNewNoteText(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div className="sad-modal-footer">
              <button
                className="sad-btn sad-btn-ghost"
                onClick={() => setShowNoteModal(false)}
                disabled={savingNote}
              >
                Cancel
              </button>
              <button
                className="sad-btn sad-btn-primary"
                onClick={handleSaveFollowupNote}
                disabled={savingNote || !newNoteText.trim()}
              >
                {savingNote ? 'Saving...' : 'Save Follow-up Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
