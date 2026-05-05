import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDhif8EzLS6N385kE9bKYPq2Cm6Fs9h09M",
  authDomain: "restaurant-discovery-a8e8e.firebaseapp.com",
  projectId: "restaurant-discovery-a8e8e",
  storageBucket: "restaurant-discovery-a8e8e.firebasestorage.app",
  messagingSenderId: "1025755946694",
  appId: "1:1025755946694:web:0ad535c7c3e7e328fa41c7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
