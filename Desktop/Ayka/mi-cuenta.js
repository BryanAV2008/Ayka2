import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "./firebase-config.js";
import { escaparHtml, urlImagenSegura, anunciar } from "./utils.js";

let uidActual = null;
let usuarioActual = null;

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    window.location.href = "ingresar.html";
    return;
  }
  usuarioActual = usuario;
  uidActual = usuario.uid;
  await cargarDatos(usuario);
  cargarFavoritos();
  cargarPedidos();
});

document.getElementById("cerrar-sesion").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

/* ---------- Pestañas ---------- */
document.querySelectorAll(".admin-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((b) => {
      b.classList.remove("activo");
      b.setAttribute("aria-pressed", "false");
    });
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("activo"));
    btn.classList.add("activo");
    btn.setAttribute("aria-pressed", "true");
    document.getElementById(btn.dataset.panel).classList.add("activo");
  });
});

/* ---------- Mis datos ---------- */
async function cargarDatos(usuario) {
  const refCliente = doc(db, "clientes", uidActual);
  let snap = await getDoc(refCliente);

  if (!snap.exists() || snap.data().nombre === undefined) {
    // Cuenta sin perfil de cliente todavía (ej. un admin entrando aquí): se crea vacío.
    await setDoc(refCliente, { nombre: "", telefono: "", correo: usuario.email, creado: Date.now() }, { merge: true });
    snap = await getDoc(refCliente);
  }

  const datos = snap.data();
  document.getElementById("nombre").value = datos.nombre || "";
  document.getElementById("telefono").value = datos.telefono || "";
}

document.getElementById("form-datos").addEventListener("submit", async (e) => {
  e.preventDefault();
  const mensaje = document.getElementById("mensaje-datos");
  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("telefono").value.trim();

  mensaje.className = "mensaje-error";
  if (nombre.length < 2 || nombre.length > 100) {
    mensaje.textContent = "Escribe tu nombre (entre 2 y 100 caracteres).";
    return;
  }
  if (!/^[0-9+()\s-]{7,20}$/.test(telefono)) {
    mensaje.textContent = "Escribe un teléfono válido, solo con números.";
    return;
  }

  try {
    await updateDoc(doc(db, "clientes", uidActual), { nombre, telefono });
    mensaje.className = "mensaje-exito";
    mensaje.textContent = "Datos guardados.";
  } catch (error) {
    console.error(error);
    mensaje.textContent = "No se pudo guardar. Intenta de nuevo.";
  }
});

/* ---------- Favoritos ---------- */
async function cargarFavoritos() {
  const grid = document.getElementById("grid-favoritos");
  grid.innerHTML = `<p class="cargando" role="status">Cargando...</p>`;

  const snapshot = await getDocs(collection(db, "clientes", uidActual, "favoritos"));
  if (snapshot.empty) {
    grid.innerHTML = `<p class="cargando">Todavía no tienes favoritos. Ve a la tienda y toca el corazón en un producto.</p>`;
    return;
  }

  const productos = await Promise.all(
    snapshot.docs.map(async (favorito) => {
      const snapProducto = await getDoc(doc(db, "productos", favorito.id));
      return snapProducto.exists() ? { id: favorito.id, ...snapProducto.data() } : null;
    })
  );

  grid.innerHTML = "";
  productos.filter(Boolean).forEach((p) => grid.appendChild(tarjetaFavorito(p)));
  if (!grid.children.length) {
    grid.innerHTML = `<p class="cargando">Los productos que guardaste ya no están disponibles.</p>`;
  }
}

function tarjetaFavorito(producto) {
  const nombre = escaparHtml(producto.nombre);
  const imagen = urlImagenSegura(producto.imagen);
  const article = document.createElement("article");
  article.className = "tarjeta-galeria";
  article.innerHTML = `
    <div class="tarjeta-imagen">
      <img src="${escaparHtml(imagen)}" alt="${nombre}" tabindex="0" role="button" aria-label="Ampliar foto de ${nombre}">
    </div>
    <div class="tarjeta-info">
      <h3>${nombre}</h3>
      <p>$${Number(producto.precio || 0).toFixed(2)}</p>
      <button class="btn-secundario" type="button">Quitar de favoritos<span class="solo-lectores">: ${nombre}</span></button>
    </div>
  `;
  const img = article.querySelector("img");
  const abrir = () => abrirImagen(imagen, producto.nombre);
  img.addEventListener("click", abrir);
  img.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      abrir();
    }
  });
  article.querySelector("button").addEventListener("click", async () => {
    await deleteDoc(doc(db, "clientes", uidActual, "favoritos", producto.id));
    anunciar(`${producto.nombre} se quitó de tus favoritos`);
    cargarFavoritos();
  });
  return article;
}

/* ---------- Mis pedidos ---------- */
const NOMBRES_METODO = {
  "transferencia-guayaquil": "Transferencia · Banco Guayaquil",
  "transferencia-pichincha": "Transferencia · Banco Pichincha",
  "transferencia-internacional": "Transferencia · Banco Internacional",
  transferencia: "Transferencia bancaria",
  tarjeta: "Tarjeta (link de PayPhone)",
  "coordinar-whatsapp": "Coordinado por WhatsApp",
};

