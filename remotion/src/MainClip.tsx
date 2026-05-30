import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export interface ChartDataItem {
  label: string;
  value: number;
}

export interface MainClipProps {
  text?: string;
  title?: string;
  chartType?: 'bar' | 'line' | 'kpi' | 'none';
  data?: ChartDataItem[];
  metricValue?: string;
  metricLabel?: string;
  backgroundType?: 'neural' | 'mesh' | 'binary' | 'nodes' | 'map' | 'figure';
  sceneTheme?: 'memory' | 'action' | 'data' | 'society' | 'technology' | 'geography';
  figureAnimation?: 'consumo' | 'poder' | 'urgencia' | 'caida' | 'sociedad' | 'mundo' | 'empoderamiento' | 'psicologia' | 'trabajo' | 'revelacion' | 'none';
  numberData?: number;
  unitData?: string;
  percentageData?: number;
  isNegative?: boolean;
  aspectRatio?: '16:9' | '9:16';
}

export const defaultProps: MainClipProps = {
  backgroundType: 'neural',
  sceneTheme: 'memory',
  figureAnimation: 'none',
  aspectRatio: '16:9'
};

// HELPER COMPONENTS FOR DRAW-STYLE STROKE-DASH-OFFSET ANIMATIONS
interface DrawLineProps extends React.SVGProps<SVGLineElement> {
  frame: number;
  startFrame?: number;
  duration?: number;
}
const DrawLine: React.FC<DrawLineProps> = ({ frame, startFrame = 0, duration = 30, x1 = 0, y1 = 0, x2 = 0, y2 = 0, ...props }) => {
  const nx1 = Number(x1);
  const ny1 = Number(y1);
  const nx2 = Number(x2);
  const ny2 = Number(y2);
  const length = Math.sqrt((nx2 - nx1) ** 2 + (ny2 - ny1) ** 2) || 1;
  
  const progress = interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      strokeDasharray={length}
      strokeDashoffset={length * progress}
      {...props}
    />
  );
};

interface DrawPathProps extends React.SVGProps<SVGPathElement> {
  frame: number;
  startFrame?: number;
  duration?: number;
  pathLengthEstimate?: number;
}
const DrawPath: React.FC<DrawPathProps> = ({ frame, startFrame = 0, duration = 35, pathLengthEstimate = 1200, ...props }) => {
  const progress = interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  return (
    <path
      strokeDasharray={pathLengthEstimate}
      strokeDashoffset={pathLengthEstimate * progress}
      {...props}
    />
  );
};

interface DrawCircleProps extends React.SVGProps<SVGCircleElement> {
  frame: number;
  startFrame?: number;
  duration?: number;
  r: number;
}
const DrawCircle: React.FC<DrawCircleProps> = ({ frame, startFrame = 0, duration = 30, r, ...props }) => {
  const length = 2 * Math.PI * r;
  const progress = interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  return (
    <circle
      r={r}
      strokeDasharray={length}
      strokeDashoffset={length * progress}
      {...props}
    />
  );
};

// Procedural brain nodes generator
const generateBrainNodes = () => {
  const pts: { x: number; y: number; originalX: number; originalY: number; size: number; phase: number }[] = [];
  
  // Left cerebrum lobe (80 particles)
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const isOutline = i < 30;
    const sulcus = isOutline ? (12 * Math.sin(6 * angle) + 6 * Math.cos(12 * angle)) : 0;
    const r = isOutline ? (130 + sulcus) : (Math.sqrt(Math.random()) * 110);
    const a = isOutline ? angle : Math.random() * Math.PI * 2;
    const x = 440 + Math.cos(a) * r * 1.15;
    const y = 390 + Math.sin(a) * r * 0.95;
    pts.push({ x, y, originalX: x, originalY: y, size: 1.5 + Math.random() * 3, phase: Math.random() * 100 });
  }
  
  // Right cerebrum lobe (80 particles)
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const isOutline = i < 30;
    const sulcus = isOutline ? (12 * Math.sin(6 * angle) + 6 * Math.cos(12 * angle)) : 0;
    const r = isOutline ? (130 + sulcus) : (Math.sqrt(Math.random()) * 110);
    const a = isOutline ? angle : Math.random() * Math.PI * 2;
    const x = 560 + Math.cos(a) * r * 1.15;
    const y = 390 + Math.sin(a) * r * 0.95;
    pts.push({ x, y, originalX: x, originalY: y, size: 1.5 + Math.random() * 3, phase: Math.random() * 100 });
  }

  // Cerebellum (40 particles)
  for (let i = 0; i < 40; i++) {
    const isLeft = i % 2 === 0;
    const centerX = isLeft ? 430 : 570;
    const centerY = 520;
    const angle = Math.random() * Math.PI * 2;
    const sulcus = 6 * Math.sin(6 * angle);
    const r = (30 + Math.random() * 40) + sulcus;
    const x = centerX + Math.cos(angle) * r * 1.1;
    const y = centerY + Math.sin(angle) * r * 0.75;
    pts.push({ x, y, originalX: x, originalY: y, size: 1.5 + Math.random() * 3, phase: Math.random() * 100 });
  }

  // Brain stem (30 particles)
  for (let i = 0; i < 30; i++) {
    const t = Math.random();
    const y = 540 + t * 130;
    const widthAtY = 32 - t * 14;
    const x = 500 + (Math.random() - 0.5) * widthAtY;
    pts.push({ x, y, originalX: x, originalY: y, size: 1.5 + Math.random() * 2.5, phase: Math.random() * 100 });
  }

  return pts;
};

