import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FLYERO Verteiler",
    short_name: "FLYERO",
    description: "Mobile Verteiler-App für Auftragsannahme, Pickup, GPS-Tourtracking, Fotos und Tourabschluss.",
    start_url: "/distributor/dashboard",
    scope: "/distributor",
    display: "standalone",
    background_color: "#050806",
    theme_color: "#b7e800",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Heute",
        short_name: "Heute",
        description: "Verteiler-Dashboard öffnen",
        url: "/distributor/dashboard",
      },
      {
        name: "Nachrichten",
        short_name: "Nachrichten",
        description: "Verteiler-Nachrichten öffnen",
        url: "/distributor/notifications",
      },
    ],
  };
}
