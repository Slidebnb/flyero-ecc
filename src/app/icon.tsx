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
          color: "#b7e800",
          fontFamily: "Arial, sans-serif",
          fontWeight: 900,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ width: 210, height: 34, borderRadius: 999, background: "#b7e800" }} />
            <span style={{ width: 156, height: 34, borderRadius: 999, background: "#b7e800" }} />
            <span style={{ width: 92, height: 34, borderRadius: 999, background: "#b7e800" }} />
          </div>
          <span style={{ fontSize: 78, letterSpacing: 0 }}>FLYERO</span>
        </div>
      </div>
    ),
    size,
  );
}
