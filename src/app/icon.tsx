import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050806",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
          fontWeight: 900,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 90, fontStyle: "italic", lineHeight: 1, whiteSpace: "nowrap" }}>
            <span>FLY</span>
            <span style={{ width: 74, height: 76, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
              <span style={{ height: 16, background: "#a7ff00" }} />
              <span style={{ height: 16, background: "#a7ff00" }} />
              <span style={{ height: 16, background: "#a7ff00" }} />
            </span>
            <span>RO</span>
          </div>
          <span style={{ fontSize: 18, letterSpacing: 6, whiteSpace: "nowrap" }}>LOKAL. EFFEKTIV. MESSBAR.</span>
        </div>
      </div>
    ),
    size,
  );
}
