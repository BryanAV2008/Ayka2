import {
  auth,
  db,
  createUserWithEmailAndPassword,
  doc,
  setDoc,
} from "./firebase-config.js";

const form = document.getElementById("form-registro");
const mensajeError = document.getElementById("mensaje-error");

const errores = {
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión en su lugar.",
  "auth/invalid-email": "Ese correo no es válido.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  mensajeError.textContent = "";

  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const correo = document.getElementById("correo").value.trim().toLowerCase();
  const contrasena = document.getElementById("contrasena").value;

  // El consentimiento debe ser expreso: las casillas empiezan sin marcar.
  const mayorDeEdad = document.getElementById("mayor-edad").checked;
  const aceptaPrivacidad = document.getElementById("acepta-privacidad").checked;
  const aceptaTerminos = document.getElementById("acepta-terminos").checked;
  if (!mayorDeEdad || !aceptaPrivacidad || !aceptaTerminos) {
    mensajeError.textContent = "Para crear tu cuenta debes marcar las tres casillas de confirmación y aceptación.";
    return;
  }
  if (nombre.length < 2 || nombre.length > 100) {
    mensajeError.textContent = "Escribe tu nombre (entre 2 y 100 caracteres).";
    return;
  }
  if (!/^[0-9+()\s-]{7,20}$/.test(telefono)) {
    mensajeError.textContent = "Escribe un teléfono válido, solo con números.";
    return;
  }

  try {
    const credencial = await createUserWithEmailAndPassword(auth, correo, contrasena);
    await setDoc(doc(db, "clientes", credencial.user.uid), {
      nombre,
      telefono,
      correo,
      creado: Date.now(),
      // Prueba de consentimiento: qué versión de los textos aceptó y cuándo.
      aceptacion: {
        version: (window.NEGOCIO && window.NEGOCIO.versionLegal) || "2026-10-11",
        fecha: Date.now(),
        privacidad: true,
        terminos: true,
        mayorDeEdad: true,
      },
    });
    window.location.href = "mi-cuenta.html";
  } catch (error) {
    mensajeError.textContent = errores[error.code] || "No se pudo crear la cuenta. Intenta de nuevo.";
  }
});
