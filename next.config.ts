import type { NextConfig } from "next";

/**
 * NEXT_OUTPUT=export genera un sitio estático en out/ para empaquetarlo dentro de la app
 * de iOS/Android (Capacitor). Sin esa variable (Vercel, `npm run build`) todo queda igual.
 */
const isExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isExport
    ? {
        output: "export",
        // /admin/clase/index.html en vez de /admin/clase.html: cualquier servidor de archivos
        // (y el WebView de la app) encuentra la página sin reglas de reescritura.
        trailingSlash: true,
        // La optimización de imágenes necesita servidor; en el sitio estático se sirven tal cual.
        images: { unoptimized: true },
      }
    : {
        // Las fichas antes vivían en /admin/clase/<id>, /admin/alumnos/<id> y /profesor/clase/<id>.
        // Ahora usan ?id= (las rutas dinámicas no se pueden exportar); los enlaces viejos siguen
        // funcionando en la web. `missing` evita redirigir /admin/alumnos/ficha?id=… a sí misma.
        async redirects() {
          const missingId = [{ type: "query" as const, key: "id" }];
          return [
            { source: "/admin/alumnos/ficha", destination: "/admin/alumnos", missing: missingId, permanent: false },
            { source: "/admin/clase/:id", destination: "/admin/clase?id=:id", missing: missingId, permanent: false },
            { source: "/admin/alumnos/:id", destination: "/admin/alumnos/ficha?id=:id", missing: missingId, permanent: false },
            { source: "/profesor/clase/:id", destination: "/profesor/clase?id=:id", missing: missingId, permanent: false },
          ];
        },
      }),
};

export default nextConfig;
