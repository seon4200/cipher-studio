import React, { useState, useEffect } from 'react'
import { SISTEMAS, ZONA_SEGURA, NombreSistema } from './sistemas'
import { recortarTexto } from '../../shared/texto'
import { cicloValido } from '../../shared/ciclo'
import { semillaDe } from '../../shared/semilla'
import { composicion } from './composiciones'
import {
  sceneSpecFromGraphicData,
  sceneSpecReactKey,
  type RuntimeRenderAssetV1,
} from '../../shared/visual-scene-spec'

/* --------------------------------------------------------------
   AnimatedGraphic – Fase 2
   Renderiza los diferentes tipos de gráficos animados.
   -------------------------------------------------------------- */

export type GraphicType =
  | 'barra_horizontal'
  | 'barra_vertical'
  | 'barras_comparativas'
  | 'donut'
  | 'contador'
  | 'comparacion_antes_despues'
  | 'lista_numerada'
  | 'checklist'
  | 'pasos_proceso'
  | 'flecha_crecimiento'
  | 'flecha_caida'
  | 'multiplicador'
  | 'fraccion'
  | 'ranking_top3'
  | 'dato_grande'
  | 'frase_clave'
  | 'decorativo_emoji'
  | 'decorativo_particulas'
  // SOLO para modo pantalla. No aparece en el prompt de tarjetas, asi que el modelo no puede
  // producirlo por accidente: lo construye la generacion de Visuales.
  | 'visual_texto'
  | 'visual_mapa'
  | 'visual_escena'

export interface GraphicData {
  type: GraphicType
  /** valores numéricos o texto que el gráfico mostrará */
  value?: number | string
  /** etiqueta corta bajo el número / emoji */
  label?: string
  /** unidad opcional (%, pts, etc.) */
  unit?: string
  /** emoji opcional relevante al tema */
  emoji?: string
  /** datos auxiliares para tipos complejos (ej. lista, donut) */
  extra?: any
}

/** Helper: color palette */
const COLORS = {
  primary: '#00d4ff',
  secondary: '#7F77DD',
  accent: '#EF9F27',
}

// Resuelve cubic-bezier(x1,y1,x2,y2) para un avance x en 0..1, con Newton-Raphson.
// Es la MISMA curva que usa la transicion CSS, no una aproximacion: asi el frame que se
// captura para el export coincide con lo que se ve en el preview.
const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bx = (u: number) => 3 * x1 * u * (1 - u) * (1 - u) + 3 * x2 * u * u * (1 - u) + u * u * u
  const by = (u: number) => 3 * y1 * u * (1 - u) * (1 - u) + 3 * y2 * u * u * (1 - u) + u * u * u
  let u = x
  for (let i = 0; i < 8; i++) {
    const err = bx(u) - x
    if (Math.abs(err) < 1e-6) break
    const d = 3 * x1 * (1 - u) * (1 - 3 * u) + 3 * x2 * u * (2 - 3 * u) + 3 * u * u
    if (Math.abs(d) < 1e-9) break
    u = Math.min(1, Math.max(0, u - err / d))
  }
  return by(u)
}
const EASE_BARRA = cubicBezier(0.16, 1, 0.3, 1)   // la de las barras (1.2s)
const EASE_DONUT = cubicBezier(0.42, 0, 0.58, 1)  // ease-in-out del donut (1s)

/**
 * `t` OPCIONAL, en segundos desde que el grafico entra.
 * SIN `t` el componente se comporta exactamente igual que siempre: reloj propio.
 * CON `t` es una funcion PURA del tiempo — nada de rAF, setTimeout ni transiciones —
 * de modo que sirve igual para capturar frames, previsualizar uno suelto o avanzar
 * con el cursor del timeline, incluso hacia atras.
 */
