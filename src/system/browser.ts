/** Small browser integrations that keep a party setup running unattended. */

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => {});
}

/** Stops the laptop from dimming or sleeping while the visuals run. */
export function keepScreenAwake(): void {
  if (!('wakeLock' in navigator)) return;
  let lock: WakeLockSentinel | null = null;
  const request = async () => {
    if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      // Denied (e.g. battery saver) — nothing to do.
    }
  };
  document.addEventListener('visibilitychange', () => void request());
  void request();
}

/** Hides the mouse pointer after 2 s without movement. */
export function hideIdleCursor(): void {
  let timer = 0;
  const wake = () => {
    document.body.classList.remove('cursor-hidden');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => document.body.classList.add('cursor-hidden'), 2000);
  };
  window.addEventListener('mousemove', wake);
  wake();
}

/** Offline support for the built app (not in dev, where it would cache stale modules). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