// 1. NEURAL BACKGROUND (Procedural brain outline - line by line with light pulses)
const NeuralBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const brainNodes = useMemo(() => generateBrainNodes(), []);
  
  const nodes = brainNodes.map((n) => {
    const waveX = Math.sin(frame * 0.05 + n.phase) * 3;
    const waveY = Math.cos(frame * 0.04 + n.phase) * 3;
    return {
      ...n,
      x: n.originalX + waveX,
      y: n.originalY + waveY
    };
  });

  const connections = useMemo(() => {
    const linesArr: [number, number][] = [];
    for (let i = 0; i < brainNodes.length; i++) {
      let count = 0;
      for (let j = i + 1; j < brainNodes.length; j++) {
        const dx = brainNodes[i].x - brainNodes[j].x;
        const dy = brainNodes[i].y - brainNodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 65) {
          linesArr.push([i, j]);
          count++;
          if (count > 2) break;
        }
      }
    }
    return linesArr;
  }, [brainNodes]);

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} viewBox="0 0 1000 1000">
      <defs>
        <radialGradient id="neuralBgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.1" />
          <stop offset="80%" stopColor="#020712" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="500" cy="450" r="450" fill="url(#neuralBgGlow)" />

      {/* Draw connections line-by-line using strokeDashoffset */}
      {connections.map(([a, b], idx) => {
        const startDraw = (idx % 25) * 1.2;
        return (
          <DrawLine
            key={`l-${idx}`}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            frame={frame}
            startFrame={startDraw}
            duration={25}
            stroke="#6366f1"
            strokeWidth={0.9}
            strokeOpacity={0.25}
          />
        );
      })}

      {/* Light pulses traveling along connections */}
      {connections.map(([a, b], idx) => {
        const startDraw = (idx % 25) * 1.2;
        const pulseStart = startDraw + 25;
        if (frame < pulseStart) return null;
        
        const t = ((frame - pulseStart) * 0.04) % 1.0;
        const cx = nodes[a].x + (nodes[b].x - nodes[a].x) * t;
        const cy = nodes[a].y + (nodes[b].y - nodes[a].y) * t;

        return (
          <circle
            key={`p-${idx}`}
            cx={cx}
            cy={cy}
            r={3.0}
            fill="#00d4ff"
            style={{ filter: 'drop-shadow(0 0 5px #00d4ff)' }}
          />
        );
      })}

      {/* Nodes pop-in */}
      {nodes.map((node, idx) => {
        const isPulse = idx % 8 === 0;
        const popFrame = (idx % 25) * 1.2 + 20;
        if (frame < popFrame) return null;
        
        const s = interpolate(frame, [popFrame, popFrame + 10], [0, 1], { extrapolateRight: 'clamp' });
        return (
          <circle
            key={`n-${idx}`}
            cx={node.x}
            cy={node.y}
            r={node.size * s * (isPulse ? 1.5 : 1)}
            fill={isPulse ? '#f472b6' : '#6366f1'}
            opacity={0.8}
            style={{ filter: isPulse ? 'drop-shadow(0 0 4px #f472b6)' : 'none' }}
          />
        );
      })}
    </svg>
  );
};

// 2. WAVY MESH BACKGROUND (Perspective 3D undulating grid - orderly ripples drawing)
const MeshBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const columns = 18;
  const rows = 18;
  const spacing = 65;
  const points: { px: number; py: number; color: string }[] = [];

  const startX = 500 - ((columns - 1) * spacing) / 2;
  const startY = 450 - ((rows - 1) * spacing) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const gridX = startX + c * spacing;
      const gridZ = startY + r * spacing;

      const waveHeight = Math.sin((r + c) * 0.25 - frame * 0.12) * 45;

      const cameraY = -400;
      const cameraZ = -700;
      const relativeZ = gridZ - cameraZ;
      const perspective = 800 / (800 + relativeZ);

      let color = '#6366f1';
      if ((r + c) % 8 === 0) color = '#00d4ff';
      else if ((r + c) % 5 === 0) color = '#f472b6';
      else if ((r + c) % 6 === 0) color = '#fbbf24';

      points.push({
        px: 500 + (gridX - 500) * perspective,
        py: 450 + (waveHeight - cameraY) * perspective,
        color
      });
    }
  }

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} viewBox="0 0 1000 1000">
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: columns }).map((_, c) => {
          const idx = r * columns + c;
          const rightLine = c < columns - 1 ? (
            <DrawLine
              key={`mh-${r}-${c}`}
              x1={points[idx].px}
              y1={points[idx].py}
              x2={points[idx + 1].px}
              y2={points[idx + 1].py}
              frame={frame}
              startFrame={r * 2}
              duration={20}
              stroke="#6366f1"
              strokeWidth={0.8}
              strokeOpacity={0.2}
            />
          ) : null;

          const bottomLine = r < rows - 1 ? (
            <DrawLine
              key={`mv-${r}-${c}`}
              x1={points[idx].px}
              y1={points[idx].py}
              x2={points[idx + columns].px}
              y2={points[idx + columns].py}
              frame={frame}
              startFrame={c * 2}
              duration={20}
              stroke="#f472b6"
              strokeWidth={0.8}
              strokeOpacity={0.2}
            />
          ) : null;

          return (
            <g key={`m-${r}-${c}`}>
              {rightLine}
              {bottomLine}
            </g>
          );
        })
      )}

      {points.map((pt, idx) => {
        if (idx % 3 !== 0) return null;
        const popFrame = (idx % 18) * 2;
        if (frame < popFrame) return null;
        return <circle key={`mp-${idx}`} cx={pt.px} cy={pt.py} r={2.0} fill={pt.color} opacity={0.65} />;
      })}
    </svg>
  );
};

