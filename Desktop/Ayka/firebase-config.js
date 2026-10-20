// Configuración compartida de Firebase y Cloudinary para todo el sitio.
// Este archivo se importa como módulo (type="module") tanto en la página
// principal como en el panel de administración.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBc_0ay3Vs0UED_geaUEUtOL_R3JJk1eJI",
  authDomain: "ayka-bisuterias.firebaseapp.com",
  projectId: "ayka-bisuterias",
  storageBucket: "ayka-bisuterias.firebasestorage.app",
  messagingSenderId: "26416930939",
  appId: "1:26416930939:web:1d92ff1cb6da30e5b7c2de",
};

// App principal: se usa para todo el sitio y para la sesión de quien
// está usando el panel en este momento.
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// App secundaria: se usa SOLO para que el Owner pueda crear cuentas nuevas
// (admins) sin que eso cierre su propia sesión. Crear un usuario con el SDK
// de cliente inicia sesión automáticamente como ese usuario nuevo; al usar
// una segunda instancia de la app, ese login "de prueba" queda aislado y no
// afecta la sesión del Owner en la app principal.
export const appSecundaria = initializeApp(firebaseConfig, "secundaria");
export const authSecundaria = getAuth(appSecundaria);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
};

// ---------- Cloudinary (para subir fotos) ----------
export const CLOUDINARY_CLOUD_NAME = "e40ekbox";
export const CLOUDINARY_UPLOAD_PRESET = "ayka-productos";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO_MB = 8;

export async function subirFotoACloudinary(archivo) {
  if (!archivo || !TIPOS_PERMITIDOS.includes(archivo.type)) {
    throw new Error("Formato no permitido. Usa una foto JPG, PNG o WEBP.");
  }
  if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(`La foto pesa más de ${TAMANO_MAXIMO_MB} MB. Usa una más liviana.`);
  }
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", archivo);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const respuesta = await fetch(url, { method: "POST", body: formData });
  if (!respuesta.ok) {
    throw new Error("No se pudo subir la imagen a Cloudinary");
  }
  const datos = await respuesta.json();
  return datos.secure_url; // link público de la foto ya subida
}
