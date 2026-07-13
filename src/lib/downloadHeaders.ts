const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export function safeDownloadFilename(filename: string, fallback = "download") {
  const normalized = filename
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "_")
    .replace(/[\\/\"]/g, "_")
    .trim()
    .slice(0, 180);
  return normalized || fallback;
}

export function privateDownloadHeaders(input: {
  contentType: string;
  filename: string;
  inline?: boolean;
}) {
  return {
    "content-type": input.contentType,
    "content-disposition": `${input.inline ? "inline" : "attachment"}; filename="${safeDownloadFilename(input.filename)}"`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
}

export function rasterProofMimeType(value: unknown) {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp"
    ? value
    : "image/png";
}