// 3. BINARY FLOW BACKGROUND (Falling columns of vertical neon lines)
const BinaryBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const columnCount = 24;
  const cols = useMemo(() => {
    return Array.from({ length: columnCount }).map((_, i) => {
      const x = (1000 / columnCount) * (i + 0.5);
      const speed = 14 + (i % 6) * 4;
      const length = 10 + (i % 5) * 2;
      const color = i % 3 === 0 ? '#00d4ff' : i % 3 === 1 ? '#f472b6' : '#fbbf24';
      return { x, speed, length, color };
    });
  }, []);

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} viewBox="0 0 1000 1000">
      {cols.map((col, cIdx) => {
        const leadY = ((frame * col.speed) % 1500) - 250;
        return (
          <g key={`bc-${cIdx}`}>
            {Array.from({ length: col.length }).map((_, charIdx) => {
              const charY = leadY - charIdx * 35;
              if (charY < -50 || charY > 1050) return null;
              const opacity = Math.max(0, 1 - charIdx / col.length) * 0.5;
              const height = 24 - (charIdx * 0.8);
              return (
                <line
                  key={`bt-${charIdx}`}
                  x1={col.x}
                  y1={charY}
                  x2={col.x}
                  y2={charY + Math.max(5, height)}
                  stroke={col.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  opacity={opacity}
                  style={{ filter: opacity > 0.2 ? `drop-shadow(0 0 5px ${col.color})` : 'none' }}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

// 4. NODES BACKGROUND (3D rotating sphere drawn meridiano por meridiano)
const NodesBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const points = useMemo(() => {
    const pts: { x: number; y: number; z: number; color: string; latIdx: number; lonIdx: number }[] = [];
    const numLatitudes = 8;
    const numLongitudes = 16;
    const radius = 250;
    
    for (let i = 0; i <= numLatitudes; i++) {
      const phi = (i / numLatitudes) * Math.PI; 
      for (let j = 0; j < numLongitudes; j++) {
        const theta = (j / numLongitudes) * 2 * Math.PI;
        const x = Math.sin(phi) * Math.cos(theta) * radius;
        const y = Math.sin(phi) * Math.sin(theta) * radius;
        const z = Math.cos(phi) * radius;
        
        const color = i % 2 === 0 ? '#00d4ff' : '#6366f1';
        pts.push({ x, y, z, color, latIdx: i, lonIdx: j });
      }
    }
    return pts;
  }, []);

  const angle = frame * 0.015;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const projected = points.map(p => {
    const x1 = p.x * cosA - p.z * sinA;
    const z1 = p.x * sinA + p.z * cosA;
    const y2 = p.y * cosA - z1 * sinA;
    const z2 = p.y * sinA + z1 * cosA;

    const perspective = 800 / (800 + z2);
    return {
      px: 500 + x1 * perspective,
      py: 450 + y2 * perspective,
      z: z2,
      color: p.color,
      latIdx: p.latIdx,
      lonIdx: p.lonIdx
    };
  });

  const numLatitudes = 8;
  const numLongitudes = 16;
  const lines: React.ReactNode[] = [];

  for (let i = 0; i <= numLatitudes; i++) {
    for (let j = 0; j < numLongitudes; j++) {
      const currIdx = i * numLongitudes + j;
      const nextLonIdx = (j + 1) % numLongitudes;
      const nextLonProjIdx = i * numLongitudes + nextLonIdx;
      
      if (i < numLatitudes) {
        const nextLatProjIdx = (i + 1) * numLongitudes + j;
        const p1 = projected[currIdx];
        const p2 = projected[nextLatProjIdx];
        const avgZ = (p1.z + p2.z) / 2;
        const opacity = Math.max(0.04, 0.3 - avgZ / 500);
        
        // Meridian lines draw based on longitude index
        const startDraw = j * 3;
        lines.push(
          <DrawLine
            key={`mv-${i}-${j}`}
            x1={p1.px}
            y1={p1.py}
            x2={p2.px}
            y2={p2.py}
            frame={frame}
            startFrame={startDraw}
            duration={20}
            stroke="#6366f1"
            strokeWidth={0.8}
            strokeOpacity={opacity}
          />
        );
      }
      
      const p1 = projected[currIdx];
      const p2 = projected[nextLonProjIdx];
      const avgZ = (p1.z + p2.z) / 2;
      const opacity = Math.max(0.04, 0.3 - avgZ / 500);
      
      // Parallel lines draw based on latitude index
      const startDraw = i * 5;
      lines.push(
        <DrawLine
          key={`mh-${i}-${j}`}
          x1={p1.px}
          y1={p1.py}
          x2={p2.px}
          y2={p2.py}
          frame={frame}
          startFrame={startDraw}
          duration={20}
          stroke="#00d4ff"
          strokeWidth={0.8}
          strokeOpacity={opacity}
        />
      );
    }
  }

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} viewBox="0 0 1000 1000">
      {lines}
      {projected.map((pt, idx) => {
        const popFrame = pt.latIdx * 5 + pt.lonIdx * 2;
        if (frame < popFrame) return null;
        const opacity = Math.max(0.1, 0.6 - pt.z / 500);
        return (
          <circle
            key={`nod-${idx}`}
            cx={pt.px}
            cy={pt.py}
            r={3.0}
            fill={pt.color}
            opacity={opacity}
            style={{ filter: pt.color === '#00d4ff' ? 'drop-shadow(0 0 4px #00d4ff)' : 'none' }}
          />
        );
      })}
    </svg>
  );
};

// 5. MAP BACKGROUND (Stylized world map dots grid)
const MapBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const lineProgress = (frame * 5) % 900;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} viewBox="0 0 1000 1000" opacity={0.25}>
      <defs>
        <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1.5" fill="#6366f1" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="1000" height="1000" fill="url(#mapGrid)" />
      <DrawLine x1={50} y1={50 + lineProgress} x2={950} y2={50 + lineProgress} frame={frame} startFrame={0} duration={80} stroke="#00d4ff" strokeWidth="1.5" strokeOpacity="0.5" />
    </svg>
  );
};

// 6. FIGURE BACKGROUND (Stick figure golden animation - builds piece by piece)
const FigureBackgroundComp: React.FC<{ frame: number }> = ({ frame }) => {
  const particles = useMemo(() => {
    const pts: { x: number; y: number; speed: number; size: number; phase: number }[] = [];
    for (let i = 0; i < 110; i++) {
      pts.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        speed: 1.5 + Math.random() * 3,
        size: 2 + Math.random() * 4,
        phase: Math.random() * 100
      });
    }
    return pts;
  }, []);

  const swing = frame >= 50 ? (frame - 50) * 0.2 : 0;
  const bounce = frame >= 50 ? Math.abs(Math.sin(swing * 2)) * 12 : 0;

  // Moving joints after build completes (frame >= 50)
  const leftArmEnd = { x: -65, y: -120 + (frame >= 50 ? Math.sin(swing) * 40 : 0) };
  const leftForearmEnd = { x: -110, y: -160 + (frame >= 50 ? Math.cos(swing) * 35 : 0) };
  const rightArmEnd = { x: 65, y: -120 - (frame >= 50 ? Math.sin(swing) * 40 : 0) };
  const rightForearmEnd = { x: 110, y: -80 + (frame >= 50 ? Math.cos(swing) * 35 : 0) };

  const leftThighEnd = { x: -50 + (frame >= 50 ? Math.sin(swing) * 40 : 0), y: 65 + (frame >= 50 ? Math.cos(swing) * 10 : 0) };
  const leftShinEnd = { x: -80 + (frame >= 50 ? Math.sin(swing) * 50 : 0), y: 165 };
  const rightThighEnd = { x: 50 - (frame >= 50 ? Math.sin(swing) * 40 : 0), y: 65 - (frame >= 50 ? Math.cos(swing) * 10 : 0) };
  const rightShinEnd = { x: 80 - (frame >= 50 ? Math.sin(swing) * 50 : 0), y: 165 };

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} viewBox="0 0 1000 1000">
      {/* Floating golden circles */}
      {particles.map((p, idx) => {
        const currentY = (p.y - frame * p.speed) % 1000;
        const finalY = currentY < 0 ? currentY + 1000 : currentY;
        const waveX = Math.sin(frame * 0.05 + p.phase) * 15;
        return (
          <circle
            key={`gold-part-${idx}`}
            cx={p.x + waveX}
            cy={finalY}
            r={p.size}
            fill="#fbbf24"
            opacity={0.35}
          />
        );
      })}

      {/* Gold Stick Figure (400px height - draws piece by piece) */}
      <g transform={`translate(500, 480 - ${bounce})`} style={{ filter: 'drop-shadow(0 0 12px #fbbf24)' }}>
        {/* 1. Head (0 - 10) */}
        <DrawCircle cx={0} cy={-200} r={35} frame={frame} startFrame={0} duration={10} fill="none" stroke="#fbbf24" strokeWidth={8} />
        
        {/* 2. Torso (10 - 18) */}
        <DrawLine x1={0} y1={-165} x2={0} y2={-25} frame={frame} startFrame={10} duration={8} stroke="#fbbf24" strokeWidth={14} strokeLinecap="round" />
        
        {/* 3. Left Arm (18 - 26) */}
        <DrawLine x1={0} y1={-140} x2={leftArmEnd.x} y2={leftArmEnd.y} frame={frame} startFrame={18} duration={4} stroke="#fbbf24" strokeWidth={10} strokeLinecap="round" />
        <DrawLine x1={leftArmEnd.x} y1={leftArmEnd.y} x2={leftForearmEnd.x} y2={leftForearmEnd.y} frame={frame} startFrame={22} duration={4} stroke="#fbbf24" strokeWidth={9} strokeLinecap="round" />

        {/* 4. Right Arm (26 - 34) */}
        <DrawLine x1={0} y1={-140} x2={rightArmEnd.x} y2={rightArmEnd.y} frame={frame} startFrame={26} duration={4} stroke="#fbbf24" strokeWidth={10} strokeLinecap="round" />
        <DrawLine x1={rightArmEnd.x} y1={rightArmEnd.y} x2={rightForearmEnd.x} y2={rightForearmEnd.y} frame={frame} startFrame={30} duration={4} stroke="#fbbf24" strokeWidth={9} strokeLinecap="round" />

        {/* 5. Left Leg (34 - 42) */}
        <DrawLine x1={0} y1={-25} x2={leftThighEnd.x} y2={leftThighEnd.y} frame={frame} startFrame={34} duration={4} stroke="#fbbf24" strokeWidth={12} strokeLinecap="round" />
        <DrawLine x1={leftThighEnd.x} y1={leftThighEnd.y} x2={leftShinEnd.x} y2={leftShinEnd.y} frame={frame} startFrame={38} duration={4} stroke="#fbbf24" strokeWidth={10} strokeLinecap="round" />

        {/* 6. Right Leg (42 - 50) */}
        <DrawLine x1={0} y1={-25} x2={rightThighEnd.x} y2={rightThighEnd.y} frame={frame} startFrame={42} duration={4} stroke="#fbbf24" strokeWidth={12} strokeLinecap="round" />
        <DrawLine x1={rightThighEnd.x} y1={rightThighEnd.y} x2={rightShinEnd.x} y2={rightShinEnd.y} frame={frame} startFrame={46} duration={4} stroke="#fbbf24" strokeWidth={10} strokeLinecap="round" />
      </g>
    </svg>
  );
};

