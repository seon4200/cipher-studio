import React, { useState, useEffect, useMemo, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import { 
  Play, Pause, FastForward, Rewind, Video, Volume2, VolumeX, Sparkles, 
  Scissors, Type, Languages, Download, Upload, Plus, 
  FolderOpen, Cpu, Trash2, Maximize, Copy, Clipboard, Crop, FlipHorizontal,
  Undo, Redo, Sliders, ChevronDown, Save
} from 'lucide-react'
import './styles/globals.css'

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

export const AnimatedGraphic: React.FC<{ graphic: GraphicData }> = ({ graphic }) => {
  const { type, value, label, unit, emoji, extra } = graphic
  const [internal, setInternal] = useState<number>(0)

  useEffect(() => {
    setInternal(0)

    const parsedNum = typeof value === 'number'
      ? value
      : (typeof value === 'string' && !isNaN(parseFloat(value)) ? parseFloat(value) : NaN)
    const hasNum = !isNaN(parsedNum)

    if (type === 'contador' && hasNum) {
      const target = parsedNum
      const duration = 1500 // 1.5s
      const start = performance.now()
      let animId: number
      const step = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        setInternal(Math.round(target * progress))
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
      const timer = setTimeout(() => setInternal(parsedNum), 150)
      return () => clearTimeout(timer)
    } else if (type === 'donut' && hasNum) {
      setInternal(parsedNum)
    } else if (hasNum) {
      setInternal(parsedNum)
    }
  }, [type, value])

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
            <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden border border-slate-700/50">
              <div 
                className="bg-[#00d4ff] h-full rounded-full animate-bar-pulse" 
                style={{ width: `${size}%`, transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
            </div>
            <div className="text-3xl font-black text-[#00d4ff]">{size}{unit || '%'}</div>
          </div>
        )
      }
      case 'barra_vertical': {
        const size = Math.max(0, Math.min(100, internal))
        return (
          <div className="flex flex-col items-center space-y-2 h-36 justify-end w-full">
            <div className="w-6 bg-slate-800 h-28 rounded-full overflow-hidden border border-slate-700/50 flex flex-col justify-end">
              <div 
                className="bg-[#00d4ff] w-full rounded-full animate-bar-pulse" 
                style={{ height: `${size}%`, transition: 'height 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
            </div>
            <div className="text-2xl font-black text-[#00d4ff]">{size}{unit}</div>
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
              <div className="w-5 bg-slate-800 h-20 rounded-full flex flex-col justify-end overflow-hidden">
                <div className="w-full rounded-full animate-bar-pulse" style={{ height: `${leftVal}%`, backgroundColor: '#00d4ff', transition: 'height 1.2s' }} />
              </div>
              <span className="text-xs text-slate-300 font-bold">{extra?.leftLabel || 'A'}</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="w-5 bg-slate-800 h-20 rounded-full flex flex-col justify-end overflow-hidden">
                <div className="w-full rounded-full" style={{ height: `${rightVal}%`, backgroundColor: '#7F77DD', transition: 'height 1.2s' }} />
              </div>
              <span className="text-xs text-slate-300 font-bold">{extra?.rightLabel || 'B'}</span>
            </div>
          </div>
        )
      }
      case 'donut': {
        const radius = 35
        const circumference = 2 * Math.PI * radius
        const offset = circumference - (circumference * internal) / 100
        return (
          <div className="flex justify-center w-full">
            <svg width={90} height={90} className="transform -rotate-90">
              <circle cx={45} cy={45} r={radius} fill="none" stroke="#1e293b" strokeWidth={8} />
              <circle
                cx={45}
                cy={45}
                r={radius}
                fill="none"
                stroke={COLORS.primary}
                strokeWidth={8}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
              />
              <text x={45} y={50} textAnchor="middle" className="text-sm font-black fill-[#00d4ff] transform rotate-90 origin-center">
                {internal}%
              </text>
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
            <div className="flex-1 flex flex-col items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800 animate-slide-left">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Antes</div>
              <div className="text-3xl font-black text-rose-500">{beforeVal}{unit}</div>
            </div>
            <div className="flex-1 flex flex-col items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800 animate-slide-right">
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
            <div className="flex flex-col items-center bg-slate-900/80 border border-slate-800 rounded-t-lg p-1 w-16 h-16 justify-center">
              <span className="text-lg">🥈</span>
              <span className="text-xs text-slate-400 font-bold">#2</span>
              <span className="text-[9px] text-slate-300 truncate w-full text-center">{top3[1] || '🥈'}</span>
            </div>
            <div className="flex flex-col items-center bg-slate-800/80 border border-slate-700 rounded-t-lg p-1 w-18 h-20 justify-center">
              <span className="text-xl animate-bounce">👑</span>
              <span className="text-xs text-amber-400 font-black">#1</span>
              <span className="text-[9px] text-slate-200 font-bold truncate w-full text-center">{top3[0] || '👑'}</span>
            </div>
            <div className="flex flex-col items-center bg-slate-900/80 border border-slate-800 rounded-t-lg p-1 w-16 h-12 justify-center">
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
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-center flex-1 min-w-[70px]">
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

  return (
    <div className={`min-w-[320px] p-6 rounded-2xl shadow-2xl backdrop-blur-md bg-slate-950/85 border border-slate-800/80 flex flex-col items-center space-y-3 ${getAnimationClass()}`}>
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

/* ------------------------------------------------------------------
   App component (ya existente)
   ------------------------------------------------------------------ */

interface Clip {
  id: string;
  name: string;
  duration: string;
  durationSeconds: number;
  type: 'video' | 'audio';
  path: string;
  size: string;
  url?: string;
  category?: string;
  thumbnailUrl?: string;
  graphicData?: any;
}

interface TimelineClip {
  id: string;
  name: string;
  startSeconds: number;
  durationSeconds: number;
  /** Tipo de clip, incluye 'graphic' para gráficos animados */
  type?: 'video' | 'audio' | 'graphic';
  path?: string;
  url?: string;
  origDurationSeconds?: number;
  segmentStartOffset?: number;
  segmentIndex?: number;
  text?: string;
  /** Datos específicos del gráfico (emoji, valor, label, etc.) */
  graphicData?: any;
  category?: string;
  thumbnailUrl?: string;
}

interface GeneratedVoiceVersion {
  id: string;
  timestamp: number;
  speaker: string;
  model: string;
  speed: number;
  stability: number;
  text: string;
  filePath: string;
  audioUrl: string;
  durationSeconds?: number;
}

interface TimelineVersion {
  id: string;
  name: string;
  timestamp: number;
  timelineVideoClips: TimelineClip[];
}


function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState('00:00:15:22')
  
  // Project Management States
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null)
  const [projectsList, setProjectsList] = useState<any[]>([])
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [mainProcessTime, setMainProcessTime] = useState<string>('Esperando...')
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  
  // State for imported files/clips
  const [clips, setClips] = useState<Clip[]>([])

  const [timelineVideoClips, setTimelineVideoClips] = useState<TimelineClip[]>([])
  const [timelineVersions, setTimelineVersions] = useState<TimelineVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string>('')

  const handleSelectTimelineVersion = (versionId: string) => {
    setActiveVersionId(versionId);
    const targetVersion = timelineVersions.find(v => v.id === versionId);
    if (targetVersion) {
      setTimelineVideoClips(targetVersion.timelineVideoClips);
      pushHistory(targetVersion.timelineVideoClips);
    }
  };

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Canvas Preview Active Video States
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  
  // Timeline zoom and container refs
  const [timelineZoom, setTimelineZoom] = useState(1200)
  const timelineTracksRef = React.useRef<HTMLDivElement>(null)
  
  // Track volume states
  const [videoTrackVolume, setVideoTrackVolume] = useState(1.0)
  const [isVideoTrackMuted, setIsVideoTrackMuted] = useState(false)
  const [audioTrackVolume, setAudioTrackVolume] = useState(1.0)
  const [isAudioTrackMuted, setIsAudioTrackMuted] = useState(false)

  // Zoom, pan, crop and mirror states
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isCropping, setIsCropping] = useState(false)
  const [cropRect, setCropRect] = useState({ left: 10, top: 10, right: 10, bottom: 10 })
  const [activeCrop, setActiveCrop] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null)
  const [isMirrored, setIsMirrored] = useState(false)
  const [copiedClip, setCopiedClip] = useState<TimelineClip | null>(null)
  // Porcentaje global de generación de gráficos (valor por defecto 50%)
  const [graphicsPercent, setGraphicsPercent] = useState<number>(50);

  // Estados para controlar el ciclo de vida y visibilidad de los gráficos animados
  const [graphicVisible, setGraphicVisible] = useState(false);
  const [graphicFading, setGraphicFading] = useState(false);

  // Reset panOffset when zoom resets to 1
  useEffect(() => {
    if (zoom <= 1) {
      setPanOffset({ x: 0, y: 0 })
    }
  }, [zoom])

  // Player premium controls states
  // Performance: currentTimeSeconds lives in a ref to avoid 60 re-renders/sec during playback.
  // currentTimeForUI is a low-frequency state updated ~5 times/sec for UI elements that need React re-render.
  const currentTimeRef = React.useRef(0)
  const [currentTimeForUI, setCurrentTimeForUI] = useState(0)
  const lastUIUpdateRef = React.useRef(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [aspectRatio, setAspectRatio] = useState<'horizontal' | 'vertical' | 'square'>('horizontal')
  const [showFormatDropdown, setShowFormatDropdown] = useState(false)

  // Timeline interactive states
  const [selectedTimelineClipIds, setSelectedTimelineClipIds] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null)

  const trackRef = React.useRef<HTMLDivElement>(null)
  const playerWrapperRef = React.useRef<HTMLDivElement>(null)

  // Refs to allow stable keyboard listener dependencies
  const timelineClipsRef = React.useRef<TimelineClip[]>([])
  const currentTimeSecondsRef = currentTimeRef
  const selectedTimelineClipIdsRef = React.useRef<string[]>([])

  useEffect(() => {
    timelineClipsRef.current = timelineVideoClips
    selectedTimelineClipIdsRef.current = selectedTimelineClipIds
  }, [timelineVideoClips, selectedTimelineClipIds])

  // Magnetic timeline layout builder helper
  const applyMagneticLayout = useCallback((clips: TimelineClip[]): TimelineClip[] => {
    // Excluimos clips de tipo 'graphic' del cálculo magnético
    const videoClips = clips.filter(c => c.type !== 'audio' && c.type !== 'graphic');
    const audioClips = clips.filter(c => c.type === 'audio');
    
    // Sort video clips by their startSeconds
    videoClips.sort((a, b) => a.startSeconds - b.startSeconds);
    
    let currentStart = 0;
    const rebuiltVideoClips = videoClips.map(clip => {
      const updated = {
        ...clip,
        startSeconds: currentStart
      };
      currentStart += clip.durationSeconds;
      return updated;
    });
    
    const graphicClips = clips.filter(c => c.type === 'graphic');
    return [...rebuiltVideoClips, ...audioClips, ...graphicClips];
  }, []);

  // Export Settings States
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportResolution, setExportResolution] = useState<'1080p' | '4K' | '720p'>('1080p')
  const [exportFormat, setExportFormat] = useState<'mp4' | 'mov'>('mp4')
  const [exportQuality, setExportQuality] = useState<'high' | 'medium' | 'low'>('medium')

  useEffect(() => {
    if (!activeVersionId) return;
    setTimelineVersions(prev => {
      const active = prev.find(v => v.id === activeVersionId);
      if (active && active.timelineVideoClips === timelineVideoClips) {
        return prev;
      }
      return prev.map(v => v.id === activeVersionId ? { ...v, timelineVideoClips } : v);
    });
  }, [timelineVideoClips, activeVersionId]);

  // Helper: update time ref + direct DOM updates (avoids React re-render)
  const updateCurrentTime = useCallback((newTime: number) => {
    currentTimeRef.current = newTime;
    
    // Direct DOM update for timecode display
    const timecodeEl = document.getElementById('cipher-timecode');
    if (timecodeEl) {
      const hrs = Math.floor(newTime / 3600);
      const mins = Math.floor((newTime % 3600) / 60);
      const secs = Math.floor(newTime % 60);
      const frames = Math.floor((newTime % 1) * 24);
      const pad = (n: number) => String(n).padStart(2, '0');
      timecodeEl.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
    }
    
    // Direct DOM update for playhead line
    const playheadEl = document.getElementById('cipher-playhead');
    if (playheadEl) {
      const totalDur = Math.max(120, timelineClipsRef.current.reduce((max, c) => Math.max(max, c.startSeconds + c.durationSeconds), 0) + 10);
      const percent = totalDur > 0 ? (newTime / totalDur) * 100 : 0;
      playheadEl.style.left = `${percent}%`;
    }
    
    // Direct DOM update for scrubber position
    const scrubFill = document.getElementById('cipher-scrub-fill');
    const scrubThumb = document.getElementById('cipher-scrub-thumb');
    const durationSec = videoRef.current?.duration || 0;
    if (scrubFill) {
      scrubFill.style.width = `${durationSec > 0 ? (newTime / durationSec) * 100 : 0}%`;
    }
    if (scrubThumb) {
      scrubThumb.style.left = `${durationSec > 0 ? (newTime / durationSec) * 100 : 0}%`;
    }
    
    // Direct DOM update for time text
    const timeTextEl = document.getElementById('cipher-time-text');
    if (timeTextEl) {
      const fmins = Math.floor(newTime / 60);
      const fsecs = Math.floor(newTime % 60);
      timeTextEl.textContent = `${String(fmins).padStart(2, '0')}:${String(fsecs).padStart(2, '0')}`;
    }
    
    // Throttled React state update (~5 times/sec, every 200ms) for components that need re-render
    const now = performance.now();
    if (now - lastUIUpdateRef.current > 200) {
      lastUIUpdateRef.current = now;
      setCurrentTimeForUI(newTime);
    }
  }, []);

  // Force a React re-render with current time (for user actions like seek, pause, etc.)
  const flushCurrentTime = useCallback(() => {
    setCurrentTimeForUI(currentTimeRef.current);
  }, []);

  // Dynamic total timeline duration (minimum 120 seconds, or max clip end + 10s buffer)
  const totalDuration = useMemo(() => Math.max(120, timelineVideoClips.reduce((max, c) => Math.max(max, c.startSeconds + c.durationSeconds), 0) + 10), [timelineVideoClips]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  
  const sortedVideoClips = useMemo(() => {
    return timelineVideoClips
      .filter(c => c.type !== 'audio' && c.type !== 'graphic')
      .sort((a, b) => a.startSeconds - b.startSeconds);
  }, [timelineVideoClips]);

  const graphicClips = useMemo(() => {
    return timelineVideoClips.filter(c => c.type === 'graphic');
  }, [timelineVideoClips]);

  const activeGraphicClip = useMemo(() => {
    const activeTime = audioRef.current ? audioRef.current.currentTime : currentTimeForUI;
    return graphicClips.find(c => activeTime >= c.startSeconds && activeTime < c.startSeconds + c.durationSeconds) || null;
  }, [graphicClips, currentTimeForUI]);

  useEffect(() => {
    if (activeGraphicClip?.id && isPlaying) {
      const durMs = (activeGraphicClip.durationSeconds || 2.0) * 1000;
      const fadeMs = Math.max(0, durMs - 300);

      setGraphicVisible(true);
      setGraphicFading(false);
      const fadeTimer = setTimeout(() => setGraphicFading(true), fadeMs);
      const hideTimer = setTimeout(() => {
        setGraphicVisible(false);
        setGraphicFading(false);
      }, durMs);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setGraphicVisible(false);
      setGraphicFading(false);
    }
  }, [activeGraphicClip?.id, isPlaying]);

  interface MilestoneState {
    label: string;
    clips: Clip[];
    timelineVideoClips: TimelineClip[];
    transcriptionStatus: string;
    transcriptSegments: any[];
    newAudioSegments?: any[];
    aiScript: string;
    originalTranscriptText: string;
    generatedVoices: any[];
    /** optional percentage (0‑100) of graphic clips for this milestone */
    graphicsPercent?: number;
  }

  const [isDirty, setIsDirty] = useState(false)
  const [milestoneHistory, setMilestoneHistory] = useState<MilestoneState[]>([])
  const [milestoneIndex, setMilestoneIndex] = useState(-1)

  const milestoneHistoryRef = React.useRef(milestoneHistory)
  const milestoneIndexRef = React.useRef(milestoneIndex)

  useEffect(() => {
    milestoneHistoryRef.current = milestoneHistory
    milestoneIndexRef.current = milestoneIndex
  }, [milestoneHistory, milestoneIndex])

  const pushMilestone = (label: string, customState?: Partial<MilestoneState>) => {
    setMilestoneHistory(prev => {
      const nextHistory = prev.slice(0, milestoneIndexRef.current + 1)
      const newState: MilestoneState = {
        label,
        clips: customState?.clips ?? clips,
        timelineVideoClips: customState?.timelineVideoClips ?? timelineVideoClips,
        transcriptionStatus: customState?.transcriptionStatus ?? transcriptionStatus,
        transcriptSegments: customState?.transcriptSegments ?? transcriptSegments,
        newAudioSegments: customState?.newAudioSegments ?? newAudioSegments,
        aiScript: customState?.aiScript ?? aiScript,
        originalTranscriptText: customState?.originalTranscriptText ?? originalTranscriptText,
        generatedVoices: customState?.generatedVoices ?? generatedVoices,
        graphicsPercent: customState?.graphicsPercent ?? graphicsPercent,
      }
      return [...nextHistory, newState]
    })
    setMilestoneIndex(prev => prev + 1)
  }

  const pushHistory = (newClips: TimelineClip[]) => {
    pushMilestone('Edición de Timeline', { timelineVideoClips: newClips })
  }

  const handleUndo = () => {
    const idx = milestoneIndexRef.current
    const hist = milestoneHistoryRef.current
    if (idx > 0) {
      const newIndex = idx - 1
      setMilestoneIndex(newIndex)
      const state = hist[newIndex]
      setClips(state.clips)
      setTimelineVideoClips(state.timelineVideoClips)
      setTranscriptionStatus(state.transcriptionStatus)
      setTranscriptSegments(state.transcriptSegments)
      setNewAudioSegments(state.newAudioSegments || [])
      setAiScript(state.aiScript)
      setOriginalTranscriptText(state.originalTranscriptText)
      setGeneratedVoices(state.generatedVoices)
      if (state.graphicsPercent !== undefined) setGraphicsPercent(state.graphicsPercent)
    }
  }

  const handleRedo = () => {
    const idx = milestoneIndexRef.current
    const hist = milestoneHistoryRef.current
    if (idx < hist.length - 1) {
      const newIndex = idx + 1
      setMilestoneIndex(newIndex)
      const state = hist[newIndex]
      setClips(state.clips)
      setTimelineVideoClips(state.timelineVideoClips)
      setTranscriptionStatus(state.transcriptionStatus)
      setTranscriptSegments(state.transcriptSegments)
      setNewAudioSegments(state.newAudioSegments || [])
      setAiScript(state.aiScript)
      setOriginalTranscriptText(state.originalTranscriptText)
      setGeneratedVoices(state.generatedVoices)
      if (state.graphicsPercent !== undefined) setGraphicsPercent(state.graphicsPercent)
    }
  }

  // Seek video by offset (+10s / -10s)
  const seekForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10)
    }
  }

  const seekBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10)
    }
  }

  // Toggle Mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (val > 0) {
      setIsMuted(false)
    }
  }

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (playerWrapperRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        playerWrapperRef.current.requestFullscreen().catch((err) => {
          console.error("Error enabling fullscreen mode:", err)
        })
      }
    }
  }

  // Helper to format duration to mm:ss
  const formatTimeMinutesSeconds = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Seek global timeline time (Corrección 1)
  const seekGlobalTime = (time: number) => {
    const boundedTime = Math.max(0, Math.min(time, totalDuration));
    updateCurrentTime(boundedTime);
    flushCurrentTime();

    if (audioRef.current) {
      audioRef.current.currentTime = boundedTime;
    }

    const targetClip = sortedVideoClips.find(c => 
      boundedTime >= c.startSeconds && 
      boundedTime < c.startSeconds + c.durationSeconds
    );

    const video = videoRef.current;
    if (targetClip) {
      const newIdx = sortedVideoClips.findIndex(c => c.id === targetClip.id);
      setCurrentClipIndex(newIdx);
      
      if (targetClip.path) {
        const fileUrl = `file:///${targetClip.path.replace(/\\/g, '/')}`;
        const scale = targetClip.origDurationSeconds 
          ? (targetClip.origDurationSeconds / targetClip.durationSeconds) 
          : 1;
        const offsetInClip = boundedTime - targetClip.startSeconds;
        const targetVideoTime = (targetClip.segmentStartOffset || 0) + offsetInClip * scale;

        if (activeVideoUrl !== fileUrl) {
          setActiveVideoUrl(fileUrl);
          if (video) {
            video.src = fileUrl;
          }
        }

        if (video) {
          video.currentTime = targetVideoTime;
        }
      } else {
        if (activeVideoUrl !== null) {
          setActiveVideoUrl(null);
        }
      }
    } else {
      if (activeVideoUrl !== null) {
        setActiveVideoUrl(null);
      }
    }
  };

  // Scrubber dragging logic
  const handleScrubberSeek = (clientX: number, rect: DOMRect) => {
    const clickX = clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    const newTime = percent * totalDuration
    seekGlobalTime(newTime);
  };

  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalDuration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    handleScrubberSeek(e.clientX, rect)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleScrubberSeek(moveEvent.clientX, rect)
    }
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Timeline scrubbing logic
  const handleTimelineScrub = (clientX: number) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const clickX = clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    const newTime = percent * totalDuration
    seekGlobalTime(newTime);
  }

  const handleTimelineScrubMouseDown = (e: React.MouseEvent) => {
    handleTimelineScrub(e.clientX)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleTimelineScrub(moveEvent.clientX)
    }
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Clip dragging/trimming logic
  const handleClipMouseDown = (
    e: React.MouseEvent,
    clipId: string,
    action: 'move' | 'trim-left' | 'trim-right'
  ) => {
    e.stopPropagation()
    e.preventDefault()
    
    setSelectedTimelineClipIds(prev => {
      if (e.ctrlKey || e.metaKey) {
        if (prev.includes(clipId)) {
          return prev.filter(id => id !== clipId);
        } else {
          return [...prev, clipId];
        }
      }
      return [clipId];
    });
    
    // Find library clip and set active if needed
    const tClip = timelineVideoClips.find(c => c.id === clipId)
    if (tClip) {
      updateCurrentTime(tClip.startSeconds);
      flushCurrentTime();
      setIsPlaying(false);
    }
    
    if (!trackRef.current) return
    
    const rect = trackRef.current.getBoundingClientRect()
    const trackWidth = rect.width
    const startX = e.clientX
    
    const clip = timelineVideoClips.find(c => c.id === clipId)
    if (!clip) return
    
    const initialStart = clip.startSeconds
    const initialDuration = clip.durationSeconds
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaSeconds = (deltaX / trackWidth) * totalDuration
      
      setTimelineVideoClips(prev => 
        prev.map(c => {
          if (c.id !== clipId) return c
          
          if (action === 'move') {
            const newStart = Math.max(0, initialStart + deltaSeconds)
            return { ...c, startSeconds: newStart }
          } else if (action === 'trim-left') {
            const newStart = Math.min(initialStart + initialDuration - 0.2, Math.max(0, initialStart + deltaSeconds))
            const newDuration = initialStart + initialDuration - newStart
            return { ...c, startSeconds: newStart, durationSeconds: newDuration }
          } else { // trim-right
            const newDuration = Math.max(0.2, initialDuration + deltaSeconds)
            return { ...c, durationSeconds: newDuration }
          }
        })
      )
    }
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      
      setTimelineVideoClips(prev => {
        const aligned = applyMagneticLayout(prev);
        setTimeout(() => {
          pushHistory(aligned);
        }, 0);
        return aligned;
      });
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Delete Clips central handler
  const handleDeleteClips = (clipIdsToDelete: string[]) => {
    const clips = timelineClipsRef.current || [];
    const videoClips = clips.filter(c => c.type !== 'audio' && c.type !== 'graphic' && !clipIdsToDelete.includes(c.id));
    const audioClips = clips.filter(c => c.type === 'audio' && !clipIdsToDelete.includes(c.id));
    const graphicClips = clips.filter(c => c.type === 'graphic' && !clipIdsToDelete.includes(c.id));
    
    // Sort remaining video clips by start time
    videoClips.sort((a, b) => a.startSeconds - b.startSeconds);
    
    let currentStart = 0;
    const rebuiltVideoClips = videoClips.map(clip => {
      const updated = {
        ...clip,
        startSeconds: currentStart
      };
      currentStart += clip.durationSeconds;
      return updated;
    });
    
    const updated = [...rebuiltVideoClips, ...audioClips, ...graphicClips];
    setTimelineVideoClips(updated);
    setSelectedTimelineClipIds([]);
    pushHistory(updated);
  };

  // Duplicate timeline clip
  const duplicateTimelineClip = (clipId: string) => {
    const clip = timelineVideoClips.find(c => c.id === clipId)
    if (!clip) return
    
    const newClip: TimelineClip = {
      id: `timeline-${Math.random()}`,
      name: `${clip.name} (Copy)`,
      startSeconds: clip.startSeconds + clip.durationSeconds,
      durationSeconds: clip.durationSeconds,
      type: clip.type,
      path: clip.path,
      url: clip.url,
      category: clip.category,
      thumbnailUrl: clip.thumbnailUrl,
      graphicData: clip.graphicData
    }
    const updated = applyMagneticLayout([...timelineVideoClips, newClip])
    setTimelineVideoClips(updated)
    pushHistory(updated)
  }

  // Duplicate timeline clips batched
  const duplicateTimelineClips = (clipIds: string[]) => {
    let updated = [...timelineVideoClips];
    clipIds.forEach(clipId => {
      const clip = updated.find(c => c.id === clipId);
      if (!clip) return;
      
      const newClip: TimelineClip = {
        id: `timeline-${Math.random()}`,
        name: `${clip.name} (Copy)`,
        startSeconds: clip.startSeconds + clip.durationSeconds,
        durationSeconds: clip.durationSeconds,
        type: clip.type,
        path: clip.path,
        url: clip.url,
        category: clip.category,
        thumbnailUrl: clip.thumbnailUrl,
        graphicData: clip.graphicData
      };
      updated.push(newClip);
    });
    
    const finalClips = applyMagneticLayout(updated);
    setTimelineVideoClips(finalClips);
    pushHistory(finalClips);
  };

  // Split clip at current playhead
  const handleSplit = () => {
    const targetTime = currentTimeSecondsRef.current
    const clips = timelineClipsRef.current
    const selectedIds = selectedTimelineClipIdsRef.current

    let clipToSplit = clips.find(c => selectedIds.includes(c.id))
    if (!clipToSplit || targetTime < clipToSplit.startSeconds || targetTime > clipToSplit.startSeconds + clipToSplit.durationSeconds) {
      clipToSplit = clips.find(c => targetTime >= c.startSeconds && targetTime <= c.startSeconds + c.durationSeconds)
    }
    
    if (!clipToSplit) return
    
    const splitOffset = targetTime - clipToSplit.startSeconds
    if (splitOffset <= 0.1 || splitOffset >= clipToSplit.durationSeconds - 0.1) {
      return
    }
    
    const secondClip: TimelineClip = {
      id: `timeline-${Math.random()}`,
      name: `${clipToSplit.name} (Part 2)`,
      startSeconds: targetTime,
      durationSeconds: clipToSplit.durationSeconds - splitOffset,
      type: clipToSplit.type,
      path: clipToSplit.path,
      url: clipToSplit.url,
      category: clipToSplit.category,
      thumbnailUrl: clipToSplit.thumbnailUrl
    }
    
    const updated = clips.map(c => {
      if (c.id === clipToSplit.id) {
        return {
          ...c,
          durationSeconds: splitOffset
        }
      }
      return c
    }).concat(secondClip)
    
    const magneticallyAligned = applyMagneticLayout(updated)
    setTimelineVideoClips(magneticallyAligned)
    pushHistory(magneticallyAligned)
  }

  // Copy clip
  const handleCopyClip = () => {
    const clip = timelineVideoClips.find(c => selectedTimelineClipIds.includes(c.id))
    if (clip) {
      setCopiedClip(clip)
    }
  }

  // Paste clip at playhead
  const handlePasteClip = () => {
    if (!copiedClip) return
    const newClip: TimelineClip = {
      id: `timeline-${Math.random()}`,
      name: `${copiedClip.name} (Copy)`,
      startSeconds: currentTimeRef.current,
      durationSeconds: copiedClip.durationSeconds,
      type: copiedClip.type
    }
    const updated = [...timelineVideoClips, newClip]
    setTimelineVideoClips(updated)
    pushHistory(updated)
  }

  // Preview zoom & pan
  const handlePreviewWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const zoomDelta = -e.deltaY * 0.001
    setZoom(prev => Math.max(1, Math.min(4, prev + zoomDelta)))
  }

  const handlePreviewMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1 || isCropping || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setIsPanning(true)
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return
    e.preventDefault()
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    })
  }

  const handlePreviewMouseUpOrLeave = () => {
    setIsPanning(false)
  }

  // Crop resize handles
  const handleCropResizeMouseDown = (
    e: React.MouseEvent,
    handle: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  ) => {
    e.stopPropagation()
    e.preventDefault()
    
    const container = e.currentTarget.parentElement?.parentElement
    if (!container) return
    const rect = container.getBoundingClientRect()
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const xPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100
      const yPercent = ((moveEvent.clientY - rect.top) / rect.height) * 100
      
      setCropRect(prev => {
        let left = prev.left
        let right = prev.right
        let top = prev.top
        let bottom = prev.bottom
        
        if (handle === 'top-left') {
          left = Math.max(0, Math.min(100 - right - 10, xPercent))
          top = Math.max(0, Math.min(100 - bottom - 10, yPercent))
        } else if (handle === 'top-right') {
          right = Math.max(0, Math.min(100 - left - 10, 100 - xPercent))
          top = Math.max(0, Math.min(100 - bottom - 10, yPercent))
        } else if (handle === 'bottom-left') {
          left = Math.max(0, Math.min(100 - right - 10, xPercent))
          bottom = Math.max(0, Math.min(100 - top - 10, 100 - yPercent))
        } else if (handle === 'bottom-right') {
          right = Math.max(0, Math.min(100 - left - 10, 100 - xPercent))
          bottom = Math.max(0, Math.min(100 - top - 10, 100 - yPercent))
        }
        
        return { left, right, top, bottom }
      })
    }
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleConfirmCrop = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveCrop(cropRect)
    setIsCropping(false)
  }

  const handleCancelCrop = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCropping(false)
  }

  // Global Keyboard Shortcuts (Undo, Redo, Split, Delete, Select All)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.getAttribute('contenteditable') === 'true') {
        return
      }

      const key = e.key.toLowerCase()

      // Ctrl+B / Cmd+B -> Split
      if ((e.ctrlKey || e.metaKey) && (key === 'b' || e.code === 'KeyB')) {
        e.preventDefault()
        handleSplit()
      }

      // Ctrl+Z / Cmd+Z -> Undo
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault()
        handleUndo()
      }

      // Ctrl+Y / Cmd+Y -> Redo
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault()
        handleRedo()
      }

      // Ctrl+A / Cmd+A -> Select All Video Clips
      if ((e.ctrlKey || e.metaKey) && (key === 'a' || e.code === 'KeyA')) {
        e.preventDefault()
        const videoClips = timelineClipsRef.current.filter(c => c.type !== 'audio')
        const videoClipIds = videoClips.map(c => c.id)
        setSelectedTimelineClipIds(videoClipIds)
      }

      // Delete / Backspace -> Delete Selected Clips
      if (key === 'delete' || key === 'backspace') {
        const selectedIds = selectedTimelineClipIdsRef.current
        if (selectedIds && selectedIds.length > 0) {
          e.preventDefault()
          handleDeleteClips(selectedIds)
        }
      }

      // Ctrl+= / Ctrl++ -> Timeline Zoom In
      if ((e.ctrlKey || e.metaKey) && (key === '=' || key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault()
        setTimelineZoom(prev => Math.min(6000, prev + 300))
      }

      // Ctrl+- -> Timeline Zoom Out
      if ((e.ctrlKey || e.metaKey) && (key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault()
        setTimelineZoom(prev => Math.max(1200, prev - 300))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // Stable!

  // Reset selected clips if they are no longer present in clips
  useEffect(() => {
    setSelectedTimelineClipIds(prev => {
      const filtered = prev.filter(id => timelineVideoClips.some(c => c.id === id));
      if (filtered.length !== prev.length) {
        return filtered;
      }
      return prev;
    });
  }, [timelineVideoClips]);

  // Bind non-passive wheel event to timeline tracks container to handle Ctrl+Scroll zoom
  useEffect(() => {
    const element = timelineTracksRef.current;
    if (!element) return;
    
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault(); // Blocks Electron page zoom
        const zoomDelta = e.deltaY < 0 ? 100 : -100;
        setTimelineZoom(prev => Math.max(1200, Math.min(6000, prev + zoomDelta)));
      } else if (e.deltaY !== 0) {
        element.scrollLeft += e.deltaY;
      }
    };
    
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Handle right-click context menu
  const handleClipContextMenu = (e: React.MouseEvent, clipId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedTimelineClipIds(prev => {
      if (prev.includes(clipId)) {
        return prev;
      }
      return [clipId];
    });
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      clipId
    })
  }

  // Close context menu on click
  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu(null)
    }
    window.addEventListener('click', handleCloseMenu)
    return () => window.removeEventListener('click', handleCloseMenu)
  }, [])

  // HTML5 video handlers
  const loadClip = useCallback((index: number, autoPlay: boolean) => {
    const clip = sortedVideoClips[index];
    const video = videoRef.current;
    if (!clip || !video) {
      setIsPlaying(false);
      if (video) video.pause();
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    setCurrentClipIndex(index);
    
    if (clip.path) {
      const fileUrl = `file:///${clip.path.replace(/\\/g, '/')}`;
      setActiveVideoUrl(fileUrl);
      if (video.src !== fileUrl) {
        video.src = fileUrl;
        video.load();
      }
      const masterTime = audioRef.current ? audioRef.current.currentTime : currentTimeRef.current;
      const offsetInClip = masterTime - clip.startSeconds;
      video.currentTime = Math.max(0, offsetInClip);
      if (autoPlay) {
        video.play().catch(e => console.error("loadClip play error:", e));
      }
    } else {
      setActiveVideoUrl(null);
      if (video) video.pause();
    }
  }, [sortedVideoClips]);

  const handleVideoCanPlay = () => {
    if (videoRef.current && isPlaying) {
      videoRef.current.play().catch(e => console.error("canplay play error:", e));
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDurationSeconds(videoRef.current.duration || 0)
      handleVideoCanPlay();
    }
  }

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDurationSeconds(videoRef.current.duration || 0)
    }
  }

  const handleEnded = () => {
    const nextIdx = currentClipIndex + 1;
    if (nextIdx < sortedVideoClips.length) {
      loadClip(nextIdx, true);
    } else {
      setIsPlaying(false);
      const video = videoRef.current;
      if (video) video.pause();
      if (audioRef.current) audioRef.current.pause();
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && isPlaying) {
      const clip = sortedVideoClips[currentClipIndex];
      const audio = audioRef.current;
      const cursor = (audio && !audio.paused) ? audio.currentTime : (clip ? clip.startSeconds + video.currentTime : video.currentTime);
      updateCurrentTime(cursor);
    }
  };

  // Sync global timecode string representation
  useEffect(() => {
    const hrs = Math.floor(currentTimeForUI / 3600)
    const mins = Math.floor((currentTimeForUI % 3600) / 60)
    const secs = Math.floor(currentTimeForUI % 60)
    const frames = Math.floor((currentTimeForUI % 1) * 24) // mock 24 fps
    const pad = (num: number) => String(num).padStart(2, '0')
    setCurrentTime(`${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`)
  }, [currentTimeForUI]);

  // Force video element to load new source immediately when activeVideoUrl changes (Bug 1)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [activeVideoUrl]);

  // Sync volume, mute, and speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted, activeVideoUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, activeVideoUrl]);

  // AI Transcription States
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('')
  const [transcriptSegments, setTranscriptSegments] = useState<{ start: number; end: number; text: string }[]>([])
  const [newAudioSegments, setNewAudioSegments] = useState<{ start: number; end: number; text: string }[]>([])
  const [originalTranscriptText, setOriginalTranscriptText] = useState<string>('')
  const transcription = originalTranscriptText
  const [aiScript, setAiScript] = useState<string>('')
  const [isRewriting, setIsRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState<string>('')
  const [isCopied, setIsCopied] = useState(false)

  // AI Asset Generation States
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; paragraph: string; type: string } | null>(null)
  const [generationError, setGenerationError] = useState<string>('')

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onGenerationProgress) {
      const unsub = window.electronAPI.onGenerationProgress((_event, data) => {
        setGenerationProgress({
          current: data.index + 1,
          total: data.total,
          paragraph: data.paragraph,
          type: data.type
        });
      });
      return () => unsub();
    }
    return undefined;
  }, []);

  // Resizable panel dimensions
  const [libraryWidth, setLibraryWidth] = useState(320)
  const [toolsWidth, setToolsWidth] = useState(320)
  const [timelineHeight, setTimelineHeight] = useState(256)

  // Voice settings states (ElevenLabs style)
  const [voiceModel, setVoiceModel] = useState('Eleven Multilingual v2')
  const [voiceSpeaker, setVoiceSpeaker] = useState('Clon de mi Voz (Voz del Video)')
  const [elevenLabsVoices, setElevenLabsVoices] = useState<any[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('c9cmyX6CFsCvEKNVoCZ1')
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false)
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null)
  const [playingPreviewVoiceId, setPlayingPreviewVoiceId] = useState<string | null>(null)

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const res = await window.electronAPI.getElevenLabsVoices();
        if (res && res.success && res.voices) {
          setElevenLabsVoices(res.voices);
          const savedVoiceId = localStorage.getItem('elevenlabs_selected_voice_id');
          if (savedVoiceId && res.voices.some((v: any) => v.voice_id === savedVoiceId)) {
            setSelectedVoiceId(savedVoiceId);
          } else {
            setSelectedVoiceId('c9cmyX6CFsCvEKNVoCZ1');
          }
        }
      } catch (err) {
        console.error('Error fetching ElevenLabs voices:', err);
      }
    };
    fetchVoices();
  }, []);

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    localStorage.setItem('elevenlabs_selected_voice_id', voiceId);
  };

  const playVoicePreview = (voice: any) => {
    if (playingPreviewVoiceId === voice.voice_id && previewAudio) {
      previewAudio.pause();
      setPreviewAudio(null);
      setPlayingPreviewVoiceId(null);
      return;
    }

    if (previewAudio) {
      previewAudio.pause();
    }

    if (voice.preview_url) {
      const audio = new Audio(voice.preview_url);
      audio.volume = 0.8;
      audio.play().catch(e => console.error("Error playing voice preview:", e));
      audio.onended = () => {
        setPlayingPreviewVoiceId(null);
        setPreviewAudio(null);
      };
      setPreviewAudio(audio);
      setPlayingPreviewVoiceId(voice.voice_id);
    } else {
      alert("Esta voz no tiene un audio de demostración disponible.");
    }
  };
  const [voiceSpeed, setVoiceSpeed] = useState(1.0)
  const [voiceStability, setVoiceStability] = useState(50)
  const [voiceFormat] = useState('MP3 44.1 kHz')
  const [generatedVoices, setGeneratedVoices] = useState<GeneratedVoiceVersion[]>([])
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false)
  const [voiceGenerationError, setVoiceGenerationError] = useState<string>('')

  // Bank Clips & Tabs states
  const [libraryTab, setLibraryTab] = useState('Principal')
  const [bankClips, setBankClips] = useState<Record<string, any[]>>({
    originales: [],
    stock: [],
    minimax: [],
    veo3: []
  })
  const [isCuttingClips, setIsCuttingClips] = useState(false)
  const [cuttingClipsError, setCuttingClipsError] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Timeline IA weights: [Original, Stock, MiniMax]
  const [timelineWeights, setTimelineWeights] = useState<number[]>([40, 30, 30])
  const [iaStyle, setIaStyle] = useState<'cartoon' | 'bw' | 'normal'>('normal')

  // MiniMax Hub States
  const [minimaxPrompt, setMinimaxPrompt] = useState<string>('')
  const [isGeneratingMinimax, setIsGeneratingMinimax] = useState(false)
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false)
  const [minimaxError, setMinimaxError] = useState<string>('')

  // Project persistence state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false)
  const hasLoaded = React.useRef(false)

  const firstLibraryClip = clips.find(c => c.type === 'video' || c.type === 'audio') || clips[0];
  const firstLibraryClipId = firstLibraryClip ? firstLibraryClip.id : null;

  useEffect(() => {
    setIsTranscribing(false);
    setTranscriptionStatus('');
    setTranscriptSegments([]);
    setOriginalTranscriptText('');
    setAiScript('');
    setIsRewriting(false);
    setRewriteError('');
  }, [firstLibraryClipId]);

  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.onTranscriptionUpdate === 'function') {
      const unsubscribe = window.electronAPI.onTranscriptionUpdate((_event, data) => {
        if (data.status === 'starting') {
          setIsTranscribing(true);
          setTranscriptionStatus(data.message);
          setTranscriptSegments([]);
        } else if (data.status === 'progress') {
          setTranscriptionStatus(data.message);
        } else if (data.status === 'success') {
          setIsTranscribing(false);
          setTranscriptionStatus('Transcripción completada con éxito.');
          if (data.result && data.result.segments) {
            setTranscriptSegments(data.result.segments);
            const compiled = data.result.segments.map((s: any) => s.text).join(' ');
            setOriginalTranscriptText(compiled);
            pushMilestone('Transcripción lista', {
              transcriptionStatus: 'Transcripción completada con éxito.',
              transcriptSegments: data.result.segments,
              originalTranscriptText: compiled
            });
          }
        } else if (data.status === 'error') {
          setIsTranscribing(false);
          setTranscriptionStatus(`Error: ${data.error}`);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Master Audio initialization and volume/mute sync
  useEffect(() => {
    const voiceClip = timelineVideoClips.find(c => c.type === 'audio');
    if (voiceClip && voiceClip.url) {
      if (!audioRef.current) {
        audioRef.current = new Audio(voiceClip.url);
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          if (videoRef.current) videoRef.current.pause();
        });
      } else if (audioRef.current.src !== voiceClip.url) {
        audioRef.current.src = voiceClip.url;
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
  }, [timelineVideoClips]);

  // Synchronize HTML5 video and audio play state when isPlaying changes (Corrección 1)
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    if (isPlaying) {
      const currentT = currentTimeRef.current;
      if (audio) {
        audio.currentTime = currentT;
        audio.play().catch(e => console.error("Audio play error:", e));
      }
      
      const idx = Math.max(0, sortedVideoClips.findIndex((_, i) => {
        const next = sortedVideoClips[i + 1];
        return !next || currentT < next.startSeconds;
      }));
      loadClip(idx, true);
    } else {
      if (audio) {
        audio.pause();
      }
      if (video) {
        video.pause();
      }
    }
  }, [isPlaying, loadClip, sortedVideoClips]);

  // Sync volume, mute, and speed of video & audio elements
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isVideoTrackMuted ? 0 : videoTrackVolume * volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted, isVideoTrackMuted, videoTrackVolume, activeVideoUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isAudioTrackMuted ? 0 : audioTrackVolume * volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted, isAudioTrackMuted, audioTrackVolume]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, activeVideoUrl]);



  const refreshProjectsList = async () => {
    try {
      if (window.electronAPI && window.electronAPI.listProjects) {
        const res = await window.electronAPI.listProjects();
        if (res && res.success && res.projects) {
          setProjectsList(res.projects);
        }
      }
    } catch (e) {
      console.error('Error refreshing projects list:', e);
    }
  };

  // Load project list on startup
  useEffect(() => {
    refreshProjectsList();
  }, []);

  // CapCut-style debounced auto-save (triggers 2 seconds after any changes)
  useEffect(() => {
    if (!hasLoaded.current) return;

    setIsDirty(true);
    const timer = setTimeout(() => {
      handleSaveProjectDirectly();
    }, 2000);

    return () => clearTimeout(timer);
  }, [clips, timelineVideoClips, timelineVersions, activeVersionId, transcriptionStatus, transcriptSegments, aiScript, originalTranscriptText, libraryWidth, toolsWidth, timelineHeight, voiceModel, voiceSpeaker, voiceSpeed, voiceStability, generatedVoices, timelineWeights, graphicsPercent]);

  // Save-on-close handler
  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.onSaveBeforeClose === 'function') {
      const unsubscribe = window.electronAPI.onSaveBeforeClose(async () => {
        const stateToSave = {
          id: activeProjectId,
          name: activeProjectName,
          clips: clips.map(c => ({
            id: c.id,
            name: c.name,
            duration: c.duration,
            durationSeconds: c.durationSeconds,
            type: c.type,
            path: c.path,
            size: c.size,
            url: c.type === 'audio' ? c.url : undefined
          })),
          timelineVideoClips,
          timelineVersions,
          activeVersionId,
          transcriptionStatus,
          transcriptSegments,
          newAudioSegments,
          aiScript,
          originalTranscriptText,
          libraryWidth,
          toolsWidth,
          timelineHeight,
          voiceModel,
          voiceSpeaker,
          voiceSpeed,
          voiceStability,
          generatedVoices,
          graphicsPercent,
          activeProjectId,
          activeProjectName,
          timelineWeights
        };
        
        try {
          await window.electronAPI.saveProjectState(stateToSave);
        } catch (e) {
          console.error('Error saving on close:', e);
        }
        window.electronAPI.readyToClose();
      });
      return () => unsubscribe();
    }
  }, [clips, timelineVideoClips, timelineVersions, activeVersionId, transcriptionStatus, transcriptSegments, newAudioSegments, aiScript, originalTranscriptText, libraryWidth, toolsWidth, timelineHeight, voiceModel, voiceSpeaker, voiceSpeed, voiceStability, generatedVoices, graphicsPercent, activeProjectId, activeProjectName, timelineWeights]);

  const handleSaveProjectDirectly = async (): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      const stateToSave = {
        id: activeProjectId,
        name: activeProjectName,
        clips: clips.map(c => ({
          id: c.id,
          name: c.name,
          duration: c.duration,
          durationSeconds: c.durationSeconds,
          type: c.type,
          path: c.path,
          size: c.size,
          url: c.type === 'audio' ? c.url : undefined
        })),
        timelineVideoClips,
        timelineVersions,
        activeVersionId,
        transcriptionStatus,
        transcriptSegments,
        newAudioSegments,
        aiScript,
        originalTranscriptText,
        libraryWidth,
        toolsWidth,
        timelineHeight,
        voiceModel,
        voiceSpeaker,
        voiceSpeed,
        voiceStability,
        generatedVoices,
        graphicsPercent,
        timelineWeights
      };

      const res = await window.electronAPI.saveProjectState(stateToSave);
      if (res && res.success) {
        setSaveStatus('saved');
        setIsDirty(false);
        setTimeout(() => setSaveStatus('idle'), 2500);
        return true;
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
        return false;
      }
    } catch (e) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
      return false;
    }
  };

  const handleSaveProjectAs = async () => {
    setSaveStatus('saving');
    try {
      const stateToSave = {
        id: activeProjectId,
        name: activeProjectName,
        clips: clips.map(c => ({
          id: c.id,
          name: c.name,
          duration: c.duration,
          durationSeconds: c.durationSeconds,
          type: c.type,
          path: c.path,
          size: c.size,
          url: c.type === 'audio' ? c.url : undefined
        })),
        timelineVideoClips,
        timelineVersions,
        activeVersionId,
        transcriptionStatus,
        transcriptSegments,
        newAudioSegments,
        aiScript,
        originalTranscriptText,
        libraryWidth,
        toolsWidth,
        timelineHeight,
        voiceModel,
        voiceSpeaker,
        voiceSpeed,
        voiceStability,
        generatedVoices,
        graphicsPercent,
        timelineWeights
      };

      const res = await window.electronAPI.saveProjectAs(stateToSave);
      if (res && res.success) {
        setSaveStatus('saved');
        setIsDirty(false);
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
      }
    } catch (e) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  const handleLoadProject = async (projectPath: string) => {
    try {
      const res = await window.electronAPI.loadProject({ projectPath });
      if (res && res.success && res.data) {
        const loadedData = res.data;
        
        const restoredClips = (loadedData.clips || []).map((c: any) => ({
          ...c,
          url: c.type === 'audio' ? c.url : undefined
        }));

        setClips(restoredClips);
        const restoredVersions = loadedData.timelineVersions || [
          {
            id: 'v-original',
            name: 'Timeline Original',
            timestamp: Date.now(),
            timelineVideoClips: loadedData.timelineVideoClips || []
          }
        ];
        const restoredActiveId = loadedData.activeVersionId || restoredVersions[0]?.id || 'v-original';
        setTimelineVersions(restoredVersions);
        setActiveVersionId(restoredActiveId);

        const activeVersion = restoredVersions.find((v: any) => v.id === restoredActiveId);
        setTimelineVideoClips(activeVersion ? activeVersion.timelineVideoClips : (loadedData.timelineVideoClips || []));
        setTranscriptionStatus(loadedData.transcriptionStatus || '');
        setTranscriptSegments(loadedData.transcriptSegments || []);
        setNewAudioSegments(loadedData.newAudioSegments || []);
        setAiScript(loadedData.aiScript || '');
        const loadedOriginalText = loadedData.originalTranscriptText || (loadedData.transcriptSegments || []).map((s: any) => s.text).join(' ') || '';
        setOriginalTranscriptText(loadedOriginalText);
        if (loadedData.libraryWidth) setLibraryWidth(loadedData.libraryWidth);
        if (loadedData.toolsWidth) setToolsWidth(loadedData.toolsWidth);
        if (loadedData.timelineHeight) setTimelineHeight(loadedData.timelineHeight);
        if (loadedData.voiceModel) setVoiceModel(loadedData.voiceModel);
        if (loadedData.voiceSpeaker) setVoiceSpeaker(loadedData.voiceSpeaker);
        if (loadedData.voiceSpeed !== undefined) setVoiceSpeed(loadedData.voiceSpeed);
        if (loadedData.voiceStability !== undefined) setVoiceStability(loadedData.voiceStability);
        setGeneratedVoices(loadedData.generatedVoices || []);
        if (loadedData.timelineWeights !== undefined) setTimelineWeights(loadedData.timelineWeights);
        if (loadedData.graphicsPercent !== undefined) setGraphicsPercent(loadedData.graphicsPercent);
        
        setActiveProjectPath(projectPath);
        setActiveProjectId(loadedData.id || null);
        setActiveProjectName(loadedData.name || 'Proyecto Sin Nombre');

        const loadedMilestone: MilestoneState = {
          label: 'Proyecto cargado',
          clips: restoredClips,
          timelineVideoClips: activeVersion ? activeVersion.timelineVideoClips : (loadedData.timelineVideoClips || []),
          transcriptionStatus: loadedData.transcriptionStatus || '',
          transcriptSegments: loadedData.transcriptSegments || [],
          newAudioSegments: loadedData.newAudioSegments || [],
          aiScript: loadedData.aiScript || '',
          originalTranscriptText: loadedOriginalText,
          generatedVoices: loadedData.generatedVoices || [],
          graphicsPercent: loadedData.graphicsPercent ?? 50
        };
        setMilestoneHistory([loadedMilestone]);
        setMilestoneIndex(0);
        setIsDirty(false);
        
        // Refresh bank clips for temp folders
        await loadClipsForCategory('originales');
        await loadClipsForCategory('minimax');

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);

        setTimeout(() => {
          hasLoaded.current = true;
        }, 1000);
      } else {
        alert('Error al cargar proyecto: ' + (res?.error || 'Desconocido'));
      }
    } catch (err: any) {
      console.error('Failed to load project:', err);
      alert('Excepción al cargar proyecto: ' + err.message);
    }
  };

  const handleCreateProject = async (name: string) => {
    try {
      const res = await window.electronAPI.createProject({ name });
      if (res && res.success && res.data) {
        // Marca que la carga aún no terminó para evitar pantalla azul
        hasLoaded.current = false;
        const loadedData = res.data;
        
        setClips([]);
        const initialVersion = {
          id: 'v-original',
          name: 'Timeline Original',
          timestamp: Date.now(),
          timelineVideoClips: []
        };
        setTimelineVersions([initialVersion]);
        setActiveVersionId('v-original');
        setTimelineVideoClips([]);
        setTranscriptionStatus('');
        setTranscriptSegments([]);
        setAiScript('');
        setOriginalTranscriptText('');
        setGeneratedVoices([]);
        setTimelineWeights([40, 30, 30]);
        setGraphicsPercent(50);

        setActiveProjectPath(res.projectPath || null);
        setActiveProjectId(loadedData.id || null);
        setActiveProjectName(name);

        const initialMilestone: MilestoneState = {
          label: 'Proyecto vacío',
          clips: [],
          timelineVideoClips: [],
          transcriptionStatus: '',
          transcriptSegments: [],
          aiScript: '',
          originalTranscriptText: '',
          generatedVoices: [],
          graphicsPercent: 50
        };
        setMilestoneHistory([initialMilestone]);
        setMilestoneIndex(0);
        setIsDirty(false);
        
        setBankClips({
          originales: [],
          stock: [],
          minimax: [],
          veo3: []
        });

        console.log('Project created successfully:', res.projectPath);
        setShowNewProjectModal(false);
        setNewProjectName('');
        
        setTimeout(() => {
          hasLoaded.current = true;
        }, 1000);
      } else {
        alert('Error al crear proyecto: ' + (res?.error || 'Desconocido'));
      }
    } catch (err: any) {
      console.error('Failed to create project:', err);
      alert('Excepción al crear proyecto: ' + err.message);
    }
  };

  const handleCloseProject = async () => {
    try {
      if (hasLoaded.current) {
        await handleSaveProjectDirectly();
      }
      if (window.electronAPI && window.electronAPI.closeProject) {
        await window.electronAPI.closeProject();
      }
      hasLoaded.current = false;
      setActiveProjectPath(null);
      setActiveProjectId(null);
      setActiveProjectName(null);
      setClips([]);
      setTimelineVersions([]);
      setActiveVersionId('');
      setTimelineVideoClips([]);
      setTranscriptionStatus('');
      setTranscriptSegments([]);
      setNewAudioSegments([]);
      setAiScript('');
      setOriginalTranscriptText('');
      setGeneratedVoices([]);
      
      refreshProjectsList();
    } catch (err: any) {
      console.error('Failed to close project:', err);
    }
  };

  const handleDeleteProject = async (projectPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de que deseas eliminar este proyecto de forma permanente?')) return;
    try {
      const res = await window.electronAPI.deleteProject({ projectPath });
      if (res && res.success) {
        if (activeProjectPath === projectPath) {
          handleCloseProject();
        } else {
          refreshProjectsList();
        }
      } else {
        alert('Error al eliminar proyecto: ' + (res?.error || 'Desconocido'));
      }
    } catch (err: any) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleClearGlobalStockCache = async () => {
    if (!confirm('¿Estás seguro de que deseas borrar la caché global de videos de stock de Pexels? Los videos se volverán a descargar cuando sean requeridos.')) return;
    try {
      const res = await window.electronAPI.clearGlobalStockCache();
      if (res && res.success) {
        alert('Caché global de stock eliminada con éxito.');
      } else {
        alert('Error al borrar caché de stock: ' + (res?.error || 'Desconocido'));
      }
    } catch (err: any) {
      console.error('Failed to clear global stock cache:', err);
    }
  };

  const handleDeleteAllProjects = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar TODOS los proyectos de forma permanente? Esta acción no se puede deshacer.')) return;
    if (!confirm('¿De verdad quieres borrar absolutamente todos los proyectos y sus archivos del disco?')) return;
    try {
      const res = await window.electronAPI.deleteAllProjects();
      if (res && res.success) {
        setClips([]);
        setTimelineVideoClips([]);
        setTimelineVersions([]);
        setActiveProjectPath(null);
        setActiveProjectId(null);
        setActiveProjectName(null);
        refreshProjectsList();
      } else {
        alert('Error al eliminar todos los proyectos: ' + (res?.error || 'Desconocido'));
      }
    } catch (err: any) {
      console.error('Failed to delete all projects:', err);
    }
  };

  const handleOpenProject = async () => {
    try {
      const res = await window.electronAPI.openProject();
      if (res && res.success && res.projectPath && res.data) {
        const loadedData = res.data;
        const restoredClips = (loadedData.clips || []).map((c: any) => ({
          ...c,
          url: c.type === 'audio' ? c.url : undefined
        }));

        setClips(restoredClips);
        const restoredVersions = loadedData.timelineVersions || [
          {
            id: 'v-original',
            name: 'Timeline Original',
            timestamp: Date.now(),
            timelineVideoClips: loadedData.timelineVideoClips || []
          }
        ];
        const restoredActiveId = loadedData.activeVersionId || restoredVersions[0]?.id || 'v-original';
        setTimelineVersions(restoredVersions);
        setActiveVersionId(restoredActiveId);

        const activeVersion = restoredVersions.find((v: any) => v.id === restoredActiveId);
        setTimelineVideoClips(activeVersion ? activeVersion.timelineVideoClips : (loadedData.timelineVideoClips || []));
        setTranscriptionStatus(loadedData.transcriptionStatus || '');
        setTranscriptSegments(loadedData.transcriptSegments || []);
        setNewAudioSegments(loadedData.newAudioSegments || []);
        setAiScript(loadedData.aiScript || '');
        const loadedOriginalText = loadedData.originalTranscriptText || (loadedData.transcriptSegments || []).map((s: any) => s.text).join(' ') || '';
        setOriginalTranscriptText(loadedOriginalText);
        if (loadedData.libraryWidth) setLibraryWidth(loadedData.libraryWidth);
        if (loadedData.toolsWidth) setToolsWidth(loadedData.toolsWidth);
        if (loadedData.timelineHeight) setTimelineHeight(loadedData.timelineHeight);
        if (loadedData.voiceModel) setVoiceModel(loadedData.voiceModel);
        if (loadedData.voiceSpeaker) setVoiceSpeaker(loadedData.voiceSpeaker);
        if (loadedData.voiceSpeed !== undefined) setVoiceSpeed(loadedData.voiceSpeed);
        if (loadedData.voiceStability !== undefined) setVoiceStability(loadedData.voiceStability);
        setGeneratedVoices(loadedData.generatedVoices || []);
        if (loadedData.timelineWeights !== undefined) setTimelineWeights(loadedData.timelineWeights);
        if (loadedData.graphicsPercent !== undefined) setGraphicsPercent(loadedData.graphicsPercent);
        
        setActiveProjectPath(res.projectPath);
        setActiveProjectId(loadedData.id || null);
        setActiveProjectName(loadedData.name || 'Proyecto Sin Nombre');
        
        // Refresh bank clips for temp folders
        await loadClipsForCategory('originales');
        await loadClipsForCategory('minimax');

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);

        setTimeout(() => {
          hasLoaded.current = true;
        }, 1000);
      }
    } catch (err: any) {
      console.error('Failed to open project:', err);
    }
  };

  const handleNewProject = () => {
    handleCloseProject().then(() => {
      setShowNewProjectModal(true);
    });
  };

  const handleTranscribeClick = () => {
    setSelectedTool('subtitles'); // Switch active tool in panel
  };

  const handleRewriteClick = async () => {
    if (!originalTranscriptText.trim()) return
    setIsRewriting(true)
    setRewriteError('')
    
    try {
      const res = await window.electronAPI.rewriteTranscript(originalTranscriptText)
      if (res && res.success && res.data) {
        setAiScript(res.data)
        pushMilestone('Guión reescrito', { aiScript: res.data })
      } else {
        setRewriteError(res.error || 'Error al conectar con la API de DeepSeek.')
      }
    } catch (err: any) {
      setRewriteError(err.message || 'Error inesperado al solicitar reescritura.')
    } finally {
      setIsRewriting(false)
    }
  }

  const handleCopyScript = () => {
    navigator.clipboard.writeText(aiScript)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2050)
  }

  const loadClipsForCategory = async (category: string) => {
    try {
      const res = await window.electronAPI.loadBankClips({ category });
      if (res && res.success && res.clips) {
        setBankClips(prev => ({
          ...prev,
          [category]: res.clips || []
        }));
      }
    } catch (e) {
      console.error(`Error al cargar clips para la categoría ${category}:`, e);
    }
  };

  useEffect(() => {
    if (libraryTab !== 'Principal') {
      loadClipsForCategory(libraryTab.toLowerCase());
    }
  }, [libraryTab]);

  const handleCutClipsClick = async () => {
    const firstVideoInLibrary = clips.find(c => c.type === 'video' || c.type === 'audio') || clips[0];
    if (!firstVideoInLibrary) return;
    setIsCuttingClips(true);
    setCuttingClipsError('');
    try {
      const res = await window.electronAPI.cutVideoClips({
        videoPath: firstVideoInLibrary.path,
        timestamps: transcriptSegments.map((s: any) => s.start),
        aspectRatio: aspectRatio
      });
      if (res && res.success && res.clips) {
        setBankClips(prev => ({
          ...prev,
          originales: res.clips || []
        }));
        setLibraryTab('Originales');
      } else {
        setCuttingClipsError(res?.error || 'Error al cortar el video en clips.');
      }
    } catch (err: any) {
      setCuttingClipsError(err.message || 'Excepción al realizar el corte del video.');
    } finally {
      setIsCuttingClips(false);
    }
  };

  const handleExportClick = async () => {
    if (timelineVideoClips.length === 0) {
      alert('No hay clips en el Timeline para exportar. Agrega clips primero.');
      return;
    }
    
    setIsExporting(true);
    setShowExportModal(false);
    
    try {
      console.log('Exportando timeline con aspecto:', aspectRatio, 'res:', exportResolution, 'fmt:', exportFormat, 'calidad:', exportQuality);
      const res = await window.electronAPI.exportVideo({
        clips: timelineVideoClips,
        aspectRatio: aspectRatio,
        resolution: exportResolution,
        format: exportFormat,
        quality: exportQuality
      });
      
      if (res && res.success && res.filePath) {
        alert(`¡Video exportado con éxito en:\n${res.filePath}`);
      } else {
        const errorMsg = res?.error || 'Error al exportar el video.';
        alert(`Error al exportar: ${errorMsg}`);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Excepción al exportar el video.';
      alert(`Error al exportar: ${errorMsg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWeightChange = (index: number, newValue: number) => {
    const updatedWeights = [...timelineWeights];
    const oldValue = updatedWeights[index];
    const diff = newValue - oldValue;
    
    // Set the new value
    updatedWeights[index] = newValue;
    
    // Distribute the difference among other sliders
    const otherIndices = [0, 1, 2].filter(i => i !== index);
    const sumOthers = otherIndices.reduce((sum, i) => sum + updatedWeights[i], 0);
    
    if (sumOthers > 0) {
      // Distribute proportionally
      let remainingDiff = diff;
      otherIndices.forEach((i, idx) => {
        const share = Math.round((updatedWeights[i] / sumOthers) * diff);
        const toSubtract = idx === otherIndices.length - 1 ? remainingDiff : share;
        updatedWeights[i] = Math.max(0, updatedWeights[i] - toSubtract);
        remainingDiff -= toSubtract;
      });
    } else {
      // If others are all 0, distribute evenly
      let remainingDiff = diff;
      const count = otherIndices.length;
      otherIndices.forEach((i, idx) => {
        const share = Math.round(diff / count);
        const toSubtract = idx === otherIndices.length - 1 ? remainingDiff : share;
        updatedWeights[i] = Math.max(0, updatedWeights[i] - toSubtract);
        remainingDiff -= toSubtract;
      });
    }
    
    // Ensure the sum is exactly 100
    const finalSum = updatedWeights.reduce((a, b) => a + b, 0);
    if (finalSum !== 100) {
      const adjustment = 100 - finalSum;
      const adjIndex = otherIndices.find(i => updatedWeights[i] + adjustment >= 0) ?? otherIndices[0];
      updatedWeights[adjIndex] = Math.max(0, updatedWeights[adjIndex] + adjustment);
    }
    
    setTimelineWeights(updatedWeights);
  };

  const handleBuildIATimeline = async () => {
    if (!aiScript.trim()) return;

    const voiceClip = timelineVideoClips.find(c => c.type === 'audio');
    const isUsingOriginalAudio = voiceClip?.name === 'Voz - Audio Original';
    if (!voiceClip) {
      setGenerationError('Debes agregar un audio al timeline primero.');
      return;
    }
    if (!isUsingOriginalAudio && (!newAudioSegments || newAudioSegments.length === 0)) {
      setGenerationError('Debes generar la voz primero antes de construir el timeline.');
      return;
    }
    const effectiveAudioSegments = isUsingOriginalAudio ? transcriptSegments : newAudioSegments;
    
    setIsGeneratingAssets(true);
    setGenerationError('');
    setGenerationProgress(null);

    try {
      // 1. Slicing original video first if one is imported (Regla 1)
      const firstVideoInLibrary = clips.find(c => c.type === 'video' || c.type === 'audio') || clips[0];
      if (firstVideoInLibrary) {
        console.log('[handleBuildIATimeline] Cortando video original en clips de 3 segundos...');
        setGenerationProgress({ current: 0, total: 3, paragraph: 'Cortando video original en clips de 3s...', type: 'FFmpeg' });
        const cutRes = await window.electronAPI.cutVideoClips({
          videoPath: firstVideoInLibrary.path
        });
        if (cutRes && cutRes.success && cutRes.clips) {
          setBankClips(prev => ({
            ...prev,
            originales: cutRes.clips || []
          }));
        } else {
          throw new Error(cutRes?.error || 'Error al segmentar el video original.');
        }
      }

      console.log('[handleBuildIATimeline] Iniciando generación de assets de Timeline IA...');
      const audioDuration = voiceClip ? voiceClip.durationSeconds : undefined;
      const res = await window.electronAPI.generateTimelineAssets({ 
        scriptText: aiScript, 
        weights: timelineWeights, 
        aspectRatio, 
        audioDuration,
        transcriptSegments,
        videoPath: firstVideoInLibrary?.path,
        iaStyle,
        graphicsPercent,
        newAudioSegments: effectiveAudioSegments
      });
      
      if (res && res.success && res.clips) {
        console.log('[handleBuildIATimeline] Generación completada con éxito. Clips recibidos:', res.clips.length);
        
        // Refresh library bank folders so generated clips appear in their tabs
        await loadClipsForCategory('originales');
        await loadClipsForCategory('minimax');

        const newVideoClips: any[] = [];
        const newGraphicClips: any[] = [];

        for (let i = 0; i < res.clips.length; i++) {
          const item = res.clips[i];
          const clipInfo = item.clip || item;
          if (clipInfo) {
            if (clipInfo.type === 'graphic') {
              newGraphicClips.push({
                id: clipInfo.id || `timeline-graphic-${Math.random()}`,
                name: clipInfo.name,
                startSeconds: clipInfo.startSeconds || 0,
                durationSeconds: clipInfo.durationSeconds || 2.0,
                type: 'graphic',
                graphicData: clipInfo.graphicData
              });
            } else {
              newVideoClips.push({
                id: `timeline-${Math.random()}`,
                name: clipInfo.name,
                startSeconds: clipInfo.startSeconds || 0,
                durationSeconds: clipInfo.durationSeconds || 3,
                type: 'video',
                url: clipInfo.url,
                path: clipInfo.path,
                category: clipInfo.category || item.type,
                thumbnailUrl: clipInfo.thumbnailUrl || ''
              });
            }
          }
        }

        // Adjust all start times sequentially only for video clips
        let runningStart = 0;
        for (let k = 0; k < newVideoClips.length; k++) {
          const oldStart = newVideoClips[k].startSeconds;
          newVideoClips[k].startSeconds = runningStart;
          
          // Sync startSeconds of graphic clips corresponding to this video clip
          for (let m = 0; m < newGraphicClips.length; m++) {
            if (newGraphicClips[m].startSeconds === oldStart) {
              newGraphicClips[m].startSeconds = runningStart;
            }
          }
          
          runningStart += newVideoClips[k].durationSeconds;
        }

        // Keep all existing audio clips completely intact and untouched!
        const existingAudioClips = timelineVideoClips.filter(c => c.type === 'audio');
        const finalTimelineClips = [...newVideoClips, ...newGraphicClips, ...existingAudioClips];

        const nextVersionNumber = timelineVersions.filter(v => v.id.startsWith('v-ai-')).length + 1;
        const newVersionId = `v-ai-${Date.now()}`;
        const newVersionName = `Versión IA ${nextVersionNumber}`;
        const newVersion: TimelineVersion = {
          id: newVersionId,
          name: newVersionName,
          timestamp: Date.now(),
          timelineVideoClips: finalTimelineClips
        };

        setTimelineVersions(prev => [...prev, newVersion]);
        setActiveVersionId(newVersionId);
        setTimelineVideoClips(finalTimelineClips);
        pushMilestone('Timeline construido', {
          timelineVideoClips: finalTimelineClips
        });
        pushHistory(finalTimelineClips);
      } else {
        const errorMsg = res?.error || 'Error al generar los clips de la IA.';
        setGenerationError(errorMsg);
        console.error('Error en Timeline IA:', errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Excepción al generar assets.';
      setGenerationError(errorMsg);
      console.error('Excepción en Timeline IA:', errorMsg);
    } finally {
      setIsGeneratingAssets(false);
      setGenerationProgress(null);
    }
  };

  const handleRegenerateGraphics = async () => {
    const textToUse = aiScript.trim() || originalTranscriptText.trim();
    if (!textToUse) return;
    const videoClips = timelineVideoClips.filter(c => c.type !== 'audio' && c.type !== 'graphic');
    if (videoClips.length === 0) return;
    setIsGeneratingAssets(true);
    try {
      const res = await window.electronAPI.regenerateGraphics({
        scriptText: textToUse,
        clips: videoClips.map(c => ({ id: c.id, name: c.name })),
        graphicsPercent: graphicsPercent > 0 ? Math.max(50, graphicsPercent) : 0
      });
      if (res && res.success && res.clips) {
        const nonGraphicClips = timelineVideoClips.filter(c => c.type !== 'graphic');
        const newGraphicClips = res.clips
          .filter((c: any) => c.graphicData)
          .map((c: any) => {
            const matchingVideo = nonGraphicClips.find((tc: any) => tc.id === c.id || tc.name === c.name);
            return {
              id: `timeline-graphic-${Math.random()}`,
              name: `Gráfico: ${c.graphicData.label || c.graphicData.type}`,
              startSeconds: matchingVideo?.startSeconds || 0,
              durationSeconds: Math.min(2.0, matchingVideo?.durationSeconds || 2.0),
              type: 'graphic' as const,
              graphicData: c.graphicData
            };
          });
        setTimelineVideoClips([...nonGraphicClips, ...newGraphicClips]);
        setIsDirty(true);
      }
    } catch (err) {
      console.error('Error regenerando gráficos:', err);
    } finally {
      setIsGeneratingAssets(false);
    }
  };

  const handleOptimizePromptWithDeepSeek = async () => {
    if (!minimaxPrompt.trim()) return;
    setIsOptimizingPrompt(true);
    setMinimaxError('');
    try {
      const instructions = `Optimiza el siguiente texto y conviértelo en un prompt altamente detallado y visual en inglés para generación de video por IA (MiniMax). Agrega detalles de cámara, iluminación cinemática y estilo fotorrealista. IMPORTANTE: Responde ÚNICAMENTE con el prompt final optimizado en inglés. No incluyes explicaciones, introducciones ni comillas. Texto original: "${minimaxPrompt}"`;
      const res = await window.electronAPI.rewriteTranscript(instructions);
      if (res && res.success && res.data) {
        setMinimaxPrompt(res.data.trim());
      } else {
        setMinimaxError(res?.error || 'Error al optimizar el prompt con DeepSeek.');
      }
    } catch (e: any) {
      setMinimaxError(e.message || 'Excepción al optimizar prompt.');
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  const handleGenerateMinimaxVideo = async () => {
    if (!minimaxPrompt.trim()) return;
    setIsGeneratingMinimax(true);
    setMinimaxError('');
    try {
      const res = await window.electronAPI.generateMinimaxVideo({ prompt: minimaxPrompt });
      if (res && res.success && res.filePath) {
        const fileUrl = `file:///${res.filePath.replace(/\\/g, '/')}`;
        const newClip: Clip = {
          id: `minimax-${Date.now()}`,
          name: res.name || `minimax-${Date.now()}.mp4`,
          duration: formatTimeMinutesSeconds(res.durationSeconds || 6),
          durationSeconds: res.durationSeconds || 6,
          type: 'video',
          path: res.filePath,
          size: '12 MB',
          url: fileUrl,
          category: 'minimax',
          thumbnailUrl: res.thumbnailUrl
        };
        
        // Add to media bank list
        setClips(prev => [...prev, newClip]);
        
        // Add to active library bank category
        await loadClipsForCategory('minimax');
        
        // Automatically append to the end of the timeline
        const startSec = timelineVideoClips.filter(c => c.type !== 'audio').reduce((max, c) => Math.max(max, c.startSeconds + c.durationSeconds), 0);
        const newTimelineClip: TimelineClip = {
          id: `timeline-${Math.random()}`,
          name: newClip.name,
          startSeconds: startSec,
          durationSeconds: newClip.durationSeconds,
          type: 'video',
          url: newClip.url,
          path: newClip.path,
          category: 'minimax',
          thumbnailUrl: newClip.thumbnailUrl,
          graphicData: newClip.graphicData
        };
        const updated = [...timelineVideoClips, newTimelineClip];
        setTimelineVideoClips(updated);
        pushHistory(updated);
        
        setMinimaxPrompt('');
      } else {
        setMinimaxError(res?.error || 'Error al generar video con la API de MiniMax.');
      }
    } catch (e: any) {
      setMinimaxError(e.message || 'Excepción al generar video con MiniMax.');
    } finally {
      setIsGeneratingMinimax(false);
    }
  };

  const handleGenerateVoiceClick = async () => {
    if (!aiScript.trim()) {
      setVoiceGenerationError('El guión está vacío. Por favor escribe o genera un guión primero.')
      return
    }
    setIsGeneratingVoice(true)
    setVoiceGenerationError('')
    try {
      console.log('Generando voz con ElevenLabs...')
      const res = await window.electronAPI.generateVoice({
        text: aiScript,
        model: voiceModel,
        voiceId: selectedVoiceId,
        speed: voiceSpeed,
        stability: voiceStability
      })
      
      if (res && res.success && res.filePath && res.audioUrl) {
        console.log('Audio generado con éxito y guardado en:', res.filePath)
        
        // Use exact duration from backend if available, fallback to estimate
        const durationSecs = typeof res.durationSeconds === 'number' && res.durationSeconds > 0
          ? res.durationSeconds
          : Math.max(2, Math.ceil(aiScript.split(/\s+/).filter(Boolean).length / 2.5));

        const newVersion: GeneratedVoiceVersion = {
          id: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          speaker: voiceSpeaker,
          model: voiceModel,
          speed: voiceSpeed,
          stability: voiceStability,
          text: aiScript,
          filePath: res.filePath,
          audioUrl: res.audioUrl,
          durationSeconds: durationSecs
        }
        const libraryClip: Clip = {
          id: newVersion.id,
          name: `Voz - ${voiceSpeaker} (${new Date(newVersion.timestamp).toLocaleTimeString()})`,
          duration: formatTimeMinutesSeconds(durationSecs),
          durationSeconds: durationSecs,
          type: 'audio',
          path: res.filePath,
          url: res.audioUrl,
          size: '128 KB'
        };

        const voiceSegments = res.newAudioSegments || [];
        setNewAudioSegments(voiceSegments);

        const updatedClips = [...clips, libraryClip];
        const updatedVoices = [newVersion, ...generatedVoices];
        setClips(updatedClips);
        setGeneratedVoices(updatedVoices);
        pushMilestone('Audio generado', {
          clips: updatedClips,
          generatedVoices: updatedVoices,
          newAudioSegments: voiceSegments
        });
      } else {
        const errorMsg = res?.error || 'Error al generar la voz en ElevenLabs.'
        setVoiceGenerationError(errorMsg)
        console.error('Error al generar voz:', errorMsg)
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Excepción al generar voz.'
      setVoiceGenerationError(errorMsg)
      console.error('Excepción al generar voz:', errorMsg)
    } finally {
      setIsGeneratingVoice(false)
    }
  }

  const addVoiceToTimeline = (voice: GeneratedVoiceVersion) => {
    // Use exact duration if available, fallback to estimate
    const durationSecs = voice.durationSeconds || Math.max(2, Math.ceil(voice.text.split(/\s+/).filter(Boolean).length / 2.5));

    const newTimelineClip: TimelineClip = {
      id: `timeline-voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Voz - ${voice.speaker}`,
      startSeconds: currentTimeRef.current,
      durationSeconds: durationSecs,
      type: 'audio',
      url: voice.audioUrl,
      path: voice.filePath
    }

    const updated = [...timelineVideoClips, newTimelineClip]
    setTimelineVideoClips(updated)
    pushHistory(updated)
  }

  // Panel drag-resize handlers
  const handleLibraryResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Size limits: minWidth 200px, maxWidth 500px
      const newWidth = Math.max(200, Math.min(500, moveEvent.clientX));
      setLibraryWidth(newWidth);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleToolsResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Size limits: minWidth 200px, maxWidth 500px
      const newWidth = Math.max(200, Math.min(500, window.innerWidth - moveEvent.clientX));
      setToolsWidth(newWidth);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTimelineResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Size limits: minHeight 150px, maxHeight 500px
      const newHeight = Math.max(150, Math.min(500, window.innerHeight - moveEvent.clientY));
      setTimelineHeight(newHeight);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };



  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 24); // mock 24 fps
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const processFiles = (filesList: File[]) => {
    filesList.forEach(file => {
      const nameLower = file.name.toLowerCase();
      const isVideo = file.type.startsWith('video/') || nameLower.endsWith('.mp4') || nameLower.endsWith('.mov') || nameLower.endsWith('.mkv') || nameLower.endsWith('.avi') || nameLower.endsWith('.webm');
      const isAudio = file.type.startsWith('audio/') || nameLower.endsWith('.mp3') || nameLower.endsWith('.wav') || nameLower.endsWith('.ogg') || nameLower.endsWith('.m4a') || nameLower.endsWith('.flac');
      if (!isVideo && !isAudio) {
        return;
      }

      const url = URL.createObjectURL(file);
      const element = isAudio ? document.createElement('audio') : document.createElement('video');
      element.src = url;
      element.onloadedmetadata = () => {
        let duration = element.duration;
        if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
          duration = 10;
        }
        const formattedDuration = formatDuration(duration);
        const clipId = Math.random().toString();
        
        const newClip: Clip = {
          id: clipId,
          name: file.name,
          duration: formattedDuration,
          durationSeconds: duration,
          type: isAudio ? 'audio' : 'video',
          path: (file as any).path || file.name,
          size: formatSize(file.size),
          url: url
        };

        const updatedClips = [newClip, ...clips];
        setClips(updatedClips);

        // Automatically add video clips to Video v1 track and load into preview canvas
        if (isVideo) {
          setActiveVideoUrl(url);
          setIsPlaying(false);
          
          const lastClip = timelineClipsRef.current[timelineClipsRef.current.length - 1];
          const startSeconds = lastClip ? (lastClip.startSeconds + lastClip.durationSeconds + 2) : 0;
          const updated = [...timelineClipsRef.current, {
            id: `timeline-${Math.random()}`,
            name: file.name,
            startSeconds,
            durationSeconds: duration,
            type: 'video' as const,
            path: (file as any).path || file.name,
            url: url,
            category: 'original'
          }];
          setTimelineVideoClips(updated);
          pushMilestone('Video importado', {
            clips: updatedClips,
            timelineVideoClips: updated
          });
        }
      };
    });
  };

  const addClipToTimeline = (clip: Clip) => {
    const lastClip = timelineVideoClips[timelineVideoClips.length - 1];
    const startSeconds = lastClip ? (lastClip.startSeconds + lastClip.durationSeconds + 2) : 0;
    
    let cat = clip.category;
    if (!cat && libraryTab) {
      const tabLower = libraryTab.toLowerCase();
      if (tabLower === 'principal' || tabLower === 'originales') {
        cat = 'original';
      } else {
        cat = tabLower;
      }
    }

    const updated = [...timelineVideoClips, {
      id: `timeline-${Math.random()}`,
      name: clip.name,
      startSeconds,
      durationSeconds: clip.durationSeconds,
      type: clip.type,
      path: clip.path,
      url: clip.url,
      category: cat,
      thumbnailUrl: clip.thumbnailUrl
    }];
    setTimelineVideoClips(updated);
    pushHistory(updated);
  };

  const handleClipClick = (clip: Clip) => {
    if (clip.url) {
      setActiveVideoUrl(clip.url);
    } else {
      setActiveVideoUrl(null);
    }
    setIsPlaying(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };
  
  useEffect(() => {
    // Listen for the active message from Main Process using the Preload bridge API
    if (window.electronAPI && typeof window.electronAPI.onMainMessage === 'function') {
      const unsubscribe = window.electronAPI.onMainMessage((time: string) => {
        setMainProcessTime(time)
      })
      return () => unsubscribe()
    }
  }, [])

  if (activeProjectPath === null) {
    return (
      <div className="flex flex-col h-screen w-screen bg-[#020712] text-slate-100 overflow-hidden font-sans select-none relative">
        {/* Background glow effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6366f1]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#c084fc]/5 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Header */}
        <header className="flex justify-between items-center px-8 py-4 bg-slate-950/40 border-b border-slate-900/60 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-[#6366f1] to-[#c084fc] p-2 rounded-xl shadow-lg shadow-indigo-500/10">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent uppercase">
                CIPHER STUDIO
              </h1>
              <p className="text-[10px] text-[#6366f1]/80 font-medium">AI VIDEO EDITOR • v1.0.0</p>
            </div>
          </div>
          <button 
            onClick={handleOpenProject}
            className="text-xs font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-xl hover:bg-slate-900 border border-slate-800 transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
          >
            <FolderOpen className="h-4 w-4 text-[#6366f1]" />
            <span>Abrir desde Archivo</span>
          </button>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-10 flex flex-col space-y-8 overflow-hidden">
          {/* Hero Actions */}
          <div className="grid grid-cols-2 gap-6">
            <div 
              onClick={() => setShowNewProjectModal(true)}
              className="group bg-gradient-to-br from-slate-950 to-slate-900 hover:from-slate-900 hover:to-slate-950 border border-slate-850 hover:border-[#6366f1]/40 rounded-2xl p-8 flex flex-col justify-between items-start space-y-12 cursor-pointer shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-indigo-500/5"
            >
              <div className="bg-indigo-500/10 group-hover:bg-[#6366f1]/20 p-4 rounded-2xl transition-all duration-300">
                <Plus className="h-8 w-8 text-[#6366f1]" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white mb-2 tracking-tight group-hover:text-indigo-350 transition-colors">
                  Nuevo Proyecto
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                  Crea un nuevo proyecto en CIPHER Studio. Tus clips temporales y audios se guardarán de forma organizada.
                </p>
              </div>
            </div>

            <div 
              onClick={handleOpenProject}
              className="group bg-gradient-to-br from-slate-950 to-slate-900 hover:from-slate-900 hover:to-slate-950 border border-slate-850 hover:border-[#c084fc]/40 rounded-2xl p-8 flex flex-col justify-between items-start space-y-12 cursor-pointer shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-purple-500/5"
            >
              <div className="bg-purple-500/10 group-hover:bg-[#c084fc]/20 p-4 rounded-2xl transition-all duration-300">
                <FolderOpen className="h-8 w-8 text-[#c084fc]" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white mb-2 tracking-tight group-hover:text-purple-350 transition-colors">
                  Abrir Proyecto
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                  Busca un archivo <code className="font-mono text-[10px] text-purple-400">project-state.json</code> en tu sistema para reanudar tu edición anterior.
                </p>
              </div>
            </div>
          </div>

          {/* Recent Projects List */}
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-350 tracking-wider flex items-center space-x-2">
                <span className="w-1.5 h-3 bg-[#6366f1] rounded-full" />
                <span>PROYECTOS RECIENTES</span>
              </h3>
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={handleClearGlobalStockCache}
                  className="text-[10px] bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white px-2 py-1 rounded-md transition-all cursor-pointer active:scale-95 font-medium"
                  title="Borrar todos los videos descargados de Pexels en disco para liberar espacio"
                >
                  Limpiar Caché Stock
                </button>
                <button
                  onClick={handleDeleteAllProjects}
                  className="text-[10px] bg-red-950/20 hover:bg-red-900/20 border border-red-900/30 hover:border-red-900/60 text-red-400 px-2 py-1 rounded-md transition-all cursor-pointer active:scale-95 font-medium"
                  title="Eliminar de forma permanente todos los proyectos y sus archivos"
                >
                  Eliminar Todo
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2.5">
              {projectsList.length === 0 ? (
                <div className="h-48 border border-dashed border-slate-900 rounded-2xl flex flex-col items-center justify-center space-y-2 bg-slate-950/20">
                  <FolderOpen className="h-8 w-8 text-slate-600" />
                  <p className="text-xs text-slate-550 font-medium">Aún no tienes proyectos creados</p>
                </div>
              ) : (
                projectsList.map((project) => {
                  const formattedDate = new Date(project.date).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  return (
                    <div 
                      key={project.id}
                      onClick={() => handleLoadProject(project.projectPath)}
                      className="group bg-slate-950/60 hover:bg-slate-900 border border-slate-900 hover:border-slate-850 rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 animate-fade-in"
                    >
                      <div className="flex items-center space-x-4">
                        {/* Thumbnail or Placeholder */}
                        <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0 flex items-center justify-center border border-slate-850 relative group-hover:border-slate-800 transition-colors">
                          {project.thumbnailUrl ? (
                            <img src={project.thumbnailUrl} alt={project.name} className="w-full h-full object-cover" />
                          ) : (
                            <Video className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        
                        <div>
                          <h4 className="text-xs font-bold text-white group-hover:text-[#6366f1] transition-colors leading-tight">
                            {project.name}
                          </h4>
                          <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-medium mt-1">
                            <span className="font-mono">{formattedDate}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <span className="font-mono text-[#34d399]">{formatTimeMinutesSeconds(project.durationSeconds)}</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={(e) => handleDeleteProject(project.projectPath, e)}
                        className="p-2 hover:bg-red-500/10 hover:text-red-405 text-slate-500 rounded-lg cursor-pointer active:scale-95 transition-all"
                        title="Eliminar proyecto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>

        {/* New Project Modal */}
        {showNewProjectModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#020712] border border-slate-850 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-[#6366f1] animate-pulse" />
                <span>Crear Nuevo Proyecto</span>
              </h3>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider">Nombre del Proyecto</label>
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Mi impresionante video..."
                  className="w-full bg-slate-950 border border-slate-850 focus:border-[#6366f1]/50 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 outline-none transition-all font-sans"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateProject(newProjectName || 'Nuevo Proyecto');
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button 
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjectName('');
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-white px-4 py-2 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleCreateProject(newProjectName || 'Nuevo Proyecto')}
                  className="bg-indigo-650 hover:bg-[#6366f1] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-95"
                >
                  Crear Proyecto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const firstVideoInLibrary = clips.find(c => c.type === 'video' || c.type === 'audio') || clips[0];

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="video/*,audio/*" 
        multiple
        className="hidden" 
      />
      {/* Title Bar / Header */}
      <header className="flex justify-between items-center px-4 py-2 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-tr from-indigo-500 to-violet-500 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                CIPHER STUDIO
              </h1>
              <p className="text-[10px] text-indigo-400/80 font-medium">AI VIDEO EDITOR • v1.0.0</p>
            </div>
          </div>

          {/* Close Project / Back to Dashboard Button */}
          <button 
            onClick={handleCloseProject}
            className="text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 text-slate-300 font-bold px-2 py-1 rounded-md border border-slate-700/50 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
            title="Volver al inicio (Cierra y guarda el proyecto actual)"
          >
            <span>&larr; Proyectos</span>
          </button>

          {activeProjectName && (
            <div className="flex items-center space-x-2.5 px-3 border-l border-slate-800/80">
              <span className="text-xs font-bold text-slate-350 select-none tracking-wide">
                {activeProjectName}
              </span>
              <button
                onClick={handleSaveProjectDirectly}
                disabled={!isDirty && saveStatus === 'idle'}
                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all active:scale-95 flex items-center space-x-1 ${
                  isDirty
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-lg shadow-indigo-600/20'
                    : saveStatus === 'saving'
                    ? 'bg-amber-600 text-white cursor-wait'
                    : saveStatus === 'saved'
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750/30'
                }`}
                title={
                  isDirty
                    ? 'Guardar cambios pendientes'
                    : saveStatus === 'saving'
                    ? 'Guardando...'
                    : saveStatus === 'saved'
                    ? '¡Guardado!'
                    : 'Sin cambios pendientes'
                }
              >
                <Save className="h-3 w-3" />
                <span>
                  {saveStatus === 'saving'
                    ? 'Guardando...'
                    : saveStatus === 'saved'
                    ? '¡Guardado!'
                    : 'Guardar'}
                </span>
              </button>
            </div>
          )}

          {/* Selector de Versiones del Timeline */}
          {timelineVersions.length > 0 && (
            <div className="flex items-center space-x-2 bg-slate-950/40 px-2.5 py-1 rounded-lg border border-slate-800/80 text-xs">
              <span className="text-[10px] text-slate-500 font-bold select-none uppercase tracking-wider">Versión:</span>
              <div className="relative flex items-center">
                <select
                  value={activeVersionId}
                  onChange={(e) => handleSelectTimelineVersion(e.target.value)}
                  className="bg-transparent text-slate-200 font-bold pr-6 outline-none appearance-none cursor-pointer hover:text-indigo-400 text-[11px] font-sans"
                >
                  {timelineVersions.map(v => (
                    <option key={v.id} value={v.id} className="bg-slate-950 text-slate-200 font-sans text-xs">
                      {v.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500 absolute right-0 pointer-events-none" />
              </div>
            </div>
          )}

          {/* File Dropdown Menu */}
          <div className="relative">
            <button 
              onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
              className="text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded-md hover:bg-slate-800/80 border border-transparent hover:border-slate-800 transition-all flex items-center space-x-1"
            >
              <span>Archivo</span>
              <span className="text-[8px] text-slate-500">▼</span>
            </button>
            
            {isFileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFileMenuOpen(false)} />
                <div className="absolute left-0 mt-1 w-40 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col space-y-0.5 backdrop-blur-md">
                  <button 
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      handleNewProject();
                    }}
                    className="w-full text-left text-[11px] text-slate-300 hover:text-white hover:bg-indigo-600 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Nuevo Proyecto
                  </button>
                  <button 
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      handleOpenProject();
                    }}
                    className="w-full text-left text-[11px] text-slate-300 hover:text-white hover:bg-indigo-600 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Abrir proyecto
                  </button>
                  <button 
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      handleSaveProjectDirectly();
                    }}
                    className="w-full text-left text-[11px] text-slate-300 hover:text-white hover:bg-indigo-600 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Guardar
                  </button>
                  <button 
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      handleSaveProjectAs();
                    }}
                    className="w-full text-left text-[11px] text-slate-300 hover:text-white hover:bg-indigo-600 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Guardar como
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800 text-[11px]">
            <Cpu className="h-3 w-3 text-indigo-400" />
            <span className="text-slate-400">IPC Bridge:</span>
            <span className="text-emerald-400 font-mono">{mainProcessTime}</span>
          </div>

          {/* Auto-save Status Indicator */}
          <div className="flex items-center space-x-1.5 bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-slate-800/50 text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${
              saveStatus === 'saved' 
                ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' 
                : saveStatus === 'saving'
                ? 'bg-sky-500 animate-pulse shadow-[0_0_6px_#0ea5e9]'
                : saveStatus === 'error'
                ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                : 'bg-emerald-500/60'
            }`} />
            <span className="text-slate-400 font-medium font-sans">
              {saveStatus === 'saving' 
                ? 'Guardando...' 
                : saveStatus === 'error' 
                ? 'Error al guardar' 
                : 'Guardado'}
            </span>
          </div>
 
          <button 
            onClick={handleTranscribeClick}
            className="flex items-center space-x-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-500/30 shadow-lg shadow-indigo-600/5 active:scale-95 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>Transcribir con IA</span>
          </button>
 
          <button 
            onClick={() => setShowExportModal(true)}
            disabled={isExporting}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? 'Exportando...' : 'Exportar'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Workspace layout */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Side: Project Media & Library */}
        <section 
          style={{ width: `${libraryWidth}px` }} 
          className="bg-slate-900/50 border-r border-slate-800/80 flex flex-col flex-shrink-0"
        >
          <div className="p-3 border-b border-slate-800/80 flex justify-between items-center">
            <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Biblioteca</h2>
            <button 
              onClick={handleUploadClick}
              className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>

          {/* Library Tabs */}
          <div className="flex border-b border-slate-800/80 bg-slate-900/40 p-1 overflow-x-auto scrollbar-none space-x-1 flex-shrink-0">
            {['Principal', 'Originales', 'Stock', 'MiniMax'].map(tab => (
              <button
                key={tab}
                onClick={() => setLibraryTab(tab)}
                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  libraryTab === tab 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-205 hover:bg-slate-800/50'
                }`}
              >
                {tab}
              </button>
            ))}
            {/* Veo 3 tab - disabled, red dot, Próximamente */}
            <button
              disabled
              className="text-[10px] font-bold px-2 py-1 rounded-md text-slate-500/70 flex items-center space-x-1 cursor-not-allowed whitespace-nowrap opacity-60 bg-transparent border-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span>Veo 3 (Próximamente)</span>
            </button>
          </div>

          {/* Mix del montaje Section */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/20 space-y-3 flex-shrink-0">
            <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <Sliders className="h-3.5 w-3.5 text-indigo-400" />
              <span>Mix del montaje</span>
            </div>

            <div className="space-y-2.5">
              {/* Slider 1: Original */}
              <div className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-slate-400 w-16 select-none">Original</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={timelineWeights[0]}
                  onChange={(e) => handleWeightChange(0, parseInt(e.target.value))}
                  className="flex-1 h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-emerald-500 transition-all outline-none" 
                  style={{
                    background: `linear-gradient(to right, rgb(16, 185, 129) ${timelineWeights[0]}%, rgb(30, 41, 59) 0%)`
                  }}
                />
                <span className="font-mono text-[10px] text-emerald-400 font-bold w-8 text-right select-none">{timelineWeights[0]}%</span>
              </div>

              {/* Slider 2: Stock */}
              <div className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-slate-400 w-16 select-none">Stock</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={timelineWeights[1]}
                  onChange={(e) => handleWeightChange(1, parseInt(e.target.value))}
                  className="flex-1 h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-sky-500 transition-all outline-none" 
                  style={{
                    background: `linear-gradient(to right, rgb(14, 165, 233) ${timelineWeights[1]}%, rgb(30, 41, 59) 0%)`
                  }}
                />
                <span className="font-mono text-[10px] text-sky-400 font-bold w-8 text-right select-none">{timelineWeights[1]}%</span>
              </div>

              {/* Slider 3: MiniMax */}
              <div className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-slate-400 w-16 select-none">MiniMax</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={timelineWeights[2]}
                  onChange={(e) => handleWeightChange(2, parseInt(e.target.value))}
                  className="flex-1 h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-amber-500 transition-all outline-none"
                  style={{
                    background: `linear-gradient(to right, rgb(245, 158, 11) ${timelineWeights[2]}%, rgb(30, 41, 59) 0%)`
                  }}
                />
                <span className="font-mono text-[10px] text-amber-400 font-bold w-8 text-right select-none">{timelineWeights[2]}%</span>
              </div>
            </div>

            {/* Proportional Color Bar */}
            <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-slate-800 mt-2">
              <div style={{ width: `${timelineWeights[0]}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Original: ${timelineWeights[0]}%`} />
              <div style={{ width: `${timelineWeights[1]}%` }} className="h-full bg-sky-500 transition-all duration-300" title={`Stock: ${timelineWeights[1]}%`} />
              <div style={{ width: `${timelineWeights[2]}%` }} className="h-full bg-amber-500 transition-all duration-300" title={`MiniMax: ${timelineWeights[2]}%`} />
            </div>

            {/* Selector de Estilo IA */}
            <div className="mt-3 flex items-center justify-between space-x-2">
              <span className="text-[10px] font-semibold text-slate-400 select-none">Estilo de Video IA</span>
              <select
                value={iaStyle}
                onChange={(e) => setIaStyle(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-indigo-500 transition-all font-medium"
              >
                <option value="normal">Cinemático (Normal)</option>
                <option value="cartoon">Cartoon 3D / Animación</option>
                <option value="bw">Blanco y Negro (Noir)</option>
              </select>
            </div>

            {/* Botón Construir Timeline IA */}
            {isGeneratingAssets ? (
              <div className="w-full mt-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 select-none">
                <div className="flex items-center space-x-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <span className="text-[10px] font-semibold text-indigo-300">Generando clips...</span>
                </div>
                {generationProgress && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                      <span>{generationProgress.current}/{generationProgress.total}</span>
                      <span className="uppercase text-[7px] bg-slate-850 px-1 py-0.5 rounded text-indigo-400 font-bold">{generationProgress.type}</span>
                    </div>
                    <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button 
                  onClick={handleBuildIATimeline}
                  disabled={!aiScript.trim()}
                  className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-violet-650 hover:from-indigo-500 hover:to-violet-550 text-white text-xs py-2 px-3 rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-indigo-600/10 cursor-pointer flex items-center justify-center space-x-2 border border-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-250 animate-pulse" />
                  <span>Construir Timeline IA</span>
                </button>
                {/* ----- Selector de Porcentaje de Gráficos ----- */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Porcentaje de Gráficos
                  </label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                    {[0, 50, 100].map((val) => {
                      const active = graphicsPercent === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setGraphicsPercent(val)}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                            active
                              ? 'bg-indigo-650 text-white shadow-md shadow-indigo-500/20'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                          }`}
                        >
                          {val}%
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* ----- Botón Regenerar Gráficos ----- */}
                <button
                  className={`mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={
                    (!aiScript?.trim() && !originalTranscriptText?.trim()) ||
                    timelineVideoClips.filter(c => c.type !== 'audio' && c.type !== 'graphic').length === 0 ||
                    isGeneratingAssets
                  }
                  onClick={handleRegenerateGraphics}
                >
                  {isGeneratingAssets ? 'Generando...' : 'Regenerar Gráficos'}
                </button>
              </>
            )}
            {generationError && (
              <div className="w-full mt-2 p-2 bg-red-950/20 border border-red-900/50 rounded-xl text-[9px] text-red-400 font-medium text-center select-text leading-relaxed">
                Error: {generationError}
              </div>
            )}
          </div>

          {/* Media Items List */}
          <div 
            className="flex-1 overflow-y-auto p-3 space-y-3"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {libraryTab === 'Principal' && (
              <div 
                onClick={handleUploadClick}
                className={`border border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center space-y-2 group cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-500/10 scale-[0.98]' 
                    : 'border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5'
                }`}
              >
                <FolderOpen className={`h-8 w-8 transition-colors ${isDragging ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                <p className="text-xs text-slate-400 font-medium">Arrastra clips de video o haz clic aquí</p>
                <p className="text-[10px] text-slate-600">MP4, MOV, WAV, MP3</p>
              </div>
            )}

            {/* Clips List */}
            {(() => {
              if (libraryTab === 'MiniMax') {
                const currentClips = bankClips.minimax || [];
                return (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-3 select-none mb-3">
                      <div className="flex items-center space-x-1.5 text-amber-500">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider">MiniMax Video Hub</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Genera videos fotorrealistas por IA de 6 segundos en resolución 1080p usando MiniMax.
                      </p>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Prompt del Video</label>
                        <textarea
                          value={minimaxPrompt}
                          onChange={(e) => setMinimaxPrompt(e.target.value)}
                          placeholder="Describe la escena a generar..."
                          className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500/50 rounded-lg p-2 text-xs text-white placeholder-slate-650 outline-none transition-all resize-none h-18 font-sans"
                        />
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={handleGenerateMinimaxVideo}
                          disabled={isGeneratingMinimax || !minimaxPrompt.trim()}
                          className="flex-1 bg-gradient-to-r from-amber-600 to-orange-650 hover:from-amber-500 hover:to-orange-550 text-white text-[11px] py-1.5 px-2.5 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
                        >
                          {isGeneratingMinimax ? (
                            <>
                              <div className="w-3 h-3 rounded-full border border-white/20 border-t-white animate-spin mr-1" />
                              <span>Generando...</span>
                            </>
                          ) : (
                            <>
                              <Video className="h-3 w-3" />
                              <span>Generar Video</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleOptimizePromptWithDeepSeek}
                          disabled={isOptimizingPrompt || !minimaxPrompt.trim()}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] py-1.5 px-2.5 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
                          title="Optimizar prompt con DeepSeek"
                        >
                          {isOptimizingPrompt ? (
                            <div className="w-3 h-3 rounded-full border border-white/20 border-t-white animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 text-amber-400" />
                          )}
                        </button>
                      </div>

                      {minimaxError && (
                        <div className="text-[9px] text-red-400 font-medium bg-red-950/20 border border-red-900/40 p-2 rounded-lg leading-relaxed select-text">
                          Error: {minimaxError}
                        </div>
                      )}
                    </div>

                    {currentClips.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs italic">
                        No hay videos de MiniMax generados aún.
                      </div>
                    ) : (
                      currentClips.map(clip => (
                        <div 
                          key={clip.id}
                          onClick={() => handleClipClick(clip)}
                          className={`border rounded-xl overflow-hidden p-2 flex space-x-3 transition-all cursor-pointer relative group/clip ${
                            activeVideoUrl === clip.url && clip.url
                              ? 'bg-indigo-950/30 border-indigo-500/55'
                              : 'bg-slate-900 border-slate-800/60 hover:border-slate-700'
                          }`}
                        >
                          <div className="w-20 h-14 bg-indigo-950/80 rounded-lg flex items-center justify-center relative overflow-hidden group flex-shrink-0">
                            {clip.thumbnailUrl ? (
                              <img src={clip.thumbnailUrl} className="w-full h-full object-cover" alt="miniatura" />
                            ) : (
                              <Video className="h-5 w-5 text-indigo-400" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="h-4 w-4 text-white fill-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div className="pr-12">
                              <h4 className="text-xs font-semibold truncate" title={clip.name}>{clip.name}</h4>
                              <p className="text-[10px] text-slate-500 truncate" title={clip.path}>{clip.size || 'N/A'} • Video</p>
                            </div>
                            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 self-start px-1.5 py-0.5 rounded-md">{clip.duration}</span>
                          </div>
                          <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover/clip:opacity-100 transition-opacity z-20">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                addClipToTimeline(clip);
                              }}
                              className="p-1 bg-indigo-600 border border-indigo-500 hover:bg-indigo-500 rounded-md text-white shadow-sm"
                              title="Añadir al Timeline"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const res = await window.electronAPI.deleteBankClip({
                                    category: 'minimax',
                                    file: clip.name
                                  });
                                  if (res && res.success) {
                                    await loadClipsForCategory('minimax');
                                    setTimelineVideoClips(prev => prev.filter(t => t.name !== `${clip.name} (minimax)`));
                                  }
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="p-1 bg-red-650 hover:bg-red-500 rounded-md text-white border-none cursor-pointer"
                              title="Eliminar de biblioteca"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              }

              const currentClips = libraryTab === 'Principal' 
                ? clips 
                : (bankClips[libraryTab.toLowerCase()] || []);

              if (libraryTab === 'Stock' && currentClips.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-500 space-y-2.5 bg-slate-900/10 rounded-xl p-6 border border-dashed border-slate-800/40 select-none">
                    <FolderOpen className="h-8 w-8 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-400">Sin clips de stock aún</span>
                    <span className="text-[10px] text-slate-500 text-center max-w-[220px]">
                      Ajusta el slider de Stock en el panel de Timeline IA para buscar y descargar B-roll automáticamente de Pexels.
                    </span>
                  </div>
                );
              }
              
              if (currentClips.length === 0) {
                return (
                  <div className="text-center py-10 text-slate-500 text-xs italic">
                    No hay clips en esta carpeta.
                  </div>
                );
              }

              return currentClips.map(clip => (
                <div 
                  key={clip.id}
                  onClick={() => handleClipClick(clip)}
                  className={`border rounded-xl overflow-hidden p-2 flex space-x-3 transition-all cursor-pointer relative group/clip ${
                    activeVideoUrl === clip.url && clip.url
                      ? 'bg-indigo-950/30 border-indigo-500/55'
                      : 'bg-slate-900 border-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="w-20 h-14 bg-indigo-950/80 rounded-lg flex items-center justify-center relative overflow-hidden group flex-shrink-0">
                    {clip.thumbnailUrl ? (
                      <img src={clip.thumbnailUrl} className="w-full h-full object-cover" alt="miniatura" />
                    ) : (
                      <Video className="h-5 w-5 text-indigo-400" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-4 w-4 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="pr-12">
                      <h4 className="text-xs font-semibold truncate" title={clip.name}>{clip.name}</h4>
                      <p className="text-[10px] text-slate-500 truncate" title={clip.path}>{clip.size || 'N/A'} • {clip.type === 'video' ? 'Video' : 'Audio'}</p>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 self-start px-1.5 py-0.5 rounded-md">{clip.duration}</span>
                  </div>
                  <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover/clip:opacity-100 transition-opacity z-20">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        addClipToTimeline(clip);
                      }}
                      className="p-1 bg-indigo-600 border border-indigo-500 hover:bg-indigo-500 rounded-md text-white shadow-sm"
                      title="Añadir al Timeline"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    {!(libraryTab === 'Principal' && clips.find(c => c.type === 'video')?.id === clip.id) && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (libraryTab === 'Principal') {
                            setClips(prev => prev.filter(c => c.id !== clip.id));
                            setTimelineVideoClips(prev => prev.filter(t => t.name !== clip.name));
                          } else {
                            try {
                              const cat = libraryTab.toLowerCase();
                              const res = await window.electronAPI.deleteBankClip({
                                category: cat,
                                file: clip.name
                              });
                              if (res && res.success) {
                                await loadClipsForCategory(cat);
                                setTimelineVideoClips(prev => prev.filter(t => t.name !== `${clip.name} (${cat})`));
                              } else {
                                console.error('Error al eliminar clip:', res?.error);
                              }
                            } catch (err) {
                              console.error('Excepción al eliminar clip:', err);
                            }
                          }
                        }}
                        className="p-1 bg-slate-950/85 border border-slate-800 hover:border-red-500/50 hover:text-red-400 rounded-md text-slate-400 cursor-pointer"
                        title="Eliminar de la biblioteca"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </section>

        {/* Resizer 1: Library Resizer */}
        <div
          onMouseDown={handleLibraryResizeMouseDown}
          className="w-1 bg-slate-950 hover:bg-indigo-500/85 active:bg-indigo-650 transition-colors cursor-col-resize flex-shrink-0 z-40 relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
        </div>

        {/* Center: Canvas Player */}
        <section className="flex-1 bg-slate-950 flex flex-col p-4 overflow-hidden">
          <div 
            ref={playerWrapperRef}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl relative overflow-hidden flex items-center justify-center group shadow-inner"
          >
            {/* Player Canvas Mockup / Real Player */}
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/20" />
            
            {activeVideoUrl ? (
              <div 
                onWheel={handlePreviewWheel}
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={handlePreviewMouseUpOrLeave}
                onMouseLeave={handlePreviewMouseUpOrLeave}
                className={`relative z-10 bg-black shadow-2xl transition-all duration-300 flex items-center justify-center overflow-hidden border border-slate-800 ${
                  aspectRatio === 'vertical' 
                    ? 'h-[95%] aspect-[9/16]' 
                    : aspectRatio === 'square' 
                    ? 'h-[95%] aspect-square' 
                    : 'w-[95%] aspect-video'
                }`}
              >
                <video 
                  id="preview-video"
                  ref={videoRef}
                  src={activeVideoUrl || ''}
                  style={{
                    display: activeVideoUrl ? 'block' : 'none',
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) ${isMirrored ? 'scaleX(-1)' : 'scaleX(1)'}`,
                    clipPath: activeCrop 
                      ? `inset(${activeCrop.top}% ${activeCrop.right}% ${activeCrop.bottom}% ${activeCrop.left}%)` 
                      : 'none',
                  }}
                  className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-75 ease-out"
                  controls={false}
                  onLoadedMetadata={handleLoadedMetadata}
                  onCanPlay={handleVideoCanPlay}
                  onDurationChange={handleDurationChange}
                  onEnded={handleEnded}
                  onTimeUpdate={handleTimeUpdate}
                />

                {/* Crop Editor Overlay */}
                {isCropping && (
                   <div className="absolute inset-0 z-30 select-none cursor-crosshair">
                     {/* Dark surrounding panels */}
                     <div 
                       className="absolute left-0 right-0 top-0 bg-black/70 border-b border-white/10" 
                       style={{ height: `${cropRect.top}%` }}
                     />
                     <div 
                       className="absolute left-0 right-0 bottom-0 bg-black/70 border-t border-white/10" 
                       style={{ height: `${cropRect.bottom}%` }}
                     />
                     <div 
                       className="absolute left-0 bg-black/70 border-r border-white/10" 
                       style={{ 
                         top: `${cropRect.top}%`, 
                         bottom: `${cropRect.bottom}%`, 
                         width: `${cropRect.left}%` 
                       }}
                     />
                     <div 
                       className="absolute right-0 bg-black/70 border-l border-white/10" 
                       style={{ 
                         top: `${cropRect.top}%`, 
                         bottom: `${cropRect.bottom}%`, 
                         width: `${cropRect.right}%` 
                       }}
                     />

                     {/* Draggable Crop Box Area */}
                     <div 
                       className="absolute border-2 border-indigo-500 border-dashed"
                       style={{
                         left: `${cropRect.left}%`,
                         right: `${cropRect.right}%`,
                         top: `${cropRect.top}%`,
                         bottom: `${cropRect.bottom}%`
                       }}
                     >
                       {/* Interactive Crop Handles */}
                       <div 
                         onMouseDown={(e) => handleCropResizeMouseDown(e, 'top-left')}
                         className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full cursor-nwse-resize shadow"
                       />
                       <div 
                         onMouseDown={(e) => handleCropResizeMouseDown(e, 'top-right')}
                         className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full cursor-nesw-resize shadow"
                       />
                       <div 
                         onMouseDown={(e) => handleCropResizeMouseDown(e, 'bottom-left')}
                         className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full cursor-nesw-resize shadow"
                       />
                       <div 
                         onMouseDown={(e) => handleCropResizeMouseDown(e, 'bottom-right')}
                         className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full cursor-nwse-resize shadow"
                       />

                       {/* Confirm/Cancel */}
                       <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center space-x-2 z-45">
                         <button 
                           onClick={handleConfirmCrop}
                           className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors active:scale-95 cursor-pointer"
                         >
                           Aplicar
                         </button>
                         <button 
                           onClick={handleCancelCrop}
                           className="bg-slate-800 hover:bg-slate-700 text-slate-355 text-[10px] font-bold px-2 py-1 rounded transition-colors active:scale-95 cursor-pointer"
                         >
                           Cancelar
                         </button>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Overlay de Gráficos Animados (Fase 3) */}
                 {graphicVisible && activeGraphicClip && activeGraphicClip.graphicData && (
                   <div 
                     key={activeGraphicClip.id}
                     className={`absolute inset-0 z-20 flex items-end justify-center pb-[20%] transition-opacity duration-300 select-none pointer-events-none ${
                       graphicFading ? 'opacity-0' : 'opacity-100'
                     }`}
                   >
                     <AnimatedGraphic graphic={activeGraphicClip.graphicData} />
                   </div>
                 )}
              </div>
            ) : (
              /* Beautiful visualizer block inside player */
              <div className="relative text-center z-10 space-y-4">
                <div className="w-24 h-24 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Video className="h-8 w-8 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wider text-indigo-300">PREVISUALIZACIÓN DE CANVAS</p>
                  <p className="text-xs text-slate-400">Listo para reproducir contenido del proyecto</p>
                </div>
              </div>
            )}

            {/* Overlay controller */}
            <div className="absolute bottom-4 right-4 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-350 flex items-center space-x-2 z-20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{activeVideoUrl ? 'Reproductor Activo' : 'Full Res (1080p)'}</span>
            </div>
          </div>

          {/* Player controls */}
          <div className="flex flex-col mt-4 p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-3">
            {/* Scrubber row */}
            <div className="w-full flex items-center space-x-3 px-1">
              <span 
                id="cipher-time-text"
                className="text-[10px] font-mono text-slate-400 select-none w-10 text-right"
              >
                {formatTimeMinutesSeconds(currentTimeForUI)}
              </span>
              <div 
                onMouseDown={handleScrubberMouseDown}
                className="flex-1 h-2 bg-slate-800 rounded-full relative cursor-pointer group/scrub"
              >
                <div 
                  id="cipher-scrub-fill"
                  style={{ width: `${durationSeconds > 0 ? (currentTimeForUI / durationSeconds) * 100 : 0}%` }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full absolute top-0 left-0"
                />
                <div 
                  id="cipher-scrub-thumb"
                  style={{ left: `${durationSeconds > 0 ? (currentTimeForUI / durationSeconds) * 100 : 0}%` }}
                  className="w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full absolute top-1/2 -translate-y-1/2 -ml-1.5 opacity-0 group-hover/scrub:opacity-100 transition-opacity shadow-md"
                />
              </div>
              <span className="text-[10px] font-mono text-slate-400 select-none w-10 text-left">
                {formatTimeMinutesSeconds(durationSeconds)}
              </span>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between">
              {/* Playback Controls */}
              <div className="flex items-center space-x-3">
                <button 
                  onClick={seekBackward}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all active:scale-90"
                  title="Retroceder 10s"
                >
                  <Rewind className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all active:scale-95 shadow-md shadow-indigo-600/30"
                  title={isPlaying ? "Pausar" : "Reproducir"}
                >
                  {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
                </button>
                <button 
                  onClick={seekForward}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all active:scale-90"
                  title="Adelantar 10s"
                >
                  <FastForward className="h-4 w-4" />
                </button>
              </div>

              {/* Timecode */}
              <div 
                id="cipher-timecode"
                className="text-base font-mono tracking-wider font-semibold text-slate-100 bg-slate-950/40 px-3 py-1 rounded-lg border border-slate-800/60"
              >
                {currentTime}
              </div>

              {/* Extras Controls (Volume, Speed, Aspect, Fullscreen) */}
              <div className="flex items-center space-x-3.5">
                {/* Volume Slider */}
                <div className="flex items-center space-x-2 group/volume relative">
                  <button 
                    onClick={toggleMute}
                    className="p-1.5 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-slate-700 hover:bg-slate-650 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none"
                    style={{
                      background: `linear-gradient(to right, rgb(99, 102, 241) ${Math.round((isMuted ? 0 : volume) * 100)}%, rgb(51, 65, 85) 0%)`
                    }}
                  />
                </div>

                {/* Speed Dropdown */}
                <div className="flex items-center">
                  <select 
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-lg p-1.5 text-slate-300 font-semibold cursor-pointer outline-none hover:border-indigo-500/50 transition-colors"
                  >
                    <option value="0.5">0.5x</option>
                    <option value="1">1.0x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2.0x</option>
                  </select>
                </div>

                {/* Fullscreen / Aspect Ratio Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                    className={`p-1.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                      showFormatDropdown ? 'bg-indigo-600/25 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                    title="Formato y Pantalla Completa"
                  >
                    <Maximize className="h-4 w-4" />
                    <span className="text-[10px] font-mono font-semibold opacity-75">
                      {aspectRatio === 'vertical' ? '9:16' : aspectRatio === 'square' ? '1:1' : '16:9'}
                    </span>
                  </button>
                  
                  {showFormatDropdown && (
                    <>
                      {/* Invisible backdrop to close dropdown */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowFormatDropdown(false)}
                      />
                      <div className="absolute right-0 bottom-full mb-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="px-2.5 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider select-none">
                          Formato de Preview
                        </div>
                        <button
                          onClick={() => {
                            setAspectRatio('horizontal');
                            setShowFormatDropdown(false);
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors text-left ${
                            aspectRatio === 'horizontal' 
                              ? 'bg-indigo-600 text-white' 
                              : 'text-slate-350 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span>16:9 Horizontal</span>
                          <span className="text-[9px] opacity-70">Largo</span>
                        </button>
                        <button
                          onClick={() => {
                            setAspectRatio('vertical');
                            setShowFormatDropdown(false);
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors text-left ${
                            aspectRatio === 'vertical' 
                              ? 'bg-indigo-600 text-white' 
                              : 'text-slate-350 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span>9:16 Vertical</span>
                          <span className="text-[9px] opacity-70">Shorts / Reels</span>
                        </button>
                        <button
                          onClick={() => {
                            setAspectRatio('square');
                            setShowFormatDropdown(false);
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors text-left ${
                            aspectRatio === 'square' 
                              ? 'bg-indigo-600 text-white' 
                              : 'text-slate-350 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span>1:1 Cuadrado</span>
                          <span className="text-[9px] opacity-70">Post / Feed</span>
                        </button>
                        
                        <div className="border-t border-slate-800 my-1" />
                        
                        <button
                          onClick={() => {
                            toggleFullscreen();
                            setShowFormatDropdown(false);
                          }}
                          className="flex items-center space-x-2 px-2.5 py-1.5 text-xs rounded-lg font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                        >
                          <Maximize className="h-3.5 w-3.5 text-slate-400" />
                          <span>Pantalla Completa</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Resizer 2: Tools Resizer */}
        <div
          onMouseDown={handleToolsResizeMouseDown}
          className="w-1 bg-slate-950 hover:bg-indigo-500/85 active:bg-indigo-650 transition-colors cursor-col-resize flex-shrink-0 z-40 relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
        </div>

        {/* Right Side: AI Tools Panel */}
        <section 
          style={{ width: `${toolsWidth}px` }} 
          className="bg-slate-900/50 border-l border-slate-800/80 flex flex-col h-full overflow-hidden flex-shrink-0"
        >
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
              <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Caja de Herramientas IA</h2>
            </div>
            {selectedTool && (
              <button 
                onClick={() => setSelectedTool(null)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 active:scale-95"
              >
                &larr; Volver
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedTool ? (
              // List of Tool Cards
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Smart Cut Tool */}
                <div 
                  onClick={() => setSelectedTool('smart-cut')}
                  className="p-3 rounded-xl border bg-slate-900 border-slate-800/60 hover:border-slate-700 transition-all cursor-pointer flex flex-col space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Scissors className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-bold">Auto Smart-Cut</span>
                    </div>
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold uppercase font-sans">Listo</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Corta silencios y pausas automáticamente usando transcripción acústica en milisegundos.</p>
                </div>

                {/* Transcript/Subtitles Tool */}
                <div 
                  onClick={() => setSelectedTool('subtitles')}
                  className="p-3 rounded-xl border bg-slate-900 border-slate-800/60 hover:border-slate-700 transition-all cursor-pointer flex flex-col space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Type className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-bold">Transcripción de Voz</span>
                    </div>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-semibold uppercase font-sans">Whisper</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Genera subtítulos editables y marcas de tiempo precisas para todo el audio detectado.</p>
                </div>

                {/* Style Transfer */}
                <div 
                  onClick={() => setSelectedTool('translate')}
                  className="p-3 rounded-xl border bg-slate-900 border-slate-800/60 hover:border-slate-700 transition-all cursor-pointer flex flex-col space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Languages className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-bold">Traductor / Doblaje IA</span>
                    </div>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-semibold uppercase font-sans">Traducción</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Traduce diálogos a múltiples idiomas manteniendo la clonación de la voz original.</p>
                </div>

                {/* Voice Generation Tool */}
                <div 
                  onClick={() => setSelectedTool('voice')}
                  className="p-3 rounded-xl border bg-slate-900 border-slate-800/60 hover:border-slate-700 transition-all cursor-pointer flex flex-col space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Volume2 className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-bold">Generación de Voz</span>
                    </div>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-semibold uppercase font-sans">Voz IA</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Genera una pista de voz en off profesional a partir de tu guion reescrito usando clonación de voz.</p>
                </div>

                {/* Timeline IA Tool */}
                <div 
                  onClick={() => setSelectedTool('timeline-ia')}
                  className="p-3 rounded-xl border bg-slate-900 border-slate-800/60 hover:border-slate-700 transition-all cursor-pointer flex flex-col space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-bold">Timeline IA / Montaje</span>
                    </div>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-semibold uppercase font-sans">Montaje</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Distribuye y organiza de forma inteligente tus clips en la línea de tiempo basado en la reescritura del guión.</p>
                </div>
              </div>
             ) : (
              // Detailed Workspace for the Selected Tool (takes full height!)
              <div className="flex-1 flex flex-col overflow-hidden p-4">
                {selectedTool === 'subtitles' && (() => {
                   const firstVideoInLibrary = clips.find(c => c.type === 'video' || c.type === 'audio') || clips[0];
                   return (
                     <div className="flex-1 flex flex-col overflow-hidden">
                       <div className="flex items-center justify-between mb-3 border-b border-slate-850 pb-2">
                         <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Transcripción Whisper</h3>
                         <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold uppercase font-sans">Whisper AI</span>
                       </div>
                       
                       {!firstVideoInLibrary ? (
                         <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl space-y-3 bg-slate-950/20">
                           <Type className="h-8 w-8 text-slate-650" />
                           <div>
                             <p className="text-xs font-semibold text-slate-300">No hay videos importados</p>
                             <p className="text-[10px] text-slate-500 mt-1">Por favor, importa al menos un video a la biblioteca para comenzar.</p>
                           </div>
                           <button 
                             onClick={handleUploadClick}
                             className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold active:scale-95 transition-all shadow-md shadow-indigo-600/25 cursor-pointer flex items-center space-x-1"
                           >
                             <Upload className="h-3.5 w-3.5" />
                             <span>Importar Video</span>
                           </button>
                         </div>
                       ) : isTranscribing ? (
                         <div className="flex-1 flex flex-col overflow-hidden p-2 bg-slate-950/20 rounded-xl border border-slate-900 space-y-4">
                           <div className="flex flex-col items-center justify-center text-center p-4 space-y-3 bg-slate-900/30 rounded-lg">
                             <div className="w-8 h-8 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin flex items-center justify-center shadow-lg shadow-indigo-500/20" />
                             <div className="space-y-1">
                               <p className="text-xs font-semibold text-indigo-300">Ejecutando Whisper local...</p>
                               <p className="text-[9px] text-slate-500 truncate max-w-[220px] font-mono" title={firstVideoInLibrary.name}>
                                 {firstVideoInLibrary.name}
                               </p>
                             </div>
                           </div>
                           <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60 rounded-lg p-3 border border-slate-900/80 font-mono text-[10px]">
                             <span className="text-[9px] text-slate-500 font-bold uppercase mb-1.5 block tracking-wider">Log de progreso Whisper:</span>
                             <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin text-indigo-400 select-text leading-relaxed whitespace-pre-wrap break-all">
                               {transcriptionStatus || 'Iniciando proceso...'}
                             </div>
                           </div>
                         </div>
                       ) : (originalTranscriptText || transcriptSegments.length > 0) ? (
                          <div className="flex-1 flex flex-col overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                            {/* Transcripción Original Panel */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col space-y-2 shadow-xl">
                              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800/80">
                                <div className="flex items-center space-x-1.5">
                                  <Type className="h-3.5 w-3.5 text-indigo-400" />
                                  <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase">Transcripción Original</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(originalTranscriptText);
                                    }}
                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
                                    title="Copiar"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const text = await navigator.clipboard.readText();
                                        setOriginalTranscriptText(prev => prev + text);
                                      } catch (e) {}
                                    }}
                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-205 rounded transition-colors cursor-pointer"
                                    title="Pegar"
                                  >
                                    <Clipboard className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => setOriginalTranscriptText('')}
                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                value={originalTranscriptText}
                                onChange={(e) => setOriginalTranscriptText(e.target.value)}
                                className="w-full h-36 bg-slate-950/80 border border-slate-850 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 resize-y leading-relaxed font-sans scrollbar-thin select-text"
                                placeholder="La transcripción de Whisper aparecerá aquí..."
                              />
                            {/* Actions Group */}
                            <div className="space-y-2">
                              <div className="flex space-x-2">
                                {!isRewriting ? (
                                  <button
                                    onClick={handleRewriteClick}
                                    disabled={!originalTranscriptText.trim()}
                                    className={`flex-1 bg-gradient-to-r from-indigo-600 via-indigo-650 to-violet-650 hover:from-indigo-500 hover:to-violet-500 text-white text-xs py-2 px-3 rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-1.5 border border-indigo-500/20 ${
                                      originalTranscriptText.trim() ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-55'
                                    }`}
                                  >
                                    <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-250 flex-shrink-0" />
                                    <span>Reescribir</span>
                                  </button>
                                ) : (
                                  <div className="flex-1 bg-slate-900 border border-indigo-500/30 rounded-xl py-2 px-3 flex items-center justify-center space-x-2">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                                    <span className="text-[10px] text-indigo-300 font-semibold animate-pulse">Reescribiendo...</span>
                                  </div>
                                )}

                                {!isCuttingClips ? (
                                  <button
                                    onClick={handleCutClipsClick}
                                    disabled={transcriptSegments.length === 0}
                                    className={`flex-1 bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 text-slate-205 text-xs py-2 px-3 rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center space-x-1.5 border border-slate-700/50 ${
                                      transcriptSegments.length > 0 ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-55'
                                    }`}
                                    title="Analiza y segmenta el video usando los timestamps de la transcripción"
                                  >
                                    <Scissors className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                    <span>Cortar en Clips</span>
                                  </button>
                                ) : (
                                  <div className="flex-1 bg-slate-900 border border-slate-700/30 rounded-xl py-2 px-3 flex items-center justify-center space-x-2">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-550/20 border-t-indigo-500 animate-spin" />
                                    <span className="text-[10px] text-slate-400 font-semibold animate-pulse">Cortando...</span>
                                  </div>
                                )}
                              </div>

                              {rewriteError && (
                                <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl break-words">
                                  <p className="font-bold mb-0.5">Error de reescritura:</p>
                                  <p className="font-mono text-[9px] select-text">{rewriteError}</p>
                                </div>
                              )}

                              {cuttingClipsError && (
                                <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl break-words">
                                  <p className="font-bold mb-0.5">Error al cortar clips:</p>
                                  <p className="font-mono text-[9px] select-text">{cuttingClipsError}</p>
                                </div>
                              )}
                            </div>
                          </div>

                             {/* Guión IA Panel */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col space-y-2.5 shadow-xl">
                              <div className="flex justify-between items-center pb-1 border-b border-slate-800/80">
                                <div className="flex items-center space-x-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                                  <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase font-sans">Guión IA</span>
                                </div>
                              </div>

                              {/* Action Buttons Row */}
                              <div className="flex flex-wrap gap-1.5 py-1">
                                <button
                                  onClick={handleCopyScript}
                                  className="flex-1 min-w-[70px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] py-1 px-2 rounded-lg font-semibold active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer border border-slate-700/50"
                                  title="Copiar todo el texto"
                                >
                                  <Copy className="h-3 w-3 text-slate-450" />
                                  <span>{isCopied ? '¡Copiado!' : 'Copiar'}</span>
                                </button>
                                <button
                                  onClick={() => setAiScript('')}
                                  className="flex-1 min-w-[70px] bg-slate-800 hover:bg-red-955 hover:text-red-300 hover:border-red-900/40 text-slate-200 text-[10px] py-1 px-2 rounded-lg font-semibold active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer border border-slate-700/50"
                                  title="Limpiar el panel"
                                >
                                  <Trash2 className="h-3 w-3 text-slate-450" />
                                  <span>Borrar</span>
                                </button>
                                <button
                                  onClick={handleRewriteClick}
                                  disabled={isRewriting}
                                  className="flex-1 min-w-[80px] bg-indigo-900/40 hover:bg-indigo-805 text-indigo-300 text-[10px] py-1 px-2 rounded-lg font-semibold active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer border border-indigo-700/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Reescribir con DeepSeek"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  <span>{isRewriting ? 'Procesando...' : 'Reescribir'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    if (transcriptSegments && transcriptSegments.length > 0) {
                                      const text = transcriptSegments.map((s: any) => s.text).join(' ');
                                      setAiScript(text);
                                    } else if (transcription) {
                                      setAiScript(transcription);
                                    }
                                  }}
                                  className="bg-slate-700/50 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600/30 text-[10px] font-bold py-1.5 px-3 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
                                >
                                  <span>📋 Usar Transcripción</span>
                                </button>
                                <button
                                  onClick={() => setSelectedTool('voice')}
                                  className="flex-1 min-w-[100px] bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] py-1 px-2 rounded-lg font-semibold active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer border border-emerald-500/20"
                                  title="Confirmar y pasar a voz"
                                >
                                  <span>Confirmar Guión</span>
                                </button>
                              </div>

                              <textarea
                                value={aiScript}
                                onChange={(e) => setAiScript(e.target.value)}
                                className="w-full h-40 bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500/50 resize-y leading-relaxed font-sans scrollbar-thin select-text"
                                placeholder="El guión generado aparecerá aquí..."
                              />
                            </div>
                          </div>
                       ) : (
                         <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl space-y-4 bg-slate-950/20">
                           <Type className="h-8 w-8 text-indigo-400 animate-pulse" />
                           <div className="space-y-2">
                             <p className="text-xs font-semibold text-slate-300 leading-relaxed">
                               Listo para transcribir: <span className="text-indigo-400 font-mono font-bold block mt-1 break-all">{firstVideoInLibrary.name}</span>
                             </p>
                             <p className="text-[10px] text-slate-500 italic">
                               La transcripción real se conectará con Whisper local.
                             </p>
                           </div>
                           
                           {transcriptionStatus && transcriptionStatus.startsWith('Error:') && (
                             <p className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/25 px-2 py-1 rounded max-w-[220px] select-text break-all">
                               {transcriptionStatus}
                             </p>
                           )}

                           <button 
                             onClick={() => {
                               if (firstVideoInLibrary) {
                                 window.electronAPI.startTranscription(firstVideoInLibrary.path);
                               }
                             }}
                             className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold active:scale-95 transition-all shadow-md shadow-indigo-600/25 cursor-pointer"
                           >
                             Iniciar Transcripción
                           </button>
                         </div>
                       )}
                     </div>
                   );
                })()}

                {selectedTool === 'smart-cut' && (
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-6 space-y-3">
                    <Scissors className="h-8 w-8 text-indigo-450 mb-1" />
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Auto Smart-Cut</h3>
                    <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">Remueve silencios y pausas automáticamente usando transcripción acústica.</p>
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold active:scale-95 transition-all shadow-md shadow-indigo-600/25 cursor-pointer">
                      Analizar Silencios
                    </button>
                  </div>
                )}

                {selectedTool === 'translate' && (
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-6 space-y-4">
                    <Languages className="h-8 w-8 text-indigo-450 mb-1" />
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Doblaje e Idiomas</h3>
                    <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">Traduce tus pistas de audio a otros idiomas manteniendo tu tono de voz original.</p>
                    
                    <div className="w-full space-y-2 text-left">
                      <label className="text-[10px] text-slate-500 font-bold uppercase">Idioma Destino</label>
                      <select className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-300 outline-none">
                        <option>Inglés (EE.UU.)</option>
                        <option>Español (España)</option>
                        <option>Portugués (Brasil)</option>
                        <option>Francés (Francia)</option>
                        <option>Alemán (Alemania)</option>
                      </select>
                    </div>

                    <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded-lg font-semibold active:scale-95 transition-all shadow-md shadow-indigo-600/25 cursor-pointer">
                      Iniciar Traducción
                    </button>
                  </div>
                )}

                {selectedTool === 'voice' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedTool('subtitles')}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 text-slate-300 font-bold px-2 py-0.5 rounded-md border border-slate-700/50 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
                          title="Volver a editar/reescribir el guion"
                        >
                          <span>&larr; Volver al Guión</span>
                        </button>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Generador de Voz IA</h3>
                      </div>
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold uppercase font-sans">Voice AI</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                      <div className="bg-slate-900/90 border border-slate-805 rounded-xl p-3 flex flex-col space-y-2.5 shadow-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">Guión de Entrada</span>
                        <textarea
                          value={aiScript}
                          onChange={(e) => setAiScript(e.target.value)}
                          className="w-full h-32 bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 resize-y leading-relaxed font-sans scrollbar-thin select-text"
                          placeholder="El guion a procesar aparecerá aquí..."
                        />
                      </div>

                      <div className="bg-slate-900/90 border border-slate-805 rounded-xl p-3.5 flex flex-col space-y-4 shadow-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase font-sans tracking-wide">Configuración de Voz</span>
                        
                        {/* Selector de Modelo (Eleven Multilingual v2) */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase font-sans">Modelo</label>
                          <select 
                            value={voiceModel}
                            onChange={(e) => setVoiceModel(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-805 text-xs rounded-lg p-2 text-slate-300 outline-none focus:border-indigo-500/50 cursor-pointer"
                          >
                            <option value="Eleven Multilingual v2">Eleven Multilingual v2</option>
                            <option value="Eleven English v1">Eleven English v1</option>
                            <option value="Eleven Turbo v2">Eleven Turbo v2</option>
                          </select>
                        </div>

                        {/* Selector de Voz */}
                        <div className="space-y-1 relative">
                          <label className="text-[9px] text-slate-500 font-bold uppercase font-sans">Clon o Locutor</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                              className="w-full bg-slate-950 border border-slate-805 text-xs rounded-lg p-2 text-slate-355 flex items-center justify-between hover:bg-slate-900 transition-colors cursor-pointer select-none text-left"
                            >
                              <span>
                                {elevenLabsVoices.find(v => v.voice_id === selectedVoiceId)?.name || 'Clon de mi Voz (Mi voz)'}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                            </button>
                            
                            {isVoiceDropdownOpen && (
                              <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
                                {elevenLabsVoices.length === 0 ? (
                                  <div className="text-[10px] text-slate-500 italic p-2 text-center">
                                    Cargando voces desde ElevenLabs...
                                  </div>
                                ) : (
                                  elevenLabsVoices.map(voice => (
                                    <div
                                      key={voice.voice_id}
                                      onClick={() => {
                                        handleVoiceSelect(voice.voice_id);
                                        setIsVoiceDropdownOpen(false);
                                      }}
                                      className={`flex items-center justify-between p-2 rounded-lg text-xs hover:bg-slate-800 transition-all cursor-pointer ${
                                        selectedVoiceId === voice.voice_id
                                          ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                                        {voice.is_my_voice && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 animate-pulse" />
                                        )}
                                        <span className="truncate font-semibold">{voice.name}</span>
                                        <span className="text-[8px] px-1 py-0.2 bg-slate-950 text-slate-500 rounded text-right capitalize truncate font-mono">
                                          {voice.category}
                                        </span>
                                      </div>
                                      
                                      {voice.preview_url && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            playVoicePreview(voice);
                                          }}
                                          className={`p-1 bg-slate-950 hover:bg-slate-800 hover:text-white rounded border border-slate-850 flex items-center justify-center cursor-pointer transition-colors ${
                                            playingPreviewVoiceId === voice.voice_id ? 'text-indigo-400 border-indigo-500/30' : 'text-slate-500'
                                          }`}
                                          title="Escuchar demostración"
                                        >
                                          {playingPreviewVoiceId === voice.voice_id ? (
                                            <Pause className="h-2.5 w-2.5 fill-current" />
                                          ) : (
                                            <Play className="h-2.5 w-2.5 fill-current" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Slider de Velocidad */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase font-sans">
                            <span>Velocidad</span>
                            <span className="font-mono text-indigo-400 font-bold">{voiceSpeed.toFixed(1)}x</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.1" 
                            value={voiceSpeed}
                            onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none" 
                            style={{
                              background: `linear-gradient(to right, rgb(99, 102, 241) ${Math.round(((voiceSpeed - 0.5) / 1.5) * 100)}%, rgb(30, 41, 59) 0%)`
                            }}
                          />
                          <div className="flex justify-between text-[8px] text-slate-600 font-medium font-sans">
                            <span>Más lento</span>
                            <span>Más rápido</span>
                          </div>
                        </div>

                        {/* Slider de Estabilidad */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase font-sans">
                            <span>Estabilidad</span>
                            <span className="font-mono text-indigo-400 font-bold">{voiceStability}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={voiceStability}
                            onChange={(e) => setVoiceStability(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none" 
                            style={{
                              background: `linear-gradient(to right, rgb(99, 102, 241) ${voiceStability}%, rgb(30, 41, 59) 0%)`
                            }}
                          />
                          <div className="flex justify-between text-[8px] text-slate-600 font-medium font-sans">
                            <span>Más variable</span>
                            <span>Más estable</span>
                          </div>
                        </div>

                        {/* Formato de Salida (Fijo) */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase font-sans">Formato de Salida</label>
                          <input 
                            type="text" 
                            readOnly 
                            value={voiceFormat}
                            className="w-full bg-slate-950/50 border border-slate-805 text-xs rounded-lg p-2 text-slate-400 outline-none select-none font-mono cursor-not-allowed" 
                          />
                        </div>
                      </div>

                      {/* Botón Generar Voz */}
                      <button 
                        onClick={handleGenerateVoiceClick}
                        disabled={isGeneratingVoice}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs py-2.5 px-3 rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-indigo-600/10 cursor-pointer flex items-center justify-center space-x-2 border border-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>{isGeneratingVoice ? 'Generando Voz...' : 'Generar Voz'}</span>
                      </button>

                      {voiceGenerationError && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-[10px] text-rose-400 break-words leading-relaxed">
                          <span className="font-bold block mb-1">Error de generación:</span>
                          <span className="font-mono text-[9px] select-text">{voiceGenerationError}</span>
                        </div>
                      )}

                      {firstVideoInLibrary && (
                        <button
                          onClick={() => {
                            const durationSecs = firstVideoInLibrary.durationSeconds || 30;
                            const newTimelineClip = {
                              id: `timeline-voice-original-${Date.now()}`,
                              name: `Voz - Audio Original`,
                              startSeconds: 0,
                              durationSeconds: durationSecs,
                              type: 'audio' as const,
                              url: firstVideoInLibrary.url,
                              path: firstVideoInLibrary.path,
                              newAudioSegments: transcriptSegments,
                            };
                            const updated = [...timelineVideoClips, newTimelineClip];
                            setTimelineVideoClips(updated);
                            pushHistory(updated);
                          }}
                          className="w-full bg-emerald-600/25 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/20 hover:border-emerald-500 text-[10px] font-bold py-2 px-3 rounded-lg active:scale-95 transition-all cursor-pointer"
                        >
                          🎙️ Usar Audio Original
                        </button>
                      )}

                      {/* Lista de Versiones Generadas (Mini Reproductor) */}
                      <div className="bg-slate-900/90 border border-slate-805 rounded-xl p-3.5 flex flex-col space-y-3 shadow-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase font-sans tracking-wide">
                          Versiones Generadas ({generatedVoices.length})
                        </span>
                        
                        {generatedVoices.length === 0 ? (
                          <div className="text-center py-6 text-slate-500 text-[10px] italic">
                            No hay versiones generadas aún. Presiona "Generar Voz" para crear una.
                          </div>
                        ) : (
                          <div className="space-y-3.5 divide-y divide-slate-800/60 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                            {generatedVoices.map((voice, idx) => (
                              <div key={voice.id} className={`${idx > 0 ? 'pt-3.5' : ''} flex flex-col space-y-2`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-205">
                                      Take {generatedVoices.length - idx} &bull; {voice.speaker}
                                    </span>
                                    <span className="text-[8px] text-slate-550 font-mono">
                                      {voice.model} &bull; Estab: {voice.stability}% &bull; {new Date(voice.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setGeneratedVoices(prev => prev.filter(v => v.id !== voice.id));
                                    }}
                                    className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                                    title="Eliminar esta versión"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                                
                                <div className="text-[9px] text-slate-450 bg-slate-950/40 p-2 rounded border border-slate-850 line-clamp-2 select-text" title={voice.text}>
                                  "{voice.text}"
                                </div>

                                <div className="flex items-center space-x-2">
                                  <audio 
                                    controls 
                                    src={voice.audioUrl} 
                                    className="flex-1 h-7 rounded bg-slate-950" 
                                    style={{ outline: 'none' }}
                                  />
                                  <button
                                    onClick={() => addVoiceToTimeline(voice)}
                                    className="bg-indigo-600/25 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/20 hover:border-indigo-500 text-[10px] font-bold py-1 px-2.5 rounded-lg active:scale-95 transition-all cursor-pointer flex-shrink-0"
                                  >
                                    Añadir al Timeline
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedTool === 'timeline-ia' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedTool(null)}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 text-slate-300 font-bold px-2 py-0.5 rounded-md border border-slate-700/50 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
                          title="Volver a la caja de herramientas"
                        >
                          <span>&larr; Volver</span>
                        </button>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Timeline IA / Montaje</h3>
                      </div>
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold uppercase font-sans">IA Assembly</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col space-y-3 shadow-xl">
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">Mezcla del Montaje</h4>
                          <p className="text-[10px] text-slate-400 mt-1">El sistema organizará los clips en el timeline utilizando los porcentajes que configures en el panel izquierdo ("Mix del montaje").</p>
                        </div>
                      </div>

                      {/* Build Timeline IA Button */}
                      {isGeneratingAssets ? (
                        <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl select-none">
                          <div className="w-8 h-8 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin flex items-center justify-center shadow-lg shadow-indigo-500/20" />
                          <div className="space-y-2 w-full">
                            <p className="text-xs font-semibold text-indigo-300">Generando clips con IA local...</p>
                            {generationProgress ? (
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                  <span>Progreso: {generationProgress.current} de {generationProgress.total}</span>
                                  <span className="capitalize text-indigo-400 font-bold">{generationProgress.type}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                                    style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-slate-500 italic truncate" title={generationProgress.paragraph}>
                                  "{generationProgress.paragraph}"
                                </p>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 font-mono">Analizando guion y preparando entorno...</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={handleBuildIATimeline}
                          disabled={!aiScript.trim()}
                          className="w-full bg-gradient-to-r from-indigo-600 to-violet-650 hover:from-indigo-500 hover:to-violet-550 text-white text-xs py-2.5 px-3 rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-indigo-600/10 cursor-pointer flex items-center justify-center space-x-2 border border-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-indigo-250 animate-pulse" />
                          <span>Construir Timeline IA</span>
                        </button>
                      )}

                      {!aiScript.trim() && (
                        <div className="text-center py-2 text-[10px] text-slate-500 italic leading-relaxed">
                          * Genera o reescribe un guión en el panel de transcripción antes de construir el Timeline IA.
                        </div>
                      )}

                      {generationError && (
                        <div className="text-center py-2 px-3 text-[10px] text-red-400 font-medium leading-relaxed bg-red-950/20 border border-red-900/50 rounded-xl mt-2 select-text">
                          Error de generación: {generationError}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Resizer 3: Timeline Resizer */}
      <div
        onMouseDown={handleTimelineResizeMouseDown}
        className="h-1 bg-slate-950 hover:bg-indigo-500/85 active:bg-indigo-650 transition-colors cursor-row-resize flex-shrink-0 z-40 relative group"
      >
        <div className="absolute inset-x-0 -top-1 -bottom-1 cursor-row-resize" />
      </div>

      {/* Bottom Timeline Editor */}
      <footer 
        style={{ height: `${timelineHeight}px` }} 
        className="bg-slate-900 flex flex-col flex-shrink-0 overflow-hidden"
      >
        {/* Timeline toolbar */}
        <div className="px-4 py-2 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-455">
          <div className="flex items-center space-x-4 flex-wrap">
            {/* Undo */}
            <button 
              disabled={milestoneIndex <= 0}
              onClick={handleUndo}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                milestoneIndex > 0 
                  ? 'text-slate-300 hover:text-indigo-400 cursor-pointer' 
                  : 'text-slate-650 cursor-not-allowed'
              }`}
              title="Deshacer (Ctrl+Z)"
            >
              <Undo className="h-3.5 w-3.5" />
            </button>

            {/* Redo */}
            <button 
              disabled={milestoneIndex >= milestoneHistory.length - 1}
              onClick={handleRedo}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                milestoneIndex < milestoneHistory.length - 1 
                  ? 'text-slate-300 hover:text-indigo-400 cursor-pointer' 
                  : 'text-slate-655 cursor-not-allowed'
              }`}
              title="Rehacer (Ctrl+Y)"
            >
              <Redo className="h-3.5 w-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-slate-800 mx-1" />

            {/* Split / Tijeras */}
            <button 
              onClick={handleSplit}
              className="flex items-center space-x-1 text-slate-300 hover:text-indigo-400 cursor-pointer transition-all active:scale-95"
              title="Dividir clip en la línea de tiempo (Ctrl+B)"
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>Dividir</span>
            </button>

            {/* Copiar Clip */}
            <button 
              disabled={selectedTimelineClipIds.length === 0}
              onClick={handleCopyClip}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                selectedTimelineClipIds.length > 0 
                  ? 'text-slate-300 hover:text-indigo-400 cursor-pointer' 
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Copiar clip seleccionado"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copiar</span>
            </button>

            {/* Pegar Clip */}
            <button 
              disabled={!copiedClip}
              onClick={handlePasteClip}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                copiedClip 
                  ? 'text-slate-300 hover:text-indigo-400 cursor-pointer' 
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Pegar clip copiado en el cabezal de reproducción"
            >
              <Clipboard className="h-3.5 w-3.5" />
              <span>Pegar</span>
            </button>

            {/* Espejo */}
            <button 
              onClick={() => setIsMirrored(!isMirrored)}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                isMirrored 
                  ? 'text-indigo-400 hover:text-indigo-300 font-bold' 
                  : 'text-slate-300 hover:text-indigo-400 cursor-pointer'
              }`}
              title="Voltear horizontalmente (Espejo)"
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
              <span>Espejo</span>
            </button>

            {/* Crop */}
            <button 
              onClick={() => setIsCropping(!isCropping)}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                isCropping 
                  ? 'text-indigo-400 hover:text-indigo-300 font-bold' 
                  : 'text-slate-300 hover:text-indigo-400 cursor-pointer'
              }`}
              title="Recortar video (Crop)"
            >
              <Crop className="h-3.5 w-3.5" />
              <span>Crop</span>
            </button>
            {activeCrop && (
              <button 
                onClick={() => setActiveCrop(null)}
                className="text-[9px] bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-slate-700 px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer"
                title="Restaurar recorte original"
              >
                Reset Crop
              </button>
            )}

            <div className="w-[1px] h-4 bg-slate-800 mx-1" />

            {/* Duplicar */}
            <button 
              disabled={selectedTimelineClipIds.length === 0}
              onClick={() => duplicateTimelineClips(selectedTimelineClipIds)}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                selectedTimelineClipIds.length > 0 
                  ? 'text-slate-300 hover:text-indigo-400 cursor-pointer' 
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Duplicar clip seleccionado"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Duplicar</span>
            </button>

            {/* Eliminar */}
            <button 
              disabled={selectedTimelineClipIds.length === 0}
              onClick={() => handleDeleteClips(selectedTimelineClipIds)}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                selectedTimelineClipIds.length > 0 
                  ? 'text-rose-450 hover:text-rose-400 cursor-pointer' 
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Eliminar clip seleccionado (Delete)"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Eliminar</span>
            </button>

            {/* Zoom Slider Control */}
            <div className="flex items-center space-x-2 text-slate-400 pl-4 border-l border-slate-800">
              <span className="text-[10px] font-semibold text-slate-500 uppercase select-none">Zoom Preview:</span>
              <input 
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-700 hover:bg-slate-650 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none"
                style={{
                  background: `linear-gradient(to right, rgb(99, 102, 241) ${Math.round(((zoom - 1) / 3) * 100)}%, rgb(51, 65, 85) 0%)`
                }}
              />
              <span className="text-[10px] font-mono text-slate-400 w-8">
                {Math.round(zoom * 100)}%
              </span>
              {zoom > 1 && (
                <button 
                  onClick={() => setZoom(1)}
                  className="text-[9px] bg-slate-800 hover:bg-slate-750 text-indigo-400 px-1.5 py-0.5 rounded font-bold border border-slate-700 transition-all active:scale-95 cursor-pointer"
                  title="Restablecer zoom a 100%"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="font-mono text-[10px] text-slate-500">Escala de Tiempo: 1s</span>
            
            {/* Timeline Zoom Slider Control (Regla 6) */}
            <div className="flex items-center space-x-2 pl-4 border-l border-slate-800 text-slate-400">
              <span className="text-[10px] font-semibold text-slate-500 uppercase select-none">Zoom Timeline:</span>
              <button 
                onClick={() => setTimelineZoom(prev => Math.max(1200, prev - 300))} 
                className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5 hover:bg-slate-800 rounded select-none cursor-pointer font-bold transition-colors"
                title="Alejar"
              >
                -
              </button>
              <input 
                type="range"
                min="1200"
                max="6000"
                step="100"
                value={timelineZoom}
                onChange={(e) => setTimelineZoom(parseInt(e.target.value))}
                className="w-24 h-1 bg-slate-700 hover:bg-slate-650 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none"
                style={{
                  background: `linear-gradient(to right, rgb(99, 102, 241) ${Math.round(((timelineZoom - 1200) / 4800) * 100)}%, rgb(51, 65, 85) 0%)`
                }}
              />
              <button 
                onClick={() => setTimelineZoom(prev => Math.min(6000, prev + 300))} 
                className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5 hover:bg-slate-800 rounded select-none cursor-pointer font-bold transition-colors"
                title="Acercar"
              >
                +
              </button>
              <span className="text-[9px] font-mono text-slate-400 w-8 select-none">
                {Math.round((timelineZoom / 1200) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Tracks area */}
        <div 
          ref={timelineTracksRef}
          className="flex-1 overflow-x-auto overflow-y-auto p-4 bg-slate-950/40 relative scrollbar-timeline"
        >
          <div className="relative" style={{ minWidth: `${timelineZoom}px` }}>
            {/* Timeline Ruler */}
            <div className="flex items-center space-x-3 mb-2 select-none">
              <div className="w-28 flex-shrink-0" />
              <div 
                ref={trackRef}
                onMouseDown={handleTimelineScrubMouseDown}
                className="flex-1 h-6 relative cursor-col-resize border-b border-slate-800"
              >
                {/* Ruler Ticks */}
                {(() => {
                  const ticks = [];
                  const numTicks = Math.floor(totalDuration / 10);
                  for (let i = 0; i <= numTicks; i++) {
                    ticks.push(i * 10);
                  }
                  return ticks.map(tick => (
                    <div 
                      key={tick} 
                      style={{ left: `${(tick / totalDuration) * 100}%` }} 
                      className="absolute top-0 bottom-0 flex flex-col justify-between"
                    >
                      <div className="w-[1px] h-1.5 bg-slate-700" />
                      <span className="text-[8px] text-slate-500 font-mono transform -translate-x-1/2 select-none">
                        {tick}s
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Tracks wrapper */}
            <div className="relative space-y-3">
              {/* Playhead Overlay Area (aligned with the tracks, starts after the header - Corrección 5) */}
              <div 
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{
                  left: 'calc(7rem + 12px)',
                  right: 0,
                }}
              >
                {/* Vertical Playhead Play Line */}
                {(() => {
                  const playheadPercent = totalDuration > 0 ? (currentTimeForUI / totalDuration) * 100 : 0;
                  return (
                    <div 
                      id="cipher-playhead"
                      style={{ left: `${playheadPercent}%` }} 
                      className="absolute top-0 bottom-0 w-[2px] bg-indigo-500 pointer-events-none shadow-[0_0_10px_#6366f1]"
                    >
                      <div className="w-3 h-3 bg-indigo-500 rounded-full -ml-[5px] -mt-[4px] border border-white shadow-lg" />
                    </div>
                  );
                })()}
              </div>

              {/* Track 1: Video Track */}
              <div className="flex items-center space-x-3">
                <div className="w-28 text-[11px] font-bold text-slate-400 flex flex-col justify-center space-y-1.5 flex-shrink-0 pr-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Video className="h-3.5 w-3.5 text-sky-400" />
                      <span>Video v1</span>
                    </div>
                    <button 
                      onClick={() => setIsVideoTrackMuted(!isVideoTrackMuted)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                      title={isVideoTrackMuted ? "Desmutear pista" : "Mutear pista"}
                    >
                      {isVideoTrackMuted || videoTrackVolume === 0 ? (
                        <VolumeX className="h-3 w-3 text-rose-400" />
                      ) : (
                        <Volume2 className="h-3 w-3 text-sky-400" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isVideoTrackMuted ? 0 : videoTrackVolume}
                      onChange={(e) => {
                        setVideoTrackVolume(parseFloat(e.target.value));
                        setIsVideoTrackMuted(false);
                      }}
                      className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500 transition-all outline-none"
                      style={{
                        background: `linear-gradient(to right, rgb(56, 189, 248) ${Math.round((isVideoTrackMuted ? 0 : videoTrackVolume) * 100)}%, rgb(30, 41, 59) 0%)`
                      }}
                    />
                    <span className="font-mono text-[8px] text-sky-400 w-5 text-right">{Math.round((isVideoTrackMuted ? 0 : videoTrackVolume) * 100)}%</span>
                  </div>
                </div>
                <div className="flex-1 h-12 bg-slate-900/60 border border-slate-800/80 rounded-xl relative overflow-hidden">
                  {timelineVideoClips.filter(tClip => tClip.type !== 'audio' && tClip.type !== 'graphic').length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-600 font-medium">Arrastra o añade videos aquí</span>
                    </div>
                  )}
                  {timelineVideoClips
                    .filter(tClip => tClip.type !== 'audio' && tClip.type !== 'graphic')
                    .map((tClip, index) => {
                      const leftPercent = (tClip.startSeconds / totalDuration) * 100;
                      const widthPercent = (tClip.durationSeconds / totalDuration) * 100;
                      
                      const cat = tClip.category ? tClip.category.toLowerCase() : '';
                      let bgClass = 'bg-slate-500/20 border-slate-400/50 text-slate-300 hover:bg-slate-500/30';
                      if (cat === 'original' || cat === 'originales') {
                        bgClass = 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/35';
                      } else if (cat === 'stock') {
                        bgClass = 'bg-sky-500/25 border-sky-400/50 text-sky-300 hover:bg-sky-500/35';
                      } else if (cat === 'minimax') {
                        bgClass = 'bg-amber-600/25 border-amber-500/50 text-amber-300 hover:bg-amber-600/35';
                      } else {
                        bgClass = index % 2 === 0 
                          ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 hover:bg-sky-500/30' 
                          : 'bg-violet-500/20 border-violet-400/50 text-violet-300 hover:bg-violet-500/30';
                      }
                      
                      return (
                        <div 
                          key={tClip.id}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          onMouseDown={(e) => handleClipMouseDown(e, tClip.id, 'move')}
                          onContextMenu={(e) => handleClipContextMenu(e, tClip.id)}
                          className={`absolute h-full border rounded-lg flex items-center px-2 justify-between group/tclip cursor-move transition-shadow ${
                            selectedTimelineClipIds.includes(tClip.id) 
                              ? 'ring-2 ring-indigo-500 border-indigo-400 z-20 shadow-[0_0_12px_rgba(99,102,241,0.25)]' 
                              : 'border-slate-800'
                          } ${bgClass}`}
                        >
                          {/* Left Trim Handle */}
                          <div 
                            onMouseDown={(e) => handleClipMouseDown(e, tClip.id, 'trim-left')}
                            className="absolute left-0 top-0 bottom-0 w-2.5 bg-indigo-500/85 cursor-ew-resize opacity-0 group-hover/tclip:opacity-100 transition-opacity rounded-l-lg flex items-center justify-center hover:bg-indigo-400 z-10"
                          >
                            <div className="w-[1.5px] h-3 bg-white/60" />
                          </div>

                          <div className="flex items-center min-w-0 flex-1 select-none pointer-events-none">
                            {tClip.thumbnailUrl && (
                              <img 
                                src={tClip.thumbnailUrl} 
                                alt="" 
                                className="h-8 w-12 object-cover rounded mr-2 flex-shrink-0" 
                              />
                            )}
                            <span className="text-[10px] truncate font-medium pr-1" title={tClip.name}>
                              {tClip.name}
                            </span>
                          </div>
                          
                          <span className="text-[9px] font-mono px-1 rounded flex-shrink-0 select-none pointer-events-none bg-slate-950/60 text-slate-350 z-10">
                            {tClip.durationSeconds.toFixed(1)}s
                          </span>

                          {/* Right Trim Handle */}
                          <div 
                            onMouseDown={(e) => handleClipMouseDown(e, tClip.id, 'trim-right')}
                            className="absolute right-0 top-0 bottom-0 w-2.5 bg-indigo-500/85 cursor-ew-resize opacity-0 group-hover/tclip:opacity-100 transition-opacity rounded-r-lg flex items-center justify-center hover:bg-indigo-400 z-10"
                          >
                            <div className="w-[1.5px] h-3 bg-white/60" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Track 1.5: Gráficos Track */}
              <div className="flex items-center space-x-3">
                <div className="w-28 text-[11px] font-bold text-slate-400 flex flex-col justify-center space-y-1.5 flex-shrink-0 pr-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                      <span>Gráficos g1</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 h-12 bg-slate-900/60 border border-slate-800/80 rounded-xl relative overflow-hidden">
                  {timelineVideoClips.filter(tClip => tClip.type === 'graphic').length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-600 font-medium">Sin gráficos asignados</span>
                    </div>
                  )}
                  {timelineVideoClips
                    .filter(tClip => tClip.type === 'graphic')
                    .map((tClip) => {
                      const leftPercent = (tClip.startSeconds / totalDuration) * 100;
                      const widthPercent = (tClip.durationSeconds / totalDuration) * 100;
                      const emoji = tClip.graphicData?.emoji || '📊';
                      const label = tClip.graphicData?.label || tClip.graphicData?.type || tClip.name;
                      
                      return (
                        <div 
                          key={tClip.id}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          onMouseDown={(e) => handleClipMouseDown(e, tClip.id, 'move')}
                          className={`absolute h-full border border-cyan-500/35 bg-cyan-950/15 text-cyan-300 rounded-lg flex items-center px-2 justify-between group/tclip cursor-move transition-shadow z-10 hover:bg-cyan-950/25`}
                        >
                          {/* Left Trim Handle */}
                          <div 
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleClipMouseDown(e, tClip.id, 'trim-left');
                            }}
                            className="absolute left-0 top-0 bottom-0 w-2 bg-cyan-500/50 cursor-ew-resize opacity-0 group-hover/tclip:opacity-100 transition-opacity rounded-l-lg flex items-center justify-center hover:bg-cyan-400 z-10"
                          >
                            <div className="w-[1px] h-3 bg-white/60" />
                          </div>

                          <div className="flex items-center min-w-0 flex-1 select-none pointer-events-none">
                            <span className="text-xs mr-1">{emoji}</span>
                            <span className="text-[10px] truncate font-medium pr-1" title={label}>
                              {label}
                            </span>
                          </div>
                          
                          {tClip.durationSeconds >= 2.0 && (
                            <span className="text-[9px] font-mono px-1 rounded flex-shrink-0 select-none pointer-events-none bg-slate-950/60 text-slate-350 z-10 mr-1.5">
                              {tClip.durationSeconds.toFixed(1)}s
                            </span>
                          )}

                          {/* Delete button (X) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimelineVideoClips(prev => prev.filter(tc => tc.id !== tClip.id));
                              setIsDirty(true);
                            }}
                            className="w-3.5 h-3.5 rounded-full bg-slate-950/40 hover:bg-rose-500/80 hover:text-white flex items-center justify-center text-[8px] font-bold transition-all z-20 cursor-pointer border-none"
                            title="Eliminar gráfico"
                          >
                            ×
                          </button>

                          {/* Right Trim Handle */}
                          <div 
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleClipMouseDown(e, tClip.id, 'trim-right');
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 bg-cyan-500/50 cursor-ew-resize opacity-0 group-hover/tclip:opacity-100 transition-opacity rounded-r-lg flex items-center justify-center hover:bg-cyan-400 z-10"
                          >
                            <div className="w-[1px] h-3 bg-white/60" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Track 2: Audio Track */}
              <div className="flex items-center space-x-3">
                <div className="w-28 text-[11px] font-bold text-slate-400 flex flex-col justify-center space-y-1.5 flex-shrink-0 pr-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Audio a1</span>
                    </div>
                    <button 
                      onClick={() => setIsAudioTrackMuted(!isAudioTrackMuted)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                      title={isAudioTrackMuted ? "Desmutear pista" : "Mutear pista"}
                    >
                      {isAudioTrackMuted || audioTrackVolume === 0 ? (
                        <VolumeX className="h-3 w-3 text-rose-400" />
                      ) : (
                        <Volume2 className="h-3 w-3 text-emerald-400" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isAudioTrackMuted ? 0 : audioTrackVolume}
                      onChange={(e) => {
                        setAudioTrackVolume(parseFloat(e.target.value));
                        setIsAudioTrackMuted(false);
                      }}
                      className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500 transition-all outline-none"
                      style={{
                        background: `linear-gradient(to right, rgb(52, 211, 153) ${Math.round((isAudioTrackMuted ? 0 : audioTrackVolume) * 100)}%, rgb(30, 41, 59) 0%)`
                      }}
                    />
                    <span className="font-mono text-[8px] text-emerald-400 w-5 text-right">{Math.round((isAudioTrackMuted ? 0 : audioTrackVolume) * 100)}%</span>
                  </div>
                </div>
                <div className="flex-1 h-12 bg-slate-900/60 border border-slate-800/80 rounded-xl relative overflow-hidden">
                  {timelineVideoClips.filter(tClip => tClip.type === 'audio').length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-600 font-medium">Arrastra o añade audios aquí</span>
                    </div>
                  )}
                  {timelineVideoClips
                    .filter(tClip => tClip.type === 'audio')
                    .map((tClip) => {
                      const leftPercent = (tClip.startSeconds / totalDuration) * 100;
                      const widthPercent = (tClip.durationSeconds / totalDuration) * 100;
                      const bgClass = 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/30';
                      
                      return (
                        <div 
                          key={tClip.id}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          onMouseDown={(e) => handleClipMouseDown(e, tClip.id, 'move')}
                          onContextMenu={(e) => handleClipContextMenu(e, tClip.id)}
                          className={`absolute h-full border rounded-lg flex items-center px-3 justify-between group/tclip cursor-move transition-shadow ${
                            selectedTimelineClipIds.includes(tClip.id) 
                              ? 'ring-2 ring-indigo-500 border-indigo-400 z-20 shadow-[0_0_12px_rgba(99,102,241,0.25)]' 
                              : 'border-slate-800'
                          } ${bgClass}`}
                        >
                          {/* Left Trim Handle */}
                          <div 
                            onMouseDown={(e) => handleClipMouseDown(e, tClip.id, 'trim-left')}
                            className="absolute left-0 top-0 bottom-0 w-2.5 bg-indigo-500/85 cursor-ew-resize opacity-0 group-hover/tclip:opacity-100 transition-opacity rounded-l-lg flex items-center justify-center hover:bg-indigo-400 z-10"
                          >
                            <div className="w-[1.5px] h-3 bg-white/60" />
                          </div>

                          <span className="text-[10px] truncate font-medium pr-1 select-none pointer-events-none" title={tClip.name}>
                            {tClip.name}
                          </span>
                          <span className="text-[9px] font-mono px-1 rounded flex-shrink-0 select-none pointer-events-none bg-slate-950/60 text-slate-350">
                            {tClip.durationSeconds.toFixed(1)}s
                          </span>

                          {/* Right Trim Handle */}
                          <div 
                            onMouseDown={(e) => handleClipMouseDown(e, tClip.id, 'trim-right')}
                            className="absolute right-0 top-0 bottom-0 w-2.5 bg-indigo-500/85 cursor-ew-resize opacity-0 group-hover/tclip:opacity-100 transition-opacity rounded-r-lg flex items-center justify-center hover:bg-indigo-400 z-10"
                          >
                            <div className="w-[1.5px] h-3 bg-white/60" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Track 3: AI Effects Track */}
              <div className="flex items-center space-x-3">
                <div className="w-28 text-[11px] font-bold text-slate-400 flex items-center space-x-1 flex-shrink-0 pr-2">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span>AI FX</span>
                </div>
                <div className="flex-1 h-10 bg-slate-900/30 border border-slate-800/40 rounded-xl relative overflow-hidden">
                  <div className="absolute left-[20%] w-[12%] h-full bg-indigo-500/10 border-l-2 border-indigo-400 flex items-center px-2">
                    <span className="text-[9px] text-indigo-300 font-semibold uppercase truncate">Smart-Cut</span>
                  </div>
                  <div className="absolute left-[62%] w-[15%] h-full bg-pink-500/10 border-l-2 border-pink-400 flex items-center px-2">
                    <span className="text-[9px] text-pink-300 font-semibold uppercase truncate">Doblaje</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Context Menu */}
        {contextMenu && (
          <div 
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 z-50 flex flex-col space-y-0.5 min-w-[120px] backdrop-blur-md"
          >
            <button 
              onClick={() => {
                duplicateTimelineClip(contextMenu.clipId);
                setContextMenu(null);
              }}
              className="w-full text-left text-xs text-slate-350 hover:text-white hover:bg-indigo-600 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Duplicar
            </button>
            <button 
              onClick={() => {
                handleDeleteClips([contextMenu.clipId]);
                setContextMenu(null);
              }}
              className="w-full text-left text-xs text-rose-400 hover:text-white hover:bg-rose-600 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        )}
      </footer>

      {/* Export Settings Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#020712] border border-slate-850 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center space-x-2">
              <Download className="h-4 w-4 text-[#6366f1]" />
              <span>Ajustes de Exportación Avanzados</span>
            </h3>
            
            <div className="space-y-4">
              {/* Resolution Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider">Resolución</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1080p', '4K', '720p'] as const).map(res => (
                    <button
                      key={res}
                      onClick={() => setExportResolution(res)}
                      className={`text-xs font-bold py-2 px-3 rounded-xl border transition-all cursor-pointer ${
                        exportResolution === res
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                          : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      {res === '1080p' ? '1080p (FHD)' : res === '4K' ? '4K (UHD)' : '720p (HD)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider">Formato</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['mp4', 'mov'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`text-xs font-bold py-2 px-3 rounded-xl border transition-all cursor-pointer capitalize ${
                        exportFormat === fmt
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                          : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider">Calidad (H.264 Rate)</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['high', 'medium', 'low'] as const).map(qual => (
                    <button
                      key={qual}
                      onClick={() => setExportQuality(qual)}
                      className={`text-xs font-bold py-2 px-3 rounded-xl border transition-all cursor-pointer ${
                        exportQuality === qual
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                          : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      {qual === 'high' ? 'Alta' : qual === 'medium' ? 'Media' : 'Baja'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-white px-4 py-2 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleExportClick}
                className="bg-indigo-650 hover:bg-[#6366f1] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-95"
              >
                Exportar Video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
