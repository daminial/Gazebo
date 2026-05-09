import { useState, useRef, useEffect, useCallback } from 'react'
import { useRoom } from '../../context/RoomContext'
import { Token } from './Token'
import './MapCanvas.css'
import { DrawingLayer } from './DrawingLayer'
import { useRuler } from '../../hooks/useRuler'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.1

export function MapCanvas({ 
  activeTool = 'select', 
  canvasWidth, 
  canvasHeight, 
  gridSize, 
  gridVisible, 
  measureMode = null,
  drawColor,
  drawBrushSize,
  drawingLayerRef
}) {
  const {
    maps, activeMapId, pages, activePageId,
    setPageBackground, removePageBackground,
    tokens, setTokens, sendTokenMove, roomId, createToken,
    isDm, user, deleteToken, sendRulerData,
  } = useRoom()
  const [showContextMenu, setShowContextMenu] = useState(null)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [draggedImage, setDraggedImage] = useState(null)

  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const [isDragOver, setIsDragOver] = useState(false)

  const [selectedTokenIds, setSelectedTokenIds] = useState([])
  const [selectionRect, setSelectionRect] = useState(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState(null)

  const [remoteRulers, setRemoteRulers] = useState({});

  const canvasRef = useRef(null)

  const ruler = useRuler({
    gridSize,
    feetPerCell: 5,
    enabled: activeTool === 'measure',
    onMeasureUpdate: (data) => {
      if (data) {
        sendRulerData('measuring', {
          ...data,
          participantId: user?.id
        });
      } else {
        sendRulerData('measuring', {
          participantId: user?.id,
          start: null
        });
      }
    }
  })
  useEffect(() => {
  if (measureMode) {
    ruler.setMeasureMode(measureMode);
  }
}, [measureMode, ruler.setMeasureMode]);

  const {
    measuring,
    measureMode: currentMeasureMode,
    measureStart,
    measureEnd,
    measureResult,
    renderKey,
    startMeasure,
    scheduleUpdate,
    endMeasure,
  } = ruler

  useEffect(() => {
    const handleRulerUpdate = (e) => {
      const { mode, start, end, result, participantId } = e.detail;
      
      console.log('📏 Получена чужая линейка:', { mode, start, end, result, participantId });
      
      if (participantId === user?.id) return;
      
      setRemoteRulers(prev => {
        if (!start) {
          const next = { ...prev };
          delete next[participantId];
          return next;
        }
        return {
          ...prev,
          [participantId]: { mode, start, end, result }
        };
      });
    };

    window.addEventListener('ruler-update', handleRulerUpdate);
    return () => window.removeEventListener('ruler-update', handleRulerUpdate);
  }, [user?.id]);

  const activePage = pages.find(p => p.id === activePageId)
  let activeMap = null

  if (activePage?.map) {
    activeMap = activePage.map
  } else if (activeMapId) {
    activeMap = maps.find(m => m.id === activeMapId)
  }

  const backgroundImageUrl = activePage?.background_image_url
  const mapImageUrl = activeMap?.image_url
  const displayImageUrl = backgroundImageUrl || mapImageUrl

  const roomImages = maps
    .filter(m => m.image_url)
    .map(m => ({ id: m.image_id || m.template_image_id, url: m.image_url, name: m.name_in_room || 'Карта' }))
    .filter((img, i, arr) => arr.findIndex(x => x.url === img.url) === i)

  const getCanvasCoordinates = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - panX) / zoom,
      y: (e.clientY - rect.top - panY) / zoom
    }
  }, [panX, panY, zoom])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta))
    const scale = newZoom / zoom

    setPanX(mouseX - scale * (mouseX - panX))
    setPanY(mouseY - scale * (mouseY - panY))
    setZoom(newZoom)
  }, [zoom, panX, panY])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const getTokenAtPosition = useCallback((x, y) => {
    const tokensOnPage = [...tokens.filter(t => t.page_id === activePageId)].reverse()
    return tokensOnPage.find(token => {
      const tokenSize = token.width || gridSize
      return x >= token.position_x &&
             x <= token.position_x + tokenSize &&
             y >= token.position_y &&
             y <= token.position_y + tokenSize
    })
  }, [tokens, activePageId, gridSize])

  const handleMouseDown = useCallback((e) => {
    if (activeTool === 'hand') {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = { x: e.clientX - panX, y: e.clientY - panY }
    } else if (activeTool === 'select') {
      const canvasCoords = getCanvasCoordinates(e)
      const clickedToken = getTokenAtPosition(canvasCoords.x, canvasCoords.y)

      if (clickedToken) {
        e.preventDefault()
        e.stopPropagation()
        
        if (e.ctrlKey || e.metaKey) {
          setSelectedTokenIds(prev => 
            prev.includes(clickedToken.id)
              ? prev.filter(id => id !== clickedToken.id)
              : [...prev, clickedToken.id]
          )
        } else {
          setSelectedTokenIds([clickedToken.id])
        }
      } else {
        if (!(e.ctrlKey || e.metaKey)) {
          setSelectedTokenIds([])
        }
        setIsSelecting(true)
        setSelectionStart(canvasCoords)
        setSelectionRect(null)
      }
    } else if (activeTool === 'measure' && measureMode) {
      e.preventDefault()
      const coords = getCanvasCoordinates(e)
      startMeasure(coords.x, coords.y)
    }
  }, [activeTool, panX, panY, getCanvasCoordinates, getTokenAtPosition, measureMode, startMeasure])

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      setPanX(e.clientX - panStartRef.current.x)
      setPanY(e.clientY - panStartRef.current.y)
    } else if (isSelecting && selectionStart) {
      const current = getCanvasCoordinates(e)
      setSelectionRect({
        x: Math.min(selectionStart.x, current.x),
        y: Math.min(selectionStart.y, current.y),
        width: Math.abs(current.x - selectionStart.x),
        height: Math.abs(current.y - selectionStart.y)
      })
    } else if (activeTool === 'measure' && measuring && measureMode && measureStart) {
      const coords = getCanvasCoordinates(e)
      scheduleUpdate(coords.x, coords.y)
    }
  }, [isPanning, isSelecting, selectionStart, getCanvasCoordinates, activeTool, measuring, measureMode, measureStart, scheduleUpdate])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
    } else if (isSelecting && selectionRect) {
      const selectedTokens = tokens
        .filter(t => t.page_id === activePageId)
        .filter(token => {
          const tokenSize = token.width || gridSize
          const tokenCenterX = token.position_x + tokenSize / 2
          const tokenCenterY = token.position_y + tokenSize / 2
          return tokenCenterX >= selectionRect.x &&
                 tokenCenterX <= selectionRect.x + selectionRect.width &&
                 tokenCenterY >= selectionRect.y &&
                 tokenCenterY <= selectionRect.y + selectionRect.height
        })
        .map(t => t.id)
      
      setSelectedTokenIds(selectedTokens)
      setIsSelecting(false)
      setSelectionRect(null)
      setSelectionStart(null)
    } else if (activeTool === 'measure' && measuring) {
      endMeasure()
    } else if (isSelecting) {
      setIsSelecting(false)
      setSelectionRect(null)
      setSelectionStart(null)
    }
  }, [isPanning, isSelecting, selectionRect, tokens, activePageId, gridSize, activeTool, measuring, endMeasure])

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mouseup', handleMouseUp)
      return () => window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isPanning, handleMouseUp])

  const handleContextMenu = (e) => {
    e.preventDefault()
    setShowContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCloseMenu = () => {
    setShowContextMenu(null)
  }

  const handleSetBackground = (imageId, imageUrl) => {
    if (!activePageId) return
    setPageBackground(activePageId, imageId)
    setShowBgPicker(false)
    setShowContextMenu(null)
  }

  const handleRemoveBackground = async () => {
    if (!activePageId) return
    setShowContextMenu(null)
    try {
      await removePageBackground(activePageId)
    } catch (err) {
      console.error('Failed to remove background:', err)
      alert('Ошибка при удалении: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleZoomIn = () => setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
  const handleZoomOut = () => setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
  const handleResetView = () => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  const pickerRef = useRef(null)
  useEffect(() => {
    if (!showBgPicker) return
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowBgPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBgPicker])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTokenIds.length > 0 && activeTool === 'select') {
        if (window.confirm(`Удалить ${selectedTokenIds.length} токен(ов)?`)) {
          selectedTokenIds.forEach(tokenId => {
            deleteToken(tokenId)
          })
          setSelectedTokenIds([])
        }
      }
      if (e.key === 'Escape') {
        setSelectedTokenIds([])
        setIsSelecting(false)
        setSelectionRect(null)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTokenIds, activeTool, deleteToken])

  const viewportCursor = activeTool === 'hand'
    ? (isPanning ? 'grabbing' : 'grab')
    : (activeTool === 'measure' ? 'crosshair' : 'default')

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      if (!activePageId) {
        alert('Сначала выберите активную страницу, затем размещайте токены на поле.')
        return
      }

      if (!isDm) {
        alert('Только DM может добавлять токены на карту.')
        return
      }

      const raw = e.dataTransfer.getData('text/plain')
      let data
      try {
        data = JSON.parse(raw)
      } catch (err) {
        console.error('[MapCanvas] failed to parse drop payload:', err, raw)
        return
      }
      
      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - panX) / zoom
      const y = (e.clientY - rect.top - panY) / zoom
      
      const snappedX = Math.round(x / gridSize) * gridSize
      const snappedY = Math.round(y / gridSize) * gridSize

      if (data.type === 'creature') {
        await createToken({
          name_in_room: data.name,
          creature_template_id: data.creatureId,
          position_x: snappedX,
          position_y: snappedY,
          page_id: activePageId,
        })
      }
      if (data.type === 'room-token') {
        await createToken({
          name_in_room: data.name,
          creature_template_id: data.creatureTemplateId || undefined,
          page_id: activePageId,
          position_x: snappedX,
          position_y: snappedY,
          width: data.width || undefined,
          height: data.height || undefined,
          current_hp: data.currentHp,
          current_ac: data.currentAc,
        })
      }
    } catch (err) {
      console.error('Failed to handle drop:', err)
      alert('Не удалось добавить токен на поле.')
    }
  }, [panX, panY, zoom, gridSize, activePageId, createToken, isDm])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const renderRuler = () => {
    if (!measuring || !measureStart || !measureEnd) return null

    const strokeW = Math.max(2, 3 / zoom)
    const circleR = Math.max(4, 5 / zoom)
    const dashArray = `${5/zoom},${5/zoom}`

    if (measureMode === 'line') {
      return (
        <svg 
          key={renderKey}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            pointerEvents: 'none', 
            zIndex: 1001,
            overflow: 'visible'
          }}
        >
          <line 
            x1={measureStart.x} y1={measureStart.y} 
            x2={measureEnd.x} y2={measureEnd.y} 
            stroke="#ff4444" strokeWidth={strokeW} strokeDasharray={dashArray} 
          />
          <circle cx={measureStart.x} cy={measureStart.y} r={circleR} fill="#ff4444" />
          <circle cx={measureEnd.x} cy={measureEnd.y} r={circleR} fill="#ff4444" />
        </svg>
      )
    }

    if (measureMode === 'circle') {
      const radius = Math.hypot(measureEnd.x - measureStart.x, measureEnd.y - measureStart.y)
      return (
        <svg 
          key={renderKey}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            pointerEvents: 'none', 
            zIndex: 1001,
            overflow: 'visible'
          }}
        >
          <circle 
            cx={measureStart.x} cy={measureStart.y} r={radius} 
            stroke="#44aaff" strokeWidth={strokeW} strokeDasharray={dashArray} 
            fill="rgba(68,170,255,0.1)" 
          />
          <circle cx={measureStart.x} cy={measureStart.y} r={circleR} fill="#44aaff" />
          <line 
            x1={measureStart.x} y1={measureStart.y} 
            x2={measureEnd.x} y2={measureEnd.y} 
            stroke="#44aaff" strokeWidth={strokeW * 0.7} strokeDasharray={`${3/zoom},${3/zoom}`} 
          />
        </svg>
      )
    }

    if (measureMode === 'cone') {
      const dx = measureEnd.x - measureStart.x
      const dy = measureEnd.y - measureStart.y
      const length = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      
      let points = `M ${measureStart.x},${measureStart.y} `
      for (let i = -45; i <= 45; i += 5) {
        const rad = (angle + i) * Math.PI / 180
        points += `${measureStart.x + Math.cos(rad) * length},${measureStart.y + Math.sin(rad) * length} `
      }
      points += `M ${measureStart.x},${measureStart.y}`
      
      return (
        <svg 
          key={renderKey}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            pointerEvents: 'none', 
            zIndex: 1001,
            overflow: 'visible'
          }}
        >
          <path 
            d={points} 
            stroke="#ffaa44" strokeWidth={strokeW} strokeDasharray={dashArray} 
            fill="rgba(255,170,68,0.15)" 
          />
          <circle cx={measureStart.x} cy={measureStart.y} r={circleR} fill="#ffaa44" />
        </svg>
      )
    }

    return null
  }

  const renderRemoteRulers = () => {
    return Object.entries(remoteRulers).map(([participantId, remoteRuler]) => {
      if (!remoteRuler.start || !remoteRuler.end) return null;
      
      const strokeW = Math.max(2, 3 / zoom);
      const circleR = Math.max(4, 5 / zoom);
      const dashArray = `${5/zoom},${5/zoom}`;

      const renderSVG = () => {
        if (remoteRuler.mode === 'line') {
          return (
            <svg 
              key={participantId}
              style={{ 
                position: 'absolute', 
                top: 0, left: 0, 
                width: `${canvasWidth}px`, 
                height: `${canvasHeight}px`,
                pointerEvents: 'none', 
                zIndex: 999,
                overflow: 'visible'
              }}
            >
              <line 
                x1={remoteRuler.start.x} y1={remoteRuler.start.y} 
                x2={remoteRuler.end.x} y2={remoteRuler.end.y} 
                stroke="#FFD700" strokeWidth={strokeW} strokeDasharray={dashArray} 
                opacity={0.7}
              />
              <circle cx={remoteRuler.start.x} cy={remoteRuler.start.y} r={circleR} fill="#FFD700" opacity={0.7} />
              <circle cx={remoteRuler.end.x} cy={remoteRuler.end.y} r={circleR} fill="#FFD700" opacity={0.7} />
            </svg>
          );
        }

        if (remoteRuler.mode === 'circle') {
          const radius = Math.hypot(remoteRuler.end.x - remoteRuler.start.x, remoteRuler.end.y - remoteRuler.start.y);
          return (
            <svg 
              key={participantId}
              style={{ 
                position: 'absolute', 
                top: 0, left: 0, 
                width: `${canvasWidth}px`, 
                height: `${canvasHeight}px`,
                pointerEvents: 'none', 
                zIndex: 999,
                overflow: 'visible'
              }}
            >
              <circle 
                cx={remoteRuler.start.x} cy={remoteRuler.start.y} r={radius} 
                stroke="#FFD700" strokeWidth={strokeW} strokeDasharray={dashArray} 
                fill="rgba(255,215,0,0.1)" opacity={0.7}
              />
              <circle cx={remoteRuler.start.x} cy={remoteRuler.start.y} r={circleR} fill="#FFD700" opacity={0.7} />
              <line 
                x1={remoteRuler.start.x} y1={remoteRuler.start.y} 
                x2={remoteRuler.end.x} y2={remoteRuler.end.y} 
                stroke="#FFD700" strokeWidth={strokeW * 0.7} strokeDasharray={`${3/zoom},${3/zoom}`} 
                opacity={0.7}
              />
            </svg>
          );
        }

        if (remoteRuler.mode === 'cone') {
          const dx = remoteRuler.end.x - remoteRuler.start.x;
          const dy = remoteRuler.end.y - remoteRuler.start.y;
          const length = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          
          let points = `M ${remoteRuler.start.x},${remoteRuler.start.y} `;
          for (let i = -45; i <= 45; i += 5) {
            const rad = (angle + i) * Math.PI / 180;
            points += `${remoteRuler.start.x + Math.cos(rad) * length},${remoteRuler.start.y + Math.sin(rad) * length} `;
          }
          points += `M ${remoteRuler.start.x},${remoteRuler.start.y}`;
          
          return (
            <svg 
              key={participantId}
              style={{ 
                position: 'absolute', 
                top: 0, left: 0, 
                width: `${canvasWidth}px`, 
                height: `${canvasHeight}px`,
                pointerEvents: 'none', 
                zIndex: 999,
                overflow: 'visible'
              }}
            >
              <path 
                d={points} 
                stroke="#FFD700" strokeWidth={strokeW} strokeDasharray={dashArray} 
                fill="rgba(255,215,0,0.15)" opacity={0.7}
              />
              <circle cx={remoteRuler.start.x} cy={remoteRuler.start.y} r={circleR} fill="#FFD700" opacity={0.7} />
            </svg>
          );
        }

        return null;
      };

      const renderResult = () => {
        if (!remoteRuler.result) return null;
        
        const midX = (remoteRuler.start.x + remoteRuler.end.x) / 2 * zoom + panX;
        const midY = (remoteRuler.start.y + remoteRuler.end.y) / 2 * zoom + panY - 40;
        const fontSize = Math.max(10, 12 / zoom);
        
        return (
          <div 
            key={`result-${participantId}`}
            style={{ 
              position: 'absolute', 
              left: `${midX}px`, 
              top: `${midY}px`, 
              transform: 'translate(-50%, -50%)', 
              background: 'rgba(0,0,0,0.8)', 
              color: '#FFD700', 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: `${fontSize}px`, 
              whiteSpace: 'nowrap', 
              pointerEvents: 'none', 
              zIndex: 1002,
              fontFamily: 'monospace',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,215,0,0.3)'
            }}
          >
            📏 {remoteRuler.result.cells} кл ({remoteRuler.result.feet} фт)
          </div>
        );
      };

      return (
        <div key={`remote-ruler-${participantId}`}>
          {renderSVG()}
          {renderResult()}
        </div>
      );
    });
  };

  const handleTokenSelect = useCallback((id, ctrlKey) => {
    if (ctrlKey) {
      setSelectedTokenIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      )
    } else {
      setSelectedTokenIds([id])
    }
  }, [])

  const renderContent = () => (
    <>
      {tokens
        .filter(t => t.page_id === activePageId)
        .map(token => (
          <Token
            key={token.id}
            token={token}
            gridSize={gridSize}
            zoom={zoom}
            gridVisible={gridVisible}
            isSelected={selectedTokenIds.includes(token.id)}
            currentUser={user}
            isDm={isDm}  
            onSelect={handleTokenSelect}
          />
        ))}

      {selectionRect && (
        <div
          className="selection-rect"
          style={{
            position: 'absolute',
            left: `${selectionRect.x}px`,
            top: `${selectionRect.y}px`,
            width: `${selectionRect.width}px`,
            height: `${selectionRect.height}px`,
            border: '1px solid #AEBDC6',
            backgroundColor: '#aebdc64e',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        />
      )}
    </>
  )

  if (!activePage) {
    return (
      <div
        className={"map-viewport" + (isDragOver ? ' drag-over' : '')}
        style={{ cursor: viewportCursor, overflow: 'visible' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <div className="map-placeholder">
          <span>📄</span>
          <p>Нет активной страницы</p>
        </div>
      </div>
    )
  }

  const commonProps = {
    ref: canvasRef,
    style: { cursor: viewportCursor, overflow: 'visible' },
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onContextMenu: handleContextMenu,
    onDrop: handleDrop,
    onDragOver: handleDragOver,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
  }

  const transformLayer = (
    <div
      className="map-transform-layer"
      style={{
        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        transformOrigin: '0 0',
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        overflow: 'visible'
      }}
    >
      {displayImageUrl && (
        <img
          src={displayImageUrl}
          alt={activePage.name || (activeMap?.name_in_room) || 'Карта'}
          className={`map-image ${backgroundImageUrl ? 'map-cover-bg' : 'map-original'}`}
          draggable={false}
        />
      )}

      {gridVisible && (
        <div
          className="grid-overlay"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 0, 0, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize}px ${gridSize}px`
          }}
        />
      )}

      {renderContent()}
      {renderRuler()}
      {renderRemoteRulers()}
      <DrawingLayer
        drawingLayerRef={drawingLayerRef}
        activeTool={activeTool}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        gridSize={gridSize}
        zoom={zoom}
        panX={panX}
        panY={panY}
        color={drawColor}
        brushSize={drawBrushSize}
      />
    </div>
  )

  const renderCommonElements = () => (
    <>
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomIn}>+</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button className="zoom-btn" onClick={handleZoomOut}>−</button>
        <button className="zoom-btn" onClick={handleResetView}>⌂</button>
      </div>

      {measureResult && measuring && measureStart && measureEnd && (
        (() => {
          const midX = (measureStart.x + measureEnd.x) / 2 * zoom + panX
          const midY = (measureStart.y + measureEnd.y) / 2 * zoom + panY - 30
          const fontSize = Math.max(10, 12 / zoom)
          return (
            <div style={{ 
              position: 'absolute', 
              left: `${midX}px`, 
              top: `${midY}px`, 
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
              📏 {measureResult.cells} клеток ({measureResult.feet} футов)
            </div>
          )
        })()
      )}

      {showContextMenu && (
        <>
          <div className="context-menu-backdrop" onClick={handleCloseMenu} />
          <div className="map-context-menu" style={{ left: showContextMenu.x, top: showContextMenu.y }}>
            <button className="menu-item" onClick={() => setShowBgPicker(true)}>
              Выбрать фоновое изображение
            </button>
            {backgroundImageUrl && (
              <button className="menu-item danger" onClick={handleRemoveBackground}>
                Удалить фоновое изображение
              </button>
            )}
          </div>
        </>
      )}

      {showBgPicker && (
        <div className="bg-image-picker" ref={pickerRef} style={{ left: showContextMenu.x, top: showContextMenu.y }}>
          <div className="bg-picker-header">
            <span>Фоновое изображение</span>
            <button className="bg-picker-close" onClick={() => setShowBgPicker(false)}>✕</button>
          </div>
          {roomImages.length === 0 ? (
            <div className="bg-picker-empty">Нет изображений в комнате</div>
          ) : (
            <div className="bg-picker-grid">
              {roomImages.map((img, idx) => (
                <div key={idx} className="bg-picker-item" onClick={() => handleSetBackground(img.id, img.url)}>
                  <img src={img.url} alt={img.name} />
                  <span className="bg-picker-item-name">{img.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className={"map-viewport" + (isDragOver ? ' drag-over' : '')} {...commonProps}>
      {transformLayer}
      {renderCommonElements()}
    </div>
  )
}