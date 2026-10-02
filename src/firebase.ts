import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCeSaYQeX-cXaA-SDwCiRwJ2-5EM24glmQ",
  authDomain: "bill-month.firebaseapp.com",
  projectId: "bill-month",
  storageBucket: "bill-month.firebasestorage.app",
  messagingSenderId: "170851608233",
  appId: "1:170851608233:web:e8236c89c47da4cf6d2bb8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);