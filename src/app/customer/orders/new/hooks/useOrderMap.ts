"use client";

import { useEffect, useState } from "react";

type UseOrderMapOptions = {
  loadGoogleMaps: () => Promise<boolean>;
};

export function useOrderMap({ loadGoogleMaps }: UseOrderMapOptions): {
  mapsReady: boolean;
  mapsLoadStatus: "loading" | "ready" | "unavailable";
} {
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsLoadStatus, setMapsLoadStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let isMounted = true;
    loadGoogleMaps().then((ready) => {
      if (!isMounted) return;
      setMapsReady(ready);
      setMapsLoadStatus(ready ? "ready" : "unavailable");
    });
    return () => {
      isMounted = false;
    };
  }, [loadGoogleMaps]);

  return { mapsReady, mapsLoadStatus };
}
