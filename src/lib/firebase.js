import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyAXjE7dUHCcshpfwjCuvIctG7Uiv1G07mU",
    authDomain: "productivity24plus.firebaseapp.com",
    projectId: "productivity24plus",
    storageBucket: "productivity24plus.firebasestorage.app",
    messagingSenderId: "150792956068",
    appId: "1:150792956068:web:eb3522902180393fc5de31",
    measurementId: "G-81VJRT3VHJ"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics safely (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
    isSupported().then(supported => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });
}

export { app, auth, db, analytics };
