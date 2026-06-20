/**
 * VisualEngine.ts
 * Motor matemático y repositorio visual procedimental para Canvas 2D.
 */

export class PhysicsController {
    static applySpring(target: number, current: { value: number, velocity: number }, strength = 0.05, damping = 0.8) {
        const displacement = target - current.value;
        current.velocity += displacement * strength;
        current.velocity *= damping;
        current.value += current.velocity;
        return current;
    }

    static applyReactiveJitter(impactIntensity: number) {
        if (impactIntensity <= 0) return { dx: 0, dy: 0 };
        const timePhase = performance.now() * 0.05; 
        const maxAmplitude = impactIntensity * 8.0; 
        const dx = (Math.sin(timePhase) * Math.cos(timePhase * 0.77)) * maxAmplitude;
        const dy = (Math.cos(timePhase * 1.1) * Math.sin(timePhase * 0.5)) * maxAmplitude;
        return { dx, dy };
    }
}

export const VisualLibrary = {
    Sujeto: {
        neutral: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { x, y, scaleX = 1, scaleY = 1, color = '#ffffff' } = settings;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scaleX, scaleY);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, -45, 12, 0, Math.PI * 2); 
            ctx.ellipse(0, 10, 18, 40, 0, 0, Math.PI * 2);
            ctx.roundRect(-25, -20, 10, 50, 5); 
            ctx.roundRect(15, -20, 10, 50, 5); 
            ctx.fill();
            ctx.restore();
        },
        caida: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { x, y, scaleX = 1, scaleY = 1, color = '#ff4444' } = settings;
            const time = performance.now() * 0.005;
            ctx.save();
            ctx.translate(x, y + Math.sin(time)*10); 
            ctx.scale(scaleX, scaleY);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, -45, 12, 0, Math.PI * 2); 
            ctx.ellipse(0, 10, 16, 45, 0, 0, Math.PI * 2); 
            ctx.roundRect(-30, -60, 8, 50, 5); 
            ctx.roundRect(22, -60, 8, 50, 5);  
            ctx.fill();
            ctx.restore();
        }
    },
    ClimaLuz: {
        lluvia: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { density = 150, speed = 20, color = 'rgba(255,255,255,0.3)' } = settings;
            const time = performance.now() * 0.001;
            const height = ctx.canvas.height;
            const width = ctx.canvas.width;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for(let i=0; i<density; i++) {
                const x = (Math.sin(i * 74.3) * width + width) % width;
                const y = ((time * speed * (10 + i%10)) + (i * 100)) % height;
                ctx.moveTo(x, y);
                ctx.lineTo(x - 10, y + 60); 
            }
            ctx.stroke();
            ctx.restore();
        },
        ascension: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { density = 80, color = '#ffaa00' } = settings;
            const time = performance.now() * 0.0005;
            const height = ctx.canvas.height;
            const width = ctx.canvas.width;
            ctx.save();
            ctx.fillStyle = color;
            for(let i=0; i<density; i++) {
                const x = (Math.sin(i * 33.3) * width + width) % width;
                const drift = Math.sin(time * 2 + i) * 50;
                const y = height - (((time * 100 * (1 + (i%5)*0.2)) + (i * 80)) % height);
                ctx.globalAlpha = Math.abs(Math.sin(time * 3 + i)); 
                ctx.beginPath();
                ctx.arc(x + drift, y, (i%3)+1, 0, Math.PI*2);
                ctx.fill();
            }
            ctx.restore();
        }
    },
    Objetos: {
        maquina: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { x, y, gears = 3, color = '#1a1c23' } = settings;
            const rotation = performance.now() * 0.001;
            ctx.save();
            ctx.translate(x, y);
            ctx.fillStyle = color;
            for(let i=0; i<gears; i++) {
                ctx.rotate(rotation * (i % 2 === 0 ? 1 : -1));
                ctx.beginPath();
                // Engranajes proporcionales al tamaño del canvas
                ctx.arc(i * (ctx.canvas.width * 0.1), 0, ctx.canvas.width * 0.08, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        },
        rejas: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { x, color = '#444444' } = settings;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 5;
            for(let i=0; i<5; i++) {
                ctx.beginPath();
                ctx.moveTo(x + (i*50) - 100, 0);
                ctx.lineTo(x + (i*50) - 100, ctx.canvas.height);
                ctx.stroke();
            }
            ctx.restore();
        },
        ondas: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { x, y, color = '#00ffcc' } = settings;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            for(let i=1; i<4; i++) {
                ctx.beginPath();
                ctx.arc(x, y, i*50, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }
    },
    Avanzados: {
        redNeuronal: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { color = '#00ffcc', lineWidth = 2.5, nodeCount = 18 } = settings;
            ctx.save();
            const time = performance.now() * 0.002;
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            for(let i=0; i<nodeCount; i++) {
                const w = ctx.canvas.width;
                const h = ctx.canvas.height;
                // Nodos oscilantes por toda la pantalla
                const nx = (Math.sin(time + i) * (w * 0.3)) + (w / 2);
                const ny = (Math.cos(time + i * 2) * (h * 0.3)) + (h / 2);
                ctx.lineTo(nx, ny);
            }
            ctx.stroke();
            ctx.restore();
        },
        ondaChoque: (ctx: CanvasRenderingContext2D, settings: any) => {
            const { color = '#ff3366', lineWidth = 3.0, x, y } = settings;
            // Radio expansivo atado al tiempo
            const radius = (performance.now() * 0.5) % (ctx.canvas.width * 0.8);
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(x || ctx.canvas.width / 2, y || ctx.canvas.height / 2, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    },
    applyDoubleRender: (ctx: CanvasRenderingContext2D, drawPath: (ctx: CanvasRenderingContext2D) => void, settings: any) => {
        const color = settings.color || '#00FFFF';
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        drawPath(ctx);
        ctx.lineWidth = (settings.lineWidth || 2) * 3.5;
        ctx.strokeStyle = color;
        ctx.shadowBlur = 15; 
        ctx.shadowColor = color;
        ctx.globalAlpha = 0.5;
        ctx.stroke();

        ctx.beginPath();
        drawPath(ctx);
        ctx.lineWidth = (settings.lineWidth || 2) * 0.8;
        ctx.strokeStyle = '#FFFFFF';
        ctx.shadowBlur = 0; 
        ctx.globalAlpha = 1.0;
        ctx.stroke();
        ctx.restore();
    }
};

export class SceneAssembler {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    noiseCanvas: HTMLCanvasElement;
    visualData: any;
    rafId: number = 0;
    time: number = 0;
    hasLoggedTrace: boolean = false;

    constructor(canvas: HTMLCanvasElement, visualData: any) {
        console.log('Motor iniciado con:', JSON.stringify(visualData));
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.visualData = visualData;

        // Configurar Grano Fílmico (Offscreen Canvas para rendimiento)
        this.noiseCanvas = document.createElement('canvas');
        this.noiseCanvas.width = 512;
        this.noiseCanvas.height = 512;
        this._generateNoiseBuffer();

        this.loop = this.loop.bind(this);
    }

    _generateNoiseBuffer() {
        const nCtx = this.noiseCanvas.getContext('2d')!;
        const imgData = nCtx.createImageData(512, 512);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const noise = Math.random() * 45; // Intensidad del grano
            imgData.data[i] = noise;     // R
            imgData.data[i+1] = noise;   // G
            imgData.data[i+2] = noise;   // B
            imgData.data[i+3] = 255;     // Alpha
        }
        nCtx.putImageData(imgData, 0, 0);
    }

    start() {
        this.rafId = requestAnimationFrame(this.loop);
    }

    stop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    loop() {
        this.time += 0.02;
        const W = this.canvas.width = this.canvas.offsetWidth || 480;
        const H = this.canvas.height = this.canvas.offsetHeight || 854;

        if (!this.hasLoggedTrace) {
            console.log(`[TRAZA] Motor dibujando clip ${this.visualData.phraseIndex || 'desconocido'} con props: ${JSON.stringify(this.visualData.props || [])}`);
            this.hasLoggedTrace = true;
        }

        // 1. Limpieza y Fondo Base
        this.ctx.clearRect(0, 0, W, H);
        this.ctx.fillStyle = this.visualData.bg === 'tormenta' ? '#05070a' : '#0a0a0a';
        this.ctx.fillRect(0, 0, W, H);

        // 2. Capa Atmosférica (Clima)
        if (this.visualData.bg === 'tormenta') {
            VisualLibrary.ClimaLuz.lluvia(this.ctx, { density: 100, speed: 25, color: 'rgba(150,180,255,0.15)' });
        } else {
            VisualLibrary.ClimaLuz.ascension(this.ctx, { density: 50, color: '#ffaa00' });
        }

        // 3. Objetos Físicos (Mecánica)
        if (this.visualData.props && Array.isArray(this.visualData.props)) {
            if (this.visualData.props.includes('maquina')) {
                // Engranajes al fondo, opresivos y oscuros
                VisualLibrary.Objetos.maquina(this.ctx, { x: W/2, y: H, gears: 3, color: '#1a1c23' });
            }
            if (this.visualData.props.includes('rejas')) {
                VisualLibrary.Objetos.rejas(this.ctx, { x: W/2, y: H/2, color: '#444444' });
            }
            if (this.visualData.props.includes('ondas')) {
                VisualLibrary.Objetos.ondas(this.ctx, { x: W/2, y: H/2, color: '#00ffcc' });
            }
        }

        // 4. Sujetos y Físicas
        if (this.visualData.figures && Array.isArray(this.visualData.figures)) {
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.visualData.figures.forEach((fig: any, idx: number) => {
                let fx = W * (fig.x || 0.5);
                let fy = H * (fig.y || 0.5);
                
                if (fig.anim === 'vibrar') {
                    const jitter = PhysicsController.applyReactiveJitter(1.0);
                    fx += jitter.dx;
                    fy += jitter.dy;
                } else if (fig.anim === 'flotar') {
                    fy += Math.sin(this.time * 2 + idx) * 12;
                }

                // Aplicamos Double Render para que el sujeto también brille y se vea integrado
                VisualLibrary.applyDoubleRender(this.ctx, (ctx) => {
                    VisualLibrary.Sujeto.neutral(ctx, { 
                        x: fx, y: fy, 
                        scaleX: fig.scale || 1, scaleY: fig.scale || 1, 
                        color: fig.color || '#ffffff' 
                    });
                }, { color: fig.color, lineWidth: 2 });
            });
            // Reset shadows
            this.ctx.shadowBlur = 0;
            this.ctx.shadowColor = 'transparent';
        }

        // 5. Capa de Energía y Neón (Double Render)
        if (this.visualData.energy && Array.isArray(this.visualData.energy)) {
            // Activar modo de luz aditiva para quemar el sensor
            this.ctx.globalCompositeOperation = 'lighter';
            
            if (this.visualData.energy.includes('redNeuronal')) {
                VisualLibrary.applyDoubleRender(this.ctx, (ctx) => {
                    VisualLibrary.Avanzados.redNeuronal(ctx, { color: '#00ffcc', lineWidth: 2, nodeCount: 15 });
                }, { color: '#00ffcc', lineWidth: 2 });
            }
            if (this.visualData.energy.includes('ondaChoque')) {
                VisualLibrary.applyDoubleRender(this.ctx, (ctx) => {
                    VisualLibrary.Avanzados.ondaChoque(ctx, { color: '#ff3366', lineWidth: 3, x: W/2, y: H/2 });
                }, { color: '#ff3366', lineWidth: 3 });
            }
            
            // Restaurar renderizado normal
            this.ctx.globalCompositeOperation = 'source-over'; 
        }

        // 6. Post-procesamiento Cinematográfico
        this._applyPostProcessing(W, H);

        this.rafId = requestAnimationFrame(this.loop);
    }

    _applyPostProcessing(W: number, H: number) {
        this.ctx.save();
        
        // Viñeteado Radial
        const cx = W / 2, cy = H / 2;
        const maxRadius = Math.sqrt(cx*cx + cy*cy);
        const grad = this.ctx.createRadialGradient(cx, cy, maxRadius * 0.4, cx, cy, maxRadius);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.85)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, W, H);

        // Grano Fílmico (Overlay Cinético)
        this.ctx.globalCompositeOperation = 'overlay';
        this.ctx.globalAlpha = 0.35;
        const offsetX = (Math.random() * 512) | 0;
        const offsetY = (Math.random() * 512) | 0;
        this.ctx.translate(offsetX, offsetY);
        
        const pattern = this.ctx.createPattern(this.noiseCanvas, 'repeat');
        if (pattern) {
            this.ctx.fillStyle = pattern;
            this.ctx.fillRect(-offsetX, -offsetY, W + 512, H + 512);
        }
        
        this.ctx.restore();
    }
}
