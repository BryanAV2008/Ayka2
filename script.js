import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  increment,
} from "./firebase-config.js";
import { escaparHtml, urlImagenSegura, telefonoInternacional, anunciar } from "./utils.js";

let usuarioLogueado = null;
let favoritosUsuario = new Set();
let perfilCliente = null;

// El número de WhatsApp se edita en UN solo lugar: negocio.js
const TELEFONO = telefonoInternacional((window.NEGOCIO && window.NEGOCIO.whatsapp) || "0963309405");

/* ---------- Cargar productos desde Firestore ---------- */
async function obtenerProductos(apartado) {
  const q = query(collection(db, "productos"), where("apartado", "==", apartado));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function registrarCotizado(id) {
  try {
    await updateDoc(doc(db, "productos", id), { cotizados: increment(1) });
  } catch (error) {
    console.error("No se pudo registrar la cotización:", error);
  }
}

function mensajeProducto(producto) {
  const precio = producto.precio ? ` ($${Number(producto.precio).toFixed(2)})` : "";
  return `Hola! Me interesa este producto: ${producto.nombre}${precio}. ¿Está disponible?`;
}

/* ---------- Tarjetas ---------- */
function hacerImagenAmpliable(img, src, nombre) {
  img.setAttribute("tabindex", "0");
  img.setAttribute("role", "button");
  img.setAttribute("aria-label", `Ampliar foto de ${nombre}`);
  const abrir = () => abrirImagen(src, nombre);
  img.addEventListener("click", abrir);
  img.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      abrir();
    }
  });
}

function pintarBotonFavorito(boton, activo, nombre) {
  boton.classList.toggle("activo", activo);
  boton.textContent = activo ? "♥" : "♡";
  boton.setAttribute("aria-pressed", activo ? "true" : "false");
  boton.setAttribute("aria-label", activo ? `Quitar ${nombre} de favoritos` : `Guardar ${nombre} en favoritos`);
}

function crearTarjeta(producto) {
  const article = document.createElement("article");
  article.className = "tarjeta-producto";
  article.dataset.categoria = producto.categoria || "";

  const nombre = escaparHtml(producto.nombre);
  const imagen = urlImagenSegura(producto.imagen);
  const enlaceWhatsapp = `https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensajeProducto(producto))}`;
  const sinStock = producto.stock !== undefined && Number(producto.stock) <= 0;

  article.innerHTML = `
    <div class="tarjeta-imagen">
      <img src="${escaparHtml(imagen)}" alt="${nombre}" loading="lazy">
      ${sinStock ? '<span class="etiqueta-agotado">Agotado</span>' : ""}
      <button class="boton-favorito" type="button"></button>
    </div>
    <div class="tarjeta-info">
      <h3>${nombre}</h3>
      <p class="tarjeta-precio">$${Number(producto.precio || 0).toFixed(2)}</p>
      <button class="btn-secundario btn-agregar" type="button" ${sinStock ? "disabled" : ""}>
        ${sinStock ? "Agotado" : "Agregar al carrito"}<span class="solo-lectores">: ${nombre}</span>
      </button>
      <a class="btn-secundario" href="${escaparHtml(enlaceWhatsapp)}" target="_blank" rel="noopener noreferrer">Pedir por WhatsApp<span class="solo-lectores">: ${nombre} (se abre en una pestaña nueva)</span></a>
    </div>
  `;

  const botonFavorito = article.querySelector(".boton-favorito");
  pintarBotonFavorito(botonFavorito, favoritosUsuario.has(producto.id), producto.nombre);
  botonFavorito.addEventListener("click", () => alternarFavorito(producto, botonFavorito));

  if (!sinStock) {
    article.querySelector(".btn-agregar").addEventListener("click", () => agregarAlCarrito(producto));
  }
  hacerImagenAmpliable(article.querySelector("img"), imagen, producto.nombre);
  article.querySelector('a[href^="https://wa.me"]').addEventListener("click", () => registrarCotizado(producto.id));

  return article;
}

