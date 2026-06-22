import React, { useState, useEffect } from 'react';
import { DndContext, closestCorners, DragOverlay, useDroppable, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import './Batches.css'; // Use new UI redesign

const GRADE_TABS = ['8th', '9th', '10th'];

const BATCH_DEF = {
  '8th': [
    { id: '8th-CBSE Alpha', title: '8th-CBSE Alpha' },
    { id: '8th-CBSE Bravo', title: '8th-CBSE Bravo' },
    { id: '8th-CBSE Delta', title: '8th-CBSE Delta' },
    { id: '8th-CBSE Echo', title: '8th-CBSE Echo' },
  ],
  '9th': [
    { id: '9th-CBSE Alpha', title: '9th-CBSE Alpha' },
    { id: '9th-CBSE Bravo', title: '9th-CBSE Bravo' },
    { id: '9th-CBSE Charlie', title: '9th-CBSE Charlie' },
    { id: '9th-CBSE Echo', title: '9th-CBSE Echo' },
    { id: '9th-CBSE Foxtrot', title: '9th-CBSE Foxtrot' },
    { id: '9th-State Delta', title: '9th-State Delta' },
  ],
  '10th': [
    { id: '10th-CBSE Alpha', title: '10th-CBSE Alpha' },
    { id: '10th-CBSE Bravo', title: '10th-CBSE Bravo' },
    { id: '10th-CBSE Charlie', title: '10th-CBSE Charlie' },
    { id: '10th-CBSE Delta', title: '10th-CBSE Delta' },
    { id: '10th-CBSE Echo', title: '10th-CBSE Echo' },
    { id: '10th-CBSE Foxtrot', title: '10th-CBSE Foxtrot' },
    { id: '10th-State Hitman', title: '10th-State Hitman' },
    { id: '10th-State Golf', title: '10th-State Golf' },
  ]
};

/* --- Sortable Item Component --- */
function SortableStudentCard({ student }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: student.id, data: student });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="batch-card">
      {student.photoDataUrl ? (
        <img src={student.photoDataUrl} className="batch-card-avatar" alt={student.studentName} draggable="false" />
      ) : (
        <div className="batch-card-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>person</span>
        </div>
      )}
      <div className="batch-card-info">
        <div className="batch-card-name">{student.studentName || 'Unknown'}</div>
        <div className="batch-card-meta">
          <div className="batch-card-meta-item">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>call</span>
            {student.contactNo || student.contactNumber || 'No Phone'}
          </div>
          <div className="batch-card-meta-item">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>school</span>
            {student.board || 'Std'}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Droppable Column Component --- */
function KanbanColumn({ col, students }) {
  const { setNodeRef } = useDroppable({ id: col.id });
  const MAX_CAPACITY = 22;
  const count = students.length;
  const percentage = Math.min((count / MAX_CAPACITY) * 100, 100);
  
  let capClass = 'capacity-safe';
  if (percentage >= 100) capClass = 'capacity-danger';
  else if (percentage >= 80) capClass = 'capacity-warn';

  const isUnassigned = col.id === 'unassigned';

  return (
    <div ref={setNodeRef} className="batch-column" style={{ borderColor: percentage >= 100 ? 'var(--status-error)' : undefined }}>
      <div className="batch-col-header">
        <div className="batch-col-title-row">
          <div className="batch-col-title" style={{ color: percentage >= 100 ? 'var(--status-error)' : 'var(--text-primary)' }}>
            {percentage >= 100 && <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>}
            {col.title}
          </div>
          <div className="batch-col-count" style={{ background: percentage >= 100 ? 'var(--status-error)' : '', color: percentage >= 100 ? '#fff' : '' }}>
            {count} {isUnassigned ? '' : `/ ${MAX_CAPACITY}`}
          </div>
        </div>
        
        {!isUnassigned && (
          <div className="batch-capacity-wrapper">
            <div className={`batch-capacity-bar ${capClass}`} style={{ width: `${percentage}%` }}></div>
          </div>
        )}
      </div>
      
      <div className="batch-droppable">
        {students.length === 0 ? (
          <div className="batch-empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>inventory_2</span>
            No students here
          </div>
        ) : (
          <SortableContext items={students.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {students.map(student => (
              <SortableStudentCard key={student.id} student={student} />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export default function Batches() {
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('10th');
  const [activeStudent, setActiveStudent] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    // Only fetch admitted students
    const q = query(collection(db, 'students'), where('status', '==', 'admitted'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
    });
    return () => unsub();
  }, []);

  const handleDragStart = (event) => {
    const { active } = event;
    const student = students.find(s => s.id === active.id);
    setActiveStudent(student);
  };

  const handleDragEnd = async (event) => {
    setActiveStudent(null);
    const { active, over } = event;
    if (!over) return;

    const studentId = active.id;
    let targetBatchId = over.id;

    // Fix: If dropped onto another student card instead of the column itself,
    // the over.id will be a student's ID. We need to extract their batch instead.
    const overStudent = students.find(s => s.id === targetBatchId);
    if (overStudent) {
      targetBatchId = overStudent.batch || 'unassigned';
    }

    const currentStudent = students.find(s => s.id === studentId);
    if (!currentStudent) return;

    const newBatchValue = targetBatchId === 'unassigned' ? null : targetBatchId;

    if (currentStudent.batch !== newBatchValue) {
      try {
        await updateDoc(doc(db, 'students', studentId), { batch: newBatchValue });
      } catch (err) {
        console.error("Error updating batch:", err);
      }
    }
  };

  // Determine Columns for current Tab
  const unassignedCol = { id: 'unassigned', title: 'Unassigned (Needs Batch)' };
  const currentBatchCols = BATCH_DEF[activeTab] || [];
  const activeColumns = [unassignedCol, ...currentBatchCols];

  return (
    <div className="batches-container">
      <div className="batches-header">
        <h1>Batch Allocation Hub</h1>
        <p>Distribute admitted students across specific batches via drag-and-drop.</p>
      </div>

      {/* Segmented Control Tabs */}
      <div className="batches-tabs">
        {GRADE_TABS.map(tab => (
          <button
            key={tab}
            className={`batch-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab} Grade
          </button>
        ))}
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="batches-board-grid">
          {activeColumns.map(col => {
            const allValidBatchIds = Object.values(BATCH_DEF).flat().map(b => b.id);

            const colStudents = students.filter(s => {
              if (col.id === 'unassigned') {
                const isUnassigned = !s.batch || !allValidBatchIds.includes(s.batch);
                const tabNum = activeTab.replace(/\D/g, ''); // Extract '8', '9', '10' from '8th', etc.
                const sStandard = (s.standard || '').toLowerCase();
                // Match exact '10th' OR just the number '10'
                const isCurrentGrade = sStandard.includes(activeTab.toLowerCase()) || sStandard.includes(tabNum);
                return isUnassigned && isCurrentGrade;
              } else {
                return s.batch === col.id;
              }
            });

            return (
              <div key={col.id} id={col.id}>
                <KanbanColumn col={col} students={colStudents} />
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeStudent ? (
            <div className="batch-card batch-card-dragging">
              {activeStudent.photoDataUrl ? (
                <img src={activeStudent.photoDataUrl} className="batch-card-avatar" alt="Avatar" />
              ) : (
                <div className="batch-card-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>person</span>
                </div>
              )}
              <div className="batch-card-info">
                <div className="batch-card-name">{activeStudent.studentName}</div>
                <div className="batch-card-meta">
                  <div className="batch-card-meta-item">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>school</span>
                    {activeStudent.standard}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
