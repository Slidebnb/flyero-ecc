/** The async Maps script can expose its namespace before its constructors. */
export async function waitForMapReadiness<T>(probe: () => Promise<T | null>, timeoutMs = 10_000, intervalMs = 50): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        probe(),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())); }),
      ]);
      if (value) return value;
    } catch {
      // A partially initialized library may reject its first import.
    } finally {
      clearTimeout(timer);
    }
    if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, deadline - Date.now())));
  }
  throw new Error("Die Karte konnte nicht rechtzeitig geladen werden.");
}
