import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ECC Verteiler-App",
    short_name: "ECC Touren",
    description: "Mobile Touren-, QR- und GPS-App fuer Verteiler.",
    start_url: "/distributor/dashboard",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#102033",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "256x256",
        type: "image/x-icon",
      },
    ],
  };
}
