import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  arrayUnion,
  query,
  where,
  orderBy,
  limit,
  addDoc
} from "firebase/firestore";

import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Authentication Providers
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

/**
 * Trigger robust Google sign-in.
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Persist a high-level user document
    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || "Anonymous Detective",
      photoURL: user.photoURL || "",
      gamesPlayed: 0,
      gamesWon: 0,
      detectiveWins: 0,
      imposterWins: 0,
      lastActive: Date.now()
    }, { merge: true });
    
    return user;
  } catch (error: any) {
    console.error("Google login failed, attempting fallback:", error);
    throw error;
  }
}

/**
 * Sign in as Guest with temporary username.
 */
export async function signInAsGuest(nickname: string): Promise<User> {
  try {
    const credential = await signInAnonymously(auth);
    const user = credential.user;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      displayName: nickname,
      photoURL: "",
      gamesPlayed: 0,
      gamesWon: 0,
      detectiveWins: 0,
      imposterWins: 0,
      lastActive: Date.now(),
      isGuest: true
    }, { merge: true });
    
    return user;
  } catch (error) {
    console.error("Guest login failed:", error);
    throw error;
  }
}

/**
 * Sign out of current session.
 */
export async function logOut() {
  await signOut(auth);
}

export { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc,
  onAuthStateChanged 
};