export const AnimatedGraphic: React.FC<{
  graphic: GraphicData
  t?: number
  // 'overlay' es la tarjeta de siempre, que va ENCIMA del video. 'pantalla' es el Visual, que
  // lo SUSTITUYE y ocupa el cuadro entero. Por defecto overlay: los llamadores existentes no
  // pasan nada y tienen que seguir viendo exactamente lo mismo.
  modo?: 'overlay' | 'pantalla'
  sistema?: NombreSistema
  /**
   * EL CICLO, en segundos: lo que dura el Visual, que es lo que dura su sub-clip.
   *
   * Solo lo usan las composiciones, y de el tienen que DERIVARSE todas sus duraciones de
   * animacion —con `fraccion(ciclo, n)`, nunca con un literal—. Un `1.5s` escrito a mano es
   * correcto para un ciclo de 3 s y falso para uno de 2.6 s, y el fallo es silencioso: el video
   * sale, el bucle salta, y nada lo dice.
   *
   * Opcional y con respaldo porque los llamadores que ya existen no lo pasan y no lo necesitan:
   * los 17 tipos de tarjeta tienen sus rampas en segundos absolutos (deuda ya anotada) y no
   * miran esto.
   */
  ciclo?: number
  /** Ephemeral Blob URLs prepared from already-verified ProjectAsset bytes. */
  runtimeAssets?: readonly RuntimeRenderAssetV1[]
}> = ({ graphic, t, modo = 'overlay', sistema = 'voltaje', ciclo = 2, runtimeAssets = [] }) => {
  const { type, value, label, unit, emoji, extra } = graphic
  const sceneSpec = sceneSpecFromGraphicData(graphic)
  const sistemaEfectivo = sceneSpec?.sistema ?? sistema
  const [internalAuto, setInternalAuto] = useState<number>(0)
  const raizRef = React.useRef<HTMLDivElement>(null)

  const parsedNum = typeof value === 'number'
    ? value
    : (typeof value === 'string' && !isNaN(parseFloat(value)) ? parseFloat(value) : NaN)
  const hasNum = !isNaN(parsedNum)

  const dirigido = t !== undefined

  // El equivalente PURO de lo que hacen el rAF y el setTimeout de mas abajo.
  const valorEn = (tt: number) => {
    if (!hasNum) return 0
    if (type === 'contador') return Math.round(parsedNum * Math.min(tt / 1.5, 1))
    if (type === 'barra_horizontal' || type === 'barra_vertical') {
      // El setTimeout(150) solo ponia el valor final; quien crecia era la transicion CSS.
      // Aqui el crecimiento ES el valor, porque una transicion no se puede posicionar en t.
      return parsedNum * EASE_BARRA(Math.min(Math.max((tt - 0.15) / 1.2, 0), 1))
    }
    if (type === 'donut') return parsedNum * EASE_DONUT(Math.min(Math.max(tt / 1, 0), 1))
    return parsedNum
  }

  const internal = dirigido ? valorEn(t as number) : internalAuto

  // Las animaciones @keyframes SI se pueden posicionar. Se fijan sobre el propio subarbol
  // para que el componente no dependa de que alguien las pause desde fuera.
  React.useLayoutEffect(() => {
    if (!dirigido || !raizRef.current) return
    for (const a of raizRef.current.getAnimations({ subtree: true })) {
      a.pause()
      a.currentTime = (t as number) * 1000
    }
  })

  useEffect(() => {
    if (dirigido) return   // en modo dirigido el reloj lo pone quien llama
    setInternalAuto(0)

    if (type === 'contador' && hasNum) {
      const target = parsedNum
      const duration = 1500 // 1.5s
      const start = performance.now()
      let animId: number
      const step = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        setInternalAuto(Math.round(target * progress))
        if (progress < 1) {
          animId = requestAnimationFrame(step)
        }
      }
      animId = requestAnimationFrame(step)
      return () => cancelAnimationFrame(animId)
    } else if (
      (type === 'barra_horizontal' || type === 'barra_vertical') &&
      hasNum
    ) {
      const timer = setTimeout(() => setInternalAuto(parsedNum), 150)
      return () => clearTimeout(timer)
    } else if (type === 'donut' && hasNum) {
      setInternalAuto(parsedNum)
    } else if (hasNum) {
      setInternalAuto(parsedNum)
    }
  }, [type, value, dirigido])

  const getAnimationClass = () => {
    switch (type) {
      case 'barra_horizontal':
      case 'barras_comparativas':
      case 'flecha_crecimiento':
      case 'frase_clave':
      case 'pasos_proceso':
        return 'animate-slide-left'
      case 'barra_vertical':
      case 'contador':
      case 'fraccion':
      case 'ranking_top3':
      case 'dato_grande':
      case 'lista_numerada':
      case 'checklist':
        return 'animate-slide-up'
      case 'donut':
      case 'multiplicador':
      case 'decorativo_emoji':
        return 'animate-pop'
      default:
        return 'animate-slide-up'
    }
  }

  const renderContent = (tipoEfectivo: string = String(type ?? '')) => {
    switch (tipoEfectivo) {
      case 'barra_horizontal': {
        const size = Math.max(0, Math.min(100, internal))
        return (
          <div className="w-full space-y-2 flex flex-col items-center">
            <div className="w-full bg-[#3a3a3c] h-4 rounded-full overflow-hidden border border-slate-700/50">
              <div 
                className="bg-[#00d4ff] h-full rounded-full animate-bar-pulse" 
                style={{ width: `${size}%`, transition: dirigido ? 'none' : 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
            </div>
            {/* En modo dirigido `size` es el valor rampado que hace crecer la barra, y sin
                redondear saldria "86.658786...%". Sin el prop NO se redondea: si el dato
                viene con decimales (87.5) hoy se muestran, y eso no puede cambiar. */}
            <div className="text-3xl font-black text-[#00d4ff]">{dirigido ? Math.round(size) : size}{unit || '%'}</div>
          </div>
        )
      }
      case 'barra_vertical': {
        const size = Math.max(0, Math.min(100, internal))
        return (
          <div className="flex flex-col items-center space-y-2 h-36 justify-end w-full">
            <div className="w-6 bg-[#3a3a3c] h-28 rounded-full overflow-hidden border border-slate-700/50 flex flex-col justify-end">
              <div 
                className="bg-[#00d4ff] w-full rounded-full animate-bar-pulse" 
                style={{ height: `${size}%`, transition: dirigido ? 'none' : 'height 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
            </div>
            <div className="text-2xl font-black text-[#00d4ff]">{dirigido ? Math.round(size) : size}{unit}</div>
          </div>
        )
      }
      case 'barras_comparativas': {
        const parsedLeft = typeof value === 'number' ? value : (typeof value === 'string' && !isNaN(parseFloat(value)) ? parseFloat(value) : 70)
        const parsedRight = typeof extra?.rightValue === 'number' ? extra.rightValue : (typeof extra?.rightValue === 'string' && !isNaN(parseFloat(extra.rightValue)) ? parseFloat(extra.rightValue) : 50)
        const leftVal = Math.max(0, Math.min(100, parsedLeft))
        const rightVal = Math.max(0, Math.min(100, parsedRight))
        return (
          <div className="flex space-x-6 w-full justify-around items-end h-28">
            <div className="flex flex-col items-center space-y-1">
              <div className="w-5 bg-[#3a3a3c] h-20 rounded-full flex flex-col justify-end overflow-hidden">
                <div className="w-full rounded-full animate-bar-pulse" style={{ height: `${leftVal}%`, backgroundColor: '#00d4ff', transition: 'height 1.2s' }} />
              </div>
              <span className="text-xs text-slate-300 font-bold">{extra?.leftLabel || 'A'}</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="w-5 bg-[#3a3a3c] h-20 rounded-full flex flex-col justify-end overflow-hidden">
                <div className="w-full rounded-full" style={{ height: `${rightVal}%`, backgroundColor: '#7F77DD', transition: 'height 1.2s' }} />
              </div>
              <span className="text-xs text-slate-300 font-bold">{extra?.rightLabel || 'B'}</span>
            </div>
          </div>
        )
      }
      case 'visual_texto': {
        // La entrada va en el HIJO y no en el envoltorio de pantalla: animate-slide-up mueve
        // `transform`, y sobre el div que ocupa el cuadro entero desplazaria el FONDO. Aqui
        // solo mueve el texto, que es lo que se quiere.
        // Se reutiliza una animacion que ya existe a proposito: el useLayoutEffect de arriba
        // la posiciona en `t` como a todas las demas, asi que se comporta igual capturando
        // frames que reproduciendo.
        //
        // 88 px sale de la cuenta y lo confirmaron los PNG: la superficie mide 900 menos el
        // px-16 (64 por lado) = 772 px utiles; a 88 px el glifo medio ronda 0.5em, o sea ~17
        // caracteres por linea, y los 90 del tope caben en ~5 lineas.
        // ALTURA FIJA AL PEOR CASO, y el texto centrado dentro.
        //
        // Medido: 45 caracteres ocupan 3 lineas y la superficie sale de 530 px; 90 ocupan 6 y
        // sale de 833. Con altura variable, y con la mediana real de la narracion en 45
        // caracteres, la mayoria de los Visuales serian los pequeños y los ocasionales largos
        // se verian un 57% MAS GRANDES. El espectador no sabe que la diferencia es la longitud
        // de una frase: solo ve que el grafico salta de tamaño sin motivo.
        //
        // 673 = 607 del texto a 6 lineas + 56 del gap-14 + 10 de la barra. La superficie le
        // suma su py-20 (80 arriba y 80 abajo) y da los 833 px del peor caso, siempre.
        // Cabe de sobra: son el 60% de los 1400 de alto de la zona segura.
        const ALTO_BLOQUE = 673
        const texto = recortarTexto(value)
        return (
          <div className="w-full flex flex-col items-center justify-center gap-14 animate-slide-up"
               style={{ height: ALTO_BLOQUE }}>
            <p
              style={{
                color: 'var(--texto)',
                fontSize: 88,
                lineHeight: 1.15,
                fontWeight: 800
              }}
              className="text-center w-full"
            >
              {texto}
            </p>
            {/* El remate. Corto y en acento: es el UNICO acento de la composicion. */}
            <span style={{ backgroundColor: 'var(--acento)' }}
                  className="block h-2.5 w-40 rounded-full" />
          </div>
        )
      }
      case 'donut': {
        // En pantalla el tamaño lo fija un NUMERO, no una escala. El donut es el unico de los
        // 17 tipos cuyo tamaño es un radius, asi que crece sin tocar ninguno de los 53 tamaños
        // fijos que hay repartidos por el resto del fichero.
        // 300 + 40/2 = 320 de medio lado: el SVG de 700 deja 30 px de aire y cabe de sobra en
        // los 900 de ancho de la zona segura.
        const pantalla = modo === 'pantalla'
        const radius = pantalla ? 300 : 35
        const grosor = pantalla ? 40 : 8
        const lado = pantalla ? 700 : 90
        const centro = lado / 2
        const circumference = 2 * Math.PI * radius
        const offset = circumference - (circumference * internal) / 100
        return (
          <div className="flex justify-center w-full">
            <svg width={lado} height={lado} className="transform -rotate-90">
              {/* El arco vacio va en `apoyo`, NO en acento: un solo acento por composicion. */}
              <circle cx={centro} cy={centro} r={radius} fill="none"
                      stroke={pantalla ? 'var(--apoyo)' : '#1e293b'} strokeWidth={grosor} />
              <circle
                cx={centro}
                cy={centro}
                r={radius}
                fill="none"
                stroke={pantalla ? 'var(--acento)' : COLORS.primary}
                strokeWidth={grosor}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: dirigido ? 'none' : 'stroke-dashoffset 1s ease-in-out' }}
              />
              {pantalla ? (
                <text x={centro} y={centro} textAnchor="middle" dominantBaseline="central"
                      className="transform rotate-90 origin-center"
                      style={{
                        fill: 'var(--acento)', fontSize: 150, fontWeight: 900,
                        // tabular-nums o los digitos BAILAN al animar: cada uno con su ancho
                        // mueve el numero entero en cada frame.
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                  {dirigido ? Math.round(internal) : internal}{unit || '%'}
                </text>
              ) : (
                <text x={45} y={50} textAnchor="middle" className="text-sm font-black fill-[#00d4ff] transform rotate-90 origin-center">
                  {dirigido ? Math.round(internal) : internal}%
                </text>
              )}
            </svg>
          </div>
        )
      }
      case 'contador': {
        return (
          <div className="text-5xl font-black text-[#00d4ff] animate-number-glow">
            {internal}
            {unit && <span className="text-2xl ml-1">{unit}</span>}
          </div>
        )
      }
      case 'comparacion_antes_despues': {
        const beforeVal = extra?.beforeValue ?? value ?? 0
        const afterVal = extra?.afterValue ?? 100
        return (
          <div className="w-full flex space-x-4">
            <div className="flex-1 flex flex-col items-center bg-[#1C1C1E]/50 p-3 rounded-xl border border-[#3a3a3c] animate-slide-left">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Antes</div>
              <div className="text-3xl font-black text-rose-500">{beforeVal}{unit}</div>
            </div>
            <div className="flex-1 flex flex-col items-center bg-[#1C1C1E]/50 p-3 rounded-xl border border-[#3a3a3c] animate-slide-right">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Después</div>
              <div className="text-3xl font-black text-emerald-500">{afterVal}{unit}</div>
            </div>
          </div>
        )
      }
      case 'flecha_crecimiento': {
        return (
          <div className="flex items-center space-x-3 text-emerald-400">
            <span className="text-6xl font-black">↑</span>
            <div className="flex flex-col text-left">
              <span className="text-5xl font-black text-emerald-400 animate-number-glow">+{value}{unit}</span>
            </div>
          </div>
        )
      }
      case 'flecha_caida': {
        return (
          <div className="flex items-center space-x-3 text-rose-500">
            <span className="text-6xl font-black">↓</span>
            <div className="flex flex-col text-left">
              <span className="text-5xl font-black text-rose-500 animate-number-glow">-{value}{unit}</span>
            </div>
          </div>
        )
      }
      case 'multiplicador': {
        return (
          <div className="text-5xl font-black text-[#00d4ff] animate-number-glow">
            {value}x
          </div>
        )
      }
      case 'fraccion': {
        return (
          <div className="text-5xl font-black text-[#7F77DD] animate-number-glow">
            {value}{unit}
          </div>
        )
      }
      case 'ranking_top3': {
        const top3 = extra?.steps || extra?.items || extra?.top3 || (typeof value === 'string' ? value.split(',') : ['#1 Item', '#2 Item', '#3 Item'])
        return (
          <div className="flex items-end justify-center space-x-2 h-24 w-full">
            <div className="flex flex-col items-center bg-[#1C1C1E]/80 border border-[#3a3a3c] rounded-t-lg p-1 w-16 h-16 justify-center">
              <span className="text-lg">🥈</span>
              <span className="text-xs text-slate-400 font-bold">#2</span>
              <span className="text-[9px] text-slate-300 truncate w-full text-center">{top3[1] || '🥈'}</span>
            </div>
            <div className="flex flex-col items-center bg-[#3a3a3c]/80 border border-slate-700 rounded-t-lg p-1 w-18 h-20 justify-center">
              <span className="text-xl animate-bounce">👑</span>
              <span className="text-xs text-amber-400 font-black">#1</span>
              <span className="text-[9px] text-slate-200 font-bold truncate w-full text-center">{top3[0] || '👑'}</span>
            </div>
            <div className="flex flex-col items-center bg-[#1C1C1E]/80 border border-[#3a3a3c] rounded-t-lg p-1 w-16 h-12 justify-center">
              <span className="text-sm">🥉</span>
              <span className="text-xs text-slate-500 font-bold">#3</span>
              <span className="text-[9px] text-slate-400 truncate w-full text-center">{top3[2] || '🥉'}</span>
            </div>
          </div>
        )
      }
      case 'dato_grande': {
        return (
          <div className="text-6xl font-black bg-gradient-to-r from-[#00d4ff] to-[#7F77DD] bg-clip-text text-transparent animate-number-glow">
            {value}{unit}
          </div>
        )
      }
      case 'frase_clave': {
        return (
          <div className="border-l-4 border-[#00d4ff] pl-3 py-1 text-left w-full">
            <span className="text-xl font-bold italic text-slate-200">“{value}”</span>
          </div>
        )
      }
      case 'decorativo_emoji': {
        return (
          <div className="text-8xl animate-gentle-zoom flex justify-center w-full">
            {value || emoji || '💡'}
          </div>
        )
      }
      case 'lista_numerada': {
        const items = extra?.steps || extra?.items || (typeof value === 'string' ? value.split(',') : ['Item A', 'Item B'])
        return (
          <ol className="space-y-1 text-left w-full">
            {items.map((it: string, i: number) => (
              <li key={i} className="text-sm text-slate-300 flex items-start space-x-2">
                <span className="font-bold text-[#00d4ff]">{i + 1}.</span>
                <span>{it.trim()}</span>
              </li>
            ))}
          </ol>
        )
      }
      case 'checklist': {
        const items = extra?.steps || extra?.items || (typeof value === 'string' ? value.split(',') : ['Check A', 'Check B'])
        return (
          <ul className="space-y-1 text-left w-full">
            {items.map((it: string, i: number) => (
              <li key={i} className="text-sm text-slate-300 flex items-center space-x-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>{it.trim()}</span>
              </li>
            ))}
          </ul>
        )
      }
      case 'pasos_proceso': {
        const steps = extra?.steps || extra?.items || (typeof value === 'string' ? value.split('->') : ['Paso 1', 'Paso 2', 'Paso 3'])
        return (
          <div className="flex items-center space-x-2 overflow-x-auto py-1 w-full justify-center">
            {steps.map((st: string, i: number, arr: any[]) => (
              <React.Fragment key={i}>
                <div className="bg-[#1C1C1E] border border-[#3a3a3c] p-2 rounded-lg text-center flex-1 min-w-[70px]">
                  <div className="text-[10px] text-[#00d4ff] font-bold">Paso {i + 1}</div>
                  <div className="text-xs text-slate-300 font-semibold truncate">{st.trim()}</div>
                </div>
                {i < arr.length - 1 && <span className="text-[#7F77DD] font-black">→</span>}
              </React.Fragment>
            ))}
          </div>
        )
      }
      default: {
        const tipoDesconocido = tipoEfectivo || '(vacio)'
        if (typeof window !== 'undefined') {
          const w = window as any
          if (!Array.isArray(w.__avisosCiclo)) w.__avisosCiclo = []
          const aviso =
            `[AnimatedGraphic] TIPO NO SOPORTADO: "${tipoDesconocido}" ` +
            `cae a visual_texto`
          if (!w.__avisosCiclo.includes(aviso)) w.__avisosCiclo.push(aviso)
        }
        return renderContent('visual_texto')
      }
    }
  }

  const s = SISTEMAS[sistemaEfectivo] ?? SISTEMAS.voltaje
  // Las variables CSS son lo unico que permite cambiar el color sin tocar los 37 hex escritos
  // a mano por el fichero. En V1 solo las usa el donut; el resto de tipos se migra cuando le
  // toque a cada uno, y mientras tanto siguen funcionando con su hex.
  // `--ciclo` se publica igual que los colores, y es la misma idea que el `:root{--ciclo:6s}`
  // de los laboratorios: una composicion escribe `calc(var(--ciclo) / 2)` y esa duracion es
  // legal para CUALQUIER ciclo, por construccion. Es lo contrario de escribir `1.5s`, que solo
  // vale si el ciclo resulta ser 3, 6 o 12 — y falla en silencio cuando no lo es.
  //
  // Se publica aunque hoy no lo lea ninguna plantilla: es el canal, y tenerlo puesto es lo que
  // permite comprobar que la duracion llega hasta aqui antes de escribir la primera composicion.
  const cicloUsado = cicloValido(ciclo) ? ciclo : 2
  const vars = {
    '--fondo': s.fondo, '--sup': s.sup, '--texto': s.texto,
    '--acento': s.acento, '--apoyo': s.apoyo,
    '--ciclo': `${cicloUsado}s`
  } as React.CSSProperties

  if (modo === 'pantalla') {
    // LA COMPOSICION, si el tipo nombra una. `composicion()` devuelve null cuando no existe y
    // entonces se cae al Visual de texto de siempre: un tipo desconocido no puede dejar el
    // cuadro en blanco.
    const comp = composicion(String(type || '').replace(/^visual_/, ''))
    const palabra = sceneSpec ? sceneSpec.text.keyword : recortarTexto(value)
    // Los conceptos viajan en `extra`, que es donde los mete el backend y por tanto donde entran
    // en la clave del hash. Se pasan TAL CUAL: ya vienen de `sanearConceptos`, y volver a
    // sanearlos aqui podria cambiar el dibujo sin cambiar la clave.
    const conceptos = extra?.conceptos ?? null
    const ancla = extra?.ancla ?? null
    // LA DIRECCION viaja por el mismo sitio y por la misma razon: `extra` esta en la clave del
    // hash, asi que dos direcciones distintas dan dos ficheros distintos. Se pasa TAL CUAL --
    // sin validar-- porque quien sabe que piezas existen es la composicion, no este fichero.
    const direccion = sceneSpec?.direccion ?? extra?.direccion ?? null
    // El entero ya esta dentro de `extra` (y, por tanto, del hash). No se acepta 0, que clavaria
    // el Lehmer; el respaldo conserva los artefactos historicos que aun no lo tenian.
    const semilla = sceneSpec?.direccion.semilla ??
      (Number.isInteger(extra?.semilla) && Number(extra.semilla) > 0
        ? Number(extra.semilla) : semillaDe(palabra))

    // LA PUERTA. Que el tipo nombre una composicion no significa que pueda dibujarse: el
    // despacho es por `type` y `type` no sabe nada de los datos. Un Visual con `visual_mapa` y
    // `conceptos: null` encontraba su composicion igual y se pintaba a medias — sin aristas,
    // sin conceptos y sin emoji final. Con la puerta cerrada cae al Visual de texto de abajo,
    // que es el respaldo que ya existia y no hay que fabricar.
    // A validated sceneSpec is the explicit productive contract. It does not need the three
    // legacy concepts: its own validator and main-process QC are the gate. Without sceneSpec,
    // this remains the byte-for-byte legacy condition.
    const puede = comp
      ? (sceneSpec !== null || comp.puedeDibujar({ texto: palabra, conceptos, ancla, direccion, semilla }))
      : false
    const tipoEfectivo = comp && !puede ? 'visual_texto' : String(type ?? '')

    // EL RESPALDO NO ES MUDO. Si el 30% de los Visuales cae a texto hay que verlo en el log, no
    // descubrirlo mirando videos. Va por el mismo canal que los avisos del candado y por la
    // misma razon: esta ventana es offscreen y su consola no la abre nadie — medido en este
    // repo, un console.log puesto aqui para diagnosticar nunca llego a generation-debug.log.
    if (comp && !puede && typeof window !== 'undefined') {
      const w = window as any
      if (!Array.isArray(w.__avisosCiclo)) w.__avisosCiclo = []
      const aviso =
        `[${comp.nombre}] RESPALDO: "${palabra}" cae a visual_texto — ` +
        `la composicion no puede dibujar con estos datos ` +
        `(conceptos=${Array.isArray(conceptos) ? conceptos.length : 'null'})`
      // UNA VEZ POR CLIP, no una por frame. `render` corre en cada `__setT`, que son 90 veces
      // en un clip de 3 s: sin esto el log se lleva noventa lineas identicas por cada Visual
      // que cae al respaldo, y un aviso repetido noventa veces deja de leerse como un aviso.
      // Medido: con `__montar` + un solo `__setT` ya salian dos.
      if (!w.__avisosCiclo.includes(aviso)) w.__avisosCiclo.push(aviso)
    }

    if (comp && puede) {
      // Los avisos del candado se DEPOSITAN para que se los lleve el proceso principal.
      const avisos = comp.avisos(cicloUsado)
      if (avisos.length && typeof window !== 'undefined') {
        const w = window as any
        if (!Array.isArray(w.__avisosCiclo)) w.__avisosCiclo = []
        for (const a of avisos) w.__avisosCiclo.push(`[${comp.nombre}] ${a}`)
      }
      return (
        <div
          ref={raizRef}
          style={{ ...vars, backgroundColor: 'var(--fondo)' }}
          className="w-full h-full relative overflow-hidden"
        >
          <React.Fragment key={sceneSpec ? sceneSpecReactKey(sceneSpec) : undefined}>
            {comp.render({ u: cicloUsado > 0 ? ((t ?? 0) / cicloUsado) % 1 : 0,
                           ciclo: cicloUsado, sistema: sistemaEfectivo, texto: palabra,
                           conceptos, ancla, direccion, semilla, sceneSpec, runtimeAssets })}
          </React.Fragment>
          {/* LA PALABRA NO SE PIERDE. La composicion ocupa el cuadro, pero un Visual existe
              para poner una palabra a pantalla completa: si la composicion la sustituyera, el
              Visual dejaria de hacer su trabajo y seria decoracion.
              Va en el PIE, que es exactamente lo que hacen los ficheros de referencia — su
              `.pie{left:8.33%;right:8.33%;bottom:13.54%}` es la zona segura que ya usamos, y
              esta escrito en docs/motion/README.md.

              PERO SOLO SI LA COMPOSICION NO PINTA EL SUYO. `pintaPie` es UNA puerta: la
              composicion declara y aqui se obedece. Sin eso, una composicion con pie propio
              produciria DOS palabras superpuestas, y ese descubrimiento se dejaria para el dia
              que alguien mirara un video. */}
          {!comp.pintaPie && palabra && (
            <div style={{
              position: 'absolute', left: '8.33%', right: '8.33%', bottom: '13.54%',
              zIndex: 5, textAlign: 'center'
            }}>
              <div style={{ color: 'var(--texto)', fontSize: 132, lineHeight: 0.95,
                            fontWeight: 800, letterSpacing: '-0.01em' }}>
                {palabra}
              </div>
              <div style={{ height: 10, width: 168, margin: '34px auto 0',
                            borderRadius: 99, background: 'var(--acento)' }} />
            </div>
          )}
        </div>
      )
    }
    return (
      <div
        ref={raizRef}
        style={{ ...vars, backgroundColor: 'var(--fondo)' }}
        className="w-full h-full flex items-center justify-center"
      >
        {/* EL FONDO LO PINTA EL COMPONENTE y cubre el cuadro ENTERO, no solo la zona segura.
            La ventana offscreen se crea con transparent:true porque las tarjetas necesitan
            alfa; si aqui no se pintara, yuv420p descartaria el alfa y saldria NEGRO — con
            clinico y calido, que llevan texto oscuro, seria ilegible. Es el fallo del alpha
            otra vez, del reves.
            Y NO lleva getAnimationClass(): animate-pop anima transform con fill-mode forwards
            y sobre un div que ocupa el cuadro entero escalaria el fondo. La animacion del
            donut la lleva su propio arco por stroke-dashoffset. */}
        <div
          style={{ width: ZONA_SEGURA.ancho, height: ZONA_SEGURA.alto }}
          className="flex flex-col items-center justify-center"
        >
          {/* CAMPO + TARJETA: el texto va sobre la superficie, nunca sobre el fondo desnudo. */}
          <div
            style={{ backgroundColor: 'var(--sup)' }}
            className="w-full rounded-[48px] px-16 py-20 flex flex-col items-center justify-center gap-10"
          >
            {label && (
              <span style={{ color: 'var(--apoyo)' }}
                    className="text-5xl font-semibold tracking-wide text-center">
                {label}
              </span>
            )}
            {renderContent(tipoEfectivo)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={raizRef} className={`min-w-[320px] p-6 rounded-2xl shadow-2xl backdrop-blur-md bg-[#0D0D0F]/85 border border-[#3a3a3c]/80 flex flex-col items-center space-y-3 ${getAnimationClass()}`}>
      {/* EMOJI & LABEL HEADER */}
      {(emoji || label) && (
        <div className="flex items-center space-x-2 mb-1 justify-center w-full">
          {emoji && <span className="text-3xl animate-gentle-zoom">{emoji}</span>}
          {label && <span className="text-base font-semibold text-slate-300">{label}</span>}
        </div>
      )}
      {/* MAIN GRAPHIC CONTENT */}
      {renderContent()}
    </div>
  )
}
