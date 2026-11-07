// Genera las imágenes fuente del ícono y la pantalla de inicio de la app nativa de Marea.
//
//   node assets/generar-iconos.mjs        → escribe los PNG fuente en assets/ (y los de la tienda)
//   node assets/generar-iconos.mjs --tienda → solo las imágenes de la ficha de Google Play:
//                                           play-icon-512.png (ícono 512 × 512) y
//                                           play-feature-1024x500.png (gráfico de funciones)
//   npm run assets                        → además genera todos los tamaños para iOS y Android
//                                           (npx @capacitor/assets generate) y luego corre
//                                           este script con --despues para los retoques finales.
//
// Diseño: una "M" blanca de trazo redondeado con una ola debajo (Marea), sobre el verde de marca.
import sharp from "sharp";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(DIR, "..");
export const MARCA = "#5B7F6E";
export const FONDO = "#F7F5F1";

/** Trazos del logotipo en un lienzo de 1024 × 1024 (centro visual en 512, 512). */
export function logo(color, escala = 1) {
  const t = `translate(512 512) scale(${escala}) translate(-512 -522)`;
  return `
    <g transform="${t}" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M312 590 V360 L512 545 L712 360 V590" stroke-width="80"/>
      <path d="M292 690 q55 -34 110 0 t110 0 t110 0 t110 0" stroke-width="40" stroke-opacity=".82"/>
    </g>`;
}

const svg = (size, body, fondo) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      (fondo ? `<rect width="${size}" height="${size}" fill="${fondo}"/>` : "") +
      body +
      `</svg>`,
  );

/** `opaco`: sin canal alfa (App Store rechaza íconos con transparencia). */
async function png(nombre, buffer, opaco = true) {
  const img = sharp(buffer);
  await (opaco ? img.removeAlpha() : img).png({ compressionLevel: 9 }).toFile(join(DIR, nombre));
  console.log("✓", nombre);
}

/**
 * Retoques después de @capacitor/assets (que reescribe estos archivos):
 *  - capa monocromática del ícono adaptable (íconos temáticos de Android 13+);
 *  - borra las imágenes de ejemplo de la plantilla de Capacitor en Splash.imageset.
 */
function despues() {
  for (const nombre of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const f = join(RAIZ, "android/app/src/main/res/mipmap-anydpi-v26", nombre);
    if (!existsSync(f)) continue;
    const xml = readFileSync(f, "utf8");
    if (xml.includes("<monochrome>")) continue;
    writeFileSync(
      f,
      xml.replace(
        "</adaptive-icon>",
        `    <monochrome>\n        <inset android:drawable="@drawable/ic_launcher_monochrome" android:inset="16.7%" />\n    </monochrome>\n</adaptive-icon>`,
      ),
    );
    console.log("✓ monocromático en", nombre);
  }
  const splash = join(RAIZ, "ios/App/App/Assets.xcassets/Splash.imageset");
  if (existsSync(splash)) {
    for (const f of readdirSync(splash)) if (f.startsWith("splash-2732x2732")) rmSync(join(splash, f));
  }
}

/**
 * Imágenes de la ficha de Google Play (las pide Play Console; no van dentro de la app):
 *  - play-icon-512.png: el mismo ícono de la app reducido a 512 × 512, PNG sin transparencia.
 *  - play-feature-1024x500.png: gráfico de funciones obligatorio (1024 × 500, sin transparencia).
 */
async function tienda() {
  const fuente = join(DIR, "icon-only.png");
  const icono = existsSync(fuente) ? readFileSync(fuente) : svg(1024, logo("#fff"), MARCA);
  await sharp(icono)
    .resize(512, 512, { fit: "cover" })
    .flatten({ background: MARCA })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(join(DIR, "play-icon-512.png"));
  console.log("✓ play-icon-512.png");

  // Olas suaves de fondo, el logotipo a la izquierda y el nombre con una frase corta.
  // Todo lo importante queda lejos de las orillas (Google puede recortarlas o poner el botón de video encima).
  const olas = [0, 1, 2]
    .map((i) => {
      const y = 380 + i * 42;
      return `<path d="M-40 ${y} q64 -30 128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-opacity="${0.1 - i * 0.025}"/>`;
    })
    .join("");
  const texto = (y, size, weight, contenido, opacidad = 1) =>
    `<text x="408" y="${y}" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="#fff" fill-opacity="${opacidad}">${contenido}</text>`;
  const feature = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">` +
      `<rect width="1024" height="500" fill="${MARCA}"/>` +
      olas +
      `<g transform="translate(214 236) scale(0.42) translate(-512 -512)">${logo("#fff")}</g>` +
      texto(222, 96, 700, "Marea") +
      texto(286, 36, 500, "Reserva tus clases de yoga", 0.95) +
      texto(336, 26, 400, "Horario · Paquetes · Check-in con tu código", 0.8) +
      `</svg>`,
  );
  await sharp(feature).removeAlpha().png({ compressionLevel: 9 }).toFile(join(DIR, "play-feature-1024x500.png"));
  console.log("✓ play-feature-1024x500.png");
}

if (process.argv.includes("--despues")) {
  despues();
  process.exit(0);
}

if (process.argv.includes("--tienda")) {
  await tienda();
  process.exit(0);
}

// iOS (y ícono completo de Android): fondo de marca a sangre, sin transparencia (Apple la rechaza).
await png("icon-only.png", svg(1024, logo("#fff"), MARCA));
// Android adaptable: primer plano transparente + fondo liso. @capacitor/assets ya los reduce al área
// visible (inset de 16.7 %), así que el logotipo va a la misma escala que en iOS.
await png("icon-foreground.png", svg(1024, logo("#fff")), false);
await png("icon-background.png", svg(1024, "", MARCA));
// Pantalla de inicio: logotipo en color de marca sobre el fondo de la app (2732 × 2732).
await png("splash.png", svg(2732, `<g transform="translate(1366 1366) scale(1.3) translate(-512 -512)">${logo(MARCA)}</g>`, FONDO));
// La app solo tiene tema claro: en modo oscuro se usa la misma pantalla de inicio.
await png("splash-dark.png", svg(2732, `<g transform="translate(1366 1366) scale(1.3) translate(-512 -512)">${logo(MARCA)}</g>`, FONDO));
// Imágenes de la ficha de Google Play (a partir del ícono recién generado).
await tienda();