function crearTarjetaGaleria(item) {
  const article = document.createElement("article");
  article.className = "tarjeta-galeria";

  const nombre = escaparHtml(item.nombre);
  const imagen = urlImagenSegura(item.imagen);
  const mensaje = `Hola! Me interesa algo como: ${item.nombre}. ¿Me pueden dar más información?`;
  const enlaceWhatsapp = `https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`;

  article.innerHTML = `
    <div class="tarjeta-imagen">
      <img src="${escaparHtml(imagen)}" alt="${nombre}" loading="lazy">
    </div>
    <div class="tarjeta-info">
      <h3>${nombre}</h3>
      <p>${escaparHtml(item.descripcion || "")}</p>
      <a class="btn-secundario" href="${escaparHtml(enlaceWhatsapp)}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp<span class="solo-lectores">: ${nombre} (se abre en una pestaña nueva)</span></a>
    </div>
  `;
  hacerImagenAmpliable(article.querySelector("img"), imagen, item.nombre);
  article.querySelector("a").addEventListener("click", () => registrarCotizado(item.id));
  return article;
}

let productosColeccion = [];

async function renderizarColeccion(categoria = "todos") {
  const grid = document.getElementById("grid-productos");
  grid.innerHTML = `<p class="cargando" role="status">Cargando productos...</p>`;
  try {
    productosColeccion = await obtenerProductos("coleccion");
  } catch (error) {
    console.error(error);
    grid.innerHTML = `<p class="cargando" role="alert">No pudimos cargar los productos. Revisa tu conexión e intenta de nuevo.</p>`;
    return;
  }
  sincronizarCarritoConCatalogo();
  pintarColeccion(categoria);
}

function pintarColeccion(categoria) {
  const grid = document.getElementById("grid-productos");
  grid.innerHTML = "";
  const filtrada = categoria === "todos" ? productosColeccion : productosColeccion.filter((p) => p.categoria === categoria);
  if (filtrada.length === 0) {
    grid.innerHTML = `<p class="cargando">Todavía no hay productos en esta categoría.</p>`;
    return;
  }
  filtrada.forEach((p) => grid.appendChild(crearTarjeta(p)));
}

async function renderizarGaleria(apartado, idContenedor) {
  const grid = document.getElementById(idContenedor);
  if (!grid) return;
  grid.innerHTML = `<p class="cargando" role="status">Cargando...</p>`;
  let lista;
  try {
    lista = await obtenerProductos(apartado);
  } catch (error) {
    console.error(error);
    grid.innerHTML = `<p class="cargando" role="alert">No pudimos cargar esta sección. Intenta de nuevo más tarde.</p>`;
    return;
  }
  grid.innerHTML = "";
  if (lista.length === 0) {
    grid.innerHTML = `<p class="cargando">Todavía no hay fotos en esta sección.</p>`;
    return;
  }
  lista.forEach((item) => grid.appendChild(crearTarjetaGaleria(item)));
}

document.addEventListener("DOMContentLoaded", () => {
  renderizarColeccion();
  renderizarGaleria("personalizados", "grid-personalizados");
  renderizarGaleria("decoracion", "grid-decoracion");

  document.querySelectorAll(".filtro").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro").forEach((b) => {
        b.classList.remove("activo");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("activo");
      btn.setAttribute("aria-pressed", "true");
      pintarColeccion(btn.dataset.categoria);
    });
  });

  document.getElementById("anio").textContent = new Date().getFullYear();

  const mensajeGeneral = encodeURIComponent("Hola! Vi su catálogo de Bisuterías Ayka y quiero más información.");
  const enlaceGeneral = `https://wa.me/${TELEFONO}?text=${mensajeGeneral}`;
  document.getElementById("whatsapp-general").href = enlaceGeneral;
  document.getElementById("whatsapp-flotante").href = enlaceGeneral;

  configurarCarrito();
  configurarLightbox();
  configurarTeclado();
  configurarSesion();
});

async function alternarFavorito(producto, boton) {
  if (!usuarioLogueado) {
    mostrarConfirmacion("Inicia sesión para guardar favoritos. ¿Ir a iniciar sesión?", () => {
      window.location.href = "ingresar.html";
    }, "Ir a iniciar sesión");
    return;
  }

  const refFavorito = doc(db, "clientes", usuarioLogueado.uid, "favoritos", producto.id);

  try {
    if (favoritosUsuario.has(producto.id)) {
      await deleteDoc(refFavorito);
      favoritosUsuario.delete(producto.id);
      pintarBotonFavorito(boton, false, producto.nombre);
      anunciar(`${producto.nombre} se quitó de tus favoritos`);
    } else {
      await setDoc(refFavorito, { agregado: Date.now() });
      favoritosUsuario.add(producto.id);
      pintarBotonFavorito(boton, true, producto.nombre);
      anunciar(`${producto.nombre} se guardó en tus favoritos`);
    }
  } catch (error) {
    console.error("No se pudo actualizar el favorito:", error);
    anunciar("No se pudo actualizar el favorito. Intenta de nuevo.");
  }
}

