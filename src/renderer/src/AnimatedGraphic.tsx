import React, { useState, useEffect } from 'react'
import { SISTEMAS, ZONA_SEGURA, NombreSistema } from './sistemas'

/* --------------------------------------------------------------
   AnimatedGraphic – Fase 2
   Renderiza los diferentes tipos de gráficos animados.
   -------------------------------------------------------------- */

type GraphicType =
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

interface GraphicData {
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
}> = ({ graphic, t, modo = 'overlay', sistema = 'voltaje' }) => {
  const { type, value, label, unit, emoji, extra } = graphic
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

  const renderContent = () => {
    switch (type) {
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
      default:
        return <div className="text-sm text-slate-300">Tipo no soportado</div>
    }
  }

  const s = SISTEMAS[sistema] ?? SISTEMAS.voltaje
  // Las variables CSS son lo unico que permite cambiar el color sin tocar los 37 hex escritos
  // a mano por el fichero. En V1 solo las usa el donut; el resto de tipos se migra cuando le
  // toque a cada uno, y mientras tanto siguen funcionando con su hex.
  const vars = {
    '--fondo': s.fondo, '--sup': s.sup, '--texto': s.texto,
    '--acento': s.acento, '--apoyo': s.apoyo
  } as React.CSSProperties

  if (modo === 'pantalla') {
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
            {renderContent()}
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
