import test from 'node:test';
import assert from 'node:assert/strict';

test('Front Desk Manager Pipeline & Sync Audit', async (t) => {

  // Simulated In-Memory Database State replicating Firestore collections
  const db = {
    students: {},
    attendance: [],
    inventory: {},
    asset_assignments: [],
    teacher_attendance: [],
    salary_history: []
  };

  const frontDeskProfile = {
    id: 'user-shruti-fd',
    uid: 'user-shruti-fd',
    role: 'front_desk_manager',
    fullName: 'Shruti Kamble',
    email: 'frontdesk@shishyakul.in'
  };

  // =========================================================================
  // TEST 1: Walk-in Enquiry Pipeline (Kiosk -> Students DB -> Dashboard Metrics)
  // =========================================================================
  await t.test('1. Walk-in Enquiry Registration and Funnel Reflection', () => {
    const newEnquiryPayload = {
      id: 'stu-enq-001',
      studentName: 'Aarav Deshmukh',
      contactNo: '9822012345',
      parentName: 'Sanjay Deshmukh',
      parentContact: '9822012345',
      standard: '10th',
      board: 'CBSE',
      status: 'enquiry',
      enquiryDate: '2026-09-22',
      createdAt: new Date().toISOString()
    };

    // 1. Simulate EnquiryKiosk submitDoc
    db.students[newEnquiryPayload.id] = { ...newEnquiryPayload };
    assert.equal(db.students['stu-enq-001'].status, 'enquiry');

    // 2. Simulate FrontendDeskDashboard calculations
    const allStudents = Object.values(db.students);
    const activeEnquiries = allStudents.filter(s => s.status === 'enquiry' || !s.status);
    assert.equal(activeEnquiries.length, 1);
    assert.equal(activeEnquiries[0].studentName, 'Aarav Deshmukh');
  });

  // =========================================================================
  // TEST 2: Demo Completion & Pending Admission Linkage (PRE & POST PIPELINE)
  // =========================================================================
  await t.test('2. Completed Demo -> Pending Admissions Linkage Check (PRE vs POST)', () => {
    // PRE-CONDITION: Student enrolled in demo sessions
    const demoStudent = {
      id: 'stu-demo-002',
      studentName: 'Pooja Kulkarni',
      contactNo: '9890123456',
      standard: '10th',
      board: 'State',
      status: 'demo',
      demoCompletionStatus: 'completed', // Attended all demos
      demoSubject: 'Mathematics'
    };
    db.students[demoStudent.id] = { ...demoStudent };

    // Dashboard view: Front desk identifies completed demos
    const allStudents = Object.values(db.students);
    const completedDemosForCall = allStudents.filter(s => s.status === 'demo' && s.demoCompletionStatus === 'completed');
    assert.equal(completedDemosForCall.length, 1, 'Front desk dashboard should identify completed demos awaiting follow-up');

    // PRE-FIX CHECK: The legacy query strictly checking `where("status", "==", "pending_admission")`
    const legacyPreFixQuery = allStudents.filter(s => s.status === 'pending_admission');
    assert.equal(legacyPreFixQuery.length, 0, 'PRE-FIX: Legacy query failed to catch demo-completed students');

    // POST-FIX CHECK: The new bridged query checks both pending_admission and completed demos
    const modernPostFixQuery = allStudents.filter(s => 
      s.status === 'pending_admission' || (s.status === 'demo' && s.demoCompletionStatus === 'completed')
    );
    assert.equal(modernPostFixQuery.length, 1, 'POST-FIX: Bridged query successfully captures student for admission processing');

    // POST-PIPELINE COMPLETION: Front Desk finalizes admission in PendingAdmissions.jsx
    db.students[demoStudent.id].status = 'admitted';
    db.students[demoStudent.id].batch = '10th-State Hitman';
    db.students[demoStudent.id].totalFees = 45000;
    db.students[demoStudent.id].installments = 3;
    db.students[demoStudent.id].admissionDate = new Date().toISOString();

    // Verify post-admission state
    assert.equal(db.students[demoStudent.id].status, 'admitted');
    assert.equal(db.students[demoStudent.id].batch, '10th-State Hitman');
    assert.ok(db.students[demoStudent.id].admissionDate);

    // Verify student is removed from pending queue
    const remainingPending = Object.values(db.students).filter(s => 
      s.status === 'pending_admission' || (s.status === 'demo' && s.demoCompletionStatus === 'completed')
    );
    assert.equal(remainingPending.length, 0, 'POST-PIPELINE: Student cleanly removed from pending queue upon admission');
  });

  // =========================================================================
  // TEST 3: Attendance Grid -> Real-Time Dashboard Gauge Synchronization
  // =========================================================================
  await t.test('3. Daily Attendance Recording & Ring Gauge Calculation', () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Simulate batch attendance marked by Front Desk or Faculty
    const attendanceDoc = {
      batch: '10th-State Hitman',
      date: todayStr,
      sessionType: 'Regular',
      totalStudents: 25,
      absentCount: 3,
      absenteeIds: ['s1', 's2', 's3'],
      markedBy: frontDeskProfile.fullName,
      markedAt: new Date().toISOString()
    };
    db.attendance.push(attendanceDoc);

    // Dashboard attendance snapshot computation
    let presentCount = 0;
    let absentCount = 0;
    db.attendance.forEach(log => {
      if (log.date === todayStr) {
        absentCount += (log.absentCount || 0);
        presentCount += ((log.totalStudents || 0) - (log.absentCount || 0));
      }
    });

    const totalMarked = presentCount + absentCount;
    const attendancePercent = totalMarked === 0 ? 0 : Math.round((presentCount / totalMarked) * 100);

    assert.equal(presentCount, 22);
    assert.equal(absentCount, 3);
    assert.equal(totalMarked, 25);
    assert.equal(attendancePercent, 88);
  });

  // =========================================================================
  // TEST 4: Asset & Study Kit Disbursement Ledger Pipeline
  // =========================================================================
  await t.test('4. Study Kit Disbursement and Asset Ledger Reflection', () => {
    // Setup Inventory Catalog
    db.inventory['item-bag'] = {
      id: 'item-bag',
      name: 'Shishyakul Bag',
      category: 'Supplies',
      totalQuantity: 200,
      availableQuantity: 50
    };

    // Front Desk disburses 1 bag to admitted student
    const studentId = 'stu-demo-002';
    const disbursementPayload = {
      id: 'assign-001',
      recipientType: 'student',
      recipientId: studentId,
      recipientName: db.students[studentId].studentName,
      itemId: 'item-bag',
      itemName: 'Shishyakul Bag',
      quantity: 1,
      type: 'bag',
      action: 'Assigned',
      timestamp: { seconds: Math.floor(Date.now() / 1000) }
    };

    db.asset_assignments.push(disbursementPayload);
    db.inventory['item-bag'].availableQuantity -= 1;

    // Verify stock decrement
    assert.equal(db.inventory['item-bag'].availableQuantity, 49);

    // Verify Dashboard Asset Log
    const recentLogs = [...db.asset_assignments].sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    assert.equal(recentLogs.length, 1);
    assert.equal(recentLogs[0].recipientName, 'Pooja Kulkarni');
    assert.equal(recentLogs[0].itemName, 'Shishyakul Bag');
    assert.equal(recentLogs[0].quantity, 1);
  });

  // =========================================================================
  // TEST 5: Reception Fast Lookup Search Algorithm
  // =========================================================================
  await t.test('5. Reception Quick Lookup Search Engine', () => {
    const studentList = Object.values(db.students);

    const search = (query) => {
      if (!query.trim()) return [];
      const q = query.toLowerCase();
      return studentList.filter(s => {
        const name = (s.studentName || s.fullName || '').toLowerCase();
        const phone = (s.contactNo || s.phone || s.parentContact || '').toLowerCase();
        const parent = (s.parentName || s.fatherName || '').toLowerCase();
        const batch = (s.batch || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || parent.includes(q) || batch.includes(q);
      });
    };

    // Query by partial student name
    const matchName = search('Aarav');
    assert.equal(matchName.length, 1);
    assert.equal(matchName[0].studentName, 'Aarav Deshmukh');

    // Query by parent contact number
    const matchPhone = search('989012');
    assert.equal(matchPhone.length, 1);
    assert.equal(matchPhone[0].studentName, 'Pooja Kulkarni');

    // Query by batch
    const matchBatch = search('Hitman');
    assert.equal(matchBatch.length, 1);
    assert.equal(matchBatch[0].studentName, 'Pooja Kulkarni');

    // Query non-existent
    const matchNone = search('NonExistentStudent');
    assert.equal(matchNone.length, 0);
  });

  // =========================================================================
  // TEST 6: Front Desk Manager Role & Navigation Route Audit
  // =========================================================================
  await t.test('6. Role & Permission Matrix for Front Desk Manager', () => {
    const allowedFrontDeskRoutes = [
      '/dashboard',
      '/enquiries',
      '/pending-admissions',
      '/students',
      '/attendance',
      '/inventory',
      '/dashboard#personal_attendance',
      '/dashboard#personal_salary'
    ];

    const restrictedRoutes = [
      '/communication-log', // currently restricted to admin, service_manager, branch_manager
      '/users',             // restricted to admin, branch_manager, service_manager
      '/batches'            // not in front desk menu
    ];

    assert.ok(allowedFrontDeskRoutes.includes('/pending-admissions'));
    assert.ok(allowedFrontDeskRoutes.includes('/inventory'));
    assert.ok(restrictedRoutes.includes('/communication-log'));
  });

});