async function configurarSesion() {
  onAuthStateChanged(auth, async (usuario) => {
    const enlaceCuenta = document.getElementById("enlace-cuenta");
    usuarioLogueado = usuario;

    if (usuario) {
      enlaceCuenta.textContent = "Mi cuenta";
      enlaceCuenta.href = "mi-cuenta.html";

      try {
        const snapshotFavoritos = await getDocs(collection(db, "clientes", usuario.uid, "favoritos"));
        favoritosUsuario = new Set(snapshotFavoritos.docs.map((d) => d.id));

        const snapPerfil = await getDoc(doc(db, "clientes", usuario.uid));
        perfilCliente = snapPerfil.exists() ? snapPerfil.data() : null;
      } catch (error) {
        console.error("No se pudieron cargar los datos de la cuenta:", error);
      }

      const carritoNube = limpiarItemsCarrito(perfilCliente && perfilCliente.carrito);
      if (carritoNube.length > 0) {
        // Ya tenía un carrito guardado en la nube: ese manda (para que se vea igual en cualquier navegador).
        carrito = carritoNube;
        guardarCarritoLocal();
      } else if (carrito.length > 0) {
        // No tenía nada en la nube pero sí en este dispositivo: lo subimos.
        await guardarCarritoNube();
      }

      sincronizarCarritoConCatalogo();
      pintarColeccion(document.querySelector(".filtro.activo")?.dataset.categoria || "todos");
      renderizarCarrito();
    } else {
      enlaceCuenta.textContent = "Iniciar sesión";
      enlaceCuenta.href = "ingresar.html";
      favoritosUsuario = new Set();
      perfilCliente = null;
    }
  });
}

async function guardarPedidoEnHistorial(metodo = "coordinar-whatsapp", referencia = "") {
  if (!usuarioLogueado || carrito.length === 0) return;
  try {
    await addDoc(collection(db, "clientes", usuarioLogueado.uid, "pedidos"), {
      items: carrito.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })),
      total: totalCarrito(),
      fecha: Date.now(),
      metodo,
      referencia,
      estado: "pendiente-de-pago",
    });
  } catch (error) {
    console.error("No se pudo guardar el pedido en el historial:", error);
  }
}

/* ---------- Carrito de compras (persistente en el dispositivo y en la cuenta) ---------- */
const CLAVE_CARRITO = "ayka-carrito";

// Todo lo que viene de localStorage o de la nube se trata como "no confiable":
// se valida antes de usarlo, para que un dato alterado no rompa la página.
function limpiarItemsCarrito(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((i) => i && typeof i.id === "string" && i.id.length > 0 && i.id.length < 100)
    .map((i) => {
      const precio = Number(i.precio);
      return {
        id: i.id,
        nombre: String(i.nombre ?? "").slice(0, 120),
        precio: Number.isFinite(precio) && precio >= 0 ? precio : 0,
        imagen: typeof i.imagen === "string" ? i.imagen : "",
        cantidad: Math.min(99, Math.max(1, parseInt(i.cantidad, 10) || 1)),
      };
    });
}

function cargarCarrito() {
  try {
    const guardado = localStorage.getItem(CLAVE_CARRITO);
    return guardado ? limpiarItemsCarrito(JSON.parse(guardado)) : [];
  } catch (error) {
    console.error("No se pudo leer el carrito guardado:", error);
    return [];
  }
}

async function guardarCarritoNube() {
  if (!usuarioLogueado) return;
  try {
    await setDoc(doc(db, "clientes", usuarioLogueado.uid), { carrito }, { merge: true });
  } catch (error) {
    console.error("No se pudo guardar el carrito en la nube:", error);
  }
}

function guardarCarritoLocal() {
  try {
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
  } catch (error) {
    console.error("No se pudo guardar el carrito:", error);
  }
}

let carrito = cargarCarrito();

function productoDelCatalogo(id) {
  return productosColeccion.find((p) => p.id === id);
}

