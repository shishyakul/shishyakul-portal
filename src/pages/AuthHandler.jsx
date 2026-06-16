// Token Auth page — receives ?token= from shishyakul.in/login
// Calls signInWithCustomToken, then redirects to /dashboard
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function AuthHandler() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const token   = params.get('token');

    // In React Strict Mode, useEffect runs twice. If we remove the token from the URL 
    // on the first run, the second run will fail and briefly show an error before 
    // the first run successfully navigates to the dashboard.
    // We don't need to clean the URL because we navigate away to /dashboard anyway.

    if (!token) {
      setError('No authentication token found. Please log in again.');
      return;
    }

    (async () => {
      try {
        const cred = await signInWithCustomToken(auth, token);
        const uid  = cred.user.uid;

        // Ensure user document exists in Firestore
        const userRef  = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // First time — create a basic profile. Admin sets role manually.
          await setDoc(userRef, {
            email:     cred.user.email,
            fullName:  cred.user.displayName || cred.user.email,
            role:      'admin', // Default to admin for now — will be role-based later
            createdAt: serverTimestamp(),
          });
        }

        const data = userSnap.exists() ? userSnap.data() : { role: 'admin' };

        // Route to dashboard (Dashboard.jsx will handle role-based rendering)
        navigate('/dashboard', { replace: true });

      } catch (err) {
        console.error('Auth error:', err);
        setError('Authentication failed or link expired. Please log in again.');
      }
    })();
  }, [navigate]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--surface-bg)', color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)', textAlign: 'center', padding: 24,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--status-error)' }}>
          error
        </span>
        <p style={{ fontSize: 16, color: 'var(--status-error)' }}>{error}</p>
        <a
          href="https://shishyakul.in/login"
          style={{
            padding: '10px 24px', borderRadius: 12,
            background: 'var(--brand-primary)', color: '#1a0e00',
            fontWeight: 700, fontSize: 14,
          }}
        >
          Back to Login
        </a>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'var(--surface-bg)',
    }}>
      <div style={{
        width: 48, height: 48,
        border: '3px solid rgba(253,180,42,0.2)',
        borderTopColor: 'var(--brand-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
        Authenticating…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
