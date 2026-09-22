import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import PersonalAttendance from './shared/PersonalAttendance';
import PersonalSalary from './shared/PersonalSalary';
import './FrontendDeskDashboard.css';

export default function FrontendDeskDashboard({ profile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.hash.replace('#', '');

  const [loading, setLoading] = useState(true);
  const [demos, setDemos] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0 });
  const [inventoryLog, setInventoryLog] = useState([]);
  
  // Real-time Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Search / Fast Lookup State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 1. Listen for all students (for fast walk-in lookup and complete pipeline)
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllStudents(list);

      // Completed Demos needing follow-up
      const completedDemos = list.filter(s => s.status === 'demo' && s.demoCompletionStatus === 'completed');
      setDemos(completedDemos);

      // Enquiries in pipeline
      const enqList = list.filter(s => s.status === 'enquiry' || !s.status);
      setEnquiries(enqList);
    });

    // 2. Listen for today's attendance logs
    const todayStr = new Date().toISOString().split('T')[0];
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      let pres = 0;
      let abs = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.date === todayStr) {
          abs += (data.absentCount || 0);
          pres += ((data.totalStudents || 0) - (data.absentCount || 0));
        }
      });
      setAttendanceStats({ present: pres, absent: abs });
    });

    // 3. Listen for Inventory checkouts
    const unsubInventory = onSnapshot(collection(db, 'asset_assignments'), (snap) => {
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setInventoryLog(items.slice(0, 6));
      setLoading(false);
    });

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubInventory();
    };
  }, []);

  const totalAttendance = attendanceStats.present + attendanceStats.absent;
  const attendancePercent = totalAttendance === 0 ? 0 : Math.round((attendanceStats.present / totalAttendance) * 100);

  // 7-Day Funnel Calculations
  const recentEnquiries = enquiries.filter(e => {
    if (!e.createdAt) return false;
    const date = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
    return (new Date() - date) < 7 * 24 * 60 * 60 * 1000;
  });

  const admittedStudents = allStudents.filter(s => s.status === 'admitted');
  const activeDemos = allStudents.filter(s => s.status === 'demo');
  const totalPipeline = allStudents.length || 1;

  // Search Results
  const searchResults = searchQuery.trim() === '' ? [] : allStudents.filter(s => {
    const q = searchQuery.toLowerCase();
    const name = (s.studentName || s.fullName || '').toLowerCase();
    const phone = (s.contactNo || s.phone || s.parentContact || '').toLowerCase();
    const parent = (s.parentName || s.fatherName || '').toLowerCase();
    const batch = (s.batch || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || parent.includes(q) || batch.includes(q);
  }).slice(0, 8);

  // Formatted date string
  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  if (activeTab === 'personal_attendance') {
    return <PersonalAttendance profile={profile} />;
  }
  if (activeTab === 'personal_salary') {
    return <PersonalSalary profile={profile} />;
  }

  return (
    <div className="fd-container">
      {/* ── Reception Header Card ── */}
      <div className="fd-header-card">
        <div className="fd-header-left">
          <div className="fd-header-badge-row">
            <span className="fd-badge-live">
              <span className="fd-live-dot"></span>
              Front Desk Active
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              • Shishyakul Reception Desk
            </span>
          </div>
          <h1 className="fd-header-title">
            Welcome, <span className="gradient-text">{profile?.fullName?.split(' ')[0] ?? 'Shruti Maam'}</span> 👋
          </h1>
          <p className="fd-header-subtitle">
            Walk-in enquiries, demo conversions, student attendance, and kit disbursements.
          </p>
        </div>

        <div className="fd-header-meta">
          <div className="fd-time-chip">
            <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)', fontSize: 20 }}>
              schedule
            </span>
            <span className="fd-time-clock">{formattedTime}</span>
            <span className="fd-date-text">{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* ── Quick Lookup Bar (Instant Walk-in Student / Parent Search) ── */}
      <div className="fd-search-box">
        <span className="material-symbols-outlined fd-search-icon">search</span>
        <input
          type="text"
          className="fd-search-input"
          placeholder="Quick Walk-in Lookup: Search by Student Name, Parent Name, Phone, or Batch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
        />
        {searchQuery && (
          <button 
            className="fd-search-clear" 
            onClick={() => setSearchQuery('')}
            title="Clear search"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        )}

        {/* Dropdown search results */}
        {isSearchFocused && searchResults.length > 0 && (
          <div className="fd-search-results">
            <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Found {searchResults.length} Match{searchResults.length > 1 ? 'es' : ''}
            </div>
            {searchResults.map((st) => (
              <div 
                key={st.id} 
                className="fd-search-item"
                onClick={() => {
                  if (st.status === 'demo') navigate('/pending-admissions');
                  else if (st.status === 'enquiry') navigate('/enquiries');
                  else navigate('/students');
                }}
              >
                <div className="fd-search-item-info">
                  <div className="fd-search-item-name">
                    {st.studentName || st.fullName || 'Unnamed'}
                    {st.standard && <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: 6 }}>({st.standard} {st.board || ''})</span>}
                  </div>
                  <div className="fd-search-item-sub">
                    📞 {st.contactNo || st.phone || st.parentContact || 'No phone'} 
                    {st.batch ? ` • Batch: ${st.batch}` : ''}
                    {st.parentName ? ` • Parent: ${st.parentName}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${
                    st.status === 'admitted' ? 'badge-success' :
                    st.status === 'demo' ? 'badge-branch-manager' : 'badge-admin'
                  }`} style={{ fontSize: 11, textTransform: 'capitalize' }}>
                    {st.status || 'Enquiry'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                    chevron_right
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bento-Grid Action Launchers ── */}
      <div className="fd-bento-grid">
        {/* 1. New Walk-in Enquiry */}
        <div 
          className="fd-action-tile fd-tile-gold"
          onClick={() => navigate('/enquiries')}
        >
          <div className="fd-tile-top">
            <div className="fd-tile-icon-box" style={{ background: 'rgba(253, 180, 42, 0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary-dark)', fontSize: 24 }}>
                person_add
              </span>
            </div>
            <span className="fd-tile-badge" style={{ background: 'rgba(253, 180, 42, 0.15)', color: 'var(--brand-primary-dark)' }}>
              Walk-in Form
            </span>
          </div>
          <div>
            <h3 className="fd-tile-title">New Enquiry</h3>
            <p className="fd-tile-desc">Register parent & student walk-in with signature kiosk</p>
          </div>
        </div>

        {/* 2. Process Admissions */}
        <div 
          className="fd-action-tile fd-tile-emerald"
          onClick={() => navigate('/pending-admissions')}
        >
          <div className="fd-tile-top">
            <div className="fd-tile-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 24 }}>
                how_to_reg
              </span>
            </div>
            <span className="fd-tile-badge" style={{ 
              background: demos.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
              color: demos.length > 0 ? '#ef4444' : '#10b981' 
            }}>
              {demos.length > 0 ? `${demos.length} Pending` : 'Up to Date'}
            </span>
          </div>
          <div>
            <h3 className="fd-tile-title">Process Admissions</h3>
            <p className="fd-tile-desc">Convert attended demo students into admitted batches</p>
          </div>
        </div>

        {/* 3. Daily Attendance */}
        <div 
          className="fd-action-tile fd-tile-indigo"
          onClick={() => navigate('/attendance')}
        >
          <div className="fd-tile-top">
            <div className="fd-tile-icon-box" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: '#6366f1', fontSize: 24 }}>
                fact_check
              </span>
            </div>
            <span className="fd-tile-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
              Today's Sheet
            </span>
          </div>
          <div>
            <h3 className="fd-tile-title">Daily Attendance</h3>
            <p className="fd-tile-desc">Verify student classroom presence & log absentees</p>
          </div>
        </div>

        {/* 4. Asset Ledger */}
        <div 
          className="fd-action-tile fd-tile-rose"
          onClick={() => navigate('/inventory')}
        >
          <div className="fd-tile-top">
            <div className="fd-tile-icon-box" style={{ background: 'rgba(244, 63, 94, 0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: '#f43f5e', fontSize: 24 }}>
                inventory_2
              </span>
            </div>
            <span className="fd-tile-badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
              Study Kits & Gear
            </span>
          </div>
          <div>
            <h3 className="fd-tile-title">Asset Ledger</h3>
            <p className="fd-tile-desc">Hand over uniforms, bags, books and track checkouts</p>
          </div>
        </div>
      </div>

      {/* ── Main Cockpit Content Grid ── */}
      <div className="fd-main-grid">
        
        {/* Left Column: Follow-up Queue & Attendance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Action Required: Completed Demos Follow-up Queue */}
          <div className="fd-card fd-followup-card">
            <div className="fd-card-header">
              <div className="fd-card-title-group">
                <span className="material-symbols-outlined" style={{ color: 'var(--status-error)', fontSize: 22 }}>
                  contact_phone
                </span>
                <h2 className="fd-card-title">Priority Follow-up & Conversion Queue</h2>
              </div>
              {demos.length > 0 && (
                <span className="badge badge-error" style={{ fontSize: 11 }}>
                  {demos.length} Awaiting Calls
                </span>
              )}
            </div>

            <div className="fd-summary-stats">
              <div className="fd-stat-mini">
                <span className="fd-stat-mini-num" style={{ color: demos.length > 0 ? '#ef4444' : '#10b981' }}>
                  {demos.length}
                </span>
                <span className="fd-stat-mini-label">Completed Demos to Call Today</span>
              </div>
              <div className="fd-stat-mini">
                <span className="fd-stat-mini-num" style={{ color: 'var(--brand-primary-dark)' }}>
                  {enquiries.length}
                </span>
                <span className="fd-stat-mini-label">Active Enquiries in Pipeline</span>
              </div>
            </div>

            {demos.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0', border: '1px dashed var(--surface-border)', borderRadius: 'var(--radius-md)' }}>
                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 36 }}>
                  check_circle
                </span>
                <p style={{ margin: '8px 0 2px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                  All Completed Demos Have Been Contacted!
                </p>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  No pending follow-up calls in the queue right now.
                </span>
              </div>
            ) : (
              <div className="fd-followup-list">
                {demos.map((d) => {
                  const phoneNum = d.contactNo || d.phone || d.parentContact || '';
                  const cleanPhone = phoneNum.replace(/[^0-9]/g, '');

                  return (
                    <div key={d.id} className="fd-followup-item">
                      <div className="fd-followup-info">
                        <div className="fd-followup-name">
                          {d.studentName || d.fullName || 'Student'}
                          <span className="badge badge-branch-manager" style={{ fontSize: 10, padding: '2px 6px' }}>
                            {d.standard || '10th'} {d.board || ''}
                          </span>
                        </div>
                        <div className="fd-followup-sub">
                          <span>📞 {phoneNum || 'No contact'}</span>
                          {d.parentName && <span> • Parent: {d.parentName}</span>}
                          {d.demoSubject && <span> • Demo: {d.demoSubject}</span>}
                        </div>
                      </div>

                      <div className="fd-followup-actions">
                        {cleanPhone && (
                          <>
                            <a 
                              href={`tel:${cleanPhone}`} 
                              className="fd-btn-action" 
                              title="Call Student / Parent"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#2563eb' }}>call</span>
                            </a>
                            <a 
                              href={`https://wa.me/91${cleanPhone.slice(-10)}?text=Hello%20${encodeURIComponent(d.studentName || 'Student')},%20greetings%20from%20Shishyakul!%20How%20was%20your%20demo%20session?`}
                              target="_blank"
                              rel="noreferrer"
                              className="fd-btn-action" 
                              title="Message on WhatsApp"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>chat</span>
                            </a>
                          </>
                        )}
                        <button 
                          className="fd-btn-convert"
                          onClick={() => navigate('/pending-admissions')}
                          title="Convert to Confirmed Admission"
                        >
                          <span>Convert</span>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Attendance Snapshot Card */}
          <div className="fd-card">
            <div className="fd-card-header">
              <div className="fd-card-title-group">
                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 22 }}>
                  how_to_reg
                </span>
                <h2 className="fd-card-title">Today's Attendance Status</h2>
              </div>
              <a 
                href="/attendance" 
                style={{ fontSize: 12, color: 'var(--brand-primary-dark)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span>View Roster</span>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
              </a>
            </div>

            <div className="fd-attendance-wrap">
              {/* SVG Ring Gauge */}
              <div className="fd-gauge-box">
                <svg width="130" height="130" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="var(--surface-border)"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="#10b981"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - attendancePercent / 100)}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="fd-gauge-center">
                  <span className="fd-gauge-val">{attendancePercent}%</span>
                  <span className="fd-gauge-lbl">Present</span>
                </div>
              </div>

              {/* Metric Breakdown Rows */}
              <div className="fd-att-metrics">
                <div className="fd-att-metric-row">
                  <div className="fd-att-metric-title">
                    <span className="fd-att-metric-dot" style={{ background: '#10b981' }}></span>
                    <span>Students Present</span>
                  </div>
                  <span className="fd-att-metric-val" style={{ color: '#10b981' }}>
                    {attendanceStats.present}
                  </span>
                </div>

                <div className="fd-att-metric-row">
                  <div className="fd-att-metric-title">
                    <span className="fd-att-metric-dot" style={{ background: '#ef4444' }}></span>
                    <span>Students Absent</span>
                  </div>
                  <span className="fd-att-metric-val" style={{ color: '#ef4444' }}>
                    {attendanceStats.absent}
                  </span>
                </div>

                <div className="fd-att-metric-row">
                  <div className="fd-att-metric-title">
                    <span className="fd-att-metric-dot" style={{ background: 'var(--brand-primary)' }}></span>
                    <span>Total Marked</span>
                  </div>
                  <span className="fd-att-metric-val" style={{ color: 'var(--text-primary)' }}>
                    {totalAttendance}
                  </span>
                </div>
              </div>
            </div>

            {totalAttendance === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                * Daily attendance has not been recorded by teachers yet today.
              </p>
            )}
          </div>

        </div>

        {/* Right Column: Funnel & Asset Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Walk-in Funnel & Conversion Rhythm */}
          <div className="fd-card">
            <div className="fd-card-header">
              <div className="fd-card-title-group">
                <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)', fontSize: 22 }}>
                  trending_up
                </span>
                <h2 className="fd-card-title">Walk-in Conversion Rhythm</h2>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '12px 0 20px 0', borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 800, color: 'var(--brand-primary-dark)', lineHeight: 1 }}>
                {recentEnquiries.length}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                New Walk-in Enquiries
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Registered in the last 7 days
              </div>
            </div>

            {/* Visual Funnel Stage Bars */}
            <div className="fd-funnel-stages">
              {/* Enquiries Stage */}
              <div className="fd-stage-bar-wrap">
                <div className="fd-stage-label-row">
                  <span className="fd-stage-name">1. Total Inquiries</span>
                  <span className="fd-stage-count">{enquiries.length}</span>
                </div>
                <div className="fd-bar-track">
                  <div 
                    className="fd-bar-fill" 
                    style={{ width: `${Math.min(100, Math.round((enquiries.length / totalPipeline) * 100))}%`, background: '#60a5fa' }}
                  />
                </div>
              </div>

              {/* Demo Stage */}
              <div className="fd-stage-bar-wrap">
                <div className="fd-stage-label-row">
                  <span className="fd-stage-name">2. In Demo / Attended</span>
                  <span className="fd-stage-count">{activeDemos.length}</span>
                </div>
                <div className="fd-bar-track">
                  <div 
                    className="fd-bar-fill" 
                    style={{ width: `${Math.min(100, Math.round((activeDemos.length / totalPipeline) * 100))}%`, background: '#a855f7' }}
                  />
                </div>
              </div>

              {/* Admitted Stage */}
              <div className="fd-stage-bar-wrap">
                <div className="fd-stage-label-row">
                  <span className="fd-stage-name">3. Admitted Students</span>
                  <span className="fd-stage-count">{admittedStudents.length}</span>
                </div>
                <div className="fd-bar-track">
                  <div 
                    className="fd-bar-fill" 
                    style={{ width: `${Math.min(100, Math.round((admittedStudents.length / totalPipeline) * 100))}%`, background: '#10b981' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--surface-border)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Overall Branch Conversion:</span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>
                {Math.round((admittedStudents.length / totalPipeline) * 100)}%
              </span>
            </div>
          </div>

          {/* Recently Checked Out Assets */}
          <div className="fd-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', background: 'var(--surface-bg)', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="fd-card-title-group">
                <span className="material-symbols-outlined" style={{ color: '#f43f5e', fontSize: 20 }}>
                  inventory_2
                </span>
                <h2 className="fd-card-title" style={{ fontSize: 16 }}>Recent Asset Checkouts</h2>
              </div>
              <a 
                href="/inventory" 
                style={{ fontSize: 12, color: 'var(--brand-primary-dark)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}
              >
                <span>Ledger</span>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              </a>
            </div>

            <div style={{ padding: '12px 20px' }}>
              {inventoryLog.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: 28 }}>
                    package_2
                  </span>
                  <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    No recent asset disbursements.
                  </p>
                </div>
              ) : (
                <table className="fd-asset-table">
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Item Disbursed</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryLog.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.recipientName || 'Walk-in'}
                          </div>
                          <span className="badge badge-branch-manager" style={{ fontSize: 10, padding: '1px 5px' }}>
                            {item.recipientType || 'Student'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                              {item.type === 'book' ? 'menu_book' : item.type === 'uniform' ? 'apparel' : 'devices'}
                            </span>
                            <span style={{ fontWeight: 500 }}>{item.itemName}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.quantity || 1}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
