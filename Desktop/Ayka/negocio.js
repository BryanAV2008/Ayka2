/* ======================================================================
   DATOS DEL NEGOCIO — ÚNICO LUGAR DONDE SE EDITAN
   ----------------------------------------------------------------------
   Todas las páginas legales (privacidad, términos, cookies, reembolsos)
   y el pie de página leen estos datos desde aquí.

   Completa cada campo que esté vacío ("") con la información REAL de tu
   negocio. Mientras un campo esté vacío, las páginas legales lo muestran
   resaltado en amarillo como "[completar: ...]" para que no se te olvide.

   IMPORTANTE: no escribas datos que no sean ciertos. Estos datos se
   publican en tu sitio y forman parte de tus obligaciones legales como
   proveedor.
   ====================================================================== */
(function () {
  var NEGOCIO = {
    nombreComercial: "Bisuterías Ayka",

    // Nombre completo de la persona dueña del negocio, o la razón social
    // si es una compañía. Debe coincidir con tu RUC.
    titular: "",

    // Número de RUC (13 dígitos). Si vendes sin RUC, consulta con el SRI.
    ruc: "",

    // Régimen tributario, tal como figura en tu RUC. Ejemplos:
    // "RIMPE - Negocio Popular", "RIMPE - Emprendedor", "Régimen General".
    regimenTributario: "",

    // Dirección física del negocio o domicilio para notificaciones.
    direccion: "",

    // Correo oficial de contacto del negocio (para derechos de datos y reclamos).
    correo: "",

    // WhatsApp del negocio (el mismo que usa script.js).
    whatsapp: "0963309405",

    // Condiciones comerciales que SOLO tú puedes definir:
    metodosPago: "",       // Ej: "transferencia bancaria o efectivo contra entrega"
    zonasEntrega: "",      // Ej: "Guayaquil y envíos a nivel nacional por courier"
    costoEnvio: "",        // Ej: "se informa por WhatsApp antes de confirmar el pedido"
    plazoReembolso: "",    // Ej: "máximo 15 días después de recibir el producto devuelto"
    envioDevolucion: "",   // Quién paga el envío si el cliente se arrepiente. Ej: "el cliente"

    // ----- COBROS POR TRANSFERENCIA -----
    // Completa SOLO las cuentas que realmente tengas. Un banco aparece en la
    // pantalla de pago únicamente si tiene "numeroCuenta" escrito.
    //   tipoCuenta:     "Ahorros" o "Corriente"
    //   titular:        nombre tal como figura en la cuenta
    //   identificacion: cédula o RUC del titular
    // Recomendación: usa una cuenta exclusiva del negocio.
    // ⚠ NUNCA pongas aquí claves, contraseñas, tokens ni claves de API:
    //   este archivo es público (cualquiera puede verlo desde el navegador).
    bancos: [
      { id: "guayaquil",     nombre: "Banco Guayaquil",     tipoCuenta: "", numeroCuenta: "", titular: "", identificacion: "" },
      { id: "pichincha",     nombre: "Banco Pichincha",     tipoCuenta: "", numeroCuenta: "", titular: "", identificacion: "" },
      { id: "internacional", nombre: "Banco Internacional", tipoCuenta: "", numeroCuenta: "", titular: "", identificacion: "" }
    ],

    // Pasarela con la que cobras tarjetas (solo informativo en pantalla).
    pasarelaTarjeta: "PayPhone",

    // Versión de los textos legales (se guarda junto con el consentimiento
    // de cada cliente, como prueba de qué versión aceptó).
    versionLegal: "2026-10-11",
    fechaVersion: "11 de octubre de 2026"
  };

  var ETIQUETAS = {
    titular: "nombre del titular o razón social",
    ruc: "RUC",
    regimenTributario: "régimen tributario",
    direccion: "dirección",
    correo: "correo de contacto",
    metodosPago: "métodos de pago",
    zonasEntrega: "zonas de entrega",
    costoEnvio: "costo de envío",
    plazoReembolso: "plazo de reembolso",
    envioDevolucion: "quién paga el envío de devolución"
  };

  window.NEGOCIO = NEGOCIO;

  function completarPagina() {
    var faltantes = {};

    document.querySelectorAll("[data-negocio]").forEach(function (el) {
      var clave = el.getAttribute("data-negocio");
      var valor = NEGOCIO[clave];
      var opcionalPublico = el.hasAttribute("data-negocio-opcional");

      if (valor) {
        el.textContent = valor;
        el.classList.remove("pendiente-completar");
        el.hidden = false;
        if (clave === "correo" && el.tagName === "A") el.href = "mailto:" + valor;
      } else if (ETIQUETAS[clave]) {
        faltantes[clave] = true;
        if (opcionalPublico) {
          // En el pie de página público, lo que falta simplemente no se muestra.
          el.hidden = true;
        } else {
          el.textContent = "[completar: " + ETIQUETAS[clave] + "]";
          el.classList.add("pendiente-completar");
        }
      }
    });

    var hayBancos = (NEGOCIO.bancos || []).some(function (b) { return b.numeroCuenta; });
    if (!hayBancos) {
      console.warn("[Bisuterías Ayka] No hay cuentas bancarias en negocio.js: la opción de transferencia mostrará 'pide los datos por WhatsApp'.");
    }

    var lista = Object.keys(faltantes);
    if (lista.length > 0) {
      console.warn(
        "[Bisuterías Ayka] Faltan datos legales por completar en negocio.js: " +
          lista.map(function (c) { return ETIQUETAS[c]; }).join(", ")
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", completarPagina);
  } else {
    completarPagina();
  }
})();
