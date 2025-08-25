// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "TODO: YOUR_API_KEY",
  authDomain: "TODO: YOUR_AUTH_DOMAIN",
  projectId: "TODO: YOUR_PROJECT_ID",
  storageBucket: "TODO: YOUR_STORAGE_BUCKET",
  messagingSenderId: "TODO: YOUR_MESSAGING_SENDER_ID",
  appId: "TODO: YOUR_APP_ID"
};

// Initialize Firebase
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
}

export { app };
