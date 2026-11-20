import { useEffect, useState } from "react";

/** Registers the offline worker (D24, provisional). Production builds only: dev has no sw.js. */
export function registerServiceWorker(
  nav: Pick<Navigator, "serviceWorker"> | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
  production: boolean = import.meta.env.PROD,
): void {
  if (!production || !nav || !("serviceWorker" in nav)) return;
  nav.serviceWorker.register("/sw.js").catch(() => undefined);
}

/** True while the browser says it has a connection. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine !== false,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
