// Auth Context — manages Firebase user session across the whole portal
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);  // Firebase user object
  const [profile, setProfile] = useState(null);  // Firestore user profile (role, name)
  const [loading, setLoading] = useState(true);  // true while checking auth state

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch role + profile from Firestore users collection
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            setProfile(snap.data());
          } else {
            // User exists in Auth but not in Firestore yet — create a minimal profile
            setProfile({ role: 'unknown', fullName: firebaseUser.email });
          }
        } catch {
          setProfile({ role: 'unknown', fullName: firebaseUser.email });
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    window.location.href = 'https://shishyakul.in/login';
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
