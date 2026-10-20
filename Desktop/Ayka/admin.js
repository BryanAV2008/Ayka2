import {
  auth,
  db,
  appSecundaria,
  authSecundaria,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  subirFotoACloudinary,
} from "./firebase-config.js";
import { escaparHtml, urlImagenSegura } from "./utils.js";

let usuarioActual = null;
let rolActual = null;
let todosLosProductos = [];
const cambiosPendientes = new Map(); // id del producto -> { precio, stock }

function marcarCambio(id, campo, valor) {
  const cambio = cambiosPendientes.get(id) || {};
  cambio[campo] = Number(valor);
  cambiosPendientes.set(id, cambio);
  actualizarBarraCambios();
}

function actualizarBarraCambios() {
  const barra = document.getElementById("barra-cambios");
  const texto = document.getElementById("texto-cambios");
  const total = cambiosPendientes.size;
  if (total === 0) {
    barra.classList.remove("visible");
    return;
  }
  barra.classList.add("visible");
  texto.textContent = total === 1 ? "Tienes 1 producto con cambios sin guardar" : `Tienes ${total} productos con cambios sin guardar`;
}

document.getElementById("guardar-cambios").addEventListener("click", async () => {
  const boton = document.getElementById("guardar-cambios");
  boton.disabled = true;
  boton.textContent = "Guardando...";
  try {
    await Promise.all(
      Array.from(cambiosPendientes.entries()).map(([id, cambio]) => updateDoc(doc(db, "productos", id), cambio))
    );
    cambiosPendientes.clear();
    actualizarBarraCambios();
    cargarProductos();
  } catch (error) {
    console.error(error);
    alert("No se pudieron guardar algunos cambios. Intenta de nuevo.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Guardar cambios";
  }
});

document.getElementById("cancelar-cambios").addEventListener("click", () => {
  cambiosPendientes.clear();
  actualizarBarraCambios();
  const filtroActivo = document.querySelector("#filtro-apartado .filtro.activo")?.dataset.apartado || "todos";
  pintarTablaProductos(filtroActivo); // vuelve a pintar con los valores originales, sin lo escrito
});

/* ---------- Guardia de acceso ---------- */
onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    window.location.href = "login.html";
    return;
  }

  const correo = usuario.email.toLowerCase();
  const refUsuario = doc(db, "usuarios", correo);
  let snap;
  try {
    snap = await getDoc(refUsuario);
  } catch (error) {
    // Una cuenta sin rol recibe "permission-denied": se trata igual que "no es admin".
    snap = { exists: () => false };
  }

  if (!snap.exists()) {
    alert("Tu cuenta no tiene permisos de administrador. Contacta al dueño de la tienda.");
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }

  usuarioActual = usuario;
  rolActual = snap.data().rol; // "owner" o "admin"

  document.getElementById("correo-actual").textContent = correo;
  document.getElementById("rol-actual").textContent = rolActual === "owner" ? "Owner" : "Admin";

  if (rolActual === "owner") {
    document.querySelectorAll(".admin-solo-owner").forEach((el) => (el.style.display = ""));
  }

  iniciarPanel();
});

document.getElementById("cerrar-sesion").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

/* ---------- Pestañas ---------- */
document.querySelectorAll(".admin-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("activo"));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("activo"));
    btn.classList.add("activo");
    document.getElementById(btn.dataset.panel).classList.add("activo");
    if (btn.dataset.panel === "panel-estadisticas") pintarEstadisticas();
    if (btn.dataset.panel === "panel-equipo") cargarEquipo();
  });
});

function iniciarPanel() {
  cargarProductos();
  configurarFormularioProducto();
  configurarFormularioAdmin();
}

/* ---------- Mostrar/ocultar campos según el apartado elegido ---------- */
document.getElementById("p-apartado").addEventListener("change", (e) => {
  const apartado = e.target.value;
  document.getElementById("campo-categoria").style.display = apartado === "coleccion" ? "" : "none";
  document.getElementById("campo-precio").style.display = apartado === "decoracion" ? "none" : "";
  document.getElementById("campo-stock").style.display = apartado === "coleccion" ? "" : "none";
  document.getElementById("campo-descripcion").style.display = apartado === "coleccion" ? "none" : "";
});

