import React from 'react'
import { RULER_MODES } from '../../hooks/useRuler'

export function RulerRenderer({ 
  mode, 
  start, 
  end, 
  zoom = 1, 
  renderKey = 0 
}) {
  if (!start || !end) return null

  const strokeW = Math.max(2, 3 / zoom)
  const circleR = Math.max(4, 5 / zoom)

  if (mode === RULER_MODES.LINE) {
    return (
      <svg key={renderKey} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1001 }}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#ff4444" strokeWidth={strokeW} strokeDasharray="5,5" />
        <circle cx={start.x} cy={start.y} r={circleR} fill="#ff4444" />
        <circle cx={end.x} cy={end.y} r={circleR} fill="#ff4444" />
      </svg>
    )
  }

  if (mode === RULER_MODES.CIRCLE) {
    const radius = Math.hypot(end.x - start.x, end.y - start.y)
    return (
      <svg key={renderKey} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1001 }}>
        <circle cx={start.x} cy={start.y} r={radius} stroke="#44aaff" strokeWidth={strokeW} strokeDasharray="5,5" fill="rgba(68,170,255,0.1)" />
        <circle cx={start.x} cy={start.y} r={circleR} fill="#44aaff" />
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#44aaff" strokeWidth={strokeW * 0.7} strokeDasharray="3,3" />
      </svg>
    )
  }

  if (mode === RULER_MODES.CONE) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    
    let points = `M ${start.x},${start.y} `
    for (let i = -45; i <= 45; i += 5) {
      const rad = (angle + i) * Math.PI / 180
      points += `${start.x + Math.cos(rad) * length},${start.y + Math.sin(rad) * length} `
    }
    points += `M ${start.x},${start.y}`
    
    return (
      <svg key={renderKey} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1001 }}>
        <path d={points} stroke="#ffaa44" strokeWidth={strokeW} strokeDasharray="5,5" fill="rgba(255,170,68,0.15)" />
        <circle cx={start.x} cy={start.y} r={circleR} fill="#ffaa44" />
      </svg>
    )
  }

  return null
}

export function RulerResult({ result, start, end, zoom = 1, panX = 0, panY = 0 }) {
  if (!result || !start || !end) return null
  
  const midX = (start.x + end.x) / 2 * zoom + panX
  const midY = (start.y + end.y) / 2 * zoom + panY
  const fontSize = Math.max(10, 12 / zoom)
  
  return (
    <div style={{ 
      position: 'absolute', 
      left: midX, 
      top: midY - 30, 
      transform: 'translate(-50%, -50%)', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '4px 8px', 
      borderRadius: '4px', 
      fontSize: `${fontSize}px`, 
      whiteSpace: 'nowrap', 
      pointerEvents: 'none', 
      zIndex: 1002,
      fontFamily: 'monospace',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    }}>
      📏 {result.cells} клеток ({result.feet} футов)
    </div>
  )
}
