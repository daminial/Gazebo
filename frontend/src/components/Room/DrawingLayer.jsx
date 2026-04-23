import { useRef, useEffect, useCallback, useState } from 'react'
import { useRoom } from '../../context/RoomContext'
import './DrawingLayer.css'

export function DrawingLayer({ 
  activeTool, 
  canvasWidth, 
  canvasHeight, 
  gridSize, 
  zoom, 
  panX, 
  panY 
}) {
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const pathsRef = useRef([])
  const currentPathRef = useRef([])
  const ctxRef = useRef(null)
  
  const { isDm, activePageId, pages, sendData, roomId } = useRoom()
  const [color, setColor] = useState('#ff0000')
  const [brushSize, setBrushSize] = useState(4)

  const activePage = pages.find(p => p.id === activePageId)
  const canDraw = isDm || activePage?.players_can_draw

  // Инициализация canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Учитываем devicePixelRatio для чёткости
    const dpr = window.devicePixelRatio || 1
    
    // Устанавливаем реальный размер canvas
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    
    // CSS размер остаётся прежним
    canvas.style.width = `${canvasWidth}px`
    canvas.style.height = `${canvasHeight}px`
    
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctxRef.current = ctx
    
    // Загружаем сохраненный рисунок
    loadSavedDrawing()
  }, [canvasWidth, canvasHeight, activePageId])

  // Применяем настройки кисти
  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color
      ctxRef.current.lineWidth = brushSize
    }
  }, [color, brushSize])

  const loadSavedDrawing = async () => {
    if (!activePageId || !roomId) return
    try {
      const { roomsAPI } = await import('../../api')
      const res = await roomsAPI.getDrawing(roomId, activePageId)
      if (res.data?.paths) {
        pathsRef.current = res.data.paths
        redrawAllPaths()
      }
    } catch (e) {
      // Нет сохраненного рисунка или API не готов - это нормально
      console.log('No saved drawing or API not ready')
    }
  }

  const redrawAllPaths = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    
    pathsRef.current.forEach(path => {
      drawPath(ctx, path)
    })
  }

  const drawPath = (ctx, path) => {
    if (!path.points || path.points.length < 2) return
    
    ctx.save()
    ctx.strokeStyle = path.color
    ctx.lineWidth = path.size
    ctx.beginPath()
    ctx.moveTo(path.points[0].x, path.points[0].y)
    
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y)
    }
    ctx.stroke()
    ctx.restore()
  }

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
    if (activeTool !== 'draw' || !canDraw) return
    e.preventDefault()
    e.stopPropagation()
    
    const ctx = ctxRef.current
    if (!ctx) return
    
    isDrawingRef.current = true
    const coords = getCanvasCoords(e)
    currentPathRef.current = [{ x: coords.x, y: coords.y }]
    
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }, [activeTool, canDraw, getCanvasCoords])

  const continueDrawing = useCallback((e) => {
    if (!isDrawingRef.current || activeTool !== 'draw' || !canDraw) return
    e.preventDefault()
    
    const ctx = ctxRef.current
    if (!ctx) return
    
    const coords = getCanvasCoords(e)
    currentPathRef.current.push({ x: coords.x, y: coords.y })
    
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    
    // Для плавности начинаем новый путь
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }, [activeTool, canDraw, getCanvasCoords])

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    
    if (currentPathRef.current.length > 1) {
      const newPath = {
        color,
        size: brushSize,
        points: currentPathRef.current
      }
      pathsRef.current.push(newPath)
      
      // Отправляем другим через LiveKit
      if (sendData) {
        sendData({
          type: 'drawing:path',
          payload: newPath
        }, 'game:drawing')
      }
      
      // Сохраняем на беке (без ошибки если API нет)
      saveDrawingToBackend()
    }
    currentPathRef.current = []
  }, [color, brushSize, sendData])

  const saveDrawingToBackend = () => {
    if (!roomId || !activePageId) return
    
    // Пробуем сохранить, но не падаем с ошибкой если API нет
    import('../../api').then(({ roomsAPI }) => {
      roomsAPI.saveDrawing(roomId, activePageId, {
        paths: pathsRef.current
      }).catch(() => {
        // API эндпоинт пока не реализован - ничего страшного
      })
    }).catch(() => {})
  }

  const clearDrawing = () => {
    if (!canDraw) return
    
    const ctx = ctxRef.current
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    pathsRef.current = []
    
    // Отправляем команду очистки другим
    if (sendData) {
      sendData({
        type: 'drawing:clear'
      }, 'game:drawing')
    }
    
    // Очищаем на беке
    if (roomId && activePageId) {
      import('../../api').then(({ roomsAPI }) => {
        roomsAPI.clearDrawing(roomId, activePageId).catch(() => {})
      }).catch(() => {})
    }
  }

  // Обработчик входящих данных рисования
  useEffect(() => {
    window.__handleDrawingData = (data) => {
      if (data.type === 'drawing:path') {
        pathsRef.current.push(data.payload)
        const ctx = ctxRef.current
        if (ctx) {
          drawPath(ctx, data.payload)
        }
      } else if (data.type === 'drawing:clear') {
        pathsRef.current = []
        const ctx = ctxRef.current
        if (ctx) {
          ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        }
      }
    }
    
    return () => {
      delete window.__handleDrawingData
    }
  }, [canvasWidth, canvasHeight])

  if (activeTool !== 'draw') return null

  return (
    <>
      {canDraw && (
        <div className="drawing-controls">
          <div className="control-group">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="color-picker"
              title="Цвет кисти"
            />
          </div>
          <div className="control-group">
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="size-slider"
              title={`Размер кисти: ${brushSize}px`}
            />
            <span className="size-label">{brushSize}px</span>
          </div>
          <button onClick={clearDrawing} className="clear-drawing-btn" title="Очистить рисунок">
            🗑️
          </button>
        </div>
      )}
      {!canDraw && (
        <div className="drawing-disabled-overlay">
          🔒 Рисование запрещено
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`drawing-layer ${canDraw ? 'drawable' : ''}`}
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
          pointerEvents: canDraw ? 'auto' : 'none',
          zIndex: 5
        }}
      />
    </>
  )
}