function stockDisponible(id) {
  const p = productoDelCatalogo(id);
  if (!p || p.stock === undefined) return Infinity;
  return Math.max(0, Number(p.stock) || 0);
}

// Mantiene el carrito fiel al catálogo actual: precios vigentes, productos que
// ya no existen o se agotaron, y cantidades que no superan el stock.
// Así nadie hace un pedido con un precio viejo o con algo que ya no hay.
function sincronizarCarritoConCatalogo() {
  if (productosColeccion.length === 0 || carrito.length === 0) return;
  let huboCambios = false;
  const actualizado = [];

  carrito.forEach((item) => {
    const p = productoDelCatalogo(item.id);
    if (!p) { huboCambios = true; return; }
    const stock = stockDisponible(item.id);
    if (stock <= 0) { huboCambios = true; return; }

    const precio = Number(p.precio || 0);
    const cantidad = Math.min(item.cantidad, stock);
    if (cantidad !== item.cantidad || precio !== item.precio || p.nombre !== item.nombre || p.imagen !== item.imagen) {
      huboCambios = true;
    }
    actualizado.push({ id: item.id, nombre: p.nombre, precio, imagen: p.imagen, cantidad });
  });

  if (huboCambios) {
    carrito = actualizado;
    const aviso = document.getElementById("aviso-carrito");
    if (aviso) {
      aviso.textContent = "Actualizamos tu carrito: algunos precios o la disponibilidad cambiaron. Revisa el total antes de enviar el pedido.";
    }
    renderizarCarrito();
  }
}

function agregarAlCarrito(producto) {
  const item = carrito.find((i) => i.id === producto.id);
  const stock = stockDisponible(producto.id);
  const cantidadActual = item ? item.cantidad : 0;

  if (cantidadActual + 1 > stock) {
    anunciar(`No hay más unidades disponibles de ${producto.nombre}`);
    const aviso = document.getElementById("aviso-carrito");
    if (aviso) aviso.textContent = `No hay más unidades disponibles de ${producto.nombre}.`;
    abrirCarrito();
    return;
  }

  if (item) {
    item.cantidad += 1;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio || 0),
      imagen: producto.imagen,
      cantidad: 1,
    });
  }
  anunciar(`${producto.nombre} se agregó al carrito`);
  renderizarCarrito();
  abrirCarrito();
}

function cambiarCantidad(id, delta) {
  const item = carrito.find((i) => i.id === id);
  if (!item) return;
  if (delta > 0 && item.cantidad + delta > stockDisponible(id)) {
    anunciar(`No hay más unidades disponibles de ${item.nombre}`);
    return;
  }
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    carrito = carrito.filter((i) => i.id !== id);
  }
  renderizarCarrito();
}

function quitarDelCarrito(id) {
  const item = carrito.find((i) => i.id === id);
  carrito = carrito.filter((i) => i.id !== id);
  if (item) anunciar(`${item.nombre} se quitó del carrito`);
  renderizarCarrito();
}

function vaciarCarrito() {
  if (carrito.length === 0) return;
  mostrarConfirmacion("¿Vaciar todo el carrito?", () => {
    carrito = [];
    anunciar("El carrito quedó vacío");
    renderizarCarrito();
  }, "Sí, vaciar");
}

function totalCarrito() {
  return carrito.reduce((suma, i) => suma + i.precio * i.cantidad, 0);
}

