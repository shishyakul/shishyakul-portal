// We will dynamically import firebase-admin inside the handler 
// to prevent Vercel cold-start ESM crashes and catch any import errors.
let adminApp;
let adminAuth;
let adminDb;

async function getAdminApp() {
  if (adminApp) return { adminApp, adminAuth, adminDb };

  // Dynamic imports bypass the Vercel ESM jose bug during the build phase
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (getApps().length === 0) {
    adminApp = initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    adminApp = getApps()[0];
  }

  adminAuth = getAuth;
  adminDb = getFirestore(adminApp);

  return { adminApp, adminAuth, adminDb };
}

export default async function handler(req, res) {
  try {
    const { adminAuth, adminDb } = await getAdminApp();
    const auth = adminAuth();

    // 1. Verify Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const adminUid = decodedToken.uid;

    // 2. Verify Caller is Admin in Firestore
    const adminDoc = await adminDb.collection('users').doc(adminUid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // 3. Handle Actions
    const targetUid = req.query.uid;
    if (!targetUid) {
      return res.status(400).json({ error: 'Missing target uid' });
    }

    if (req.method === 'DELETE') {
      await auth.deleteUser(targetUid);
      return res.status(200).json({ success: true, message: 'User deleted from Firebase Auth' });
    } 
    
    if (req.method === 'POST') {
      const { password, email } = req.body || {};
      const updates = {};
      if (password) updates.password = password;
      if (email) updates.email = email;
      
      if (Object.keys(updates).length > 0) {
        await auth.updateUser(targetUid, updates);
      }
      return res.status(200).json({ success: true, message: 'User updated in Firebase Auth' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[/api/manage-user] Error:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
}
