export { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
export {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
export {
  initializeFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
