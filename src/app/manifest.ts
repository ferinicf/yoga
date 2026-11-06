import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mi Estudio de Yoga",
    short_name: "Yoga",
    description: "Reserva tus clases y administra tu estudio.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f1",
    theme_color: "#5b7f6e",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