function renderizarCarrito() {
  guardarCarritoLocal();
  guardarCarritoNube();

  const lista = document.getElementById("lista-carrito");
  const contador = document.getElementById("contador-carrito");
  const total = document.getElementById("total-carrito");
  const enlaceCarrito = document.getElementById("whatsapp-carrito");

  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);
  contador.textContent = totalItems;
  document.getElementById("abrir-carrito").setAttribute(
    "aria-label",
    `Ver carrito de compras, ${totalItems} ${totalItems === 1 ? "artículo" : "artículos"}`
  );

  if (carrito.length === 0) {
    lista.innerHTML = `<p class="carrito-vacio">Tu carrito está vacío.</p>`;
  } else {
    lista.innerHTML = carrito
      .map((item) => {
        const nombre = escaparHtml(item.nombre);
        const id = escaparHtml(item.id);
        return `
      <div class="item-carrito">
        <img src="${escaparHtml(urlImagenSegura(item.imagen))}" alt="${nombre}">
        <div>
          <p class="item-carrito-nombre">${nombre}</p>
          <p class="item-carrito-precio">$${item.precio.toFixed(2)}</p>
          <div class="item-carrito-cantidad">
            <button type="button" data-accion="restar" data-id="${id}" aria-label="Restar una unidad de ${nombre}">−</button>
            <span aria-label="Cantidad: ${item.cantidad}">${item.cantidad}</span>
            <button type="button" data-accion="sumar" data-id="${id}" aria-label="Sumar una unidad de ${nombre}">+</button>
          </div>
        </div>
        <button class="item-carrito-quitar" type="button" data-accion="quitar" data-id="${id}" aria-label="Quitar ${nombre} del carrito">×</button>
      </div>`;
      })
      .join("");
  }

  total.textContent = `$${totalCarrito().toFixed(2)}`;
  const botonPago = document.getElementById("ir-a-pago");
  if (botonPago) botonPago.disabled = carrito.length === 0;
  actualizarTotalesCheckout();

  const mensaje = carrito
    .map((i) => `• ${i.nombre} x${i.cantidad} - $${(i.precio * i.cantidad).toFixed(2)}`)
    .join("\n");
  const datosCliente = perfilCliente && perfilCliente.nombre
    ? `Soy ${perfilCliente.nombre}, tel: ${perfilCliente.telefono}.\n\n`
    : "";
  const textoFinal = carrito.length
    ? `Hola! Quiero hacer este pedido:\n${datosCliente}${mensaje}\n\nTotal: $${totalCarrito().toFixed(2)}`
    : "Hola! Quiero hacer un pedido.";
  enlaceCarrito.href = `https://wa.me/${TELEFONO}?text=${encodeURIComponent(textoFinal)}`;
}

/* ---------- Manejo de foco (teclado y lectores de pantalla) ---------- */
let focoAntesCarrito = null;
let focoAntesLightbox = null;
let focoAntesConfirmar = null;
let cerrarConfirmacionActual = null;

function atraparTab(e, contenedor) {
  if (e.key !== "Tab") return;
  const candidatos = contenedor.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const visibles = Array.from(candidatos).filter((el) => el.getClientRects().length > 0);
  if (visibles.length === 0) return;
  const primero = visibles[0];
  const ultimo = visibles[visibles.length - 1];
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primero.focus();
  }
}

function abrirCarrito() {
  focoAntesCarrito = document.activeElement;
  document.getElementById("panel-carrito").classList.add("visible");
  document.getElementById("fondo-carrito").classList.add("visible");
  requestAnimationFrame(() => document.getElementById("cerrar-carrito").focus());
}

function cerrarCarrito() {
  document.getElementById("panel-carrito").classList.remove("visible");
  document.getElementById("fondo-carrito").classList.remove("visible");
  if (focoAntesCarrito && typeof focoAntesCarrito.focus === "function") focoAntesCarrito.focus();
}

function configurarCarrito() {
  document.getElementById("abrir-carrito").addEventListener("click", abrirCarrito);
  document.getElementById("cerrar-carrito").addEventListener("click", cerrarCarrito);
  document.getElementById("fondo-carrito").addEventListener("click", cerrarCarrito);
  document.getElementById("vaciar-carrito").addEventListener("click", vaciarCarrito);

  document.getElementById("lista-carrito").addEventListener("click", (e) => {
    const boton = e.target.closest("button[data-accion]");
    if (!boton) return;
    const { accion, id } = boton.dataset;
    if (accion === "sumar") cambiarCantidad(id, 1);
    if (accion === "restar") cambiarCantidad(id, -1);
    if (accion === "quitar") quitarDelCarrito(id);
  });

  // Opción alterna: coordinar el pago directamente por WhatsApp (flujo original)
  document.getElementById("whatsapp-carrito").addEventListener("click", () => {
    carrito.forEach((item) => registrarCotizado(item.id));
    guardarPedidoEnHistorial("coordinar-whatsapp", "");
    cerrarCheckout();
  });

  document.getElementById("ir-a-pago").addEventListener("click", abrirCheckout);
  configurarCheckout();

  renderizarCarrito();
}

