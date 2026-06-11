import { useEffect, useRef } from 'react';

export type HologramArchetype = 
  | 'red_neuronal' | 'explosion' | 'figuras_humanas' | 'lluvia_particulas' 
  | 'ascenso_particulas' | 'barras_prision' | 'orbitas' | 'monedas_cayendo' 
  | 'corazon_latiente' | 'ondas_sonoras' | 'globo_terraqueo' | 'reloj_arena' 
  | 'balanza_justicia' | 'engranajes' | 'arbol_creciendo' | 'laberinto' 
  | 'escudo' | 'ojo_observador' | 'puente' | 'espiral_caos';

export const HOLOGRAM_DICTIONARY: Record<string, HologramArchetype> = {
  cerebro: 'red_neuronal', neurona: 'red_neuronal', aprendizaje: 'red_neuronal', mente: 'red_neuronal', inteligencia: 'red_neuronal', memoria: 'red_neuronal', pensamiento: 'red_neuronal', cognicion: 'red_neuronal', sinapsis: 'red_neuronal', conexion: 'red_neuronal', procesamiento: 'red_neuronal',
  energia: 'explosion', impacto: 'explosion', destruccion: 'explosion', fuerza: 'explosion', potencia: 'explosion', choque: 'explosion', detonacion: 'explosion', ruptura: 'explosion', estallido: 'explosion', colapso: 'explosion', catastrofe: 'explosion',
  persona: 'figuras_humanas', gente: 'figuras_humanas', comunidad: 'figuras_humanas', multitud: 'figuras_humanas', sociedad: 'figuras_humanas', familia: 'figuras_humanas', grupo: 'figuras_humanas', equipo: 'figuras_humanas', humanidad: 'figuras_humanas', individuo: 'figuras_humanas', relacion: 'figuras_humanas',
  caida: 'lluvia_particulas', descenso: 'lluvia_particulas', lluvia: 'lluvia_particulas', tristeza: 'lluvia_particulas', perdida: 'lluvia_particulas', decadencia: 'lluvia_particulas', deterioro: 'lluvia_particulas', melancolia: 'lluvia_particulas', crisis: 'lluvia_particulas', problema: 'lluvia_particulas', dificultad: 'lluvia_particulas',
  exito: 'ascenso_particulas', progreso: 'ascenso_particulas', mejora: 'ascenso_particulas', evolucion: 'ascenso_particulas', ascenso: 'ascenso_particulas', logro: 'ascenso_particulas', superacion: 'ascenso_particulas', avance: 'ascenso_particulas', desarrollo: 'ascenso_particulas', prosperidad: 'ascenso_particulas', abundancia: 'ascenso_particulas',
  trampa: 'barras_prision', limite: 'barras_prision', restriccion: 'barras_prision', obstaculo: 'barras_prision', control: 'barras_prision', prision: 'barras_prision', barrera: 'barras_prision', bloqueo: 'barras_prision', dependencia: 'barras_prision', adiccion: 'barras_prision', encierro: 'barras_prision',
  sistema: 'orbitas', ciclo: 'orbitas', rotacion: 'orbitas', planeta: 'orbitas', universo: 'orbitas', cosmos: 'orbitas', gravedad: 'orbitas', atraccion: 'orbitas', orden: 'orbitas', patron: 'orbitas', periodicidad: 'orbitas',
  dinero: 'monedas_cayendo', riqueza: 'monedas_cayendo', finanzas: 'monedas_cayendo', economia: 'monedas_cayendo', inversion: 'monedas_cayendo', ganancias: 'monedas_cayendo', ingresos: 'monedas_cayendo', capital: 'monedas_cayendo', fortuna: 'monedas_cayendo', patrimonio: 'monedas_cayendo', ahorro: 'monedas_cayendo',
  amor: 'corazon_latiente', emocion: 'corazon_latiente', salud: 'corazon_latiente', pasion: 'corazon_latiente', sentimiento: 'corazon_latiente', corazon: 'corazon_latiente', bienestar: 'corazon_latiente', vitalidad: 'corazon_latiente', pulso: 'corazon_latiente', latido: 'corazon_latiente', afecto: 'corazon_latiente',
  musica: 'ondas_sonoras', sonido: 'ondas_sonoras', frecuencia: 'ondas_sonoras', vibracion: 'ondas_sonoras', ritmo: 'ondas_sonoras', audio: 'ondas_sonoras', comunicacion: 'ondas_sonoras', voz: 'ondas_sonoras', senal: 'ondas_sonoras', onda: 'ondas_sonoras', resonancia: 'ondas_sonoras',
  mundo: 'globo_terraqueo', global: 'globo_terraqueo', internacional: 'globo_terraqueo', geografia: 'globo_terraqueo', pais: 'globo_terraqueo', viaje: 'globo_terraqueo', cultura: 'globo_terraqueo', tierra: 'globo_terraqueo', nacion: 'globo_terraqueo', continente: 'globo_terraqueo', fronteras: 'globo_terraqueo',
  tiempo: 'reloj_arena', plazo: 'reloj_arena', urgencia: 'reloj_arena', espera: 'reloj_arena', paciencia: 'reloj_arena', deadline: 'reloj_arena', demora: 'reloj_arena', duracion: 'reloj_arena', momento: 'reloj_arena', temporalidad: 'reloj_arena', historia: 'reloj_arena',
  justicia: 'balanza_justicia', equilibrio: 'balanza_justicia', decision: 'balanza_justicia', eleccion: 'balanza_justicia', comparar: 'balanza_justicia', balance: 'balanza_justicia', ventaja: 'balanza_justicia', desventaja: 'balanza_justicia', pros: 'balanza_justicia', contras: 'balanza_justicia', evaluacion: 'balanza_justicia',
  proceso: 'engranajes', mecanismo: 'engranajes', trabajo: 'engranajes', industria: 'engranajes', produccion: 'engranajes', maquina: 'engranajes', automatizacion: 'engranajes', eficiencia: 'engranajes', estructura: 'engranajes', organizacion: 'engranajes', manufactura: 'engranajes',
  naturaleza: 'arbol_creciendo', vida: 'arbol_creciendo', origen: 'arbol_creciendo', raiz: 'arbol_creciendo', fundamento: 'arbol_creciendo', tradicion: 'arbol_creciendo', herencia: 'arbol_creciendo', base: 'arbol_creciendo', inicio: 'arbol_creciendo', fuente: 'arbol_creciendo', crecimiento: 'arbol_creciendo',
  confusion: 'laberinto', complejidad: 'laberinto', busqueda: 'laberinto', solucion: 'laberinto', estrategia: 'laberinto', ruta: 'laberinto', camino: 'laberinto', analisis: 'laberinto', incertidumbre: 'laberinto', navegacion: 'laberinto', perderse: 'laberinto',
  proteccion: 'escudo', seguridad: 'escudo', defensa: 'escudo', privacidad: 'escudo', riesgo: 'escudo', amenaza: 'escudo', vulnerabilidad: 'escudo', fortaleza: 'escudo', resistencia: 'escudo', inmunidad: 'escudo', prevencion: 'escudo',
  vigilancia: 'ojo_observador', observacion: 'ojo_observador', atencion: 'ojo_observador', percepcion: 'ojo_observador', vision: 'ojo_observador', consciencia: 'ojo_observador', enfoque: 'ojo_observador', perspectiva: 'ojo_observador', descubrimiento: 'ojo_observador', insight: 'ojo_observador', detalle: 'ojo_observador',
  transicion: 'puente', cambio: 'puente', paso: 'puente', union: 'puente', integracion: 'puente', enlace: 'puente', acceso: 'puente', oportunidad: 'puente', cruce: 'puente', nexo: 'puente', vinculo: 'puente',
  caos: 'espiral_caos', desorden: 'espiral_caos', vertigo: 'espiral_caos', estres: 'espiral_caos', ansiedad: 'espiral_caos', desequilibrio: 'espiral_caos', tormenta: 'espiral_caos', saturacion: 'espiral_caos', vorago: 'espiral_caos', caotismo: 'espiral_caos', turbulencia: 'espiral_caos',
};

