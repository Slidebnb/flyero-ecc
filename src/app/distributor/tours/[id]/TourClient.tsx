"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  tourId: string;
  qrCode?: string | null;
  status: string;
};

type GpsPoint = {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  battery?: number;
  recordedAt: string;
  source: string;
};

const bufferKey = (tourId: string) => `ecc:gps-buffer:${tourId}`;

export function TourClient({ tourId, qrCode, status }: Props) {
  const [message, setMessage] = useState("");
  const [manualQr, setManualQr] = useState(qrCode ?? "");
  const [localStatus, setLocalStatus] = useState(status);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastPointRef = useRef<GpsPoint | null>(null);

  async function post(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : JSON.stringify({}),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.ok === false) {
      throw new Error(json.error || "Aktion fehlgeschlagen.");
    }
    return json;
  }

  function getBufferedPoints() {
    try {
      return JSON.parse(localStorage.getItem(bufferKey(tourId)) || "[]") as GpsPoint[];
    } catch {
      return [];
    }
  }

  function setBufferedPoints(points: GpsPoint[]) {
    localStorage.setItem(bufferKey(tourId), JSON.stringify(points));
  }

  async function flushBufferedPoints() {
    const points = getBufferedPoints();
    if (points.length === 0) return;
    await post(`/api/distributor/tours/${tourId}/gps`, { points });
    setBufferedPoints([]);
    setMessage(`${points.length} gepufferte GPS-Punkte hochgeladen.`);
  }

  async function sendGpsPoint(point: GpsPoint) {
    if (!navigator.onLine) {
      setBufferedPoints([...getBufferedPoints(), point]);
      setMessage("Offline: GPS-Punkt lokal gespeichert.");
      return;
    }
    try {
      await flushBufferedPoints();
      await post(`/api/distributor/tours/${tourId}/gps`, { points: [point] });
      setMessage("GPS gespeichert.");
    } catch {
      setBufferedPoints([...getBufferedPoints(), point]);
      setMessage("Upload fehlgeschlagen: GPS-Punkt lokal gespeichert.");
    }
  }

  function createPoint(position: GeolocationPosition): GpsPoint {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed ?? undefined,
      heading: position.coords.heading ?? undefined,
      altitude: position.coords.altitude ?? undefined,
      recordedAt: new Date(position.timestamp).toISOString(),
      source: "browser",
    };
  }

  function shouldSend(point: GpsPoint) {
    const lastPoint = lastPointRef.current;
    if (!lastPoint) return true;
    const seconds = (new Date(point.recordedAt).getTime() - new Date(lastPoint.recordedAt).getTime()) / 1000;
    if (seconds >= 15) return true;
    const latMeters = Math.abs(point.lat - lastPoint.lat) * 111320;
    const lngMeters = Math.abs(point.lng - lastPoint.lng) * 71400;
    return Math.sqrt(latMeters * latMeters + lngMeters * lngMeters) >= 15;
  }

  async function pickup() {
    try {
      await post(`/api/distributor/tours/${tourId}/pickup`, { qrCode: manualQr });
      setLocalStatus("PICKED_UP");
      setMessage("Abholung bestaetigt.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR-Code ungueltig.");
    }
  }

  async function start() {
    if (!navigator.geolocation) {
      setMessage("Standort ist auf diesem Geraet nicht verfuegbar.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const firstPoint = createPoint(position);
          await post(`/api/distributor/tours/${tourId}/start`, firstPoint);
          lastPointRef.current = firstPoint;
          const id = navigator.geolocation.watchPosition(
            async (nextPosition) => {
              const point = createPoint(nextPosition);
              if (shouldSend(point)) {
                lastPointRef.current = point;
                await sendGpsPoint(point);
              }
            },
            () => setMessage("GPS deaktiviert oder nicht freigegeben."),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
          );
          setWatchId(id);
          setLocalStatus("STARTED");
          setMessage("Tour gestartet. GPS laeuft.");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Tourstart fehlgeschlagen.");
        }
      },
      () => setMessage("Standortfreigabe verweigert. Tour kann nicht gestartet werden."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  }

  async function pause() {
    await post(`/api/distributor/tours/${tourId}/pause`);
    setLocalStatus("PAUSED");
    setMessage("Tour pausiert. GPS-Puffer bleibt aktiv.");
  }

  async function resume() {
    await post(`/api/distributor/tours/${tourId}/resume`);
    setLocalStatus("RESUMED");
    setMessage("Tour fortgesetzt.");
  }

  async function openScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMessage("Kamera aktiv. Falls kein Scan erkannt wird, QR-Wert manuell einfuegen.");
      const BarcodeDetectorCtor = (window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }).BarcodeDetector;
      if (BarcodeDetectorCtor && videoRef.current) {
        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        const scan = async () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const rawValue = codes[0]?.rawValue;
            if (rawValue) {
              setManualQr(rawValue);
              setMessage("QR-Code erkannt. Abholung kann bestaetigt werden.");
              streamRef.current?.getTracks().forEach((track) => track.stop());
              return;
            }
          } catch {
            return;
          }
          window.setTimeout(scan, 700);
        };
        window.setTimeout(scan, 700);
      }
    } catch {
      setMessage("Kamera konnte nicht geoeffnet werden.");
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await post(`/api/distributor/tours/${tourId}/photo`, {
          imageDataUrl: String(reader.result),
          takenAt: new Date().toISOString(),
        });
        setMessage("Foto gespeichert.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Foto-Upload fehlgeschlagen.");
      }
    };
    reader.readAsDataURL(file);
  }

  async function complete(formData: FormData) {
    try {
      await post(`/api/distributor/tours/${tourId}/complete`, {
        remainingFlyers: Number(formData.get("remainingFlyers")),
        notes: formData.get("notes")?.toString(),
      });
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      await flushBufferedPoints();
      setMessage("Tour abgeschlossen und an Admin-Pruefung uebergeben.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tourabschluss fehlgeschlagen.");
    }
  }

  useEffect(() => {
    const online = () => {
      setIsOnline(true);
      flushBufferedPoints().catch(() => undefined);
    };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
    // flushBufferedPoints nutzt bewusst den aktuellen localStorage-Puffer dieser Tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, watchId]);

  return (
    <section className="mobileControls">
      <div className={isOnline ? "badge success" : "badge warning"}>{isOnline ? "Online" : "Offline-Puffer aktiv"}</div>
      {message ? <p className="notice">{message}</p> : null}

      <div className="mobileCard">
        <h2 className="sectionTitle">Abholung</h2>
        <video ref={videoRef} className="scannerVideo" playsInline muted />
        <button type="button" onClick={openScanner}>Kamera fuer QR-Scan oeffnen</button>
        <label>
          QR-Wert
          <textarea value={manualQr} onChange={(event) => setManualQr(event.target.value)} />
        </label>
        <button type="button" onClick={pickup} disabled={localStatus !== "ASSIGNED" && localStatus !== "READY"}>
          Abholung bestaetigen
        </button>
      </div>

      <div className="mobileActionGrid">
        <button type="button" onClick={start} disabled={localStatus !== "PICKED_UP" && localStatus !== "RESUMED"}>
          Tour starten
        </button>
        <button type="button" onClick={pause} disabled={localStatus !== "STARTED" && localStatus !== "RESUMED"}>
          Pause
        </button>
        <button type="button" onClick={resume} disabled={localStatus !== "PAUSED"}>
          Fortsetzen
        </button>
      </div>

      <div className="mobileCard">
        <h2 className="sectionTitle">Foto</h2>
        <input type="file" accept="image/*" capture="environment" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
      </div>

      <form className="mobileCard form" action={complete}>
        <h2 className="sectionTitle">Tour abschliessen</h2>
        <label>
          Restflyer
          <input name="remainingFlyers" type="number" min="0" required />
        </label>
        <label>
          Notiz
          <textarea name="notes" />
        </label>
        <button type="submit" disabled={!["STARTED", "PAUSED", "RESUMED"].includes(localStatus)}>
          Tour abschliessen
        </button>
      </form>
    </section>
  );
}
