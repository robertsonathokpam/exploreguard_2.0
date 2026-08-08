import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// this is firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyClAcWhrB67Nu02sPg2JTK2hrwIj7abIrQ",
  authDomain: "exploreguard-8f37b.firebaseapp.com",
  projectId: "exploreguard-8f37b",
  storageBucket: "exploreguard-8f37b.firebasestorage.app",
  messagingSenderId: "217117232188",
  appId: "1:217117232188:web:341eb2dee19d205f75c739"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
