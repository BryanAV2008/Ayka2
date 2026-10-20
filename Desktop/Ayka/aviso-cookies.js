// Aviso informativo sobre almacenamiento del navegador.
// Este sitio solo usa almacenamiento técnico NECESARIO (carrito y sesión), por eso
// el aviso es informativo. Si algún día se agrega analítica o publicidad, este
// aviso debe reemplazarse por un banner de consentimiento real (con "Rechazar") y
// esas herramientas NO deben cargarse hasta que la persona acepte.
(function () {
  var CLAVE = "ayka-aviso-cookies";
  try {
    if (localStorage.getItem(CLAVE)) return;
  } catch (e) {
    return; // si el navegador bloquea el almacenamiento, no insistimos
  }

  function crear() {
    var aviso = document.createElement("div");
    aviso.className = "aviso-cookies";
    aviso.setAttribute("role", "region");
    aviso.setAttribute("aria-label", "Aviso sobre cookies y almacenamiento");

    var p = document.createElement("p");
    p.appendChild(document.createTextNode(
      "Este sitio solo usa almacenamiento técnico necesario (tu carrito y tu sesión). No usamos cookies de analítica ni de publicidad. Más información en la "
    ));
    var a = document.createElement("a");
    a.href = "cookies.html";
    a.textContent = "política de cookies";
    p.appendChild(a);
    p.appendChild(document.createTextNode("."));

    var boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = "Entendido";
    boton.addEventListener("click", function () {
      try { localStorage.setItem(CLAVE, "1"); } catch (e) {}
      aviso.remove();
    });

    aviso.appendChild(p);
    aviso.appendChild(boton);
    document.body.appendChild(aviso);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", crear);
  } else {
    crear();
  }
})();
