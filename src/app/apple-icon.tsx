import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
const brandName = "FLYERO";

export default function AppleIcon() {
  void brandName;
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ width: 82, height: 14, borderRadius: 999, background: "#b7e800" }} />
          <span style={{ width: 62, height: 14, borderRadius: 999, background: "#b7e800" }} />
          <span style={{ width: 38, height: 14, borderRadius: 999, background: "#b7e800" }} />
        </div>
      </div>
    ),
    size,
  );
}
