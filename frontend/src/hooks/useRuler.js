import { useState, useRef, useCallback, useEffect } from 'react'

export const RULER_MODES = {
  LINE: 'line',
  CIRCLE: 'circle',
  CONE: 'cone'
}

export function useRuler({ gridSize = 50, feetPerCell = 5, enabled = false }) {
  const [measuring, setMeasuring] = useState(false)
  const [measureMode, setMeasureMode] = useState(RULER_MODES.LINE)
  const [measureStart, setMeasureStart] = useState(null)
  const [measureEnd, setMeasureEnd] = useState(null)
  const [measureResult, setMeasureResult] = useState(null)
  const [renderKey, setRenderKey] = useState(0)
  
  const animationFrameRef = useRef(null)
  const measureStartRef = useRef(null)
  const measureEndRef = useRef(null)

  const getDistance = useCallback((x1, y1, x2, y2) => {
    const dx = Math.abs(x2 - x1)
    const dy = Math.abs(y2 - y1)
    const cells = Math.sqrt(dx * dx + dy * dy) / gridSize
    const feet = cells * feetPerCell
    return { cells: Math.round(cells * 10) / 10, feet: Math.round(feet * 10) / 10 }
  }, [gridSize, feetPerCell])

  const startMeasure = useCallback((x, y) => {
    if (!enabled) return
    setMeasuring(true)
    setMeasureStart({ x, y })
    setMeasureEnd({ x, y })
    setMeasureResult(null)
    measureStartRef.current = { x, y }
    measureEndRef.current = { x, y }
  }, [enabled])

  const updateMeasure = useCallback((x, y) => {
    if (!measuring || !measureStartRef.current) return
    measureEndRef.current = { x, y }
    setMeasureEnd({ x, y })
    const dist = getDistance(measureStartRef.current.x, measureStartRef.current.y, x, y)
    setMeasureResult(dist)
    setRenderKey(prev => prev + 1)
  }, [measuring, getDistance])

  const scheduleUpdate = useCallback((x, y) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      updateMeasure(x, y)
    })
  }, [updateMeasure])

  const endMeasure = useCallback(() => {
    setMeasuring(false)
    measureStartRef.current = null
    measureEndRef.current = null
    setTimeout(() => {
      setMeasureStart(null)
      setMeasureEnd(null)
      setMeasureResult(null)
    }, 2000)
  }, [])

  const resetMeasure = useCallback(() => {
    setMeasuring(false)
    setMeasureStart(null)
    setMeasureEnd(null)
    setMeasureResult(null)
    measureStartRef.current = null
    measureEndRef.current = null
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return {
    measuring,
    measureMode,
    setMeasureMode,
    measureStart,
    measureEnd,
    measureResult,
    renderKey,
    startMeasure,
    scheduleUpdate,
    endMeasure,
    resetMeasure,
    RULER_MODES
  }
}
