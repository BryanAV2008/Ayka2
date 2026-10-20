/* =====================================================================
   ANIMACIONES LIGERAS — Bisuterías Ayka
   ---------------------------------------------------------------------
   · No depende de ninguna librería.
   · No toca script.js: observa la página desde afuera.
   · Si el navegador no lo soporta o la persona pidió "reducir movimiento",
     no hace nada y el sitio funciona exactamente igual (mejora progresiva).
   ===================================================================== */
(function () {
  "use strict";

  var soportado = "IntersectionObserver" in window && "MutationObserver" in window;
  if (!soportado) return;

  var reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------
     1) Sección activa en el menú (no es movimiento: indica dónde estás)
     --------------------------------------------------------------- */
  function activarMenuPorScroll() {
    var enlaces = Array.prototype.slice.call(document.querySelectorAll('.main-nav a[href^="#"]'));
    if (!enlaces.length) return;

    var porId = {};
    enlaces.forEach(function (a) { porId[a.getAttribute("href").slice(1)] = a; });

    var limpiar = function () { enlaces.forEach(function (a) { a.removeAttribute("aria-current"); }); };

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        limpiar();
        if (entrada.target.classList.contains("hero")) return;
        var enlace = porId[entrada.target.id];
        if (enlace) enlace.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-40% 0px -55% 0px" });

    Object.keys(porId).forEach(function (id) {
      var seccion = document.getElementById(id);
      if (seccion) observador.observe(seccion);
    });
    var hero = document.querySelector(".hero");
    if (hero) observador.observe(hero);
  }

  activarMenuPorScroll();

  // Todo lo que sigue es movimiento: si la persona lo pidió reducido, no se activa.
  if (reducido) return;

  /* ---------------------------------------------------------------
     2) Aparición al hacer scroll (con escalonado entre tarjetas)
     --------------------------------------------------------------- */
  var revelador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) return;
      var el = entrada.target;
      revelador.unobserve(el);
      el.classList.add("rv-visible");

      // Las tarjetas vuelven a su estilo normal al terminar, para que el "hover" funcione bien.
      // Los títulos conservan su marca (rv-hecho) para mantener el detalle dorado.
      window.setTimeout(function () {
        if (el.hasAttribute("data-rv-limpiar")) {
          el.classList.remove("rv", "rv-visible");
          el.style.removeProperty("--rv-delay");
          el.removeAttribute("data-rv-limpiar");
        } else {
          el.classList.add("rv-hecho");
        }
      }, 1100 + (parseInt(el.getAttribute("data-rv-ms"), 10) || 0));
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -5% 0px" });

  function registrar(el, indice, limpiar) {
    if (!el || el.classList.contains("rv")) return;
    var retraso = Math.min(indice, 8) * 70;
    el.classList.add("rv");
    el.style.setProperty("--rv-delay", retraso + "ms");
    el.setAttribute("data-rv-ms", String(retraso));
    if (limpiar) el.setAttribute("data-rv-limpiar", "");
    revelador.observe(el);
  }

  // Bloques fijos de la página
  document.querySelectorAll(".catalogo-head, .galeria-head, .nosotros-inner, .contacto-inner").forEach(function (el, i) {
    registrar(el, 0, false);
  });

  // Tarjetas: se crean después, cuando llegan los datos de Firebase
  ["grid-productos", "grid-personalizados", "grid-decoracion"].forEach(function (id) {
    var grid = document.getElementById(id);
    if (!grid) return;
    new MutationObserver(function (cambios) {
      var nuevos = [];
      cambios.forEach(function (cambio) {
        cambio.addedNodes.forEach(function (nodo) {
          if (nodo.nodeType === 1 && !nodo.classList.contains("cargando")) nuevos.push(nodo);
        });
      });
      nuevos.forEach(function (nodo, i) { registrar(nodo, i, true); });
    }).observe(grid, { childList: true });
  });

  /* ---------------------------------------------------------------
     3) Rebote del contador del carrito y pulso del total
        (solo cuando el valor realmente cambia)
     --------------------------------------------------------------- */
  function animarCambioDeTexto(id, clase) {
    var el = document.getElementById(id);
    if (!el) return;
    var ultimo = el.textContent;
    new MutationObserver(function () {
      if (el.textContent === ultimo) return;
      ultimo = el.textContent;
      el.classList.remove(clase);
      void el.offsetWidth; // reinicia la animación si se repite rápido
      el.classList.add(clase);
    }).observe(el, { childList: true, characterData: true, subtree: true });
    el.addEventListener("animationend", function () { el.classList.remove(clase); });
  }
  animarCambioDeTexto("contador-carrito", "rebote");
  animarCambioDeTexto("total-carrito", "pulso");

  /* ---------------------------------------------------------------
     4) Panel del carrito: las filas "entran" solo al abrirlo
     --------------------------------------------------------------- */
  var panel = document.getElementById("panel-carrito");
  if (panel) {
    var estabaVisible = panel.classList.contains("visible");
    new MutationObserver(function () {
      var visible = panel.classList.contains("visible");
      if (visible && !estabaVisible) {
        panel.classList.add("entrando");
        window.setTimeout(function () { panel.classList.remove("entrando"); }, 900);
      }
      estabaVisible = visible;
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------------------------------------------------------------
     5) "Copiado" en los botones de copiar del pago
     --------------------------------------------------------------- */
  var checkout = document.getElementById("checkout");
  if (checkout) {
    new MutationObserver(function (cambios) {
      cambios.forEach(function (cambio) {
        var boton = cambio.target;
        if (boton.classList && boton.classList.contains("boton-copiar")) {
          boton.classList.toggle("copiado", boton.textContent.trim() === "¡Copiado!");
        }
      });
    }).observe(checkout, { childList: true, characterData: true, subtree: true });
  }

  /* ---------------------------------------------------------------
     6) Respuesta visual inmediata al tocar
     --------------------------------------------------------------- */
  document.addEventListener("click", function (e) {
    var agregar = e.target.closest && e.target.closest(".btn-agregar");
    if (agregar && !agregar.disabled) {
      agregar.classList.add("agregado");
      window.setTimeout(function () { agregar.classList.remove("agregado"); }, 1100);
    }

    var favorito = e.target.closest && e.target.closest(".boton-favorito");
    if (favorito) {
      favorito.classList.remove("latido");
      void favorito.offsetWidth;
      favorito.classList.add("latido");
      window.setTimeout(function () { favorito.classList.remove("latido"); }, 600);
    }
  });
})();