// --- FRONT-END OVERLAYS ---

// Theme 1: MEMORY / BRAIN (Firing neural nodes overlay)
const MemoryForeground: React.FC<{ frame: number; scale: number; opacity: number }> = ({ frame, scale, opacity }) => {
  const neuronNodes = useMemo(() => generateBrainNodes(), []);

  const nodes = neuronNodes.map((n) => {
    const t = frame * 0.08 + n.phase;
    const waveX = Math.sin(t) * 4;
    const waveY = Math.cos(t) * 4;
    return {
      ...n,
      x: n.originalX + waveX,
      y: n.originalY + waveY
    };
  });

  const connections = useMemo(() => {
    const linesArr: [number, number][] = [];
    for (let i = 0; i < neuronNodes.length; i++) {
      let c = 0;
      for (let j = i + 1; j < neuronNodes.length; j++) {
        const dx = neuronNodes[i].x - neuronNodes[j].x;
        const dy = neuronNodes[i].y - neuronNodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 65) {
          linesArr.push([i, j]);
          c++;
          if (c > 2) break;
        }
      }
    }
    return linesArr;
  }, [neuronNodes]);

  return (
    <g transform={`translate(500, 450) scale(${scale}) translate(-500, -450)`} opacity={opacity}>
      {/* Connections draw */}
      {connections.map(([a, b], idx) => {
        const startDraw = (idx % 25) * 1.2;
        return (
          <DrawLine
            key={`ml-${idx}`}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            frame={frame}
            startFrame={startDraw}
            duration={25}
            stroke="#00d4ff"
            strokeWidth={1.2}
            strokeOpacity={0.35}
          />
        );
      })}

      {/* Light pulses */}
      {connections.map(([a, b], idx) => {
        const startDraw = (idx % 25) * 1.2;
        const pulseStart = startDraw + 25;
        if (frame < pulseStart) return null;
        
        const t = ((frame - pulseStart) * 0.04) % 1.0;
        const cx = nodes[a].x + (nodes[b].x - nodes[a].x) * t;
        const cy = nodes[a].y + (nodes[b].y - nodes[a].y) * t;
        
        return (
          <circle
            key={`mlp-${idx}`}
            cx={cx}
            cy={cy}
            r={3.5}
            fill="#ffffff"
            style={{ filter: 'drop-shadow(0 0 6px #ffffff)' }}
          />
        );
      })}

      {/* Nodes pop */}
      {nodes.map((node, idx) => {
        const popFrame = (idx % 25) * 1.2 + 20;
        if (frame < popFrame) return null;
        
        const s = interpolate(frame, [popFrame, popFrame + 10], [0, 1], { extrapolateRight: 'clamp' });
        const r = node.size * s;
        return (
          <circle
            key={`mn-${idx}`}
            cx={node.x}
            cy={node.y}
            r={r}
            fill="#00d4ff"
            opacity={0.8}
            style={{ filter: 'drop-shadow(0 0 3px #00d4ffaa)' }}
          />
        );
      })}
    </g>
  );
};

