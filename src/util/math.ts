export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Modulo that is always non-negative (unlike `%` for negative numbers). */
export const mod = (v: number, m: number): number => ((v % m) + m) % m;

/** Frame-rate independent smoothing factor for a time constant `tau` (s). */
export const smoothing = (dt: number, tau: number): number => 1 - Math.exp(-dt / tau);
