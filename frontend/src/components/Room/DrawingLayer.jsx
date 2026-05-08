import { useRef, useEffect, useCallback } from 'react'
import { useRoom } from '../../context/RoomContext'
import './DrawingLayer.css'

export function DrawingLayer({ 
  activeTool, 
  canvasWidth, 
  canvasHeight, 
  gridSize, 
  zoom, 
  panX,
  color,
  brushSize,
  drawingLayerRef  // Получаем ref как пропс
}) {
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const ctxRef = useRef(null)
  
  const { isDm, activePageId, pages, sendData } = useRoom()

  const activePage = pages.find(p => p.id === activePageId)
  const canDraw = isDm || activePage?.players_can_draw
  const isDrawTool = activeTool === 'draw'

  // Инициализация canvas при монтировании и при изменении размеров
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    
    canvas.style.width = `${canvasWidth}px`
    canvas.style.height = `${canvasHeight}px`
    
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctxRef.current = ctx
  }, [canvasWidth, canvasHeight])

  // Очищаем canvas только при смене страницы
  useEffect(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  }, [activePageId, canvasWidth, canvasHeight])

  // Обновление стилей при изменении цвета и размера
  useEffect(() => {
    if (ctxRef.current && isDrawTool) {
      ctxRef.current.strokeStyle = color
      ctxRef.current.lineWidth = brushSize
    }
  }, [color, brushSize, isDrawTool])

  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    
    return {
      x: (e.clientX - rect.left) * (canvasWidth / rect.width),
      y: (e.clientY - rect.top) * (canvasHeight / rect.height)
    }
  }, [canvasWidth, canvasHeight])

  const startDrawing = useCallback((e) => {
    if (!isDrawTool || !canDraw) return
    e.preventDefault()
    e.stopPropagation()
    
    const ctx = ctxRef.current
    if (!ctx) return
    
    isDrawingRef.current = true
    const coords = getCanvasCoords(e)
    
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    
    // Отправляем начальную точку
    if (sendData) {
      sendData({
        type: 'drawing:start',
        payload: {
          x: coords.x,
          y: coords.y,
          color,
          size: brushSize
        }
      }, 'game:drawing')
    }
  }, [isDrawTool, canDraw, getCanvasCoords, color, brushSize, sendData])

  const continueDrawing = useCallback((e) => {
    if (!isDrawingRef.current || !isDrawTool || !canDraw) return
    e.preventDefault()
    
    const ctx = ctxRef.current
    if (!ctx) return
    
    const coords = getCanvasCoords(e)
    
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    
    // Отправляем точку другим пользователям
    if (sendData) {
      sendData({
        type: 'drawing:point',
        payload: {
          x: coords.x,
          y: coords.y,
          color,
          size: brushSize
        }
      }, 'game:drawing')
    }
    
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }, [isDrawTool, canDraw, getCanvasCoords, color, brushSize, sendData])

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    
    // Отправляем сигнал о завершении линии
    if (sendData) {
      sendData({
        type: 'drawing:end',
        payload: {}
      }, 'game:drawing')
    }
  }, [sendData])

  const clearDrawing = useCallback(() => {
    if (!canDraw) return
    
    const ctx = ctxRef.current
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    
    if (sendData) {
      sendData({
        type: 'drawing:clear'
      }, 'game:drawing')
    }
  }, [canDraw, canvasWidth, canvasHeight, sendData])

  // Экспортируем clearDrawing через drawingLayerRef для родительского компонента
  useEffect(() => {
    if (drawingLayerRef) {
      drawingLayerRef.current = { clearDrawing }
    }
  }, [drawingLayerRef, clearDrawing])

  // Обработка входящих данных рисования
  useEffect(() => {
    window.__handleDrawingData = (data) => {
      const ctx = ctxRef.current
      if (!ctx) return
      
      ctx.save()
      
      if (data.type === 'drawing:start') {
        const { x, y, color: pathColor, size } = data.payload
        ctx.strokeStyle = pathColor
        ctx.lineWidth = size
        ctx.beginPath()
        ctx.moveTo(x, y)
      } else if (data.type === 'drawing:point') {
        const { x, y, color: pathColor, size } = data.payload
        ctx.strokeStyle = pathColor
        ctx.lineWidth = size
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x, y)
      } else if (data.type === 'drawing:end') {
        // Просто завершаем путь
        ctx.beginPath()
      } else if (data.type === 'drawing:clear') {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      }
      
      ctx.restore()
    }
    
    return () => {
      delete window.__handleDrawingData
    }
  }, [canvasWidth, canvasHeight])

  // Canvas всегда видим, но меняем cursor и pointer-events
  return (
    <canvas
      ref={canvasRef}
      className="drawing-layer"
      onMouseDown={startDrawing}
      onMouseMove={continueDrawing}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        cursor: isDrawTool && canDraw ? 'crosshair' : 'default',
        pointerEvents: isDrawTool && canDraw ? 'auto' : 'none',
        zIndex: 5
      }}
    />
  )
}