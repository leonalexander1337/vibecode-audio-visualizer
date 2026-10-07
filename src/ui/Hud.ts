/** Monospace overlay, refreshed at ~10 Hz while visible. */
export class Hud {
  private visible = false;
  private lastUpdate = 0;

  constructor(private readonly el: HTMLElement) {}

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
    this.lastUpdate = 0;
  }

  update(now: number, text: () => string): void {
    if (!this.visible || now - this.lastUpdate < 100) return;
    this.lastUpdate = now;
    this.el.textContent = text();
  }
}

export function bar(value: number, width = 12): string {
  const n = Math.round(Math.max(0, Math.min(1, value)) * width);
  return '█'.repeat(n) + '░'.repeat(width - n);
}