// Theme 2: ACTION / MOVEMENT (Stick figure runner - builds piece by piece)
const ActionForeground: React.FC<{ frame: number; scale: number; opacity: number }> = ({ frame, scale, opacity }) => {
  const slideX = interpolate(frame, [0, 15], [-700, 0], {
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t)
  }) + interpolate(frame, [75, 90], [0, 800], {
    extrapolateLeft: 'clamp'
  });

  const runnerSwing = frame >= 50 ? (frame - 50) * 0.45 : 0;
  const runnerBounce = frame >= 50 ? Math.abs(Math.sin(runnerSwing * 2)) * 14 : 0;

  // Moving joints after build completes (frame >= 50)
  const leftArmEnd = { x: -65, y: -120 + (frame >= 50 ? Math.sin(runnerSwing) * 40 : 0) };
  const leftForearmEnd = { x: -110, y: -160 + (frame >= 50 ? Math.cos(runnerSwing) * 35 : 0) };
  const rightArmEnd = { x: 65, y: -120 - (frame >= 50 ? Math.sin(runnerSwing) * 40 : 0) };
  const rightForearmEnd = { x: 110, y: -80 + (frame >= 50 ? Math.cos(runnerSwing) * 35 : 0) };

  const leftThighEnd = { x: -50 + (frame >= 50 ? Math.sin(runnerSwing) * 40 : 0), y: 65 + (frame >= 50 ? Math.cos(runnerSwing) * 10 : 0) };
  const leftShinEnd = { x: -80 + (frame >= 50 ? Math.sin(runnerSwing) * 50 : 0), y: 165 };
  const rightThighEnd = { x: 50 - (frame >= 50 ? Math.sin(runnerSwing) * 40 : 0), y: 65 - (frame >= 50 ? Math.cos(runnerSwing) * 10 : 0) };
  const rightShinEnd = { x: 80 - (frame >= 50 ? Math.sin(runnerSwing) * 50 : 0), y: 165 };

  return (
    <g transform={`translate(${500 + slideX}, 450) scale(${scale * 1.1}) translate(-500, -450)`} opacity={opacity}>
      {/* Cinematic anime speed lines */}
      {Array.from({ length: 16 }).map((_, idx) => {
        const lineSpeed = 25 + (idx % 4) * 8;
        const xOffset = ((frame * lineSpeed + idx * 200) % 1800) - 900;
        const yPos = 200 + idx * 45;
        return (
          <DrawLine
            key={`sl-${idx}`}
            x1={xOffset}
            y1={yPos}
            x2={xOffset + 250}
            y2={yPos}
            frame={frame}
            startFrame={0}
            duration={30}
            stroke="#fbbf24"
            strokeWidth={1.5 + (idx % 2) * 1.5}
            strokeOpacity={0.25}
          />
        );
      })}

      {/* Gold Stick Figure (400px height - draws piece by piece) */}
      <g transform={`translate(500, 480 - ${runnerBounce}) skewX(-15)`} style={{ filter: 'drop-shadow(0 0 12px #fbbf24)' }}>
        {/* 1. Head (0 - 10) */}
        <DrawCircle cx={0} cy={-200} r={35} frame={frame} startFrame={0} duration={10} fill="none" stroke="#fbbf24" strokeWidth={8} />
        
        {/* 2. Torso (10 - 18) */}
        <DrawLine x1={0} y1={-165} x2={0} y2={-25} frame={frame} startFrame={10} duration={8} stroke="#fbbf24" strokeWidth={14} strokeLinecap="round" />
        
        {/* 3. Left Arm (18 - 26) */}
        <DrawLine x1={0} y1={-140} x2={leftArmEnd.x} y2={leftArmEnd.y} frame={frame} startFrame={18} duration={4} stroke="#fbbf24" strokeWidth={10} strokeLinecap="round" />
        <DrawLine x1={leftArmEnd.x} y1={leftArmEnd.y} x2={leftForearmEnd.x} y2={leftForearmEnd.y} frame={frame} startFrame={22} duration={4} stroke="#fbbf24" strokeWidth={9} strokeLinecap="round" />

        {/* 4. Right Arm (26 - 34) */}
        <DrawLine x1={0} y1={-140} x2={rightArmEnd.x} y2={rightArmEnd.y} frame={frame} startFrame={26} duration={4} stroke="#fbbf24" strokeWidth={10} strokeLinecap="round" />
        <DrawLine x1={rightArmEnd.x} y1={rightArmEnd.y} x2={rightForearmEnd.x} y2={rightForearmEnd.y} frame={frame} startFrame={30} duration={4} stroke="#fbbf24" strokeWidth={9} strokeLinecap="round" />

        {/* 5. Left Leg (34 - 42) */}
        <DrawLine x1={0} y1={-25} x2={leftThighEnd.x} y2={leftThighEnd.y} frame={frame} startFrame={34} duration={4} stroke="#fbbf24" strokeWidth={12} strokeLinecap="round" />
        <DrawLine x1={leftThighEnd.x} y1={leftThighEnd.y} x2={leftShinEnd.x} y2={leftShinEnd.y} frame={frame} startFrame={38} duration={4} stroke="#fbbf24" strokeWidth={10} strokeLinecap="round" />

        {/* 6. Right Leg (42 - 50) */}
        <DrawLine x1={0} y1={-25} x2={rightThighEnd.x} y2={rightThighEnd.y} frame={frame} startFrame={42} duration={4} stroke="#fbbf24" strokeWidth={12} strokeLinecap="round" />
        <DrawLine x1={rightThighEnd.x} y1={rightThighEnd.y} x2={rightShinEnd.x} y2={rightShinEnd.y} frame={frame} startFrame={46} duration={4} stroke="#fbbf24" strokeWidth={10} strokeLinecap="round" />
      </g>
    </g>
  );
};