/* ---------- Modal de confirmación (con el estilo del sitio) ---------- */
function mostrarConfirmacion(texto, alAceptar, textoBotonAceptar = "Sí, confirmar") {
  const modal = document.getElementById("modal-confirmar");
  document.getElementById("modal-confirmar-texto").textContent = texto;

  const botonAceptar = document.getElementById("modal-confirmar-aceptar");
  const botonCancelar = document.getElementById("modal-confirmar-cancelar");
  botonAceptar.textContent = textoBotonAceptar;

  focoAntesConfirmar = document.activeElement;
  modal.classList.add("visible");
  requestAnimationFrame(() => botonCancelar.focus());

  function cerrar() {
    modal.classList.remove("visible");
    botonAceptar.removeEventListener("click", onAceptar);
    botonCancelar.removeEventListener("click", cerrar);
    cerrarConfirmacionActual = null;
    if (focoAntesConfirmar && typeof focoAntesConfirmar.focus === "function") focoAntesConfirmar.focus();
  }

  function onAceptar() {
    cerrar();
    alAceptar();
  }

  cerrarConfirmacionActual = cerrar;
  botonAceptar.addEventListener("click", onAceptar);
  botonCancelar.addEventListener("click", cerrar);
}

/* ---------- Lightbox: ver imagen ampliada ---------- */
function abrirImagen(src, alt) {
  focoAntesLightbox = document.activeElement;
  const lightbox = document.getElementById("lightbox");
  const imagen = document.getElementById("lightbox-imagen");
  imagen.src = src;
  imagen.alt = alt;
  lightbox.classList.add("visible");
  requestAnimationFrame(() => document.getElementById("cerrar-lightbox").focus());
}

function cerrarImagen() {
  document.getElementById("lightbox").classList.remove("visible");
  if (focoAntesLightbox && typeof focoAntesLightbox.focus === "function") focoAntesLightbox.focus();
}

function configurarLightbox() {
  document.getElementById("cerrar-lightbox").addEventListener("click", cerrarImagen);
  document.getElementById("lightbox").addEventListener("click", (e) => {
    if (e.target.id === "lightbox") cerrarImagen();
  });
}

// Una sola gestión de teclado para las tres ventanas, respetando cuál está encima.
function configurarTeclado() {
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("modal-confirmar");
    const lightbox = document.getElementById("lightbox");
    const panel = document.getElementById("panel-carrito");

    if (modal.classList.contains("visible")) {
      if (e.key === "Escape" && cerrarConfirmacionActual) cerrarConfirmacionActual();
      else atraparTab(e, modal);
      return;
    }
    if (lightbox.classList.contains("visible")) {
      if (e.key === "Escape") cerrarImagen();
      else atraparTab(e, lightbox);
      return;
    }
    const checkout = document.getElementById("checkout");
    if (checkout.classList.contains("visible")) {
      if (e.key === "Escape") cerrarCheckout();
      else atraparTab(e, checkout);
      return;
    }
    if (panel.classList.contains("visible")) {
      if (e.key === "Escape") cerrarCarrito();
      else atraparTab(e, panel);
    }
  });
}


/* =====================================================================
   PAGO (CHECKOUT): transferencia bancaria o tarjeta con link de PayPhone
   ---------------------------------------------------------------------
   Este sitio NO procesa pagos ni recibe datos de tarjetas.
   - Transferencia: se muestran los datos de tu cuenta y el cliente envía el
     comprobante por WhatsApp. Tú verificas el dinero en tu banco.
   - Tarjeta: el cliente pide un link de pago por WhatsApp y paga en la página
     segura del proveedor (PayPhone). Tú generas el link con el total exacto.
   ===================================================================== */
let focoAntesCheckout = null;
let referenciaPedido = "";
let bancoElegido = null;

function generarReferencia() {
  const base = Date.now().toString(36).slice(-5).toUpperCase();
  const azar = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `AYK-${base}${azar}`;
}

function bancosConfigurados() {
  const lista = (window.NEGOCIO && window.NEGOCIO.bancos) || [];
  return lista.filter((b) => b && b.numeroCuenta);
}

function textoResumenPedido() {
  return carrito.map((i) => `• ${i.nombre} x${i.cantidad} - $${(i.precio * i.cantidad).toFixed(2)}`).join("\n");
}

function textoDatosCliente() {
  return perfilCliente && perfilCliente.nombre
    ? `Soy ${perfilCliente.nombre}, tel: ${perfilCliente.telefono}.\n\n`
    : "";
}

