import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, updateDoc, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BATCH_DEF } from './Batches';
import './Faculty.css';
import DayRangeDialer from '../components/DayRangeDialer';

const DEFAULT_SYLLABUS = [
  { batch: '10th Alpha', subject: 'Mathematics', teacher: 'Brijesh Prajapati', progress: 45, lastChapter: 'Quadratic Equations' },
  { batch: '10th Alpha', subject: 'Science', teacher: 'Sneha More', progress: 60, lastChapter: 'Carbon & its Compounds' },
  { batch: '10th Bravo', subject: 'SST & English', teacher: 'Mayur Randive', progress: 30, lastChapter: 'Rise of Nationalism in Europe' },
  { batch: '9th Alpha', subject: 'Hindi & Marathi', teacher: 'Asawari Cherphale', progress: 50, lastChapter: 'Marathi Grammar Sheets' },
  { batch: '9th Alpha', subject: 'Mathematics', teacher: 'Brijesh Prajapati', progress: 40, lastChapter: 'Polynomials' }
];

export default function Faculty() {
  const [activeTeachers, setActiveTeachers] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syllabusList, setSyllabusList] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [students, setStudents] = useState([]);

  // Syllabus progress update states
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressItemId, setProgressItemId] = useState(null);
  const [newProgressVal, setNewProgressVal] = useState(0);
  const [lastChapterName, setLastChapterName] = useState('');

  // Grievance Form states
  const [newGrievance, setNewGrievance] = useState({
    teacherId: '',
    request: '',
    priority: 'Medium'
  });

  // Timetable Maker State
  const CLASSROOMS = ['SAPTARISHI', 'MEGH SINGH', 'TANAJI KAKSH', 'AHOM KAKSH', 'MANIKARNIKA 1', 'MANIKARNIKA 2'];
  const SLOTS = ['02:00 PM TO 04:00 PM', '04:30 PM TO 06:30 PM', '07:00 PM TO 09:00 PM'];
  const [timetableData, setTimetableData] = useState({});
  const [timetableHeaderDate, setTimetableHeaderDate] = useState('CURRENT TO NEXT');
  const [publishingTimetable, setPublishingTimetable] = useState(false);
  const [timetableSettings, setTimetableSettings] = useState({
    subjects: ['Mathematics', 'Science', 'SST', 'English', 'Hindi', 'Marathi', 'Sanskrit'],
    chapters: {}
  });
  const [selectedConfigSubject, setSelectedConfigSubject] = useState('');

  useEffect(() => {
    // 0. Listen to Active Teachers
    const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubTeachers = onSnapshot(qTeachers, (snapshot) => {
      setActiveTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // --- Timetable Data Sync ---
    const qTimetable = query(doc(db, 'timetables', 'master'));
    const unsubTimetable = onSnapshot(qTimetable, (docSnap) => {
      if(docSnap.exists()) {
        const data = docSnap.data();
        setTimetableData(data.schedule || {});
        setTimetableHeaderDate(data.headerDate || 'CURRENT TO NEXT');
      } else {
        setTimetableData({});
      }
    });

    // --- Timetable Settings Sync ---
    const qSettings = query(doc(db, 'timetable_settings', 'defaults'));
    const unsubSettings = onSnapshot(qSettings, async (docSnap) => {
      if(docSnap.exists()) {
        setTimetableSettings(docSnap.data());
      } else {
        const defaultSettings = {
          subjects: ['Mathematics', 'Science', 'SST', 'English', 'Hindi', 'Marathi', 'Sanskrit'],
          chapters: {}
        };
        await setDoc(doc(db, 'timetable_settings', 'defaults'), defaultSettings);
        setTimetableSettings(defaultSettings);
      }
    });

    // 1. Listen to Syllabus Progress
    const qSyl = query(collection(db, 'syllabus_progress'));
    const unsubSyl = onSnapshot(qSyl, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (data.length === 0) {
        setLoading(true);
        for (const s of DEFAULT_SYLLABUS) {
          const docRef = doc(collection(db, 'syllabus_progress'));
          await setDoc(docRef, s);
        }
        setLoading(false);
      } else {
        setSyllabusList(data);
      }
    });

    // 2. Listen to Grievances
    const qGriev = query(collection(db, 'faculty_grievances'));
    const unsubGriev = onSnapshot(qGriev, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setGrievances(sorted);
    });

    // 4. Fetch Admitted Students for grievances target
    const qStu = query(collection(db, 'students'));
    const unsubStu = onSnapshot(qStu, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
      if (data.length > 0) {
        setNewGrievance(prev => ({ ...prev, teacherId: prev.teacherId || activeTeachers[0]?.id }));
      }
    });

    // 6. Set available batches statically from BATCH_DEF
    const computeBatches = () => {
      const batches = Object.values(BATCH_DEF).flat().map(b => b.id);
      setAvailableBatches(batches);
    };
    computeBatches();

    return () => {
      unsubTeachers();
      unsubTimetable();
      unsubSettings();
      unsubSyl();
      unsubGriev();
      unsubStu();
    };
  }, []);

  const handleAddSubject = async () => {
    const newSub = prompt("Enter new subject name:");
    if (newSub && newSub.trim()) {
      const updated = [...(timetableSettings.subjects || []), newSub.trim()];
      await updateDoc(doc(db, 'timetable_settings', 'defaults'), { subjects: updated });
    }
  };

  const handleAddChapter = async (subject) => {
    if (!subject) return alert("Please select a subject first!");
    const newChap = prompt(`Enter new chapter for ${subject}:`);
    if (newChap && newChap.trim()) {
      const updatedChaps = { ...(timetableSettings.chapters || {}) };
      if (!updatedChaps[subject]) updatedChaps[subject] = [];
      updatedChaps[subject] = [...updatedChaps[subject], newChap.trim()];
      await updateDoc(doc(db, 'timetable_settings', 'defaults'), { chapters: updatedChaps });
    }
  };

  const handleEditChapter = async (subject, oldChap) => {
    if (!subject || !oldChap) return alert("Select a chapter to edit.");
    const newChap = prompt(`Rename chapter "${oldChap}" to:`, oldChap);
    if (newChap && newChap.trim() && newChap !== oldChap) {
      const updatedChaps = { ...(timetableSettings.chapters || {}) };
      updatedChaps[subject] = updatedChaps[subject].map(c => c === oldChap ? newChap.trim() : c);
      await updateDoc(doc(db, 'timetable_settings', 'defaults'), { chapters: updatedChaps });
    }
  };

  const handleDeleteSubject = async (subject) => {
    if (!confirm(`Are you sure you want to delete the subject "${subject}"? All associated chapter details will be removed.`)) return;
    const updatedSubjects = (timetableSettings.subjects || []).filter(s => s !== subject);
    const updatedChapters = { ...(timetableSettings.chapters || {}) };
    delete updatedChapters[subject];
    await updateDoc(doc(db, 'timetable_settings', 'defaults'), {
      subjects: updatedSubjects,
      chapters: updatedChapters
    });
    if (selectedConfigSubject === subject) {
      setSelectedConfigSubject('');
    }
  };

  const handleDeleteChapter = async (subject, chapter) => {
    if (!confirm(`Are you sure you want to delete the chapter "${chapter}" from "${subject}"?`)) return;
    const updatedChapters = { ...(timetableSettings.chapters || {}) };
    if (updatedChapters[subject]) {
      updatedChapters[subject] = updatedChapters[subject].filter(c => c !== chapter);
      await updateDoc(doc(db, 'timetable_settings', 'defaults'), { chapters: updatedChapters });
    }
  };

  const handleOpenProgress = (item) => {
    setProgressItemId(item.id);
    setNewProgressVal(item.progress);
    setLastChapterName(item.lastChapter || '');
    setShowProgressModal(true);
  };

  const handleProgressSubmit = async () => {
    try {
      await updateDoc(doc(db, 'syllabus_progress', progressItemId), {
        progress: Number(newProgressVal),
        lastChapter: lastChapterName.trim()
      });
      setShowProgressModal(false);
      setProgressItemId(null);
      alert('Syllabus completion progress updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update progress.');
    }
  };

  const handleCreateGrievance = async (e) => {
    e.preventDefault();
    if (!newGrievance.request.trim()) return alert('Please enter grievance details!');

    try {
      const targetTeacher = activeTeachers.find(t => t.id === newGrievance.teacherId);
      await addDoc(collection(db, 'faculty_grievances'), {
        teacherId: newGrievance.teacherId,
        teacherName: targetTeacher ? targetTeacher.fullName : 'Unknown',
        request: newGrievance.request.trim(),
        priority: newGrievance.priority,
        status: 'Pending',
        timestamp: serverTimestamp()
      });
      setNewGrievance(prev => ({ ...prev, request: '' }));
      alert('Grievance logged on Rohan\'s Coordination Board!');
    } catch (err) {
      console.error(err);
      alert('Failed to log grievance.');
    }
  };

  const handleResolveGrievance = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Pending' ? 'Resolved' : 'Pending';
    let remark = '';
    
    if (nextStatus === 'Resolved') {
      const input = prompt("Enter a resolution note/remark for the faculty (optional):");
      if (input === null) return; // User cancelled
      remark = input.trim();
    }

    try {
      await updateDoc(doc(db, 'faculty_grievances', id), {
        status: nextStatus,
        resolutionRemark: remark || null,
        resolvedAt: nextStatus === 'Resolved' ? serverTimestamp() : null
      });
    } catch (err) {
      console.error(err);
      alert('Failed to update grievance status.');
    }
  };

  const handleUpdateCell = (slot, classroom, field, value, subField = null) => {
    setTimetableData(prev => {
      const slotData = prev[slot] || {};
      const cellData = slotData[classroom] || { batch: '', monWed: { subject: '', topic: '', teacherId: '' }, thursSat: { subject: '', topic: '', teacherId: '' }, test: { topic: '' } };

      let newCellData = { ...cellData };
      if (subField) {
        newCellData[field] = { ...newCellData[field], [subField]: value };
        
        // Auto-populate subject if teacher is selected
        if (subField === 'teacherId') {
          const teacher = activeTeachers.find(t => t.id === value);
          if (teacher) {
            newCellData[field].subject = teacher.subjects;
          }
        }
      } else {
        newCellData[field] = value;
      }

      return {
        ...prev,
        [slot]: {
          ...slotData,
          [classroom]: newCellData
        }
      };
    });
  };

  const handlePublishTimetable = async () => {
    setPublishingTimetable(true);
    try {
      await setDoc(doc(db, 'timetables', 'master'), {
        schedule: timetableData,
        headerDate: timetableHeaderDate,
        updatedAt: serverTimestamp()
      });

      // Helper to compute Saturday date string matching Teacher & Service Manager contracts
      const parseStartDate = (hdr) => {
        if (!hdr) return new Date();
        const parts = hdr.split(' TO ');
        if (parts.length > 0) {
          const p = parts[0].trim().split('/');
          if (p.length === 3) {
            const year = p[2].length === 2 ? '20' + p[2] : p[2];
            return new Date(`${year}-${p[1]}-${p[0]}`);
          }
        }
        const d = new Date(hdr);
        return !isNaN(d.getTime()) ? d : new Date();
      };
      const stDate = parseStartDate(timetableHeaderDate);
      const sat = new Date(stDate);
      sat.setDate(sat.getDate() + 5);
      const satDayStr = `${sat.getDate().toString().padStart(2, '0')}/${(sat.getMonth() + 1).toString().padStart(2, '0')}/${sat.getFullYear().toString().slice(-2)}`;

      // Auto-seed test_workflows for all test duties in the timetable
      let seededCount = 0;
      for (const slot of Object.keys(timetableData)) {
        for (const room of Object.keys(timetableData[slot] || {})) {
          const cell = timetableData[slot][room];
          if (cell?.test && (cell.test.topic || cell.test.preparedBy || cell.test.checkedBy)) {
            const testId = `${satDayStr.replace(/\//g, '-')}_${cell.batch}`;
            const testRef = doc(db, 'test_workflows', testId);
            const existingDoc = await getDoc(testRef);

            if (!existingDoc.exists()) {
              await setDoc(testRef, {
                testId,
                batch: cell.batch,
                subject: cell.thursSat?.subject || cell.monWed?.subject || 'Weekly Test',
                topic: cell.test.topic || 'Weekly Saturday Exam',
                preparedBy: cell.test.preparedBy || '',
                checkedBy: cell.test.checkedBy || '',
                status: 'draft_pending',
                testDate: satDayStr,
                createdAt: new Date().toISOString()
              });
              seededCount++;
            }
          }
        }
      }

      alert(`Master Timetable published successfully! (${seededCount > 0 ? `${seededCount} test duties seeded to Test Board` : 'Test workflows synced'})`);
    } catch(err) {
      alert("Failed to publish timetable: " + err.message);
    }
    setPublishingTimetable(false);
  };

  return (
    <div className="faculty-container">
      <div className="faculty-header-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Crafting Table</h1>
          <p>Logged in as Rohan Sir (Service Manager) • Manage master timetables and center coordination.</p>
        </div>
      </div>

      {/* Timetable Maker Section */}
      <div className="portal-card" style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>📅 Master Weekly Timetable</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage all simultaneous batches and lectures for the entire center.</p>
        </div>
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #timetable-container, #timetable-container * {
              visibility: visible;
            }
            #timetable-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              zoom: 0.55;
            }
            @page {
              size: landscape;
              margin: 5mm;
            }
            .portal-table {
              page-break-inside: avoid;
            }
            #timetable-container select {
              -webkit-appearance: none;
              appearance: none;
              border: none !important;
              background: transparent !important;
              color: #000 !important;
            }
            #timetable-container input {
              border: none !important;
              background: transparent !important;
              color: #000 !important;
            }
            #timetable-container button {
              display: none !important;
            }
            .syllabus-tracker-card {
              display: none !important;
            }
          }
        `}</style>
        <div id="timetable-container" style={{ overflowX: 'auto' }}>
          <table className="portal-table" style={{ minWidth: '1400px', borderCollapse: 'collapse', border: '2px solid #ccc' }}>
            <thead>
              <tr style={{ background: '#FFEB3B', color: '#000' }}>
                <th colSpan={7} style={{ textAlign: 'center', fontSize: '20px', padding: '12px', border: '1px solid #ccc' }}>
                  SHISHYAKUL TIME TABLE FROM 
                  <input 
                    value={timetableHeaderDate} 
                    onChange={e => setTimetableHeaderDate(e.target.value)} 
                    style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #000', outline: 'none', fontSize: '20px', fontWeight: 'bold', color: '#000', marginLeft: '12px', textAlign: 'center', width: '300px' }} 
                    placeholder="e.g. 08.06.26 TO 14.06.26" 
                  />
                </th>
              </tr>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ width: '80px', border: '1px solid #ccc', textAlign: 'center' }}>T.</th>
                {CLASSROOMS.map(room => (
                  <th key={room} style={{ border: '1px solid #ccc', textAlign: 'center', fontSize: '13px' }}>{room}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(slot => (
                <React.Fragment key={slot}>
                  {/* Class / Batch Row */}
                  <tr>
                    <td rowSpan={4} style={{ border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold', width: '80px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', padding: '12px 0' }}>
                      {slot}
                    </td>
                    {CLASSROOMS.map(room => {
                      const cell = (timetableData[slot]?.[room]) || {};
                      return (
                        <td key={`${slot}-${room}-class`} style={{ border: '1px solid #ccc', padding: '4px', background: '#FFF9C4', textAlign: 'center' }}>
                          <select 
                            value={cell.batch || ''}
                            onChange={e => handleUpdateCell(slot, room, 'batch', e.target.value)}
                            style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                          >
                            <option value="">Select Batch</option>
                            {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Mon-Wed Row */}
                  <tr>
                    {CLASSROOMS.map(room => {
                      const cell = (timetableData[slot]?.[room]) || {};
                      const mw = cell.monWed || {};
                      return (
                        <td key={`${slot}-${room}-monwed`} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center', background: '#fff' }}>
                          <DayRangeDialer 
                            value={cell.monWedLabel} 
                            onChange={val => handleUpdateCell(slot, room, 'monWedLabel', val)}
                          />
                          <select 
                            value={mw.teacherId || ''}
                            onChange={e => handleUpdateCell(slot, room, 'monWed', e.target.value, 'teacherId')}
                            style={{ width: '100%', padding: '2px', fontSize: '11px', marginBottom: '4px', color: '#D32F2F', fontWeight: 'bold', border: '1px solid #eee' }}
                          >
                            <option value="">Select Faculty</option>
                            {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                          <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                            <select 
                              value={mw.subject || ''}
                              onChange={e => handleUpdateCell(slot, room, 'monWed', e.target.value, 'subject')}
                              style={{ flex: 1, padding: '2px', fontSize: '11px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee', outline: 'none' }}
                            >
                              <option value="">Subject</option>
                              {(timetableSettings.subjects || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                            <button className="btn-icon" style={{ padding: 0, width: '16px', background: '#eee' }} onClick={handleAddSubject} title="Add New Subject">
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add</span>
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: '2px' }}>
                            <select 
                              value={mw.topic || ''}
                              onChange={e => handleUpdateCell(slot, room, 'monWed', e.target.value, 'topic')}
                              style={{ flex: 1, padding: '2px', fontSize: '11px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee', outline: 'none' }}
                            >
                              <option value="">Chapter / Topic</option>
                              {mw.subject && (timetableSettings.chapters?.[mw.subject] || []).map(chap => <option key={chap} value={chap}>{chap}</option>)}
                            </select>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <button className="btn-icon" style={{ padding: 0, width: '14px', height: '10px', minHeight: '10px', background: '#eee', lineHeight: '10px' }} onClick={() => handleAddChapter(mw.subject)} title="Add Chapter">
                                <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>add</span>
                              </button>
                              <button className="btn-icon" style={{ padding: 0, width: '14px', height: '10px', minHeight: '10px', background: '#eee', lineHeight: '10px' }} onClick={() => handleEditChapter(mw.subject, mw.topic)} title="Edit Selected Chapter">
                                <span className="material-symbols-outlined" style={{ fontSize: '9px' }}>edit</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Thurs-Sat Row */}
                  <tr>
                    {CLASSROOMS.map(room => {
                      const cell = (timetableData[slot]?.[room]) || {};
                      const ts = cell.thursSat || {};
                      return (
                        <td key={`${slot}-${room}-thurssat`} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center', background: '#fcfcfc' }}>
                          <DayRangeDialer 
                            value={cell.thursSatLabel} 
                            onChange={val => handleUpdateCell(slot, room, 'thursSatLabel', val)}
                          />
                          <select 
                            value={ts.teacherId || ''}
                            onChange={e => handleUpdateCell(slot, room, 'thursSat', e.target.value, 'teacherId')}
                            style={{ width: '100%', padding: '2px', fontSize: '11px', marginBottom: '4px', color: '#D32F2F', fontWeight: 'bold', border: '1px solid #eee' }}
                          >
                            <option value="">Select Faculty</option>
                            {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                          <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                            <select 
                              value={ts.subject || ''}
                              onChange={e => handleUpdateCell(slot, room, 'thursSat', e.target.value, 'subject')}
                              style={{ flex: 1, padding: '2px', fontSize: '11px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee', outline: 'none' }}
                            >
                              <option value="">Subject</option>
                              {(timetableSettings.subjects || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                            <button className="btn-icon" style={{ padding: 0, width: '16px', background: '#eee' }} onClick={handleAddSubject} title="Add New Subject">
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add</span>
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: '2px' }}>
                            <select 
                              value={ts.topic || ''}
                              onChange={e => handleUpdateCell(slot, room, 'thursSat', e.target.value, 'topic')}
                              style={{ flex: 1, padding: '2px', fontSize: '11px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee', outline: 'none' }}
                            >
                              <option value="">Chapter / Topic</option>
                              {ts.subject && (timetableSettings.chapters?.[ts.subject] || []).map(chap => <option key={chap} value={chap}>{chap}</option>)}
                            </select>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <button className="btn-icon" style={{ padding: 0, width: '14px', height: '10px', minHeight: '10px', background: '#eee', lineHeight: '10px' }} onClick={() => handleAddChapter(ts.subject)} title="Add Chapter">
                                <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>add</span>
                              </button>
                              <button className="btn-icon" style={{ padding: 0, width: '14px', height: '10px', minHeight: '10px', background: '#eee', lineHeight: '10px' }} onClick={() => handleEditChapter(ts.subject, ts.topic)} title="Edit Selected Chapter">
                                <span className="material-symbols-outlined" style={{ fontSize: '9px' }}>edit</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Test Row */}
                  <tr>
                    {CLASSROOMS.map(room => {
                      const cell = (timetableData[slot]?.[room]) || {};
                      const test = cell.test || {};
                      const extra = cell.extra || {};
                      const showExtra = cell.showExtra || false;

                      return (
                        <td key={`${slot}-${room}-test`} style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center', background: '#F5F5F5' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>SATURDAY TEST</div>
                            <button className="btn-icon" style={{ padding: 0, width: '14px', height: '14px', minHeight: '14px', background: '#e0e0e0', color: '#333' }} onClick={() => handleUpdateCell(slot, room, 'showExtra', !showExtra)} title="Add Sunday Extra Lecture">
                              <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>{showExtra || extra.subject ? 'remove' : 'add'}</span>
                            </button>
                          </div>
                          <input 
                            value={test.topic || ''}
                            onChange={e => handleUpdateCell(slot, room, 'test', e.target.value, 'topic')}
                            placeholder="Test Syllabus"
                            style={{ width: '100%', padding: '2px', fontSize: '11px', color: '#1976D2', textAlign: 'center', border: '1px solid #eee', background: '#fff', outline: 'none', marginBottom: '4px' }}
                          />
                          <select 
                            value={test.preparedBy || ''}
                            onChange={e => handleUpdateCell(slot, room, 'test', e.target.value, 'preparedBy')}
                            style={{ width: '100%', padding: '2px', fontSize: '9px', marginBottom: '2px', color: '#1976D2', border: '1px solid #eee' }}
                            title="Question Paper Prepared By"
                          >
                            <option value="">Prepared By</option>
                            {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                          <select 
                            value={test.checkedBy || ''}
                            onChange={e => handleUpdateCell(slot, room, 'test', e.target.value, 'checkedBy')}
                            style={{ width: '100%', padding: '2px', fontSize: '9px', color: '#1976D2', border: '1px solid #eee' }}
                            title="Answer Sheet Checked By"
                          >
                            <option value="">Checked By</option>
                            {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                          
                          {(showExtra || extra.subject || extra.teacherId) && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #ccc', position: 'relative' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#E91E63' }}>SUNDAY EXTRA</div>
                                <button 
                                  className="btn-icon" 
                                  onClick={() => {
                                    handleUpdateCell(slot, room, 'extra', { subject: '', teacherId: '' });
                                    handleUpdateCell(slot, room, 'showExtra', false);
                                  }}
                                  style={{ padding: 0, width: '14px', height: '14px', minHeight: '14px', color: '#E91E63' }}
                                  title="Delete Sunday Extra"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>delete</span>
                                </button>
                              </div>
                              <select 
                                value={extra.teacherId || ''}
                                onChange={e => handleUpdateCell(slot, room, 'extra', e.target.value, 'teacherId')}
                                style={{ width: '100%', padding: '2px', fontSize: '10px', marginBottom: '4px', color: '#D32F2F', fontWeight: 'bold', border: '1px solid #eee' }}
                              >
                                <option value="">Select Faculty</option>
                                {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                              </select>
                              <input 
                                value={extra.subject || ''}
                                onChange={e => handleUpdateCell(slot, room, 'extra', e.target.value, 'subject')}
                                placeholder="Subject"
                                style={{ width: '100%', padding: '2px', fontSize: '10px', marginBottom: '4px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee' }}
                              />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => window.print()}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '6px', fontSize: '18px' }}>download</span>
            Download PDF
          </button>
          <button className="btn btn-brand" onClick={handlePublishTimetable} disabled={publishingTimetable}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '6px', fontSize: '18px' }}>publish</span>
            {publishingTimetable ? 'Publishing...' : 'Push Master Timetable to All'}
          </button>
        </div>
      </div>

      {/* Curriculum & Settings Builder Panel */}
      <div className="portal-card" style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <h2 style={{ margin: 0 }}>⚙️ Curriculum & Settings Builder</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Manage course curriculum, active subjects, and chapters dynamically.</p>
          </div>
        </div>
        
        <div className="curriculum-grid">
          {/* Left panel: list of subjects */}
          <div className="curriculum-subject-list">
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>Subjects</div>
            {(timetableSettings.subjects || []).map(sub => (
              <button 
                key={sub}
                onClick={() => setSelectedConfigSubject(sub)}
                className={`curriculum-subject-btn ${selectedConfigSubject === sub ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <span>{sub}</span>
                <span 
                  className="material-symbols-outlined" 
                  style={{ fontSize: '16px', color: selectedConfigSubject === sub ? '#1a0e00' : 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSubject(sub);
                  }}
                  title={`Delete ${sub}`}
                >
                  delete
                </span>
              </button>
            ))}
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleAddSubject}
              style={{ marginTop: '8px', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Add Subject
            </button>
          </div>

          {/* Right panel: chapters of selected subject */}
          <div className="curriculum-chapter-panel">
            {selectedConfigSubject ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>{selectedConfigSubject} Chapters</h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Manage lesson structures for this subject.</p>
                  </div>
                  <button 
                    className="btn btn-brand btn-sm" 
                    onClick={() => handleAddChapter(selectedConfigSubject)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                    Add Chapter
                  </button>
                </div>

                <div className="curriculum-chip-container">
                  {!(timetableSettings.chapters?.[selectedConfigSubject] && timetableSettings.chapters[selectedConfigSubject].length > 0) ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                      No chapters added to this subject yet.
                    </div>
                  ) : (
                    timetableSettings.chapters[selectedConfigSubject].map((chap) => (
                      <div key={chap} className="curriculum-chapter-chip">
                        <span>{chap}</span>
                        <div style={{ display: 'flex', gap: '8px', marginLeft: '6px' }}>
                          <span 
                            className="material-symbols-outlined" 
                            style={{ fontSize: '14px', color: 'var(--text-muted)', cursor: 'pointer' }}
                            onClick={() => handleEditChapter(selectedConfigSubject, chap)}
                            title="Rename"
                          >
                            edit
                          </span>
                          <span 
                            className="material-symbols-outlined" 
                            style={{ fontSize: '14px', color: 'var(--status-error)', cursor: 'pointer' }}
                            onClick={() => handleDeleteChapter(selectedConfigSubject, chap)}
                            title="Delete"
                          >
                            delete
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px', color: 'var(--text-muted)', gap: '10px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', opacity: 0.5 }}>menu_book</span>
                <span style={{ fontSize: '13px' }}>Select a subject from the left panel to configure its chapter contents.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Syllabus Tracking Section */}
      <div className="portal-card syllabus-tracker-card" style={{ marginTop: '28px' }}>
        <h2>📚 Academic Syllabus Tracker</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Monitor syllabus completion percentages for batches and subjects.</p>
        
        {loading ? (
          <p>Syncing syllabus tracking progress...</p>
        ) : (
          <div className="syllabus-grid">
            {syllabusList.map(syl => (
              <div key={syl.id} className="syllabus-row-item">
                <div className="syllabus-meta-row">
                  <div>
                    <h3>{syl.batch} - {syl.subject}</h3>
                    <p className="teacher-desc">Faculty: {syl.teacher}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="syllabus-progress-amount">{syl.progress}%</div>
                    {syl.progress < 40 ? (
                      <span className="syllabus-health-badge behind">⚠️ Behind</span>
                    ) : syl.progress > 80 ? (
                      <span className="syllabus-health-badge advanced">🌟 Advanced</span>
                    ) : (
                      <span className="syllabus-health-badge ontrack">✅ On Track</span>
                    )}
                  </div>
                </div>

                <div className="syllabus-progress-bar-bg">
                  <div className="syllabus-progress-bar-fill" style={{ width: `${syl.progress}%` }} />
                </div>

                <div className="syllabus-chapter-row">
                  <span>Last Chapter completed: <strong>{syl.lastChapter || 'None'}</strong></span>
                  <button className="btn-manual-pay btn-sm" onClick={() => handleOpenProgress(syl)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
                    Update Track
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Grievance Section (resolved list moved down for clarity) */}
      <div className="portal-card faculty-card-panel" style={{ marginTop: '28px' }}>
        <h2>🛠️ Teacher Grievance Log List</h2>
        <form onSubmit={handleCreateGrievance} style={{ display: 'none' }}></form>
        
        <div className="grievance-feed-list" style={{ maxHeight: 'none' }}>
          {grievances.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No faculty grievances logged.</p>
          ) : (
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Priority</th>
                  <th>Request Details</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {grievances.map(g => (
                  <tr key={g.id}>
                    <td><strong>{g.teacherName}</strong></td>
                    <td>
                      <span className={`priority-tag ${g.priority.toLowerCase()}`}>
                        {g.priority}
                      </span>
                    </td>
                    <td>
                      <div>{g.request}</div>
                      {g.status === 'Resolved' && g.resolutionRemark && (
                        <div className="resolution-remark-box">
                          <strong>Note:</strong> {g.resolutionRemark}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-tag ${g.status.toLowerCase()}`}>
                        {g.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={`btn btn-sm ${g.status === 'Pending' ? 'btn-brand' : 'btn-ghost'}`}
                        onClick={() => handleResolveGrievance(g.id, g.status)}
                      >
                        {g.status === 'Pending' ? 'Resolve' : 'Re-open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {/* Progress Modals */}
      {showProgressModal && (
        <div className="fees-modal-overlay">
          <div className="fees-modal">
            <h2>📈 Update Syllabus Progress</h2>
            <p>Update syllabus progress metrics for Rohan and Sumit Sir to review.</p>
            
            <div className="form-group">
              <label className="form-label">Progress Percentage ({newProgressVal}%)</label>
              <input 
                type="range"
                min="0"
                max="100"
                value={newProgressVal} 
                onChange={e => setNewProgressVal(e.target.value)} 
                className="portal-input"
                style={{ height: 'auto', padding: 0 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Latest Completed Chapter Name</label>
              <input 
                type="text" 
                placeholder="e.g. Quadratic Equations" 
                value={lastChapterName} 
                onChange={e => setLastChapterName(e.target.value)} 
                className="portal-input"
                required
              />
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowProgressModal(false);
                  setProgressItemId(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-brand" 
                onClick={handleProgressSubmit}
              >
                Update Ledger
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
