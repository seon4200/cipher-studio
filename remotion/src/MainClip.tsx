import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export interface ChartDataItem {
  label: string;
  value: number;
}

export interface MainClipProps {
  text: string;
  title?: string;
  chartType?: 'bar' | 'line' | 'kpi';
  data?: ChartDataItem[];
  metricValue?: string;
  metricLabel?: string;
}

export const defaultProps: MainClipProps = {
  text: 'Esta es una demostración de gráficos de datos dinámicos generados por IA para CIPHER Studio.',
  title: 'Rendimiento de Datos',
  chartType: 'bar',
  data: [
    { label: 'Ene', value: 30 },
    { label: 'Feb', value: 45 },
    { label: 'Mar', value: 60 },
    { label: 'Abr', value: 80 },
    { label: 'May', value: 95 }
  ],
  metricValue: '94.2%',
  metricLabel: 'Tasa de Conversión'
};

export const MainClip: React.FC<MainClipProps> = ({
  text,
  title = 'Rendimiento de Datos',
  chartType = 'bar',
  data = defaultProps.data,
  metricValue = '94.2%',
  metricLabel = 'Tasa de Conversión'
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // 1. Soft fade-in of background
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Spring animation for text and graphics
  const spr = spring({
    frame: frame - 10,
    fps,
    config: {
      damping: 12,
    },
  });

  const textOffset = interpolate(spr, [0, 1], [50, 0]);
  const textOpacity = interpolate(spr, [0, 1], [0, 1]);

  // CSS variables for CIPHER styling
  const colors = {
    bg: '#020712',
    indigo: '#6366f1',
    purple: '#c084fc',
    green: '#34d399',
  };

  const textStyle: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontWeight: 700,
    fontSize: '56px',
    lineHeight: '1.2',
    color: '#ffffff',
    transform: `translateY(${textOffset}px)`,
    opacity: textOpacity,
    textShadow: '0 4px 20px rgba(99, 102, 241, 0.15)',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    color: colors.green,
    fontSize: '28px',
    fontWeight: 'bold',
  };

  const chartTitleStyle: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 800,
    fontSize: '36px',
    color: colors.purple,
    marginBottom: '20px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  };

  // Safe maximum value for chart scaling
  const maxVal = data && data.length > 0 ? Math.max(...data.map(d => d.value), 10) : 100;

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        width,
        height,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '100px',
        color: '#fff',
        boxSizing: 'border-box',
        opacity,
      }}
    >
      {/* Left Column: Kinetic text narrative */}
      <div style={{ flex: 1.2, paddingRight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2 style={textStyle}>
          {text.split(' ').map((word, wordIdx) => {
            // Apply elastic transition alternating colors for highlights
            const isHighlight = wordIdx % 3 === 0;
            const wordColor = isHighlight ? colors.indigo : colors.purple;
            
            // Stagger animation per word
            const wordSpr = spring({
              frame: frame - 15 - wordIdx * 1.5,
              fps,
              config: { damping: 10, stiffness: 80 },
            });
            const wordScale = interpolate(wordSpr, [0, 1], [0.8, 1]);
            const wordOpacity = interpolate(wordSpr, [0, 1], [0, 1]);

            return (
              <span
                key={wordIdx}
                style={{
                  display: 'inline-block',
                  marginRight: '12px',
                  color: isHighlight ? wordColor : '#ffffff',
                  transform: `scale(${wordScale})`,
                  opacity: wordOpacity,
                  transition: 'color 0.3s ease',
                }}
              >
                {word}
              </span>
            );
          })}
        </h2>
      </div>

      {/* Right Column: Dynamic Data Graphic */}
      <div
        style={{
          flex: 0.8,
          backgroundColor: 'rgba(99, 102, 241, 0.03)',
          border: '2px solid rgba(99, 102, 241, 0.1)',
          borderRadius: '24px',
          padding: '50px',
          height: '600px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          transform: `scale(${interpolate(spr, [0, 1], [0.95, 1])})`,
          opacity: textOpacity,
        }}
      >
        <div style={chartTitleStyle}>{title}</div>

        {/* Render Chart Type */}
        {chartType === 'bar' && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center' }}>
            {data.map((item, idx) => {
              const barSpr = spring({
                frame: frame - 25 - idx * 3,
                fps,
                config: { damping: 12 },
              });
              const barWidth = interpolate(barSpr, [0, 1], [0, (item.value / maxVal) * 100]);
              
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <div style={{ width: '120px', ...labelStyle, fontSize: '24px' }}>
                    {item.label}
                  </div>
                  <div style={{ flex: 1, height: '36px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', marginRight: '20px' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${colors.indigo}, ${colors.green})`,
                        borderRadius: '8px',
                        boxShadow: `0 0 15px rgba(52, 211, 153, 0.4)`,
                      }}
                    />
                  </div>
                  <div style={{ width: '100px', ...labelStyle, color: '#ffffff', textAlign: 'right' }}>
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {chartType === 'line' && data && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
            {/* Simple graphic lines grid */}
            <div style={{ display: 'flex', height: '320px', alignItems: 'flex-end', justifyContent: 'space-between', borderLeft: `2px solid rgba(99, 102, 241, 0.2)`, borderBottom: `2px solid rgba(99, 102, 241, 0.2)`, padding: '20px' }}>
              {data.map((item, idx) => {
                const lineSpr = spring({
                  frame: frame - 25 - idx * 3,
                  fps,
                  config: { damping: 12 },
                });
                const heightPct = interpolate(lineSpr, [0, 1], [0, (item.value / maxVal) * 80]);
                
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', width: '60px' }}>
                    {/* Visual dot on top */}
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: colors.green,
                        boxShadow: `0 0 10px ${colors.green}`,
                        transform: `translateY(${-heightPct * 3}px)`,
                        opacity: lineSpr,
                        marginBottom: '8px',
                      }}
                    />
                    {/* Bar connector */}
                    <div
                      style={{
                        width: '4px',
                        height: `${heightPct}%`,
                        backgroundColor: 'rgba(99, 102, 241, 0.4)',
                        borderRadius: '2px',
                      }}
                    />
                    <div style={{ ...labelStyle, fontSize: '18px', marginTop: '15px' }}>
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {chartType === 'kpi' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '120px',
                fontWeight: 900,
                color: colors.green,
                textShadow: `0 0 40px rgba(52, 211, 153, 0.3)`,
                letterSpacing: '-2px',
                transform: `scale(${interpolate(spring({ frame: frame - 20, fps, config: { damping: 10 } }), [0, 1], [0.5, 1])})`,
              }}
            >
              {metricValue}
            </div>
            <div
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '28px',
                fontWeight: '600',
                color: '#94a3b8',
                marginTop: '10px',
                textAlign: 'center',
                letterSpacing: '1px',
              }}
            >
              {metricLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
