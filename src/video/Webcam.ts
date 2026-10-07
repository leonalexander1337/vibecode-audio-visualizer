/** The webcam as a video element the renderer can upload as a texture. Opened only around a cut-in. */
export class Webcam {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private opening: Promise<void> | null = null;

  constructor() {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    // Kept in the DOM (invisible): some browsers stop decoding detached videos.
    this.video.className = 'webcam-source';
    document.body.append(this.video);
  }

  get ready(): boolean {
    return this.stream !== null && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.video.videoWidth > 0;
  }

  get aspect(): number {
    return this.video.videoWidth / Math.max(1, this.video.videoHeight);
  }

  /** Asks for permission once up front, so no prompt pops up on the projector mid-party. */
  static async requestPermission(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    for (const t of stream.getTracks()) t.stop();
  }

  open(): Promise<void> {
    if (this.stream) return Promise.resolve();
    this.opening ??= navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false })
      .then(async (stream) => {
        this.stream = stream;
        this.video.srcObject = stream;
        await this.video.play();
      })
      .finally(() => {
        this.opening = null;
      });
    return this.opening;
  }

  close(): void {
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.stream = null;
    this.video.srcObject = null;
  }
}
