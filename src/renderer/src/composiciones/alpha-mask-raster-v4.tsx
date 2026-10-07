import React from 'react'

/** The same SVG alpha-mask/solid-fill primitive used by ProjectAssetVisual in
 * MotionGraphicV15, scoped to explicitly authorized IDEA V4/V4.1 layers. */
export const AlphaMaskRasterV4: React.FC<{
  url: string
  color: string
  maskId: string
  style?: React.CSSProperties
  /** Chromium's CSS alpha compositor avoids the SVG edge-cache drift on tiny icons. */
  renderMode?: 'svg' | 'css'
}> = ({ url, color, maskId, style, renderMode = 'svg' }) => renderMode === 'css'
  ? <div data-idea-alpha-mask="true" style={{ width: '100%', height: '100%', ...style,
      backgroundColor: color, maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")`,
      maskMode: 'alpha',
      maskPosition: 'center', WebkitMaskPosition: 'center', maskSize: 'contain', WebkitMaskSize: 'contain',
      maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} />
  : <svg viewBox="0 0 1 1" width="100%" height="100%"
  preserveAspectRatio="xMidYMid meet" style={style} data-idea-alpha-mask="true">
  <defs><mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
    x="0" y="0" width="1" height="1" style={{ maskType: 'alpha' }}>
    <image href={url} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid meet" />
  </mask></defs>
  <rect x="0" y="0" width="1" height="1" fill={color} mask={`url(#${maskId})`} />
</svg>