function actualizarTotalesCheckout() {
  const texto = `$${totalCarrito().toFixed(2)}`;
  ["checkout-total", "checkout-total-2", "checkout-total-3"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  });
}

function mostrarVistaCheckout(vista) {
  ["metodo", "transferencia", "tarjeta"].forEach((v) => {
    document.getElementById(`checkout-vista-${v}`).hidden = v !== vista;
  });
  const titulos = {
    metodo: ["Paso 1 de 2", "Elige cómo pagar"],
    transferencia: ["Paso 2 de 2", "Paga por transferencia"],
    tarjeta: ["Paso 2 de 2", "Paga con tarjeta"],
  };
  const titulo = document.getElementById("checkout-titulo");
  document.getElementById("checkout-paso").textContent = titulos[vista][0];
  titulo.textContent = titulos[vista][1];
  document.querySelector(".checkout-cuerpo").scrollTop = 0;
  titulo.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => titulo.focus());
}

function pintarBancos() {
  const contenedor = document.getElementById("lista-bancos");
  const detalle = document.getElementById("detalle-banco");
  const boton = document.getElementById("checkout-enviar-transferencia");
  const bancos = bancosConfigurados();

  if (bancos.length === 0) {
    contenedor.innerHTML = "";
    bancoElegido = null;
    detalle.innerHTML = `<p class="detalle-banco-vacio">Por ahora no tenemos las cuentas publicadas aquí. Toca el botón de abajo y te enviamos por WhatsApp los datos para transferir.</p>`;
    boton.textContent = "Pedir los datos de transferencia por WhatsApp";
    return;
  }

  boton.textContent = "Ya transferí: enviar comprobante por WhatsApp";
  contenedor.innerHTML = bancos
    .map((b, i) => {
      const inicial = String(b.nombre).replace(/^Banco\s+/i, "").charAt(0).toUpperCase();
      return `
      <label class="chip-banco">
        <input type="radio" name="banco" value="${escaparHtml(b.id)}" ${i === 0 ? "checked" : ""}>
        <span class="chip-banco-cuerpo"><span class="chip-banco-inicial" aria-hidden="true">${escaparHtml(inicial)}</span>${escaparHtml(b.nombre)}</span>
      </label>`;
    })
    .join("");

  bancoElegido = bancos[0];
  pintarDetalleBanco();

  contenedor.querySelectorAll('input[name="banco"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      bancoElegido = bancos.find((b) => b.id === radio.value) || bancos[0];
      pintarDetalleBanco();
    });
  });
}

function pintarDetalleBanco() {
  const b = bancoElegido;
  const detalle = document.getElementById("detalle-banco");
  if (!b) return;
  const filas = [];
  if (b.titular) filas.push(`<div><dt>Titular</dt><dd>${escaparHtml(b.titular)}</dd></div>`);
  if (b.identificacion) filas.push(`<div><dt>Cédula / RUC</dt><dd>${escaparHtml(b.identificacion)}</dd></div>`);

  detalle.innerHTML = `
    <div class="cuenta-bancaria">
      <div class="cuenta-bancaria-top">
        <span class="cuenta-bancaria-banco">${escaparHtml(b.nombre)}</span>
        <span class="cuenta-bancaria-tipo">${escaparHtml(b.tipoCuenta || "Cuenta")}</span>
      </div>
      <div class="cuenta-bancaria-numero-fila">
        <span class="cuenta-bancaria-numero">${escaparHtml(b.numeroCuenta)}</span>
        <button type="button" class="boton-copiar boton-copiar-claro" data-copiar-valor="${escaparHtml(b.numeroCuenta)}" aria-label="Copiar número de cuenta de ${escaparHtml(b.nombre)}">Copiar</button>
      </div>
      ${filas.length ? `<dl class="cuenta-bancaria-datos">${filas.join("")}</dl>` : ""}
    </div>`;
}

async function copiarTexto(texto, boton) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch (error) {
    // Respaldo para navegadores que bloquean el portapapeles
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    try { document.execCommand("copy"); } catch (e) { /* sin respaldo adicional */ }
    t.remove();
  }
  const original = boton.dataset.textoOriginal || boton.textContent;
  boton.dataset.textoOriginal = original;
  boton.textContent = "¡Copiado!";
  anunciar("Copiado al portapapeles");
  setTimeout(() => { boton.textContent = original; }, 1800);
}

