// Auth Context — manages Firebase user session across the whole portal
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);  // Firebase user object
  const [profile, setProfile] = useState(null);  // Firestore user profile (role, name)
  const [loading, setLoading] = useState(true);  // true while checking auth state

  useEffect(() => {
    // Real Firebase Auth listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      let profileUnsubscribe = null;

      if (firebaseUser) {
        setUser(firebaseUser);
        // Real-time listener for role + profile from Firestore
        profileUnsubscribe = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setProfile(snap.data());
            } else {
              setProfile({ role: 'unknown', fullName: firebaseUser.email });
            }
          },
          (err) => {
            console.error('Failed to listen to profile:', err);
            setProfile({ role: 'unknown', fullName: firebaseUser.email });
          }
        );
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
      
      return () => {
        if (profileUnsubscribe) profileUnsubscribe();
      };
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    window.location.href = window.location.hostname === 'localhost'
      ? 'http://localhost:5173/login'
      : 'https://shishyakul.in/login';
  };

  const switchTestUser = (roleData) => {
    setUser({ uid: `test-${roleData.role}`, email: roleData.email });
    setProfile({ role: roleData.role, fullName: roleData.name });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, switchTestUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
