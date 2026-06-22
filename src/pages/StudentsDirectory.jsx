import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import './StudentsDirectory.css';
import PrintableAdmissionForm from '../components/PrintableAdmissionForm';
import TabProfile from '../components/StudentPortfolio/TabProfile';
import TabAttendance from '../components/StudentPortfolio/TabAttendance';
import TabPerformance from '../components/StudentPortfolio/TabPerformance';
import TabFees from '../components/StudentPortfolio/TabFees';
import TabAssets from '../components/StudentPortfolio/TabAssets';

export default function StudentsDirectory() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [batchFilter, setBatchFilter] = useState('All Batches');
  const [activeTab, setActiveTab] = useState('profile');
  const [leftWidth, setLeftWidth] = useState(350);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleMove = (clientX) => {
      if (!isDragging) return;
      // 80px is the approx width of the main portal sidebar on the left
      let newWidth = clientX - 80; 
      if (newWidth < 250) newWidth = 250;
      if (newWidth > 900) newWidth = 900;
      setLeftWidth(newWidth);
    };

    const handleMouseMove = (e) => handleMove(e.clientX);
    const handleTouchMove = (e) => {
      e.preventDefault(); // Prevent iPad from scrolling/swiping while dragging
      handleMove(e.touches[0].clientX);
    };
    
    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  useEffect(() => {
    const q = query(collection(db, 'students'), where('status', '==', 'admitted'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(docs);
      if (!selectedStudent && docs.length > 0) {
        setSelectedStudent(docs[0]);
      } else if (selectedStudent) {
        const updated = docs.find(s => s.id === selectedStudent.id);
        if (updated) setSelectedStudent(updated);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const batches = ['All Batches', ...Array.from(new Set(students.map(s => s.batch).filter(Boolean))).sort()];
  
  const filteredStudents = students.filter(s => {
    if (batchFilter === 'All Batches') return true;
    return s.batch === batchFilter;
  });

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="students-directory-container">
        <div style={{ padding: 48 }}>Loading directory...</div>
      </div>
    );
  }

  return (
    <div className="students-directory-container">
      
      {/* LEFT PANE: List */}
      <div className="sd-left-pane" style={{ flex: `0 0 ${leftWidth}px` }}>
        <div className="sd-sidebar-header">
          <h2 className="sd-sidebar-title">
            <span className="material-symbols-outlined">group</span>
            Students Database
          </h2>
          <select 
            className="sd-batch-filter"
            value={batchFilter} 
            onChange={(e) => setBatchFilter(e.target.value)}
          >
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="sd-student-list">
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
              No students found in this batch.
            </div>
          ) : (
            filteredStudents.map(student => (
              <div 
                key={student.id} 
                className={`sd-student-card ${selectedStudent?.id === student.id ? 'active' : ''}`}
                onClick={() => setSelectedStudent(student)}
              >
                {student.photoDataUrl ? (
                  <img src={student.photoDataUrl} className="sd-student-photo" alt={student.studentName} />
                ) : (
                  <div className="sd-student-photo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: selectedStudent?.id === student.id ? '#fff' : '#cbd5e1' }}>person</span>
                  </div>
                )}
                <div className="sd-student-info">
                  <h3 className="sd-student-name">{student.studentName}</h3>
                  <div className="sd-student-batch">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>school</span>
                    {student.batch || 'Unassigned'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DRAGGABLE RESIZER */}
      <div 
        className={`sd-resizer ${isDragging ? 'active' : ''}`}
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
      />

      {/* RIGHT PANE: Detail */}
      <div className="sd-right-pane">
        {!selectedStudent ? (
          <div className="sd-empty-state" style={{ height: '100%', display: 'flex', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#cbd5e1' }}>person_search</span>
            <div>Select a student to view their profile</div>
          </div>
        ) : (
          <>
            <div className="sd-profile-header-wrapper">
              <div className="sd-profile-header">
                <div className="sd-profile-identity">
                  {selectedStudent.photoDataUrl ? (
                    <img src={selectedStudent.photoDataUrl} className="sd-profile-photo-large" alt={selectedStudent.studentName} />
                  ) : (
                    <div className="sd-profile-photo-large" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#cbd5e1' }}>person</span>
                    </div>
                  )}
                  <div className="sd-profile-title">
                    <h1>{selectedStudent.studentName}</h1>
                    <div className="sd-profile-badges">
                      {selectedStudent.batch ? (
                        <div className="sd-badge sd-badge-batch">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>school</span>
                          {selectedStudent.batch}
                        </div>
                      ) : (
                        <div className="sd-badge" style={{ background: 'var(--status-error)', color: '#fff', cursor: 'pointer' }} onClick={() => navigate('/batches')}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                          Unassigned Batch (Assign Now)
                        </div>
                      )}
                      <div className="sd-badge sd-badge-status">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span>
                        Admitted
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sd-header-actions" id="sd-profile-actions-portal">
                  <button className="sd-print-btn" onClick={handlePrint}>
                    <span className="material-symbols-outlined">print</span>
                    Print Form
                  </button>
                  {/* Edit profile buttons will be injected here via React Portal */}
                </div>
              </div>

              {/* TAB NAVIGATION */}
              <div className="sd-tabs-nav">
                <button className={`sd-tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person</span> Profile Details
                </button>
                <button className={`sd-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>event_available</span> Daily Attendance Log
                </button>
                <button className={`sd-tab-btn ${activeTab === 'performance' ? 'active' : ''}`} onClick={() => setActiveTab('performance')}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>psychology</span> Score & Achievements
                </button>
                <button className={`sd-tab-btn ${activeTab === 'fees' ? 'active' : ''}`} onClick={() => setActiveTab('fees')}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span> Fees Ledger
                </button>
                <button className={`sd-tab-btn ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>inventory_2</span> Assets & Comm.
                </button>
              </div>
            </div>

            {/* RIGHT PANE CONTENT */}
            <div className="sd-tab-content-area" style={{ background: '#f8fafc', overflowY: 'auto' }}>
              {activeTab === 'profile' && <TabProfile student={selectedStudent} />}
              {activeTab === 'attendance' && <TabAttendance student={selectedStudent} />}
              {activeTab === 'performance' && <TabPerformance student={selectedStudent} />}
              {activeTab === 'fees' && <TabFees student={selectedStudent} />}
              {activeTab === 'assets' && <TabAssets student={selectedStudent} />}
            </div>
          </>
        )}
      </div>

      {/* Hidden Print Layout */}
      <PrintableAdmissionForm student={selectedStudent} />
    </div>
  );
}
