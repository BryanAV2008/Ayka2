// Copia únicamente los archivos del sitio a la carpeta "www", que es la que empaqueta Capacitor.
// Uso:  node copiar-web.mjs   (antes de "npx cap copy")
import { cpSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const EXTENSIONES = new Set([".html", ".js", ".mjs", ".css", ".json", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"]);
const EXCLUIR = new Set(["capacitor.config.json", "package.json", "package-lock.json", "copiar-web.mjs"]);

rmSync("www", { recursive: true, force: true });
mkdirSync("www");

let copiados = 0;
for (const nombre of readdirSync(".")) {
  if (EXCLUIR.has(nombre)) continue;
  const info = statSync(nombre);
  if (info.isFile() && EXTENSIONES.has(extname(nombre).toLowerCase())) {
    cpSync(nombre, join("www", nombre));
    copiados++;
  }
}
cpSync("images", join("www", "images"), { recursive: true });
console.log(`Listo: ${copiados} archivos + carpeta images copiados a "www".`);
