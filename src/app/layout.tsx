import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { createJsonLd, siteMetadata } from "./seo";
import "./globals.css";

export const metadata: Metadata = siteMetadata;
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#b7e800",
};
const jsonLd = createJsonLd();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
