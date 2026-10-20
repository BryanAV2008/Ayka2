import { auth, signInWithEmailAndPassword, sendPasswordResetEmail } from "./firebase-config.js";

const form = document.getElementById("form-ingreso");
const mensajeError = document.getElementById("mensaje-error");

const errores = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "Ese correo no es válido.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
};

// Recuperar contraseña: Firebase envía un correo con un enlace para crear una nueva.
// El mensaje es siempre el mismo exista o no la cuenta, para que nadie pueda
// averiguar qué correos están registrados.
document.getElementById("olvide-contrasena").addEventListener("click", async () => {
  mensajeError.className = "mensaje-error";
  mensajeError.textContent = "";
  const correo = document.getElementById("correo").value.trim().toLowerCase();
  if (!correo) {
    mensajeError.textContent = "Escribe primero tu correo en el campo de arriba y vuelve a tocar “¿Olvidaste tu contraseña?”.";
    document.getElementById("correo").focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, correo);
  } catch (error) {
    if (error.code === "auth/invalid-email") {
      mensajeError.textContent = "Ese correo no es válido.";
      return;
    }
    console.error(error);
  }
  mensajeError.className = "mensaje-exito";
  mensajeError.textContent = "Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.";
});

form.addEventListener("submit", async (e) => {
  mensajeError.className = "mensaje-error";
  e.preventDefault();
  mensajeError.textContent = "";

  const correo = document.getElementById("correo").value.trim().toLowerCase();
  const contrasena = document.getElementById("contrasena").value;

  try {
    await signInWithEmailAndPassword(auth, correo, contrasena);
    window.location.href = "mi-cuenta.html";
  } catch (error) {
    mensajeError.textContent = errores[error.code] || "No se pudo iniciar sesión. Intenta de nuevo.";
  }
});