function abrirCheckout() {
  if (carrito.length === 0) {
    anunciar("Tu carrito está vacío");
    return;
  }
  // Antes de pagar, nos aseguramos de cobrar precios y stock vigentes.
  sincronizarCarritoConCatalogo();
  if (carrito.length === 0) return;

  referenciaPedido = generarReferencia();
  document.getElementById("checkout-referencia").textContent = referenciaPedido;
  document.getElementById("checkout-referencia-2").textContent = referenciaPedido;
  actualizarTotalesCheckout();

  document.querySelector('input[name="metodo-pago"][value="transferencia"]').checked = true;
  pintarBancos();

  focoAntesCheckout = document.activeElement;
  document.getElementById("checkout").classList.add("visible");
  mostrarVistaCheckout("metodo");
}

function cerrarCheckout() {
  const checkout = document.getElementById("checkout");
  if (!checkout.classList.contains("visible")) return;
  checkout.classList.remove("visible");
  if (focoAntesCheckout && typeof focoAntesCheckout.focus === "function") focoAntesCheckout.focus();
}

// Se abre WhatsApp de inmediato (los navegadores bloquean ventanas que se abren
// después de una espera) y luego se registra la cotización y el pedido.
function enviarPedidoPorWhatsApp(texto, metodo) {
  window.open(`https://wa.me/${TELEFONO}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  carrito.forEach((item) => registrarCotizado(item.id));
  guardarPedidoEnHistorial(metodo, referenciaPedido);
  anunciar("Abrimos WhatsApp con tu pedido. Envía el mensaje para completarlo.");
  cerrarCheckout();
}

function confirmarTransferencia() {
  const total = `$${totalCarrito().toFixed(2)}`;
  const base = `${textoDatosCliente()}Pedido ${referenciaPedido}:\n${textoResumenPedido()}\n\nTotal: ${total}`;
  if (bancoElegido) {
    enviarPedidoPorWhatsApp(
      `Hola! Ya realicé la transferencia a ${bancoElegido.nombre}.\n${base}\n\nAdjunto el comprobante.`,
      `transferencia-${bancoElegido.id}`
    );
  } else {
    enviarPedidoPorWhatsApp(
      `Hola! Quiero pagar por transferencia.\n${base}\n\n¿Me envían los datos de la cuenta, por favor?`,
      "transferencia"
    );
  }
}

function solicitarLinkTarjeta() {
  const total = `$${totalCarrito().toFixed(2)}`;
  const pasarela = (window.NEGOCIO && window.NEGOCIO.pasarelaTarjeta) || "PayPhone";
  enviarPedidoPorWhatsApp(
    `Hola! Quiero pagar con tarjeta (${pasarela}).\n${textoDatosCliente()}Pedido ${referenciaPedido}:\n${textoResumenPedido()}\n\nTotal: ${total}\n\n¿Me envías el link de pago, por favor?`,
    "tarjeta"
  );
}

function configurarCheckout() {
  const checkout = document.getElementById("checkout");

  document.getElementById("cerrar-checkout").addEventListener("click", cerrarCheckout);
  checkout.addEventListener("click", (e) => {
    if (e.target.id === "checkout") cerrarCheckout();
  });

  document.getElementById("checkout-continuar").addEventListener("click", () => {
    const metodo = document.querySelector('input[name="metodo-pago"]:checked').value;
    mostrarVistaCheckout(metodo === "tarjeta" ? "tarjeta" : "transferencia");
  });

  checkout.querySelectorAll("[data-volver-metodo]").forEach((boton) => {
    boton.addEventListener("click", () => mostrarVistaCheckout("metodo"));
  });

  document.getElementById("checkout-enviar-transferencia").addEventListener("click", confirmarTransferencia);
  document.getElementById("checkout-solicitar-link").addEventListener("click", solicitarLinkTarjeta);

  checkout.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-copiar-valor], [data-copiar]");
    if (!boton) return;
    const valor = boton.dataset.copiarValor
      || document.getElementById(boton.dataset.copiar === "referencia-2" ? "checkout-referencia-2" : "checkout-referencia").textContent;
    copiarTexto(valor, boton);
  });
}

/* ---------- App instalable (PWA) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.error("No se pudo registrar el service worker:", error);
    });
  });
}
