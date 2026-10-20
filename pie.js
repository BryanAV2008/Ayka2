// Pone el año actual en el pie de página (sin scripts "inline", para poder usar una política de seguridad estricta).
(function () {
  var el = document.getElementById("anio");
  if (el) el.textContent = new Date().getFullYear();
})();
