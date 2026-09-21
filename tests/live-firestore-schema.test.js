import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

describe('Live Firestore Collections & Cross-Portal Schema Verification', () => {
  let db;

  before(() => {
    // Read service account from shishyakul-react/.env if available
    const reactEnvPath = path.resolve('../shishyakul-react/.env');
    let clientEmail, privateKey, projectId;

    if (fs.existsSync(reactEnvPath)) {
      const content = fs.readFileSync(reactEnvPath, 'utf8');
      content.split('\n').forEach(line => {
        if (line.startsWith('FIREBASE_PROJECT_ID=')) projectId = line.split('=')[1].trim();
        if (line.startsWith('FIREBASE_CLIENT_EMAIL=')) clientEmail = line.split('=')[1].trim();
        if (line.startsWith('FIREBASE_PRIVATE_KEY=')) {
          privateKey = line.substring('FIREBASE_PRIVATE_KEY='.length).trim().replace(/\\n/g, '\n');
        }
      });
    }

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase Admin credentials not found, skipping live DB checks.');
      return;
    }

    const app = getApps().length === 0 ? initializeApp({
      credential: cert({ projectId, clientEmail, privateKey })
    }, 'test-admin-app') : getApps()[0];

    db = getFirestore(app);
  });

  it('verifies Master Timetable doc exists with valid schedule object', async (t) => {
    if (!db) return t.skip('No live DB credentials');
    const masterSnap = await db.collection('timetables').doc('master').get();
    assert.equal(masterSnap.exists, true, 'timetables/master document should exist');
    const data = masterSnap.data();
    assert.equal(typeof data.schedule, 'object', 'schedule should be an object');
  });

  it('verifies students collection has valid records with required identity fields', async (t) => {
    if (!db) return t.skip('No live DB credentials');
    const snap = await db.collection('students').limit(5).get();
    assert.equal(snap.empty, false, 'students collection should contain documents');

    snap.docs.forEach(d => {
      const data = d.data();
      assert.ok(data.studentName || data.name || data.fullName, `Student ${d.id} should have a name`);
      assert.ok(data.status, `Student ${d.id} should have a status`);
    });
  });

  it('verifies test_marks collection structure matches Teacher & Student portal contracts', async (t) => {
    if (!db) return t.skip('No live DB credentials');
    const snap = await db.collection('test_marks').limit(5).get();
    if (!snap.empty) {
      snap.docs.forEach(d => {
        const data = d.data();
        assert.ok(data.batch, `test_mark ${d.id} should have a batch`);
        assert.ok(data.subject, `test_mark ${d.id} should have a subject`);
        assert.ok(Array.isArray(data.results), `test_mark ${d.id} should have results array`);
      });
    }
  });

  it('verifies submissions collection has valid student submission schema', async (t) => {
    if (!db) return t.skip('No live DB credentials');
    const snap = await db.collection('submissions').limit(5).get();
    if (!snap.empty) {
      snap.docs.forEach(d => {
        const data = d.data();
        assert.ok(data.studentName || data.studentId, `Submission ${d.id} should have student identifier`);
        assert.equal(typeof data.graded, 'boolean', `Submission ${d.id} graded must be boolean`);
      });
    }
  });

  it('verifies student_communications collection supports direct advisories', async (t) => {
    if (!db) return t.skip('No live DB credentials');
    const snap = await db.collection('student_communications').limit(5).get();
    if (!snap.empty) {
      snap.docs.forEach(d => {
        const data = d.data();
        assert.ok(data.message, `Communication ${d.id} must have a message`);
        assert.ok(data.teacherName, `Communication ${d.id} must have a teacherName`);
        assert.equal(typeof data.readByStudent, 'boolean', `readByStudent must be boolean`);
      });
    }
  });
});