// Theme 3: DATA / NUMBERS (Dial progress dial - ZERO text)
const DataForeground: React.FC<{
  frame: number;
  scale: number;
  opacity: number;
  numberVal?: number;
  isNegative?: boolean;
}> = ({ frame, scale, opacity, numberVal = 0, isNegative = false }) => {
  if (numberVal <= 0) return null;

  const numberProgress = interpolate(frame, [5, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 4)
  });
  
  const color = isNegative ? '#ef4444' : '#00d4ff';

  const explParticles = useMemo(() => {
    const pts: { vx: number; vy: number; r: number; color: string }[] = [];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 14;
      pts.push({
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2 + Math.random() * 5,
        color: Math.random() > 0.4 ? color : (Math.random() > 0.5 ? '#fbbf24' : '#ffffff')
      });
    }
    return pts;
  }, [color]);

  const explosionStartFrame = 12;
  const explosionProgress = Math.max(0, frame - explosionStartFrame);

  // Radial dial variables
  const radius = 180;
  const circumference = 2 * Math.PI * radius; 
  const progressVal = Math.min(100, numberVal);
  const currentProgress = numberProgress * progressVal;
  const strokeDashoffset = circumference - (circumference * currentProgress) / 100;
  
  const rotation = frame * 1.5;

  return (
    <g transform={`translate(500, 450) scale(${scale}) translate(-500, -450)`} opacity={opacity}>
      {/* 3D Particle Explosion Layer */}
      {explosionProgress > 0 && explParticles.map((p, idx) => {
        const cx = 500 + p.vx * explosionProgress * 1.4;
        const cy = 400 + p.vy * explosionProgress * 1.4;
        const alpha = Math.max(0, 1 - explosionProgress / 45);
        return (
          <circle
            key={`expl-${idx}`}
            cx={cx}
            cy={cy}
            r={p.r}
            fill={p.color}
            opacity={alpha}
            style={{ filter: p.r > 4 ? `drop-shadow(0 0 6px ${p.color})` : 'none' }}
          />
        );
      })}

      {/* Rotating radial dial system */}
      <g transform="translate(500, 400)">
        <circle cx="0" cy="0" r={radius} fill="none" stroke={color} strokeWidth="24" opacity="0.04" />
        <circle cx="0" cy="0" r={radius} fill="none" stroke="#6366f1" strokeWidth="8" opacity="0.15" />
        
        {/* Active progress arc draws over time */}
        <circle
          cx="0"
          cy="0"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90)"
          style={{ filter: `drop-shadow(0 0 12px ${color})` }}
        />

        <circle
          cx="0"
          cy="0"
          r={radius + 35}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray="8, 12"
          opacity="0.4"
          transform={`rotate(${rotation})`}
        />

        <circle
          cx="0"
          cy="0"
          r={radius - 30}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeDasharray="4, 16"
          opacity="0.3"
          transform={`rotate(${-rotation * 0.7})`}
        />
        
        <circle
          cx="0"
          cy="0"
          r="45"
          fill={color}
          opacity={0.1 + Math.sin(frame * 0.15) * 0.05}
          style={{ filter: `drop-shadow(0 0 15px ${color})` }}
        />
        <circle cx="0" cy="0" r="10" fill="#ffffff" />
      </g>
    </g>
  );
};

