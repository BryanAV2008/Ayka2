// Utilidades de seguridad compartidas por la tienda, "Mi cuenta" y el panel de administración.

// Convierte texto en texto "seguro" para insertarlo dentro de HTML.
// Evita que un nombre como <img onerror=...> se ejecute como código (ataque XSS).
export function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Solo aceptamos imágenes alojadas en Cloudinary por HTTPS.
// Cualquier otra cosa se reemplaza por el logo, para no cargar contenido de sitios desconocidos.
export function urlImagenSegura(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && u.hostname === "res.cloudinary.com") return u.href;
  } catch (error) {
    /* url inválida: se usa la imagen de respaldo */
  }
  return "images/logo-ayka.jpeg";
}

// Convierte un número local ecuatoriano (0963309405) al formato internacional que pide WhatsApp (593963309405).
export function telefonoInternacional(numero) {
  const digitos = String(numero ?? "").replace(/\D/g, "");
  if (digitos.startsWith("593")) return digitos;
  return "593" + digitos.replace(/^0+/, "");
}

// Anuncia un mensaje a lectores de pantalla (región "aria-live" invisible).
export function anunciar(texto) {
  const el = document.getElementById("anuncios");
  if (!el) return;
  el.textContent = "";
  setTimeout(() => { el.textContent = texto; }, 50);
}
