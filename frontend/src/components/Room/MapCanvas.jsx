import { useState, useRef, useEffect, useCallback } from 'react'
import { useRoom } from '../../context/RoomContext'
import { Token } from './Token'
import './MapCanvas.css'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.1

export function MapCanvas({ activeTool = 'select', canvasWidth, canvasHeight, gridSize, gridVisible }) {
  const {
    maps, activeMapId, pages, activePageId,
    setPageBackground, removePageBackground,
    tokens, setTokens, sendTokenMove, roomId, createToken,
    isDm,
  } = useRoom()
  const [showContextMenu, setShowContextMenu] = useState(null)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [draggedImage, setDraggedImage] = useState(null)

  // Pan & Zoom state
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const [isDragOver, setIsDragOver] = useState(false)

  const activePage = pages.find(p => p.id === activePageId)
  let activeMap = null

  if (activePage?.map) {
    activeMap = activePage.map
  } else if (activeMapId) {
    activeMap = maps.find(m => m.id === activeMapId)
  }

  // Приоритет: фоновое изображение страницы > карта страницы
  const backgroundImageUrl = activePage?.background_image_url
  const mapImageUrl = activeMap?.image_url
  const displayImageUrl = backgroundImageUrl || mapImageUrl

  // Собираем все уникальные изображения из карт комнаты
  const roomImages = maps
    .filter(m => m.image_url)
    .map(m => ({ id: m.image_id || m.template_image_id, url: m.image_url, name: m.name_in_room || 'Карта' }))
    .filter((img, i, arr) => arr.findIndex(x => x.url === img.url) === i)

  const canvasRef = useRef(null)

  // Zoom with wheel (приближение к курсору)
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta))
    const scale = newZoom / zoom

    // Сдвиг чтобы зум был к курсору
    setPanX(mouseX - scale * (mouseX - panX))
    setPanY(mouseY - scale * (mouseY - panY))
    setZoom(newZoom)
  }, [zoom, panX, panY])

  // Register wheel handler with passive: false
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Pan with mouse
  const handleMouseDown = useCallback((e) => {
    if (activeTool === 'hand') {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = { x: e.clientX - panX, y: e.clientY - panY }
    }
  }, [activeTool, panX, panY])

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      setPanX(e.clientX - panStartRef.current.x)
      setPanY(e.clientY - panStartRef.current.y)
    }
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mouseup', handleMouseUp)
      return () => window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isPanning, handleMouseUp])

  // Context menu
  const handleContextMenu = (e) => {
    e.preventDefault()
    setShowContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCloseMenu = () => {
    setShowContextMenu(null)
  }

  const handleSetBackground = (imageId, imageUrl) => {
    if (!activePageId) return
    const urlParts = imageUrl.split('/')
    const idFromUrl = parseInt(urlParts[urlParts.length - 1], 10)
    setPageBackground(activePageId, idFromUrl)
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

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
  const handleZoomOut = () => setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
  const handleResetView = () => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  // Закрыть bg-picker по клику вне
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

  // Cursor style based on tool
  const viewportCursor = activeTool === 'hand'
    ? (isPanning ? 'grabbing' : 'grab')
    : 'default'

  // Обработка drop из библиотеки
  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      try {
        console.debug('[MapCanvas] drop event types:', e.dataTransfer && Array.from(e.dataTransfer.types))
      } catch (err) {
        console.warn('[MapCanvas] failed to read dataTransfer types:', err)
      }

      if (!activePageId) {
        alert('Сначала выберите активную страницу, затем размещайте токены на поле.')
        return
      }

      // Only DM can create tokens on the server
      if (!isDm) {
        alert('Только DM может добавлять токены на карту.')
        return
      }

      const raw = e.dataTransfer.getData('text/plain')
      console.debug('[MapCanvas] drop raw data:', raw)
      let data
      try {
        data = JSON.parse(raw)
      } catch (err) {
        console.error('[MapCanvas] failed to parse drop payload:', err, raw)
        return
      }
      
      // Вычисляем позицию относительно карты
      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - panX) / zoom
      const y = (e.clientY - rect.top - panY) / zoom
      
      // Привязка к сетке
      const snappedX = Math.round(x / gridSize) * gridSize
      const snappedY = Math.round(y / gridSize) * gridSize

      if (data.type === 'creature') {

        console.debug('[MapCanvas] creating token from creature payload', data)
        try {
          await createToken({
            name_in_room: data.name,
            creature_template_id: data.creatureId,
            position_x: snappedX,
            position_y: snappedY,
            page_id: activePageId,
          })
        } catch (err) {
          console.error('[MapCanvas] createToken (creature) failed:', err, err.response?.data || null)
          throw err
        }
      }
      if (data.type === 'room-token') {
        console.debug('[MapCanvas] creating token from room-token payload', data)
        try {
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
        } catch (err) {
          console.error('[MapCanvas] createToken (room-token) failed:', err, err.response?.data || null)
          throw err
        }
      }
    } catch (err) {
      console.error('Failed to handle drop:', err)
      alert('Не удалось добавить токен на поле. Проверьте права DM и попробуйте еще раз.')
    }
  }, [panX, panY, zoom, gridSize, activePageId, createToken])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(true)
    console.debug('[MapCanvas] dragenter')
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    console.debug('[MapCanvas] dragleave')
  }, [])

  if (!activePage) {
    return (
      <div
        className={"map-viewport" + (isDragOver ? ' drag-over' : '')}
        style={{ cursor: viewportCursor }}
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

  // Пустое поле заданного размера и цвета — когда нет изображения
  if (!displayImageUrl) {
    return (
      <div
        className="map-viewport"
        ref={canvasRef}
        style={{
          cursor: viewportCursor,
          background: activePage?.background_color || '#FFFFFF',
        }}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Трансформируемый слой (пустой, но с правильными размерами) */}
        <div
          className="map-transform-layer"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
          }}
        >
          {/* Сетка */}
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

          {/* Токены */}
          {tokens
            .filter(t => t.page_id === activePageId)
            .map(token => (
              <Token
                key={token.id}
                token={token}
                gridSize={gridSize}
                zoom={zoom}
              />
            ))
          }
        </div>

        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={handleZoomIn} title="Приблизить">+</button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={handleZoomOut} title="Отдалить">−</button>
          <button className="zoom-btn" onClick={handleResetView} title="Сбросить вид">⌂</button>
        </div>

        {showContextMenu && (
          <>
            <div className="context-menu-backdrop" onClick={handleCloseMenu} />
            <div
              className="map-context-menu"
              style={{ left: showContextMenu.x, top: showContextMenu.y }}
            >
              <button className="menu-item" onClick={() => setShowBgPicker(true)}>
                🖼️ Выбрать фоновое изображение
              </button>
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
                  <div
                    key={idx}
                    className="bg-picker-item"
                    onClick={() => handleSetBackground(img.id, img.url)}
                  >
                    <img src={img.url} alt={img.name} />
                    <span className="bg-picker-item-name">{img.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={"map-viewport" + (isDragOver ? ' drag-over' : '')}
      ref={canvasRef}
      style={{ cursor: viewportCursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* Трансформируемый слой: карта + сетка */}
      <div
        className="map-transform-layer"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
        }}
      >
        <img
          src={displayImageUrl}
          alt={activePage.name || (activeMap?.name_in_room) || 'Карта'}
          className={`map-image ${backgroundImageUrl ? 'map-cover-bg' : 'map-original'}`}
          draggable={false}
        />

        {/* Сетка */}
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

        {/* Токены */}
        {tokens
          .filter(t => t.page_id === activePageId)
          .map(token => (
            <Token
              key={token.id}
              token={token}
              gridSize={gridSize}
              zoom={zoom}
            />
          ))
        }
      </div>

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomIn} title="Приблизить">+</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button className="zoom-btn" onClick={handleZoomOut} title="Отдалить">−</button>
        <button className="zoom-btn" onClick={handleResetView} title="Сбросить вид">⌂</button>
      </div>

      {/* Контекстное меню */}
      {showContextMenu && (
        <>
          <div className="context-menu-backdrop" onClick={handleCloseMenu} />
          <div
            className="map-context-menu"
            style={{ left: showContextMenu.x, top: showContextMenu.y }}
          >
            <button className="menu-item" onClick={() => setShowBgPicker(true)}>
              🖼️ Выбрать фоновое изображение
            </button>
            {backgroundImageUrl && (
              <button className="menu-item danger" onClick={handleRemoveBackground}>
                🗑️ Удалить фоновое изображение
              </button>
            )}
          </div>
        </>
      )}

      {/* Пикер изображений */}
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
                <div
                  key={idx}
                  className="bg-picker-item"
                  onClick={() => handleSetBackground(img.id, img.url)}
                >
                  <img src={img.url} alt={img.name} />
                  <span className="bg-picker-item-name">{img.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
