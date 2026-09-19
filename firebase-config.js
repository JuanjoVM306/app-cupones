import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, onSnapshot, query, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Contraseña de Admin Sensible a Mayúsculas/Minúsculas
const ADMIN_PASS = "Todoroki03";

// Exportar objetos globales para app.js
window.db = db;
window.ADMIN_PASS = ADMIN_PASS;
window.fs = { 
  doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, onSnapshot, query, where 
};
