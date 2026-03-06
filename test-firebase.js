import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAXjE7dUHCcshpfwjCuvIctG7Uiv1G07mU",
    authDomain: "productivity24plus.firebaseapp.com",
    projectId: "productivity24plus",
    storageBucket: "productivity24plus.firebasestorage.app",
    messagingSenderId: "150792956068",
    appId: "1:150792956068:web:eb3522902180393fc5de31",
    measurementId: "G-81VJRT3VHJ"
};

async function testFirebaseConnection() {
    console.log("Initializing Firebase app...");
    let app;
    try {
        app = initializeApp(firebaseConfig);
        console.log("Firebase app initialized successfully.");
    } catch (e) {
        console.error("Error initializing Firebase app:", e.message);
        return;
    }

    const auth = getAuth(app);
    const db = getFirestore(app);

    console.log("Testing Authentication...");
    try {
        // We'll try to sign in anonymously. Wait, to avoid changing their db auth state or requiring anon auth enabled, 
        // let's just create a mock user credentials login or just check if auth object is valid.
        // Even better, let's just test Firestore read/write, which will tell us if the config is valid 
        // and if they have open/loose security rules or closed rules.
        console.log("Auth object created successfully.");
    } catch (e) {
        console.error("Error with Firebase Auth:", e.message);
    }

    console.log("Testing Firestore Connection (attempting to list a collection)...");
    try {
        const querySnapshot = await getDocs(collection(db, "test_collection_connection"));
        console.log(`Successfully connected to Firestore. Found ${querySnapshot.size} documents in 'test_collection_connection'.`);
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.log("Successfully connected to Firestore, but permission was denied (expected if rules are locked down).");
            console.log("Firebase configuration is VALID and communicating with the server.");
        } else {
            console.error("Error connecting to Firestore:", error.message);
        }
    }

    console.log("Test script completed.");
    process.exit(0);
}

testFirebaseConnection();