/* ---------- Guardar producto nuevo ---------- */
function configurarFormularioProducto() {
  const form = document.getElementById("form-producto");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById("mensaje-producto");
    const boton = document.getElementById("btn-guardar-producto");
    mensaje.textContent = "";
    mensaje.className = "mensaje-error";

    const archivo = document.getElementById("p-foto").files[0];
    if (!archivo) {
      mensaje.textContent = "Selecciona una foto.";
      return;
    }

    boton.disabled = true;
    boton.textContent = "Subiendo foto...";

    try {
      const urlFoto = await subirFotoACloudinary(archivo);

      const apartado = document.getElementById("p-apartado").value;
      const datos = {
        apartado,
        nombre: document.getElementById("p-nombre").value.trim(),
        imagen: urlFoto,
        cotizados: 0,
        vendidos: 0,
        creado: Date.now(),
      };

      if (apartado === "coleccion") {
        datos.categoria = document.getElementById("p-categoria").value;
        datos.precio = Number(document.getElementById("p-precio").value || 0);
        datos.stock = Number(document.getElementById("p-stock").value || 0);
      } else {
        datos.descripcion = document.getElementById("p-descripcion").value.trim();
        if (apartado === "personalizados") {
          datos.precio = Number(document.getElementById("p-precio").value || 0);
        }
      }

      await addDoc(collection(db, "productos"), datos);

      mensaje.className = "mensaje-exito";
      mensaje.textContent = "¡Producto guardado!";
      form.reset();
      document.getElementById("p-apartado").dispatchEvent(new Event("change"));
      cargarProductos();
    } catch (error) {
      console.error(error);
      mensaje.textContent = error && /^(Formato|La foto)/.test(error.message) ? error.message : "Ocurrió un error al guardar. Intenta de nuevo.";
    } finally {
      boton.disabled = false;
      boton.textContent = "Guardar producto";
    }
  });
}

/* ---------- Listar y editar productos ---------- */
async function cargarProductos() {
  const cuerpo = document.getElementById("cuerpo-tabla-productos");
  cuerpo.innerHTML = `<tr><td colspan="8">Cargando...</td></tr>`;

  const snapshot = await getDocs(collection(db, "productos"));
  todosLosProductos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  const filtroActivo = document.querySelector("#filtro-apartado .filtro.activo")?.dataset.apartado || "todos";
  pintarTablaProductos(filtroActivo);
}

function pintarTablaProductos(apartado) {
  const cuerpo = document.getElementById("cuerpo-tabla-productos");
  const lista = apartado === "todos" ? todosLosProductos : todosLosProductos.filter((p) => p.apartado === apartado);

  if (lista.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="8">No hay productos en este apartado.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = "";
  lista.forEach((p) => cuerpo.appendChild(filaProducto(p)));
}

document.getElementById("filtro-apartado").addEventListener("click", (e) => {
  const boton = e.target.closest(".filtro");
  if (!boton) return;
  document.querySelectorAll("#filtro-apartado .filtro").forEach((b) => b.classList.remove("activo"));
  boton.classList.add("activo");
  pintarTablaProductos(boton.dataset.apartado);
});

function filaProducto(p) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><img src="${escaparHtml(urlImagenSegura(p.imagen))}" alt="${escaparHtml(p.nombre)}"></td>
    <td>${escaparHtml(p.nombre)}</td>
    <td>${escaparHtml(p.apartado)}${p.categoria ? " · " + escaparHtml(p.categoria) : ""}</td>
    <td>${p.precio !== undefined ? `<input type="number" step="0.01" min="0" value="${Number(p.precio) || 0}" data-campo="precio" aria-label="Precio de ${escaparHtml(p.nombre)}">` : "—"}</td>
    <td>${p.apartado === "coleccion" ? `<input type="number" step="1" min="0" value="${Number(p.stock) || 0}" data-campo="stock" aria-label="Stock de ${escaparHtml(p.nombre)}">` : "—"}</td>
    <td>${Number(p.cotizados) || 0}</td>
    <td>${Number(p.vendidos) || 0}</td>
    <td class="fila-acciones">
      <button class="boton-mini" type="button" data-accion="restar-cotizado" title="Restar una cotización">−1 cotizado<span class="solo-lectores">: ${escaparHtml(p.nombre)}</span></button>
      <button class="boton-mini" type="button" data-accion="vender">+1 vendido<span class="solo-lectores">: ${escaparHtml(p.nombre)}</span></button>
      <button class="boton-mini" type="button" data-accion="restar-vendido" title="Restar una venta">−1 vendido<span class="solo-lectores">: ${escaparHtml(p.nombre)}</span></button>
      <button class="boton-mini peligro" type="button" data-accion="eliminar">Eliminar<span class="solo-lectores">: ${escaparHtml(p.nombre)}</span></button>
    </td>
  `;

  tr.querySelectorAll("[data-campo]").forEach((input) => {
    input.addEventListener("input", () => marcarCambio(p.id, input.dataset.campo, input.value));
  });

  tr.querySelector('[data-accion="vender"]').addEventListener("click", async () => {
    await updateDoc(doc(db, "productos", p.id), { vendidos: increment(1) });
    cargarProductos();
  });

  tr.querySelector('[data-accion="restar-vendido"]').addEventListener("click", async () => {
    if ((p.vendidos || 0) <= 0) return;
    await updateDoc(doc(db, "productos", p.id), { vendidos: increment(-1) });
    cargarProductos();
  });

  tr.querySelector('[data-accion="restar-cotizado"]').addEventListener("click", async () => {
    if ((p.cotizados || 0) <= 0) return;
    await updateDoc(doc(db, "productos", p.id), { cotizados: increment(-1) });
    cargarProductos();
  });

  tr.querySelector('[data-accion="eliminar"]').addEventListener("click", () => {
    mostrarConfirmacion(`¿Eliminar "${p.nombre}"? Esto no se puede deshacer.`, async () => {
      await deleteDoc(doc(db, "productos", p.id));
      cargarProductos();
    });
  });

  return tr;
}

/* ---------- Estadísticas ---------- */
function pintarEstadisticas() {
  const totalCotizados = todosLosProductos.reduce((s, p) => s + (p.cotizados || 0), 0);
  const totalVendidos = todosLosProductos.reduce((s, p) => s + (p.vendidos || 0), 0);

  document.getElementById("total-cotizados").textContent = totalCotizados;
  document.getElementById("total-vendidos").textContent = totalVendidos;
  document.getElementById("total-productos").textContent = todosLosProductos.length;

  const cuerpo = document.getElementById("cuerpo-tabla-estadisticas");
  cuerpo.innerHTML = "";
  todosLosProductos
    .slice()
    .sort((a, b) => (b.cotizados || 0) - (a.cotizados || 0))
    .forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escaparHtml(p.nombre)}</td><td>${Number(p.cotizados) || 0}</td><td>${Number(p.vendidos) || 0}</td>`;
      cuerpo.appendChild(tr);
    });
}

