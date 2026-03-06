import {
    collection, addDoc, updateDoc, deleteDoc, doc,
    query, orderBy, onSnapshot, serverTimestamp, getDocs, getDoc, setDoc, where
} from 'firebase/firestore';
import { db } from './firebase';

// Get a reference to a user-scoped subcollection
const userCollection = (uid, collectionName) =>
    collection(db, 'users', uid, collectionName);

// Add a document to a user's subcollection
export const addDocument = async (uid, collectionName, data) => {
    const ref = await addDoc(userCollection(uid, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return ref.id;
};

// Update a document in a user's subcollection
export const updateDocument = async (uid, collectionName, docId, data) => {
    const ref = doc(db, 'users', uid, collectionName, docId);
    await updateDoc(ref, {
        ...data,
        updatedAt: serverTimestamp(),
    });
};

// Delete a document from a user's subcollection
export const deleteDocument = async (uid, collectionName, docId) => {
    const ref = doc(db, 'users', uid, collectionName, docId);
    await deleteDoc(ref);
};

// Subscribe to real-time updates with error handling
export const subscribeToCollection = (uid, collectionName, callback, orderField = 'createdAt') => {
    const q = query(
        userCollection(uid, collectionName),
        orderBy(orderField, 'desc')
    );
    return onSnapshot(q,
        (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            callback(docs);
        },
        (error) => {
            console.warn(`Firestore subscription error for ${collectionName}:`, error.code);
            // On permission-denied, return empty array instead of crashing
            callback([]);
        }
    );
};

// Get all documents from a user's subcollection (one-time read)
export const getDocuments = async (uid, collectionName) => {
    try {
        const q = query(userCollection(uid, collectionName), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.warn(`Firestore read error for ${collectionName}:`, error.code);
        return [];
    }
};

// Get or set a single user-level document (e.g., settings, skill analysis)
export const getUserDoc = async (uid, docPath) => {
    try {
        const ref = doc(db, 'users', uid, ...docPath.split('/'));
        const snap = await getDoc(ref);
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (error) {
        console.warn(`Firestore getUserDoc error for ${docPath}:`, error.code);
        return null;
    }
};

export const setUserDoc = async (uid, docPath, data) => {
    const ref = doc(db, 'users', uid, ...docPath.split('/'));
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
};

// Get activities for a specific date range
export const getActivitiesByDate = async (uid, startDate, endDate) => {
    try {
        const q = query(
            userCollection(uid, 'activities'),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.warn('Firestore getActivitiesByDate error:', error.code);
        return [];
    }
};
