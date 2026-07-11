import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
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
    try {
      await updateDoc(doc(db, 'faculty_grievances', id), {
        status: nextStatus
      });
    } catch (err) {
      console.error(err);
      alert('Failed to toggle status.');
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
      alert(`Master Timetable published successfully to all dashboards!`);
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
        
        <div style={{ overflowX: 'auto' }}>
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
        
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button className="btn btn-brand" onClick={handlePublishTimetable} disabled={publishingTimetable}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '6px', fontSize: '18px' }}>publish</span>
            {publishingTimetable ? 'Publishing...' : 'Push Master Timetable to All'}
          </button>
        </div>
      </div>

      {/* Syllabus Tracking Section */}
      <div className="portal-card syllabus-tracker-card">
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
                  <div className="syllabus-progress-amount">{syl.progress}%</div>
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
                    <td>{g.request}</td>
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