// Theme 4: SOCIETY / PEOPLE (4 stick figures building then waving)
const SocietyForeground: React.FC<{ frame: number; scale: number; opacity: number }> = ({ frame, scale, opacity }) => {
  const figures = [
    { x: 300, startFrame: 5, waveSpeed: 0.18 },
    { x: 430, startFrame: 12, waveSpeed: 0.12 },
    { x: 570, startFrame: 18, waveSpeed: 0.22 },
    { x: 700, startFrame: 25, waveSpeed: 0.15 }
  ];

  return (
    <g transform={`translate(500, 450) scale(${scale * 1.5}) translate(-500, -450)`} opacity={opacity}>
      {figures.map((fig, idx) => {
        const figProgress = Math.max(0, frame - fig.startFrame);
        if (figProgress === 0) return null;
        
        const armWave = figProgress >= 25 ? Math.sin((figProgress - 25) * fig.waveSpeed) * 35 : 0;
        const bob = figProgress >= 25 ? Math.sin((figProgress - 25) * 0.1 + idx) * 5 : 0;

        return (
          <g key={`fig-${idx}`} transform={`translate(${fig.x}, 520 + ${bob})`}>
            {/* Head (Golden) - draws (0 - 8) */}
            <DrawCircle cx={0} cy={-130} r={17} frame={figProgress} startFrame={0} duration={8} fill="none" stroke="#fbbf24" strokeWidth={5} />
            
            {/* Spine (8 - 14) */}
            <DrawLine x1={0} y1={-113} x2={0} y2={-45} frame={figProgress} startFrame={8} duration={6} stroke="#fbbf24" strokeWidth={8} strokeLinecap="round" />
            
            {/* Left Arm (14 - 18) */}
            <DrawLine x1={0} y1={-95} x2={-28} y2={-65 + armWave} frame={figProgress} startFrame={14} duration={4} stroke="#fbbf24" strokeWidth={6} strokeLinecap="round" />
            
            {/* Right Arm (18 - 22) */}
            <DrawLine x1={0} y1={-95} x2={28} y2={-65 - armWave} frame={figProgress} startFrame={18} duration={4} stroke="#fbbf24" strokeWidth={6} strokeLinecap="round" />

            {/* Left Leg (22 - 26) */}
            <DrawLine x1={0} y1={-45} x2={-18} y2={20} frame={figProgress} startFrame={22} duration={4} stroke="#fbbf24" strokeWidth={7} strokeLinecap="round" />
            
            {/* Right Leg (26 - 30) */}
            <DrawLine x1={0} y1={-45} x2={18} y2={20} frame={figProgress} startFrame={26} duration={4} stroke="#fbbf24" strokeWidth={7} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
};

// Theme 5: TECHNOLOGY / CODE (Falling columns of vertical neon lines + brackets path)
const TechnologyForeground: React.FC<{ frame: number; scale: number; opacity: number }> = ({ frame, scale, opacity }) => {
  const columns = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => {
      const x = 120 + i * 45;
      const speed = 22 + (i % 3) * 6;
      return { x, speed };
    });
  }, []);

  const bracketScale = 1.0 + Math.sin(frame * 0.1) * 0.08;

  return (
    <g transform={`translate(500, 450) scale(${scale}) translate(-500, -450)`} opacity={opacity}>
      {/* Foreground fast neon line rain columns */}
      {columns.map((col, idx) => {
        const leadY = ((frame * col.speed) % 1200) - 200;
        return (
          <g key={`tf-${idx}`} opacity={0.6}>
            <DrawLine x1={col.x} y1={leadY} x2={col.x} y2={leadY + 16} frame={frame} startFrame={0} duration={30} stroke="#00d4ff" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
            <DrawLine x1={col.x} y1={leadY - 25} x2={col.x} y2={leadY - 13} frame={frame} startFrame={0} duration={30} stroke="#00d4ff" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
            <DrawLine x1={col.x} y1={leadY - 50} x2={col.x} y2={leadY - 42} frame={frame} startFrame={0} duration={30} stroke="#00d4ff" strokeWidth={3} strokeLinecap="round" opacity={0.2} />
          </g>
        );
      })}

      {/* Floating neon code bracket in center (SVG paths instead of text braces) */}
      <g transform={`translate(500, 400) scale(${bracketScale})`}>
        {/* Left Bracket - draws (0 - 30) */}
        <DrawPath
          d="M -30,-140 H -70 Q -95,-140 -95,-115 V -25 Q -95,0 -120,0 Q -95,0 -95,25 V 115 Q -95,140 -70,140 H -30"
          fill="none"
          stroke="#00d4ff"
          strokeWidth="14"
          strokeLinecap="round"
          frame={frame}
          startFrame={0}
          duration={30}
          pathLengthEstimate={700}
          style={{ filter: 'drop-shadow(0 0 15px #00d4ff)' }}
        />
        {/* Right Bracket - draws (10 - 40) */}
        <DrawPath
          d="M 30,-140 H 70 Q 95,-140 95,-115 V -25 Q 95,0 120,0 Q 95,0 95,25 V 115 Q 95,140 70,140 H 30"
          fill="none"
          stroke="#00d4ff"
          strokeWidth="14"
          strokeLinecap="round"
          frame={frame}
          startFrame={10}
          duration={30}
          pathLengthEstimate={700}
          style={{ filter: 'drop-shadow(0 0 15px #00d4ff)' }}
        />
      </g>
    </g>
  );
};

// Theme 6: GEOGRAPHY / LATIN AMERICA (Map outline draws + glowing city markers)
const GeographyForeground: React.FC<{ frame: number; scale: number; opacity: number }> = ({ frame, scale, opacity }) => {
  const cities = [
    { x: 330, y: 260, start: 35 },
    { x: 470, y: 450, start: 40 },
    { x: 420, y: 560, start: 45 },
    { x: 430, y: 750, start: 50 },
    { x: 500, y: 785, start: 55 },
    { x: 600, y: 630, start: 60 }
  ];

  const mapPath = "M 270 180 L 320 230 L 350 250 L 380 320 L 440 390 L 480 430 L 440 490 L 420 540 L 400 620 L 420 720 L 440 780 L 450 820 L 480 770 L 530 700 L 610 620 L 650 560 L 590 500 L 530 460 Z";

  return (
    <g transform={`translate(500, 450) scale(${scale * 1.05}) translate(-500, -450)`} opacity={opacity}>
      {/* Trazando el mapa con stroke-dashoffset */}
      <DrawPath
        d={mapPath}
        fill="none"
        stroke="#6366f1"
        strokeWidth="3.5"
        strokeOpacity={0.4}
        frame={frame}
        startFrame={0}
        duration={40}
        pathLengthEstimate={1200}
        style={{ filter: 'drop-shadow(0 0 10px #6366f155)' }}
      />

      {/* Connections between cities draw after map starts finishing */}
      <DrawPath
        d="M 330 260 L 470 450 L 420 560 L 430 750 L 500 785 L 600 630"
        fill="none"
        stroke="#00d4ff"
        strokeWidth="2"
        strokeOpacity="0.3"
        frame={frame}
        startFrame={30}
        duration={35}
        pathLengthEstimate={800}
      />

      {/* Pulsing City Markers */}
      {cities.map((city, idx) => {
        const active = frame >= city.start;
        if (!active) return null;

        const pulse = ((frame - city.start) * 4.5) % 60;
        const alpha = Math.max(0, 1 - pulse / 60);

        return (
          <g key={`city-${idx}`}>
            <circle cx={city.x} cy={city.y} r={pulse} fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeOpacity={alpha} />
            <circle cx={city.x} cy={city.y} r={6} fill="#ffffff" style={{ filter: 'drop-shadow(0 0 6px #00d4ff)' }} />
          </g>
        );
      })}
    </g>
  );
};

export const MainClip: React.FC<MainClipProps> = ({
  backgroundType = 'neural',
  sceneTheme = 'memory',
  numberData = 0,
  percentageData = 0,
  isNegative = false,
  aspectRatio = '16:9'
}) => {
  const frame = useCurrentFrame();
  const isVertical = aspectRatio === '9:16';
  
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;

  const videoConfig = useVideoConfig();
  const entranceSpring = spring({
    frame,
    fps: videoConfig.fps,
    config: {
      damping: 14,
      mass: 0.8,
      stiffness: 100,
    },
  });

  const scale = interpolate(entranceSpring, [0, 1], [0.15, 1.0]);
  const opacity = interpolate(entranceSpring, [0, 1], [0, 1]);

  const exitProgress = interpolate(frame, [72, 88], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t
  });

  const finalScale = interpolate(exitProgress, [0, 1], [scale, 0.45]);
  const finalOpacity = interpolate(exitProgress, [0, 1], [opacity, 0]);
  const exitTranslateX = interpolate(exitProgress, [0, 1], [0, 600]);

  const rawNum = numberData || percentageData || 0;

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#020712',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        {backgroundType === 'neural' && <NeuralBackground frame={frame} />}
        {backgroundType === 'mesh' && <MeshBackground frame={frame} />}
        {backgroundType === 'binary' && <BinaryBackground frame={frame} />}
        {backgroundType === 'nodes' && <NodesBackground frame={frame} />}
        {backgroundType === 'map' && <MapBackground frame={frame} />}
        {backgroundType === 'figure' && <FigureBackgroundComp frame={frame} />}
      </div>

      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: 'none',
        transform: `translateX(${exitTranslateX}px)`
      }}>
        {sceneTheme === 'memory' && (
          <MemoryForeground frame={frame} scale={finalScale} opacity={finalOpacity} />
        )}
        {sceneTheme === 'action' && (
          <ActionForeground frame={frame} scale={finalScale} opacity={finalOpacity} />
        )}
        {sceneTheme === 'data' && (
          <DataForeground
            frame={frame}
            scale={finalScale}
            opacity={finalOpacity}
            numberVal={rawNum}
            isNegative={isNegative}
          />
        )}
        {sceneTheme === 'society' && (
          <SocietyForeground frame={frame} scale={finalScale} opacity={finalOpacity} />
        )}
        {sceneTheme === 'technology' && (
          <TechnologyForeground frame={frame} scale={finalScale} opacity={finalOpacity} />
        )}
        {sceneTheme === 'geography' && (
          <GeographyForeground frame={frame} scale={finalScale} opacity={finalOpacity} />
        )}
      </div>

      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        pointerEvents: 'none',
        boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.85)'
      }} />
    </div>
  );
};
