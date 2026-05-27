import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { 
  Play, Pause, FastForward, Rewind, Video, Volume2, VolumeX, Sparkles, 
  Scissors, Type, Languages, Download, Upload, Plus, 
  FolderOpen, Cpu, Trash2, Maximize, Copy, Clipboard, Crop, FlipHorizontal,
  Undo, Redo
} from 'lucide-react'
import './styles/globals.css'

interface Clip {
  id: string;
  name: string;
  duration: string;
  durationSeconds: number;
  type: 'video' | 'audio';
  path: string;
  size: string;
  url?: string;
}

interface TimelineClip {
  id: string;
  name: string;
  startSeconds: number;
  durationSeconds: number;
  type?: 'video' | 'audio';
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
}

function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState('00:00:15:22')
  const [mainProcessTime, setMainProcessTime] = useState<string>('Esperando...')
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  
  // State for imported files/clips
  const [clips, setClips] = useState<Clip[]>([])

  const [timelineVideoClips, setTimelineVideoClips] = useState<TimelineClip[]>([])

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Canvas Preview Active Video States
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)

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

  // Reset panOffset when zoom resets to 1
  useEffect(() => {
    if (zoom <= 1) {
      setPanOffset({ x: 0, y: 0 })
    }
  }, [zoom])

  // Player premium controls states
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [aspectRatio, setAspectRatio] = useState<'horizontal' | 'vertical' | 'square'>('horizontal')

  // Timeline interactive states
  const [selectedTimelineClipId, setSelectedTimelineClipId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null)

  const trackRef = React.useRef<HTMLDivElement>(null)

  // Refs to allow stable keyboard listener dependencies
  const timelineClipsRef = React.useRef<TimelineClip[]>([])
  const currentTimeSecondsRef = React.useRef(currentTimeSeconds)
  const selectedTimelineClipIdRef = React.useRef(selectedTimelineClipId)

  useEffect(() => {
    timelineClipsRef.current = timelineVideoClips
    currentTimeSecondsRef.current = currentTimeSeconds
    selectedTimelineClipIdRef.current = selectedTimelineClipId
  }, [timelineVideoClips, currentTimeSeconds, selectedTimelineClipId])

  // Undo/Redo history states
  const [history, setHistory] = useState<TimelineClip[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const historyRef = React.useRef(history)
  const historyIndexRef = React.useRef(historyIndex)

  useEffect(() => {
    historyRef.current = history
    historyIndexRef.current = historyIndex
  }, [history, historyIndex])

  // Initialize history stack with initial state
  useEffect(() => {
    if (history.length === 0) {
      setHistory([timelineVideoClips])
      setHistoryIndex(0)
    }
  }, [history.length])

  // Push new state to history stack
  const pushHistory = (newClips: TimelineClip[]) => {
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndexRef.current + 1)
      return [...nextHistory, newClips]
    })
    setHistoryIndex(prev => prev + 1)
  }

  // Undo & Redo Handlers
  const handleUndo = () => {
    const idx = historyIndexRef.current
    const hist = historyRef.current
    if (idx > 0) {
      const newIndex = idx - 1
      setHistoryIndex(newIndex)
      setTimelineVideoClips(hist[newIndex])
    }
  }

  const handleRedo = () => {
    const idx = historyIndexRef.current
    const hist = historyRef.current
    if (idx < hist.length - 1) {
      const newIndex = idx + 1
      setHistoryIndex(newIndex)
      setTimelineVideoClips(hist[newIndex])
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
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        videoRef.current.requestFullscreen().catch((err) => {
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

  // Scrubber dragging logic
  const handleScrubberSeek = (clientX: number, rect: DOMRect) => {
    const clickX = clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    const newTime = percent * durationSeconds
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
    setCurrentTimeSeconds(newTime)
  };

  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (durationSeconds <= 0) return
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
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
    setCurrentTimeSeconds(newTime)
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
    
    setSelectedTimelineClipId(clipId)
    
    // Find library clip and set active if needed
    const tClip = timelineVideoClips.find(c => c.id === clipId)
    if (tClip) {
      const matchingClip = clips.find(c => c.name === tClip.name)
      if (matchingClip && matchingClip.url && matchingClip.url !== activeVideoUrl) {
        setActiveVideoUrl(matchingClip.url)
        setIsPlaying(false)
      }
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
            const newStart = Math.min(initialStart + initialDuration - 1, Math.max(0, initialStart + deltaSeconds))
            const newDuration = initialStart + initialDuration - newStart
            return { ...c, startSeconds: newStart, durationSeconds: newDuration }
          } else { // trim-right
            const newDuration = Math.max(1, initialDuration + deltaSeconds)
            return { ...c, durationSeconds: newDuration }
          }
        })
      )
    }
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      pushHistory(timelineClipsRef.current)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Duplicate timeline clip
  const duplicateTimelineClip = (clipId: string) => {
    const clip = timelineVideoClips.find(c => c.id === clipId)
    if (!clip) return
    const newClip: TimelineClip = {
      id: `timeline-${Math.random()}`,
      name: `${clip.name} (Copy)`,
      startSeconds: clip.startSeconds + clip.durationSeconds + 1,
      durationSeconds: clip.durationSeconds,
      type: clip.type
    }
    const updated = [...timelineVideoClips, newClip]
    setTimelineVideoClips(updated)
    pushHistory(updated)
  }

  // Split clip at current playhead
  const handleSplit = () => {
    const targetTime = currentTimeSecondsRef.current
    const clips = timelineClipsRef.current
    const selectedId = selectedTimelineClipIdRef.current

    let clipToSplit = clips.find(c => c.id === selectedId)
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
      type: clipToSplit.type
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
    
    setTimelineVideoClips(updated)
    pushHistory(updated)
  }

  // Copy clip
  const handleCopyClip = () => {
    const clip = timelineVideoClips.find(c => c.id === selectedTimelineClipId)
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
      startSeconds: currentTimeSeconds,
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

  // Global Keyboard Shortcuts (Undo, Redo, Split, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
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

      // Delete / Backspace -> Delete Selected Clip
      if (key === 'delete' || key === 'backspace') {
        const selectedId = selectedTimelineClipIdRef.current
        if (selectedId) {
          e.preventDefault()
          const updated = timelineClipsRef.current.filter(c => c.id !== selectedId)
          setTimelineVideoClips(updated)
          setSelectedTimelineClipId(null)
          pushHistory(updated)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // Stable!

  // Reset selected clip if it is no longer present in clips
  useEffect(() => {
    if (selectedTimelineClipId && !timelineVideoClips.some(c => c.id === selectedTimelineClipId)) {
      setSelectedTimelineClipId(null);
    }
  }, [timelineVideoClips, selectedTimelineClipId]);

  // Handle right-click context menu
  const handleClipContextMenu = (e: React.MouseEvent, clipId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedTimelineClipId(clipId)
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
  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    setCurrentTimeSeconds(video.currentTime)
    
    const hrs = Math.floor(video.currentTime / 3600)
    const mins = Math.floor((video.currentTime % 3600) / 60)
    const secs = Math.floor(video.currentTime % 60)
    const frames = Math.floor((video.currentTime % 1) * 24) // mock 24 fps
    const pad = (num: number) => String(num).padStart(2, '0')
    setCurrentTime(`${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`)
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDurationSeconds(videoRef.current.duration || 0)
    }
  }

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDurationSeconds(videoRef.current.duration || 0)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
  }

  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)

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
  const [originalTranscriptText, setOriginalTranscriptText] = useState<string>('')
  const [aiScript, setAiScript] = useState<string>('')
  const [isRewriting, setIsRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState<string>('')
  const [isCopied, setIsCopied] = useState(false)

  // Resizable panel dimensions
  const [libraryWidth, setLibraryWidth] = useState(320)
  const [toolsWidth, setToolsWidth] = useState(320)
  const [timelineHeight, setTimelineHeight] = useState(256)

  // Voice settings states (ElevenLabs style)
  const [voiceModel, setVoiceModel] = useState('Eleven Multilingual v2')
  const [voiceSpeaker, setVoiceSpeaker] = useState('Clon de mi Voz (Voz del Video)')
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
    remotion: [],
    hyperframes: [],
    veo3: []
  })
  const [isCuttingClips, setIsCuttingClips] = useState(false)
  const [cuttingClipsError, setCuttingClipsError] = useState('')

  // Timeline IA weights: [Originales, Remotion, Hyperframes, Veo3]
  const [timelineWeights, setTimelineWeights] = useState<number[]>([40, 30, 20, 10])

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
          }
        } else if (data.status === 'error') {
          setIsTranscribing(false);
          setTranscriptionStatus(`Error: ${data.error}`);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Synchronize playing state with HTML5 Video element
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, activeVideoUrl]);

  // Removed old event listener useEffect in favor of direct HTML5 event bindings

  // Autoload project state on startup
  useEffect(() => {
    const autoLoadProject = async () => {
      try {
        const res = await window.electronAPI.loadProjectState();
        if (res && res.success && res.data) {
          const loadedData = res.data;
          
          const restoredClips = (loadedData.clips || []).map((c: any) => ({
            ...c,
            url: c.type === 'audio' ? c.url : undefined
          }));

          setClips(restoredClips);
          setTimelineVideoClips(loadedData.timelineVideoClips || []);
          setTranscriptionStatus(loadedData.transcriptionStatus || '');
          setTranscriptSegments(loadedData.transcriptSegments || []);
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
          
          console.log('Project state autoloaded successfully:', loadedData);
        }
      } catch (err) {
        console.error('Failed to autoload project state:', err);
      } finally {
        setTimeout(() => {
          hasLoaded.current = true;
        }, 1000); // 1s buffer for state updates to apply
      }
    };

    autoLoadProject();
  }, []);

  // CapCut-style debounced auto-save (triggers 2 seconds after any changes)
  useEffect(() => {
    if (!hasLoaded.current) return;

    const timer = setTimeout(() => {
      handleSaveProjectDirectly();
    }, 2000);

    return () => clearTimeout(timer);
  }, [clips, timelineVideoClips, transcriptionStatus, transcriptSegments, aiScript, originalTranscriptText, libraryWidth, toolsWidth, timelineHeight, voiceModel, voiceSpeaker, voiceSpeed, voiceStability, generatedVoices, timelineWeights]);

  // Save-on-close handler
  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.onSaveBeforeClose === 'function') {
      const unsubscribe = window.electronAPI.onSaveBeforeClose(async () => {
        const stateToSave = {
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
          transcriptionStatus,
          transcriptSegments,
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
  }, [clips, timelineVideoClips, transcriptionStatus, transcriptSegments, aiScript, originalTranscriptText, libraryWidth, toolsWidth, timelineHeight, voiceModel, voiceSpeaker, voiceSpeed, voiceStability, generatedVoices]);

  const handleSaveProjectDirectly = async (): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      const stateToSave = {
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
        transcriptionStatus,
        transcriptSegments,
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
        timelineWeights
      };

      const res = await window.electronAPI.saveProjectState(stateToSave);
      if (res && res.success) {
        setSaveStatus('saved');
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
        transcriptionStatus,
        transcriptSegments,
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
        timelineWeights
      };

      const res = await window.electronAPI.saveProjectAs(stateToSave);
      if (res && res.success) {
        setSaveStatus('saved');
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

  const handleOpenProject = async () => {
    try {
      const res = await window.electronAPI.openProject();
      if (res && res.success && res.data) {
        const loadedData = res.data;
        
        const restoredClips = (loadedData.clips || []).map((c: any) => ({
          ...c,
          url: c.type === 'audio' ? c.url : undefined
        }));

        setClips(restoredClips);
        setTimelineVideoClips(loadedData.timelineVideoClips || []);
        setTranscriptionStatus(loadedData.transcriptionStatus || '');
        setTranscriptSegments(loadedData.transcriptSegments || []);
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
        
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      }
    } catch (err) {
      console.error('Failed to open project:', err);
    }
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
        segments: transcriptSegments
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

  const handleWeightChange = (index: number, newValue: number) => {
    const updatedWeights = [...timelineWeights];
    updatedWeights[index] = newValue;

    const otherIndices = [0, 1, 2, 3].filter(i => i !== index);
    const sumOthers = otherIndices.reduce((sum, i) => sum + timelineWeights[i], 0);
    const targetOthers = 100 - newValue;

    if (sumOthers > 0) {
      otherIndices.forEach(i => {
        updatedWeights[i] = Math.round((timelineWeights[i] / sumOthers) * targetOthers);
      });
    } else {
      otherIndices.forEach(i => {
        updatedWeights[i] = Math.round(targetOthers / 3);
      });
    }

    // Adjust rounding errors to match exactly 100
    let currentSum = updatedWeights.reduce((sum, val) => sum + val, 0);
    if (currentSum !== 100) {
      const diff = 100 - currentSum;
      let bestIndex = otherIndices[0];
      let maxVal = updatedWeights[bestIndex];
      otherIndices.forEach(i => {
        if (updatedWeights[i] > maxVal) {
          maxVal = updatedWeights[i];
          bestIndex = i;
        }
      });
      updatedWeights[bestIndex] = Math.max(0, updatedWeights[bestIndex] + diff);
    }

    setTimelineWeights(updatedWeights);
  };

  const handleBuildIATimeline = async () => {
    if (!aiScript.trim()) return;
    const paragraphs = aiScript.split('\n\n').map(p => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) return;

    // Refresh bank clips before mounting
    await loadClipsForCategory('originales');
    await loadClipsForCategory('stock');
    await loadClipsForCategory('remotion');
    await loadClipsForCategory('hyperframes');
    await loadClipsForCategory('veo3');

    const [wOrig, wRemo, wHyper, wVeo] = timelineWeights;
    const N = paragraphs.length;
    
    // Distribute counts based on percentage weights
    const counts = [
      Math.round(N * (wOrig / 100)),
      Math.round(N * (wRemo / 100)),
      Math.round(N * (wHyper / 100)),
      Math.round(N * (wVeo / 100))
    ];

    // Align sum of counts to match paragraphs count N
    let totalSum = counts.reduce((s, c) => s + c, 0);
    while (totalSum !== N) {
      if (totalSum < N) {
        const maxWeightIdx = timelineWeights.indexOf(Math.max(...timelineWeights));
        counts[maxWeightIdx]++;
      } else {
        let maxCountIdx = 0;
        for (let i = 1; i < 4; i++) {
          if (counts[i] > counts[maxCountIdx] && counts[i] > 0) {
            maxCountIdx = i;
          }
        }
        counts[maxCountIdx]--;
      }
      totalSum = counts.reduce((s, c) => s + c, 0);
    }

    // Interleaved category pool
    const categoryPool: string[] = [];
    const categoryNames = ['originales', 'remotion', 'hyperframes', 'veo3'];
    const tempCounts = [...counts];
    while (categoryPool.length < N) {
      let added = false;
      for (let cIdx = 0; cIdx < 4; cIdx++) {
        if (tempCounts[cIdx] > 0) {
          categoryPool.push(categoryNames[cIdx]);
          tempCounts[cIdx]--;
          added = true;
        }
      }
      if (!added) break;
    }

    // Arrange clips on the timeline
    const newTimelineClips: any[] = [];
    let currentStartSeconds = 0;

    for (let i = 0; i < N; i++) {
      const paragraphText = paragraphs[i];
      const category = categoryPool[i] || 'originales';
      let categoryClips = bankClips[category] || [];

      if (categoryClips.length === 0) {
        // Fallback choices
        categoryClips = bankClips['originales'] || [];
        if (categoryClips.length === 0) {
          categoryClips = bankClips['stock'] || bankClips['remotion'] || [];
        }
      }

      let selectedClip: any = null;
      if (categoryClips.length > 0) {
        // Smart match by keywords
        const words = paragraphText.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        selectedClip = categoryClips.find(clip => {
          const clipNameLower = clip.name.toLowerCase();
          return words.some(w => clipNameLower.includes(w));
        });

        if (!selectedClip) {
          // Fallback sequential
          selectedClip = categoryClips[i % categoryClips.length];
        }
      }

      if (selectedClip) {
        newTimelineClips.push({
          id: `timeline-${Math.random()}`,
          name: `${selectedClip.name} (${category})`,
          startSeconds: currentStartSeconds,
          durationSeconds: selectedClip.durationSeconds,
          type: 'video',
          url: selectedClip.url,
          path: selectedClip.path
        });
        currentStartSeconds += selectedClip.durationSeconds;
      } else {
        // Placeholder
        const placeholderDuration = 4;
        newTimelineClips.push({
          id: `timeline-${Math.random()}`,
          name: `[Placeholder ${category.toUpperCase()}] - Clip vacío`,
          startSeconds: currentStartSeconds,
          durationSeconds: placeholderDuration,
          type: 'video'
        });
        currentStartSeconds += placeholderDuration;
      }
    }

    setTimelineVideoClips(newTimelineClips);
    pushHistory(newTimelineClips);
    setSelectedTool(null); // return to AI tools index
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
        speaker: voiceSpeaker,
        speed: voiceSpeed,
        stability: voiceStability
      })
      
      if (res && res.success && res.filePath && res.audioUrl) {
        console.log('Audio generado con éxito y guardado en:', res.filePath)
        
        // Estimate duration based on text: 2.5 words per second
        const wordCount = aiScript.split(/\s+/).filter(Boolean).length
        const durationSecs = Math.max(2, Math.ceil(wordCount / 2.5))

        const newVersion: GeneratedVoiceVersion = {
          id: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          speaker: voiceSpeaker,
          model: voiceModel,
          speed: voiceSpeed,
          stability: voiceStability,
          text: aiScript,
          filePath: res.filePath,
          audioUrl: res.audioUrl
        }
        
        setGeneratedVoices(prev => [newVersion, ...prev])

        // Add to media library clips
        const libraryClip: Clip = {
          id: newVersion.id,
          name: `Voz - ${voiceSpeaker} (${new Date(newVersion.timestamp).toLocaleTimeString()})`,
          duration: formatTimeMinutesSeconds(durationSecs),
          durationSeconds: durationSecs,
          type: 'audio',
          path: res.filePath,
          url: res.audioUrl,
          size: '128 KB'
        }
        setClips(prev => [...prev, libraryClip])
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
    // Estimate duration
    const wordCount = voice.text.split(/\s+/).filter(Boolean).length
    const durationSecs = Math.max(2, Math.ceil(wordCount / 2.5))

    const newTimelineClip: TimelineClip = {
      id: `timeline-voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Voz - ${voice.speaker}`,
      startSeconds: currentTimeSeconds,
      durationSeconds: durationSecs,
      type: 'audio'
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

  // Dynamic total timeline duration (minimum 120 seconds, or max clip end + 10s buffer)
  const totalDuration = Math.max(120, timelineVideoClips.reduce((max, c) => Math.max(max, c.startSeconds + c.durationSeconds), 0) + 10);

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
          path: file.path || file.name,
          size: formatSize(file.size),
          url: url
        };

        setClips(prev => [newClip, ...prev]);

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
            type: 'video' as const
          }];
          setTimelineVideoClips(updated);
          pushHistory(updated);
        }
      };
    });
  };

  const addClipToTimeline = (clip: Clip) => {
    const lastClip = timelineVideoClips[timelineVideoClips.length - 1];
    const startSeconds = lastClip ? (lastClip.startSeconds + lastClip.durationSeconds + 2) : 0;
    const updated = [...timelineVideoClips, {
      id: `timeline-${Math.random()}`,
      name: clip.name,
      startSeconds,
      durationSeconds: clip.durationSeconds,
      type: clip.type
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
 
          <button className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
            <Download className="h-3.5 w-3.5" />
            <span>Exportar</span>
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
            {['Principal', 'Originales', 'Stock', 'Remotion', 'Hyperframes'].map(tab => (
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
              const currentClips = libraryTab === 'Principal' 
                ? clips 
                : (bankClips[libraryTab.toLowerCase()] || []);
              
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
                    {libraryTab === 'Principal' && clip.type !== 'video' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setClips(prev => prev.filter(c => c.id !== clip.id));
                          // Also filter out of the timeline track
                          setTimelineVideoClips(prev => prev.filter(t => t.name !== clip.name));
                        }}
                        className="p-1 bg-slate-950/85 border border-slate-800 hover:border-red-500/50 hover:text-red-400 rounded-md text-slate-400"
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
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden flex items-center justify-center group shadow-inner">
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
                  ref={videoRef}
                  src={activeVideoUrl}
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) ${isMirrored ? 'scaleX(-1)' : 'scaleX(1)'}`,
                    clipPath: activeCrop 
                      ? `inset(${activeCrop.top}% ${activeCrop.right}% ${activeCrop.bottom}% ${activeCrop.left}%)` 
                      : 'none',
                  }}
                  className="w-full h-full object-contain select-none pointer-events-none transition-transform duration-75 ease-out"
                  controls={false}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onDurationChange={handleDurationChange}
                  onEnded={handleEnded}
                  onPlay={handlePlay}
                  onPause={handlePause}
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
              <span className="text-[10px] font-mono text-slate-400 select-none w-10 text-right">
                {formatTimeMinutesSeconds(currentTimeSeconds)}
              </span>
              <div 
                onMouseDown={handleScrubberMouseDown}
                className="flex-1 h-2 bg-slate-800 rounded-full relative cursor-pointer group/scrub"
              >
                <div 
                  style={{ width: `${durationSeconds > 0 ? (currentTimeSeconds / durationSeconds) * 100 : 0}%` }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full absolute top-0 left-0"
                />
                <div 
                  style={{ left: `${durationSeconds > 0 ? (currentTimeSeconds / durationSeconds) * 100 : 0}%` }}
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
              <div className="text-base font-mono tracking-wider font-semibold text-slate-100 bg-slate-950/40 px-3 py-1 rounded-lg border border-slate-800/60">
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

                {/* Format Aspect Ratio Selector */}
                <div className="flex items-center space-x-1 bg-slate-950 p-0.5 border border-slate-800 rounded-lg">
                  <button 
                    onClick={() => setAspectRatio('horizontal')}
                    className={`px-2 py-1 text-[10px] rounded font-semibold transition-all ${
                      aspectRatio === 'horizontal' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Horizontal (16:9)"
                  >
                    16:9
                  </button>
                  <button 
                    onClick={() => setAspectRatio('vertical')}
                    className={`px-2 py-1 text-[10px] rounded font-semibold transition-all ${
                      aspectRatio === 'vertical' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Vertical (9:16)"
                  >
                    9:16
                  </button>
                  <button 
                    onClick={() => setAspectRatio('square')}
                    className={`px-2 py-1 text-[10px] rounded font-semibold transition-all ${
                      aspectRatio === 'square' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Cuadrado (1:1)"
                  >
                    1:1
                  </button>
                </div>

                {/* Fullscreen Button */}
                <button 
                  onClick={toggleFullscreen}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                  title="Pantalla Completa"
                >
                  <Maximize className="h-4 w-4" />
                </button>
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
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase font-sans">Clon o Locutor</label>
                          <select 
                            value={voiceSpeaker}
                            onChange={(e) => setVoiceSpeaker(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-805 text-xs rounded-lg p-2 text-slate-350 outline-none focus:border-indigo-500/50 cursor-pointer"
                          >
                            <option value="Clon de mi Voz (Voz del Video)">Clon de mi Voz (Voz del Video)</option>
                            <option value="Narrador Neutro - Alejandro">Narrador Neutro - Alejandro</option>
                            <option value="Narradora Cercana - Sofía">Narradora Cercana - Sofía</option>
                            <option value="Voz Enigmática - Damián">Voz Enigmática - Damián</option>
                          </select>
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
                      <div className="bg-slate-900/90 border border-slate-805 rounded-xl p-3.5 flex flex-col space-y-4 shadow-xl">
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">Proporciones del Timeline IA</h4>
                          <p className="text-[10px] text-slate-400 mt-1">Ajusta la composición de clips para el montaje automático. El total siempre sumará 100%.</p>
                        </div>

                        {/* Slider 1: Originales */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase font-sans">
                            <span>Clips Originales</span>
                            <span className="font-mono text-indigo-400 font-bold">{timelineWeights[0]}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={timelineWeights[0]}
                            onChange={(e) => handleWeightChange(0, parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none" 
                            style={{
                              background: `linear-gradient(to right, rgb(99, 102, 241) ${timelineWeights[0]}%, rgb(30, 41, 59) 0%)`
                            }}
                          />
                        </div>

                        {/* Slider 2: Remotion */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase font-sans">
                            <span>Clips de Remotion</span>
                            <span className="font-mono text-indigo-400 font-bold">{timelineWeights[1]}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={timelineWeights[1]}
                            onChange={(e) => handleWeightChange(1, parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none" 
                            style={{
                              background: `linear-gradient(to right, rgb(99, 102, 241) ${timelineWeights[1]}%, rgb(30, 41, 59) 0%)`
                            }}
                          />
                        </div>

                        {/* Slider 3: Hyperframes */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase font-sans">
                            <span>Clips de Hyperframes</span>
                            <span className="font-mono text-indigo-400 font-bold">{timelineWeights[2]}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={timelineWeights[2]}
                            onChange={(e) => handleWeightChange(2, parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none" 
                            style={{
                              background: `linear-gradient(to right, rgb(99, 102, 241) ${timelineWeights[2]}%, rgb(30, 41, 59) 0%)`
                            }}
                          />
                        </div>

                        {/* Slider 4: Veo 3 */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase font-sans">
                            <span>Clips de Veo 3</span>
                            <span className="font-mono text-indigo-400 font-bold">{timelineWeights[3]}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={timelineWeights[3]}
                            onChange={(e) => handleWeightChange(3, parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all outline-none" 
                            style={{
                              background: `linear-gradient(to right, rgb(99, 102, 241) ${timelineWeights[3]}%, rgb(30, 41, 59) 0%)`
                            }}
                          />
                        </div>
                      </div>

                      {/* Build Timeline IA Button */}
                      <button 
                        onClick={handleBuildIATimeline}
                        disabled={!aiScript.trim()}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-650 hover:from-indigo-500 hover:to-violet-550 text-white text-xs py-2.5 px-3 rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-indigo-600/10 cursor-pointer flex items-center justify-center space-x-2 border border-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-250 animate-pulse" />
                        <span>Construir Timeline IA</span>
                      </button>

                      {!aiScript.trim() && (
                        <div className="text-center py-2 text-[10px] text-slate-500 italic leading-relaxed">
                          * Genera o reescribe un guión en el panel de transcripción antes de construir el Timeline IA.
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
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                historyIndex > 0 
                  ? 'text-slate-300 hover:text-indigo-400 cursor-pointer' 
                  : 'text-slate-650 cursor-not-allowed'
              }`}
              title="Deshacer (Ctrl+Z)"
            >
              <Undo className="h-3.5 w-3.5" />
            </button>

            {/* Redo */}
            <button 
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                historyIndex < history.length - 1 
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
              disabled={!selectedTimelineClipId}
              onClick={handleCopyClip}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                selectedTimelineClipId 
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
              disabled={!selectedTimelineClipId}
              onClick={() => {
                if (selectedTimelineClipId) duplicateTimelineClip(selectedTimelineClipId)
              }}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                selectedTimelineClipId 
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
              disabled={!selectedTimelineClipId}
              onClick={() => {
                if (selectedTimelineClipId) {
                  const updated = timelineVideoClips.filter(c => c.id !== selectedTimelineClipId)
                  setTimelineVideoClips(updated)
                  setSelectedTimelineClipId(null)
                  pushHistory(updated)
                }
              }}
              className={`flex items-center space-x-1 transition-all active:scale-95 ${
                selectedTimelineClipId 
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
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[10px] text-slate-500">Escala de Tiempo: 1s</span>
          </div>
        </div>

        {/* Tracks area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/40 relative">
          <div className="relative min-w-[800px]">
            {/* Timeline Ruler */}
            <div className="flex items-center space-x-3 mb-2 select-none">
              <div className="w-20 flex-shrink-0" />
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
              {/* Vertical Playhead Play Line */}
              {(() => {
                const playheadPercent = durationSeconds > 0 ? (currentTimeSeconds / totalDuration) * 100 : 0;
                return (
                  <div 
                    style={{ left: `calc(5rem + 12px + ${playheadPercent}%)` }} 
                    className="absolute top-0 bottom-0 w-[2px] bg-indigo-500 z-30 pointer-events-none shadow-[0_0_10px_#6366f1]"
                  >
                    <div className="w-3 h-3 bg-indigo-500 rounded-full -ml-[5px] -mt-[4px] border border-white shadow-lg" />
                  </div>
                );
              })()}

              {/* Track 1: Video Track */}
              <div className="flex items-center space-x-3">
                <div className="w-20 text-[11px] font-bold text-slate-400 flex items-center space-x-1 flex-shrink-0">
                  <Video className="h-3 w-3 text-sky-400" />
                  <span>Video v1</span>
                </div>
                <div className="flex-1 h-12 bg-slate-900/60 border border-slate-800/80 rounded-xl relative overflow-hidden">
                  {timelineVideoClips.filter(tClip => tClip.type !== 'audio').length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-600 font-medium">Arrastra o añade videos aquí</span>
                    </div>
                  )}
                  {timelineVideoClips
                    .filter(tClip => tClip.type !== 'audio')
                    .map((tClip, index) => {
                      const leftPercent = (tClip.startSeconds / totalDuration) * 100;
                      const widthPercent = (tClip.durationSeconds / totalDuration) * 100;
                      const bgClass = index % 2 === 0 
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 hover:bg-sky-500/30' 
                        : 'bg-violet-500/20 border-violet-400/50 text-violet-300 hover:bg-violet-500/30';
                      
                      return (
                        <div 
                          key={tClip.id}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          onMouseDown={(e) => handleClipMouseDown(e, tClip.id, 'move')}
                          onContextMenu={(e) => handleClipContextMenu(e, tClip.id)}
                          className={`absolute h-full border rounded-lg flex items-center px-3 justify-between group/tclip cursor-move transition-shadow ${
                            selectedTimelineClipId === tClip.id 
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

              {/* Track 2: Audio Track */}
              <div className="flex items-center space-x-3">
                <div className="w-20 text-[11px] font-bold text-slate-400 flex items-center space-x-1 flex-shrink-0">
                  <Volume2 className="h-3 w-3 text-emerald-400" />
                  <span>Audio a1</span>
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
                            selectedTimelineClipId === tClip.id 
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
                <div className="w-20 text-[11px] font-bold text-slate-400 flex items-center space-x-1 flex-shrink-0">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
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
                const updated = timelineVideoClips.filter(c => c.id !== contextMenu.clipId)
                setTimelineVideoClips(updated)
                if (selectedTimelineClipId === contextMenu.clipId) {
                  setSelectedTimelineClipId(null)
                }
                setContextMenu(null)
                pushHistory(updated)
              }}
              className="w-full text-left text-xs text-rose-400 hover:text-white hover:bg-rose-600 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
