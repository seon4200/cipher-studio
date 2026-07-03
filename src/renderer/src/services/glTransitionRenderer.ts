/* eslint-disable @typescript-eslint/no-var-requires */
const GLTransitions = require('gl-transitions') as any[];
const createTransition = require('gl-transition').default as any;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GLTransitionRenderer {
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private currentTransition: any = null;
  private queue: string[] = [];
  private lastUsed: string = '';

  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl');
    if (!gl) return false;
    this.gl = gl;
    return true;
  }

  private refillQueue(selected: string[]): void {
    let shuffled = shuffleArray(selected);
    if (shuffled.length > 1 && shuffled[0] === this.lastUsed) {
      const idx = Math.floor(Math.random() * (shuffled.length - 1)) + 1;
      const first = shuffled.splice(idx, 1)[0];
      shuffled = [first, ...shuffled];
    }
    this.queue = shuffled;
  }

  startNew(selectedTransitions: string[]): void {
    if (selectedTransitions.length === 0) return;
    if (this.queue.length === 0) this.refillQueue(selectedTransitions);
    const name = this.queue.shift()!;
    this.lastUsed = name;
    if (this.queue.length === 0) this.refillQueue(selectedTransitions);
    this.currentTransition = GLTransitions.find((t: any) => t.name === name) || GLTransitions[0];
  }

  draw(fromVideo: HTMLVideoElement, toVideo: HTMLVideoElement, progress: number): void {
    const { gl, canvas, currentTransition } = this;
    if (!gl || !canvas || !currentTransition) return;
    try {
      canvas.width = canvas.offsetWidth || 1280;
      canvas.height = canvas.offsetHeight || 720;
      gl.viewport(0, 0, canvas.width, canvas.height);
      const fromTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, fromTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fromVideo);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const toTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, toTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, toVideo);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const t = createTransition(gl, currentTransition);
      t.draw(
        progress,
        { bind: () => gl.bindTexture(gl.TEXTURE_2D, fromTex), shape: [canvas.width, canvas.height] },
        { bind: () => gl.bindTexture(gl.TEXTURE_2D, toTex), shape: [canvas.width, canvas.height] },
        canvas.width, canvas.height,
        currentTransition.defaultParams || {}
      );
      gl.deleteTexture(fromTex);
      gl.deleteTexture(toTex);
    } catch (e) {
      console.error('[GLTransition] Error:', e);
    }
  }

  destroy(): void {
    this.gl = null;
    this.canvas = null;
    this.currentTransition = null;
    this.queue = [];
    this.lastUsed = '';
  }
}