async function cargarPedidos() {
  const contenedor = document.getElementById("lista-pedidos");
  contenedor.innerHTML = `<p class="cargando" role="status">Cargando...</p>`;

  const q = query(collection(db, "clientes", uidActual, "pedidos"), orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    contenedor.innerHTML = `<p class="cargando">Todavía no tienes pedidos.</p>`;
    return;
  }

  contenedor.innerHTML = "";
  snapshot.docs.forEach((d) => {
    const pedido = d.data();
    const fecha = new Date(pedido.fecha).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });
    const items = Array.isArray(pedido.items) ? pedido.items : [];
    const total = Number(pedido.total) || 0;
    const metodo = NOMBRES_METODO[pedido.metodo];

    const div = document.createElement("div");
    div.className = "formulario-producto";
    div.style.display = "block";
    div.innerHTML = `
      <p style="margin:0 0 8px; color:var(--color-text-suave); font-size:0.82rem;">
        ${escaparHtml(fecha)}${pedido.referencia ? ` · Ref. ${escaparHtml(pedido.referencia)}` : ""}
      </p>
      <ul style="margin:0 0 10px; padding-left:18px;">
        ${items.map((i) => `<li>${escaparHtml(i.nombre)} x${Number(i.cantidad) || 1} — $${((Number(i.precio) || 0) * (Number(i.cantidad) || 1)).toFixed(2)}</li>`).join("")}
      </ul>
      <p style="margin:0; font-family:var(--fuente-display); font-size:1.1rem;">Total: $${total.toFixed(2)}</p>
      ${metodo ? `<p style="margin:6px 0 0; font-size:0.85rem; color:var(--color-text-suave);">${escaparHtml(metodo)} · pedido enviado por WhatsApp, pendiente de confirmación</p>` : ""}
    `;
    contenedor.appendChild(div);
  });
}

/* ---------- Descargar mis datos (derecho de acceso y portabilidad) ---------- */
document.getElementById("descargar-datos").addEventListener("click", async () => {
  try {
    const perfil = (await getDoc(doc(db, "clientes", uidActual))).data() || {};
    const favoritos = (await getDocs(collection(db, "clientes", uidActual, "favoritos"))).docs.map((d) => ({ productoId: d.id, ...d.data() }));
    const pedidos = (await getDocs(collection(db, "clientes", uidActual, "pedidos"))).docs.map((d) => ({ id: d.id, ...d.data() }));

    const paquete = {
      descripcion: "Copia de los datos que Bisuterías Ayka guarda sobre ti",
      generado: new Date().toISOString(),
      cuenta: { correo: usuarioActual.email },
      perfil,
      favoritos,
      pedidos,
    };
    const blob = new Blob([JSON.stringify(paquete, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "mis-datos-bisuterias-ayka.json";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    anunciar("Se descargó la copia de tus datos");
  } catch (error) {
    console.error(error);
    anunciar("No se pudo descargar tus datos. Intenta de nuevo.");
  }
});

/* ---------- Eliminar mi cuenta (derecho de eliminación) ---------- */
async function borrarColeccion(nombre) {
  const snapshot = await getDocs(collection(db, "clientes", uidActual, nombre));
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

document.getElementById("form-eliminar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const mensaje = document.getElementById("mensaje-eliminar");
  const contrasena = document.getElementById("contrasena-eliminar").value;
  mensaje.className = "mensaje-error";
  mensaje.textContent = "";

  try {
    // 1) Si la persona también es Owner/Admin del panel, no se borra: dejaría el negocio sin acceso.
    try {
      const rol = await getDoc(doc(db, "usuarios", usuarioActual.email.toLowerCase()));
      if (rol.exists()) {
        mensaje.textContent = "Esta cuenta tiene un rol en el panel de administración. Pide al Owner que lo quite antes de eliminarla.";
        return;
      }
    } catch (errorPermiso) {
      // "permission-denied": no es admin, se puede continuar.
    }

    // 2) Confirmar identidad con la contraseña
    const credencial = EmailAuthProvider.credential(usuarioActual.email, contrasena);
    await reauthenticateWithCredential(usuarioActual, credencial);

    // 3) Borrar datos y luego la cuenta de acceso
    await borrarColeccion("favoritos");
    await borrarColeccion("pedidos");
    await deleteDoc(doc(db, "clientes", uidActual));
    try { localStorage.removeItem("ayka-carrito"); } catch (err) { /* nada */ }
    await deleteUser(usuarioActual);

    window.location.href = "index.html";
  } catch (error) {
    console.error(error);
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
      mensaje.textContent = "La contraseña no es correcta.";
    } else if (error.code === "auth/too-many-requests") {
      mensaje.textContent = "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    } else {
      mensaje.textContent = "No se pudo completar la eliminación. Si el problema continúa, escríbenos y lo resolvemos.";
    }
  }
});

/* ---------- Lightbox ---------- */
let focoAntes = null;
function abrirImagen(src, alt) {
  focoAntes = document.activeElement;
  document.getElementById("lightbox-imagen").src = src;
  document.getElementById("lightbox-imagen").alt = alt;
  document.getElementById("lightbox").classList.add("visible");
  requestAnimationFrame(() => document.getElementById("cerrar-lightbox").focus());
}
function cerrarImagen() {
  document.getElementById("lightbox").classList.remove("visible");
  if (focoAntes && typeof focoAntes.focus === "function") focoAntes.focus();
}
document.getElementById("cerrar-lightbox").addEventListener("click", cerrarImagen);
document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") cerrarImagen();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("lightbox").classList.contains("visible")) cerrarImagen();
});
