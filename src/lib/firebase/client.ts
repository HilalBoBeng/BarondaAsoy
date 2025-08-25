// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDljoxNYy89XKp6KRVsE4ZqG-vgB8mImMg",
  authDomain: "siskamling-digital.firebaseapp.com",
  databaseURL: "https://siskamling-digital-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "siskamling-digital",
  storageBucket: "siskamling-digital.appspot.com",
  messagingSenderId: "535657236086",
  appId: "1:535657236086:web:be5551248f2cd826cf4157"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