/* ---------- Equipo (solo Owner) ---------- */
function configurarFormularioAdmin() {
  const form = document.getElementById("form-admin");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById("mensaje-admin");
    mensaje.textContent = "";
    mensaje.className = "mensaje-error";

    const correo = document.getElementById("a-correo").value.trim().toLowerCase();
    const contrasena = document.getElementById("a-contrasena").value;

    try {
      // Se usa la app SECUNDARIA para que esto no cierre la sesión del Owner
      await createUserWithEmailAndPassword(authSecundaria, correo, contrasena);
      await setDoc(doc(db, "usuarios", correo), { rol: "admin", creado: Date.now() });
      await signOut(authSecundaria);

      mensaje.className = "mensaje-exito";
      mensaje.textContent = "Cuenta de administrador creada.";
      form.reset();
      cargarEquipo();
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        // El correo ya tiene una cuenta de acceso (quizás se le quitó el rol antes).
        // Revisamos si ya tiene un rol asignado; si no, se lo devolvemos sin
        // tocar su contraseña actual.
        const refUsuario = doc(db, "usuarios", correo);
        const snapExistente = await getDoc(refUsuario);
        if (snapExistente.exists()) {
          mensaje.textContent = `Ese correo ya es ${snapExistente.data().rol === "owner" ? "Owner" : "administrador"}.`;
        } else {
          await setDoc(refUsuario, { rol: "admin", creado: Date.now() });
          mensaje.className = "mensaje-exito";
          mensaje.textContent = "Ese correo ya tenía cuenta, así que solo se le devolvió el acceso (su contraseña anterior sigue funcionando, no la que escribiste aquí).";
          form.reset();
          cargarEquipo();
        }
      } else if (error.code === "auth/weak-password") {
        mensaje.textContent = "La contraseña debe tener al menos 6 caracteres.";
      } else {
        console.error(error);
        mensaje.textContent = "No se pudo crear la cuenta. Intenta de nuevo.";
      }
    }
  });
}

async function cargarEquipo() {
  if (rolActual !== "owner") return;
  const cuerpo = document.getElementById("cuerpo-tabla-equipo");
  cuerpo.innerHTML = `<tr><td colspan="3">Cargando...</td></tr>`;

  const snapshot = await getDocs(collection(db, "usuarios"));
  cuerpo.innerHTML = "";

  snapshot.docs.forEach((d) => {
    const correo = d.id;
    const rol = d.data().rol;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escaparHtml(correo)}</td>
      <td>${rol === "owner" ? "Owner" : "Admin"}</td>
      <td>${rol === "owner" ? "—" : '<button class="boton-mini peligro" type="button" data-accion="quitar">Quitar acceso</button>'}</td>
    `;
    if (rol !== "owner") {
      tr.querySelector('[data-accion="quitar"]').addEventListener("click", () => {
        mostrarConfirmacion(`¿Quitar el acceso de administrador a ${correo}?`, async () => {
          await deleteDoc(doc(db, "usuarios", correo));
          cargarEquipo();
        });
      });
    }
    cuerpo.appendChild(tr);
  });
}

/* ---------- Modal de confirmación ---------- */
function mostrarConfirmacion(texto, alAceptar) {
  const modal = document.getElementById("modal-confirmar");
  document.getElementById("modal-confirmar-texto").textContent = texto;
  modal.classList.add("visible");

  const botonAceptar = document.getElementById("modal-confirmar-aceptar");
  const botonCancelar = document.getElementById("modal-confirmar-cancelar");

  function cerrar() {
    modal.classList.remove("visible");
    botonAceptar.removeEventListener("click", onAceptar);
    botonCancelar.removeEventListener("click", cerrar);
  }
  function onAceptar() {
    cerrar();
    alAceptar();
  }
  botonAceptar.addEventListener("click", onAceptar);
  botonCancelar.addEventListener("click", cerrar);
}
