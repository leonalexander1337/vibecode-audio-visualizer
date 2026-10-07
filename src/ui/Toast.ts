/** Short status message in the corner, e.g. after a key press. */
export class Toast {
  private timer = 0;

  constructor(private readonly el: HTMLElement) {}

  show(text: string, ms = 1400): void {
    this.el.textContent = text;
    this.el.classList.add('visible');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove('visible'), ms);
  }
}
