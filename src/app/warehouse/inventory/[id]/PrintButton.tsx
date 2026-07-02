"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}>
      QR-Code drucken
    </button>
  );
}