const normalizeKeyword = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

export function getArchetype(keyword: string): HologramArchetype {
  const norm = normalizeKeyword(keyword);
  return HOLOGRAM_DICTIONARY[norm] || 'ascenso_particulas';
}

interface HologramCanvasProps {
  archetype: HologramArchetype;
  width: number;
  height: number;
  isPlaying: boolean;
}

export function HologramCanvas({ archetype, width, height, isPlaying }: HologramCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafId = useRef<number>(0);
  const stateRef = useRef<any>({});
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const cx = width / 2;
    const cy = height / 2;

    // Initialize animation state per archetype
    const s: any = { time: 0 };
    
    if (archetype === 'red_neuronal') {
      s.nodes = Array.from({length: 40}).map(() => ({
        x: cx + (Math.random()-0.5)*240, 
        y: cy - 20 + (Math.random()-0.5)*160, 
        vx: (Math.random()-0.5)*0.8, 
        vy: (Math.random()-0.5)*0.8
      }));
    } else if (archetype === 'explosion') {
      s.particles = Array.from({length: 80}).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        return { x: cx, y: cy, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, size: 2 + Math.random()*4, rot: Math.random()*Math.PI*2 };
      });
      s.smoke = Array.from({length: 30}).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3;
        return { x: cx, y: cy, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, size: 10 + Math.random()*30, alpha: 0.6 };
      });
      s.flashes = Array.from({length: 15}).map(() => ({
        angle: Math.random()*Math.PI*2, 
        length: 80 + Math.random()*120
      }));
    } else if (archetype === 'figuras_humanas') {
      s.figures = Array.from({length: 6}).map((_, i) => ({ 
        x: (i * width/6), 
        y: cy + 50, 
        speed: 1 + Math.random() 
      }));
      s.parts = [];
    } else if (archetype === 'lluvia_particulas') {
      s.rain = Array.from({length: 120}).map(() => ({ 
        x: Math.random()*width*1.5, 
        y: Math.random()*height, 
        speed: 6 + Math.random()*12 
      }));
      s.clouds = Array.from({length: 5}).map((_, i) => ({ 
        x: width*0.25*i, 
        y: 40, 
        w: 120 + Math.random()*150, 
        h: 40 + Math.random()*30 
      }));
    } else if (archetype === 'ascenso_particulas') {
      s.asc = Array.from({length: 100}).map(() => ({ 
        x: Math.random()*width, 
        y: height + Math.random()*height, 
        speed: 2 + Math.random()*5 
      }));
    } else if (archetype === 'barras_prision') {
      s.trapped = Array.from({length: 30}).map(() => ({ 
        x: cx + (Math.random()-0.5)*280, 
        y: Math.random()*height, 
        vx: (Math.random()-0.5)*6, 
        vy: (Math.random()-0.5)*3 
      }));
    } else if (archetype === 'orbitas') {
      s.orb = [
        { rx: 120, ry: 50, speed: 0.04, p: [0, Math.PI] },
        { rx: 180, ry: 70, speed: 0.025, p: [0, Math.PI*0.5, Math.PI*1.5] },
        { rx: 240, ry: 90, speed: 0.015, p: [0, Math.PI] }
      ];
    } else if (archetype === 'monedas_cayendo') {
      s.coins = Array.from({length: 25}).map(() => ({ 
        x: Math.random()*width, 
        y: -Math.random()*height, 
        speed: 3 + Math.random()*5, 
        rot: Math.random() 
      }));
    } else if (archetype === 'corazon_latiente') {
      s.hparts = Array.from({length: 40}).map(() => ({ 
        angle: Math.random()*Math.PI*2, 
        dist: 60 + Math.random()*120, 
        speed: (Math.random()-0.5)*0.06 
      }));
    } else if (archetype === 'ondas_sonoras') {
      s.sparts = Array.from({length: 30}).map(() => ({ 
        x: Math.random()*width, 
        y: Math.random()*height, 
        vx: (Math.random()-0.5)*2.5, 
        vy: (Math.random()-0.5)*2.5 
      }));
    } else if (archetype === 'globo_terraqueo') {
      s.spots = Array.from({length: 15}).map(() => ({ 
        lat: (Math.random()-0.5)*Math.PI*0.8, 
        lon: Math.random()*Math.PI*2 
      }));
    } else if (archetype === 'reloj_arena') {
      s.sand = Array.from({length: 50}).map(() => ({ 
        x: cx + (Math.random()-0.5)*50, 
        y: cy - 90 + Math.random()*80, 
        active: false 
      }));
    } else if (archetype === 'balanza_justicia') {
      s.dust = Array.from({length: 20}).map(() => ({ 
        x: cx + (Math.random()>0.5?-100:100) + (Math.random()-0.5)*25, 
        y: cy - 20, 
        life: Math.random() 
      }));
    } else if (archetype === 'engranajes') {
      s.sparks = [];
    } else if (archetype === 'arbol_creciendo') {
      s.leaves = [];
    } else if (archetype === 'laberinto') {
      s.runners = Array.from({length: 5}).map(() => ({ 
        x: cx-100, y: cy-100, tx: cx-100, ty: cy-100, special: Math.random()>0.7 
      }));
    } else if (archetype === 'escudo') {
      s.threats = Array.from({length: 12}).map(() => ({ 
        angle: Math.random()*Math.PI*2, 
        dist: 250 + Math.random()*100 
      }));
    } else if (archetype === 'ojo_observador') {
      s.info = Array.from({length: 15}).map(() => ({ 
        angle: Math.random()*Math.PI*2, 
        speed: 0.02 + Math.random()*0.04 
      }));
    } else if (archetype === 'puente') {
      s.cars = Array.from({length: 15}).map(() => ({ 
        x: -Math.random()*width, 
        y: cy + (Math.random()-0.5)*25, 
        speed: 3 + Math.random()*4 
      }));
    } else if (archetype === 'espiral_caos') {
      s.chaos = Array.from({length: 30}).map(() => ({ 
        angle: Math.random()*Math.PI*2, 
        dist: 250 + Math.random()*150 
      }));
    }

    stateRef.current = s;

    const render = () => {
      if (!isPlayingRef.current) {
        rafId.current = requestAnimationFrame(render);
        return;
      }
      
      const st = stateRef.current;
      st.time += 0.05;
      const t = st.time;
      
      // Fondo muy oscuro obligatorio
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, width, height);
      ctx.save();

      if (archetype === 'red_neuronal') {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 20, 140, 90, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#00ffff';
        st.nodes.forEach((n: any, i: number) => {
          n.x += n.vx; n.y += n.vy;
          if (Math.abs(n.x - cx) > 140) n.vx *= -1;
          if (Math.abs(n.y - (cy-20)) > 90) n.vy *= -1;
          
          const scale = 1 + Math.sin(t + i) * 0.2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 3 * scale, 0, Math.PI * 2);
          ctx.fill();
          
          for(let j=i+1; j<st.nodes.length; j++) {
            const n2 = st.nodes[j];
            const dx = n.x - n2.x; const dy = n.y - n2.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 120) {
              ctx.beginPath();
              ctx.strokeStyle = `rgba(0, 255, 255, ${0.8 - dist/120})`;
              ctx.lineWidth = 1;
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(n2.x, n2.y);
              ctx.stroke();
            }
          }
        });
      } else if (archetype === 'explosion') {
        ctx.fillStyle = 'rgba(255, 100, 0, 0.2)';
        st.smoke.forEach((p: any) => {
          p.x += p.vx; p.y += p.vy; p.size += 0.6; p.alpha -= 0.006;
          if (p.alpha > 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
            ctx.fill();
          }
        });
        
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
        ctx.lineWidth = 2;
        st.flashes.forEach((f: any) => {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(f.angle)*f.length, cy + Math.sin(f.angle)*f.length);
          ctx.stroke();
        });
        
        ctx.fillStyle = '#ff4400';
        st.particles.forEach((p: any) => {
          p.x += p.vx; p.y += p.vy; p.rot += 0.25;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size, -p.size/2, p.size*2, p.size);
          ctx.restore();
          
          if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
            p.x = cx; p.y = cy;
          }
        });
      } else if (archetype === 'figuras_humanas') {
        ctx.strokeStyle = '#8b5cf6';
        ctx.fillStyle = '#ffffff';
        st.figures.forEach((f: any, i: number) => {
          f.x += f.speed;
          if (f.x > width + 50) f.x = -50;
          
          const legSwing = Math.sin(t * 4 + i);
          
          ctx.beginPath();
          ctx.arc(f.x, f.y - 45, 12, 0, Math.PI*2);
          ctx.fill();
          
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y - 33);
          ctx.lineTo(f.x, f.y);
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x - 12 * legSwing, f.y + 25);
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x + 12 * legSwing, f.y + 25);
          ctx.stroke();
          
          if (Math.random() < 0.2) {
            st.parts.push({ x: f.x, y: f.y - 20 + Math.random()*40, vx: -Math.random()*2, vy: (Math.random()-0.5)*2, life: 1 });
          }
        });
        
        st.parts.forEach((p: any, i: number) => {
          p.x += p.vx; p.y += p.vy; p.life -= 0.02;
          ctx.fillStyle = `rgba(139, 92, 246, ${p.life})`;
          ctx.fillRect(p.x, p.y, 4, 4);
          if (p.life <= 0) st.parts.splice(i, 1);
        });
      } else if (archetype === 'lluvia_particulas') {
        ctx.fillStyle = 'rgba(100, 150, 200, 0.3)';
        st.clouds.forEach((c: any) => {
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI*2);
          ctx.fill();
        });
        
        ctx.strokeStyle = '#6496c8';
        ctx.lineWidth = 1.5;
        st.rain.forEach((r: any) => {
          r.x -= r.speed * 0.4;
          r.y += r.speed;
          if (r.y > height) { r.y = -20; r.x = Math.random()*width + 300; }
          
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x + r.speed*0.4, r.y - r.speed);
          ctx.stroke();
        });
      } else if (archetype === 'ascenso_particulas') {
        const grad = ctx.createLinearGradient(0, 0, 0, 250);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, 250);
        
        st.asc.forEach((p: any) => {
          p.speed += 0.015;
          p.y -= p.speed;
          p.x += Math.sin(t + p.y*0.01);
          if (p.y < -20) { p.y = height + 20; p.speed = 2+Math.random()*5; }
          
          const progress = 1 - (p.y / height);
          const size = 1.5 + progress * 5;
          
          ctx.fillStyle = p.y < 250 ? '#ffffff' : '#ffd700';
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI*2);
          ctx.fill();
        });
      } else if (archetype === 'barras_prision') {
        ctx.fillStyle = '#00ff88';
        st.trapped.forEach((p: any) => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < cx - 180) { p.x = cx - 180; p.vx *= -1; }
          if (p.x > cx + 180) { p.x = cx + 180; p.vx *= -1; }
          if (p.y < 0 || p.y > height) p.vy *= -1;
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
          ctx.fill();
        });
        
        for(let i=0; i<9; i++) {
          const bx = cx - 220 + i * 55;
          const bg = ctx.createLinearGradient(bx, 0, bx+18, 0);
          bg.addColorStop(0, '#111'); bg.addColorStop(0.5, '#444'); bg.addColorStop(1, '#0a0a0a');
          ctx.fillStyle = bg;
          ctx.fillRect(bx, 0, 18, height);
        }
        
        const sg = ctx.createLinearGradient(0, 0, width, 0);
        sg.addColorStop(0, 'rgba(0,0,0,0.85)'); sg.addColorStop(0.25, 'rgba(0,0,0,0)'); 
        sg.addColorStop(0.75, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, width, height);
      } else if (archetype === 'orbitas') {
        ctx.fillStyle = '#0088ff';
        const pulse = 1 + Math.sin(t*4)*0.2;
        ctx.beginPath(); ctx.arc(cx, cy, 25*pulse, 0, Math.PI*2); ctx.fill();
        
        ctx.strokeStyle = 'rgba(0, 136, 255, 0.4)';
        ctx.lineWidth = 1.5;
        st.orb.forEach((o: any, i: number) => {
          ctx.beginPath();
          ctx.ellipse(cx, cy, o.rx, o.ry, i*Math.PI/4, 0, Math.PI*2);
          ctx.stroke();
          
          o.p.forEach((angleOffset: number) => {
            const angle = t * o.speed + angleOffset;
            const px = cx + Math.cos(angle)*o.rx*Math.cos(i*Math.PI/4) - Math.sin(angle)*o.ry*Math.sin(i*Math.PI/4);
            const py = cy + Math.cos(angle)*o.rx*Math.sin(i*Math.PI/4) + Math.sin(angle)*o.ry*Math.cos(i*Math.PI/4);
            
            ctx.fillStyle = '#00ffff';
            ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2); ctx.fill();
            
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            for(let step=1; step<=12; step++) {
               const ta = angle - step*0.06;
               const tx = cx + Math.cos(ta)*o.rx*Math.cos(i*Math.PI/4) - Math.sin(ta)*o.ry*Math.sin(i*Math.PI/4);
               const ty = cy + Math.cos(ta)*o.rx*Math.sin(i*Math.PI/4) + Math.sin(ta)*o.ry*Math.cos(i*Math.PI/4);
               if (step===1) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
            }
            ctx.stroke();
          });
        });
      } else if (archetype === 'monedas_cayendo') {
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(cx-60, height-30, 25, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+60, height-40, 25, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, height-20, 30, Math.PI, 0); ctx.fill();
        
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 2.5;
        st.coins.forEach((c: any) => {
          c.y += c.speed;
          c.rot += 0.15;
          if (c.y > height - 10) { 
            c.y = -30; c.x = Math.random()*width; 
          }
          
          const scaleX = Math.abs(Math.sin(c.rot));
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.scale(scaleX, 1);
          ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#b8860b';
          ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 1);
          ctx.restore();
        });
      } else if (archetype === 'corazon_latiente') {
        const beat = (t % 1) < 0.2 ? 1.15 : ((t % 1) < 0.4 ? 0.95 : 1.0);
        
        ctx.fillStyle = '#ff0055';
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(beat, beat);
        
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.bezierCurveTo(0, 20, -50, -20, 0, -50);
        ctx.bezierCurveTo(50, -20, 0, 20, 0, 20);
        ctx.fill();
        ctx.restore();
        
        ctx.strokeStyle = `rgba(255, 0, 85, ${1 - (t%1)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 50 + (t%1)*70, 0, Math.PI*2);
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        st.hparts.forEach((p: any) => {
          p.angle += p.speed;
          const px = cx + Math.cos(p.angle)*p.dist;
          const py = cy + Math.sin(p.angle)*p.dist;
          ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI*2); ctx.fill();
        });
      } else if (archetype === 'ondas_sonoras') {
        const bars = 24;
        const bw = (width - 120) / bars;
        ctx.fillStyle = '#00ff88';
        
        for(let i=0; i<bars; i++) {
          const h = 30 + Math.abs(Math.sin(t*2 + i*0.5))*90;
          const bx = 60 + i*bw;
          ctx.fillRect(bx+3, cy + 25, bw-6, h);
          ctx.fillRect(bx+3, cy - 25 - h, bw-6, h);
        }
        
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for(let x=0; x<width; x+=5) {
          const y = cy + Math.sin(x*0.02 + t*6)*20;
          if (x===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        st.sparts.forEach((p: any) => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
        });
      } else if (archetype === 'globo_terraqueo') {
        const r = 140;
        ctx.strokeStyle = '#0088ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
        
        for(let lat=-r+25; lat<r; lat+=25) {
          ctx.beginPath();
          ctx.ellipse(cx, cy + lat, Math.sqrt(r*r - lat*lat), Math.sqrt(r*r - lat*lat)*0.3, 0, 0, Math.PI*2);
          ctx.stroke();
        }
        for(let lon=0; lon<Math.PI*2; lon+=Math.PI/4) {
          ctx.beginPath();
          const rx = r * Math.cos(lon + t*0.6);
          ctx.ellipse(cx, cy, Math.abs(rx), r, 0, rx < 0 ? Math.PI*0.5 : -Math.PI*0.5, rx < 0 ? Math.PI*1.5 : Math.PI*0.5);
          ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
        ctx.beginPath(); ctx.arc(cx - 50, cy - 40, 35, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 60, cy + 30, 45, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        st.spots.forEach((sp: any) => {
          const lon = sp.lon + t*0.6;
          if (Math.cos(lon) > 0) {
            const px = cx + Math.cos(sp.lat) * Math.sin(lon) * r;
            const py = cy + Math.sin(sp.lat) * r;
            ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI*2); ctx.fill();
          }
        });
      } else if (archetype === 'reloj_arena') {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 70, cy - 120); ctx.lineTo(cx + 70, cy - 120);
        ctx.lineTo(cx + 12, cy); ctx.lineTo(cx + 70, cy + 120);
        ctx.lineTo(cx - 70, cy + 120); ctx.lineTo(cx - 12, cy);
        ctx.closePath();
        ctx.stroke();
        
        const flip = Math.floor(t / 12) % 2 === 1;
        
        ctx.fillStyle = '#ff8800';
        let dropping = false;
        st.sand.forEach((p: any) => {
          if (!p.active && Math.random() < 0.05 && !dropping) { p.active = true; p.x = cx; p.y = cy; dropping = true; }
          if (p.active) {
            p.y += 6;
            if (p.y > cy + 105 - Math.random()*25) { p.active = false; p.y = cy - 100 + Math.random()*80; }
          }
          const px = flip ? cx - (p.x - cx) : p.x;
          const py = flip ? cy - (p.y - cy) : p.y;
          ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI*2); ctx.fill();
        });
      } else if (archetype === 'balanza_justicia') {
        const tilt = Math.sin(t*2) * 0.25;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 5;
        
        ctx.beginPath(); ctx.moveTo(cx, cy - 120); ctx.lineTo(cx, cy + 120); ctx.stroke();
        
        ctx.save();
        ctx.translate(cx, cy - 100);
        ctx.rotate(tilt);
        ctx.beginPath(); ctx.moveTo(-100, 0); ctx.lineTo(100, 0); ctx.stroke();
        
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-100, 0); ctx.lineTo(-120, 70); ctx.lineTo(-80, 70); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(80, 70); ctx.lineTo(120, 70); ctx.closePath(); ctx.stroke();
        ctx.restore();
        
        ctx.fillStyle = '#aaaaaa';
        st.dust.forEach((d: any) => {
          d.y += 1.5; d.life -= 0.02;
          if (d.life <= 0) { 
            d.life = 1; 
            d.y = cy - 30 + Math.sin(t*2)*(d.x<cx?-100:100)*0.25; 
            d.x = cx + (Math.random()>0.5?-100:100) + (Math.random()-0.5)*25; 
          }
          ctx.beginPath(); ctx.arc(d.x, d.y, 2.5, 0, Math.PI*2); ctx.fill();
        });
      } else if (archetype === 'engranajes') {
        const drawGear = (x: number, y: number, r: number, teeth: number, rot: number) => {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          ctx.beginPath();
          for(let i=0; i<teeth; i++) {
            const a = (i/teeth)*Math.PI*2;
            const a2 = ((i+0.5)/teeth)*Math.PI*2;
            ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            ctx.lineTo(Math.cos(a)*(r+12), Math.sin(a)*(r+12));
            ctx.lineTo(Math.cos(a2)*(r+12), Math.sin(a2)*(r+12));
            ctx.lineTo(Math.cos(a2)*r, Math.sin(a2)*r);
          }
          ctx.closePath(); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, r*0.35, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        };
        
        ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 3.5;
        drawGear(cx - 60, cy, 70, 12, t*0.6);
        drawGear(cx + 50, cy - 40, 50, 8, -t*0.84 + 0.2);
        drawGear(cx + 40, cy + 60, 40, 6, -t*1.05 + 0.1);
        
        if (Math.random() < 0.4) st.sparks.push({ x: cx - 5, y: cy - 20, vx: Math.random()*2.5, vy: -Math.random()*2.5, life: 1 });
        ctx.fillStyle = '#ff8800';
        st.sparks.forEach((sp: any, i: number) => {
          sp.x += sp.vx; sp.y += sp.vy; sp.life -= 0.04;
          ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI*2); ctx.fill();
          if (sp.life <= 0) st.sparks.splice(i, 1);
        });
      } else if (archetype === 'arbol_creciendo') {
        ctx.strokeStyle = '#8b4513';
        ctx.lineCap = 'round';
        
        const drawBranch = (bx: number, by: number, len: number, angle: number, depth: number) => {
          if (depth === 0) return;
          const ex = bx + Math.cos(angle)*len;
          const ey = by + Math.sin(angle)*len;
          ctx.lineWidth = depth * 2.5;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
          
          if (depth === 1 && Math.random() < 0.15) st.leaves.push({ x: ex, y: ey, vx: (Math.random()-0.5), vy: Math.random()*1.5, life: 1 });
          
          drawBranch(ex, ey, len*0.75, angle - 0.5 + Math.sin(t)*0.15, depth - 1);
          drawBranch(ex, ey, len*0.75, angle + 0.5 + Math.sin(t+1)*0.15, depth - 1);
        };
        
        drawBranch(cx, cy + 140, 75, -Math.PI/2, 4);
        
        ctx.fillStyle = '#00ff00';
        st.leaves.forEach((l: any, i: number) => {
          l.x += l.vx; l.y += l.vy; l.life -= 0.015;
          ctx.beginPath(); ctx.ellipse(l.x, l.y, 5, 2.5, l.vx, 0, Math.PI*2); ctx.fill();
          if (l.life <= 0) st.leaves.splice(i, 1);
        });
      } else if (archetype === 'laberinto') {
        ctx.strokeStyle = '#000080';
        ctx.lineWidth = 5;
        
        ctx.beginPath();
        for(let i=0; i<=4; i++) {
          ctx.moveTo(cx - 120, cy - 120 + i*60); ctx.lineTo(cx + 120, cy - 120 + i*60);
          ctx.moveTo(cx - 120 + i*60, cy - 120); ctx.lineTo(cx - 120 + i*60, cy + 120);
        }
        ctx.stroke();
        
        ctx.strokeStyle = '#050510';
        ctx.beginPath();
        ctx.moveTo(cx - 60, cy - 120); ctx.lineTo(cx - 60, cy - 60);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + 60, cy);
        ctx.moveTo(cx + 60, cy + 60); ctx.lineTo(cx + 120, cy + 60);
        ctx.stroke();
        
        st.runners.forEach((r: any) => {
          const dx = r.tx - r.x; const dy = r.ty - r.y;
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
            r.x = r.tx; r.y = r.ty;
            const dirs = [[0,-60], [0,60], [-60,0], [60,0]];
            const move = dirs[Math.floor(Math.random()*4)];
            r.tx = Math.max(cx-100, Math.min(cx+100, r.x + move[0]));
            r.ty = Math.max(cy-100, Math.min(cy+100, r.y + move[1]));
          } else {
            r.x += dx * 0.15; r.y += dy * 0.15;
          }
          
          ctx.fillStyle = r.special ? '#00ffff' : '#0088ff';
          ctx.shadowBlur = r.special ? 12 : 0;
          ctx.shadowColor = '#00ffff';
          ctx.beginPath(); ctx.arc(r.x, r.y, 7, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
        });
      } else if (archetype === 'escudo') {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 50, cy - 60);
        ctx.lineTo(cx + 50, cy - 60);
        ctx.lineTo(cx + 50, cy + 15);
        ctx.lineTo(cx, cy + 75);
        ctx.lineTo(cx - 50, cy + 15);
        ctx.closePath();
        ctx.stroke();
        
        const ring = (t*60) % 120;
        ctx.strokeStyle = `rgba(0, 255, 255, ${1 - ring/120})`;
        ctx.beginPath(); ctx.arc(cx, cy, 75 + ring, 0, Math.PI*2); ctx.stroke();
        
        ctx.fillStyle = '#ff0000';
        st.threats.forEach((th: any) => {
          th.dist -= 2.5;
          if (th.dist < 85) { 
            th.dist = 250; th.angle = Math.random()*Math.PI*2; 
          }
          const px = cx + Math.cos(th.angle)*th.dist;
          const py = cy + Math.sin(th.angle)*th.dist;
          ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI*2); ctx.fill();
        });
      } else if (archetype === 'ojo_observador') {
        const blink = (t % 4) < 0.2 ? 6 : 45;
        
        ctx.strokeStyle = '#0088ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 85, blink, 0, 0, Math.PI*2);
        ctx.stroke();
        
        if (blink > 15) {
          ctx.fillStyle = '#ffd700';
          ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill();
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + 250, cy - 120);
          ctx.lineTo(cx + 250, cy + 120);
          ctx.fill();
        }
        
        ctx.fillStyle = '#00ffff';
        st.info.forEach((i: any) => {
          i.angle += i.speed;
          const px = cx + Math.cos(i.angle)*120;
          const py = cy + Math.sin(i.angle)*120;
          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill();
        });
      } else if (archetype === 'puente') {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, cy + 40); ctx.lineTo(width, cy + 40);
        ctx.moveTo(cx - 120, cy + 40); ctx.lineTo(cx - 120, cy - 90);
        ctx.moveTo(cx + 120, cy + 40); ctx.lineTo(cx + 120, cy - 90);
        
        ctx.moveTo(cx - 120, cy - 90); ctx.lineTo(cx - 240, cy + 40);
        ctx.moveTo(cx - 120, cy - 90); ctx.lineTo(cx, cy + 40);
        ctx.moveTo(cx + 120, cy - 90); ctx.lineTo(cx, cy + 40);
        ctx.moveTo(cx + 120, cy - 90); ctx.lineTo(cx + 240, cy + 40);
        ctx.stroke();
        
        st.cars.forEach((c: any) => {
          c.x += c.speed;
          if (c.x > width) c.x = -30;
          
          const isCenter = Math.abs(c.x - cx) < 60;
          ctx.fillStyle = isCenter ? '#00ffff' : '#ffffff';
          ctx.shadowBlur = isCenter ? 12 : 0;
          ctx.shadowColor = '#00ffff';
          ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
        });
      } else if (archetype === 'espiral_caos') {
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for(let i=0; i<600; i++) {
          const a = i * 0.1 - t * 1.5;
          const r = i * 0.6;
          const px = cx + Math.cos(a)*r;
          const py = cy + Math.sin(a)*r;
          if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        
        const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88'];
        st.chaos.forEach((c: any, i: number) => {
          c.angle += 0.06;
          c.dist -= 1.5;
          if (c.dist < 15) { c.dist = 350; c.angle = Math.random()*Math.PI*2; }
          
          const px = cx + Math.cos(c.angle)*c.dist;
          const py = cy + Math.sin(c.angle)*c.dist;
          const size = Math.max(1.5, c.dist * 0.025);
          
          ctx.fillStyle = colors[i % colors.length];
          ctx.save(); ctx.translate(px, py); ctx.rotate(c.angle*2.5);
          ctx.fillRect(-size, -size, size*2, size*2);
          ctx.restore();
        });
      }
      
      ctx.restore();
      rafId.current = requestAnimationFrame(render);
    };

    rafId.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(rafId.current);
  }, [archetype, width, height]);

  return <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />;
}
