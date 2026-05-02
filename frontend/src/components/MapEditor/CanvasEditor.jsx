import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { mapEditorAPI } from '../../api'
import { FiRotateCw, FiMaximize2, FiMinus, FiPlus, FiTrash2, FiSave, FiChevronUp, FiChevronDown, FiEye, FiBox, FiPenTool, FiType, FiMenu, FiMap, FiHome } from 'react-icons/fi'
import './CanvasEditor.css'

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}

export default function CanvasEditor({
  projectId,
  packs = [],
  selectedPack,
  initialObjects = [],
  projectName = 'Моя карта',
  onSelectPack,
  onSaveRendered
}) {
  const navigate = useNavigate()
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState(projectName)
  const [saveDescription, setSaveDescription] = useState('')
  const [saveTags, setSaveTags] = useState('')
  const [saveIsPublic, setSaveIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const canvasAreaRef = useRef(null)
  const canvasGridRef = useRef(null)
  const menuRef = useRef(null)
  const [assets, setAssets] = useState([])
  const [objects, setObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState(null)
  const [gridSize, setGridSize] = useState(48)
  const [activeTool, setActiveTool] = useState('objects')
  const [showObjectsPanel, setShowObjectsPanel] = useState(true)
  const draggingRef = useRef(null)
  const [assetsLoading, setAssetsLoading] = useState(false)

  // Закрытие меню при клике вне его
  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  useEffect(() => {
    if (initialObjects && initialObjects.length > 0) {
      const loaded = initialObjects.map(obj => ({
        id: obj.id,
        asset_id: obj.asset_id,
        image_url: obj.image_url,
        x: obj.x,
        y: obj.y,
        width: obj.width || gridSize,
        height: obj.height || gridSize,
        rotation: obj.rotation || 0,
        flip_h: obj.flip_h || obj.flipped_h || false,
        flip_v: obj.flip_v || obj.flipped_v || false,
        z_index: obj.z_index || 0,
        tint_color: obj.tint_color,
        opacity: obj.opacity ?? 1,
        locked: obj.locked || false
      }))
      setObjects(loaded)
    }
  }, [initialObjects, gridSize])

  useEffect(() => {
    if (selectedPack) {
      loadAssets(selectedPack.id)
    } else if (packs.length > 0 && !selectedPack) {
      onSelectPack(packs[0])
    }
  }, [selectedPack, packs])

  useEffect(() => {
    if (selectedObjectId) {
      setActiveTool('objects')
      setShowObjectsPanel(true)
    }
  }, [selectedObjectId])

  const loadAssets = async (packId) => {
    if (!packId) return
    setAssetsLoading(true)
    try {
      const { data } = await mapEditorAPI.getPackAssets(packId)
      console.log('Loaded assets:', data?.length || 0, 'for pack:', packId)
      setAssets(data || [])
    } catch (e) {
      console.warn('Failed to load assets for pack', packId, e)
      try {
        const { data } = await mapEditorAPI.getPackAssets(packId)
        setAssets(data || [])
      } catch (e2) {
        console.error('Failed to load assets (fallback)', e2)
      }
    } finally {
      setAssetsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (draggingRef.current) {
        document.removeEventListener('mousemove', draggingRef.current.onMove)
        document.removeEventListener('mouseup', draggingRef.current.onUp)
      }
    }
  }, [])

  useEffect(() => {
    const canvasArea = canvasAreaRef.current
    if (!canvasArea) return

    const handleDragStart = (e) => {
      const assetItem = e.target.closest('.asset-mini-item')
      if (!assetItem) return
      const id = assetItem.dataset.assetId
      if (!id) return
      console.log('Drag start, asset id:', id)
      e.dataTransfer.setData('text/asset-id', id)
      e.dataTransfer.effectAllowed = 'move'
    }

    const handleDrop = async (e) => {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/asset-id')
      console.log('Drop, asset id:', id)
      if (!id) return

      const asset = assets.find((a) => String(a.id) === String(id))
      if (!asset) {
        console.warn('Asset not found:', id, 'available:', assets.map(a => a.id))
        return
      }

      const rect = canvasArea.getBoundingClientRect()
      const scrollLeft = canvasArea.scrollLeft
      const scrollTop = canvasArea.scrollTop
      const x = Math.round((e.clientX - rect.left + scrollLeft - (asset.default_width || gridSize) / 2) / gridSize) * gridSize
      const y = Math.round((e.clientY - rect.top + scrollTop - (asset.default_height || gridSize) / 2) / gridSize) * gridSize

      console.log('Adding object at:', x, y, 'asset:', asset.name || asset.id)

      try {
        const { data: serverObj } = await mapEditorAPI.addObject(projectId, {
          asset_id: asset.id,
          x,
          y,
          width: asset.default_width || gridSize,
          height: asset.default_height || gridSize,
          rotation: 0,
          z_index: objects.length,
          flipped_h: false,
          flipped_v: false,
          opacity: 1,
          locked: false
        })

        const newObj = {
          id: serverObj.id,
          asset_id: asset.id,
          image_url: asset.image_url,
          x,
          y,
          width: asset.default_width || gridSize,
          height: asset.default_height || gridSize,
          rotation: 0,
          flip_h: false,
          flip_v: false,
          z_index: objects.length,
          opacity: 1,
          locked: false
        }
        setObjects((prev) => [...prev, newObj])
        setSelectedObjectId(newObj.id)
      } catch (err) {
        console.error('Failed to add object', err)
        const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const localObj = {
          id: localId,
          asset_id: asset.id,
          image_url: asset.image_url,
          x,
          y,
          width: asset.default_width || gridSize,
          height: asset.default_height || gridSize,
          rotation: 0,
          flip_h: false,
          flip_v: false,
          z_index: objects.length,
          opacity: 1,
          locked: false,
          _local: true
        }
        setObjects((prev) => [...prev, localObj])
        setSelectedObjectId(localObj.id)
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }

    document.addEventListener('dragstart', handleDragStart)
    canvasArea.addEventListener('drop', handleDrop)
    canvasArea.addEventListener('dragover', handleDragOver)

    return () => {
      document.removeEventListener('dragstart', handleDragStart)
      canvasArea.removeEventListener('drop', handleDrop)
      canvasArea.removeEventListener('dragover', handleDragOver)
    }
  }, [assets, objects.length, gridSize, projectId])

  const syncUpdate = async (obj) => {
    if (!projectId || obj._local) return
    try {
      await mapEditorAPI.updateObject(obj.id, {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        rotation: obj.rotation || 0,
        z_index: obj.z_index || 0,
        flipped_h: obj.flip_h || false,
        flipped_v: obj.flip_v || false,
        opacity: obj.opacity ?? 1,
        locked: obj.locked || false,
        tint_color: obj.tint_color || null
      })
    } catch (e) {
      console.error('syncUpdate failed', e)
    }
  }

  const syncDelete = async (objId) => {
    if (!projectId) return
    try {
      await mapEditorAPI.deleteObject(objId)
    } catch (e) {
      console.error('syncDelete failed', e)
    }
  }

  const onObjectMouseDown = (e, obj) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedObjectId(obj.id)

    if (draggingRef.current) {
      document.removeEventListener('mousemove', draggingRef.current.onMove)
      document.removeEventListener('mouseup', draggingRef.current.onUp)
    }

    let currentObj = { ...obj }
    const canvasArea = canvasAreaRef.current

    const onMove = (ev) => {
      if (!canvasArea) return
      const canvasRect = canvasArea.getBoundingClientRect()
      const scrollLeft = canvasArea.scrollLeft
      const scrollTop = canvasArea.scrollTop
      let nx = Math.round((ev.clientX - canvasRect.left + scrollLeft - currentObj.width / 2) / gridSize) * gridSize
      let ny = Math.round((ev.clientY - canvasRect.top + scrollTop - currentObj.height / 2) / gridSize) * gridSize

      setObjects((prev) => {
        const updated = prev.map((o) => (o.id === currentObj.id ? { ...o, x: nx, y: ny } : o))
        const found = updated.find(o => o.id === currentObj.id)
        if (found) currentObj = { ...found }
        return updated
      })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      draggingRef.current = null
      syncUpdate(currentObj)
    }

    draggingRef.current = { onMove, onUp }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleCanvasClick = (e) => {
    if (e.target === canvasAreaRef.current || e.target === canvasGridRef.current) {
      setSelectedObjectId(null)
    }
  }

  const removeSelected = useCallback(() => {
    if (!selectedObjectId) return
    const obj = objects.find(o => o.id === selectedObjectId)
    setObjects((prev) => prev.filter((o) => o.id !== selectedObjectId))
    if (obj && !obj._local) {
      syncDelete(selectedObjectId)
    }
    setSelectedObjectId(null)
  }, [selectedObjectId, objects])

  const bringToFront = useCallback(() => {
    if (!selectedObjectId) return
    setObjects((prev) => {
      const max = Math.max(...prev.map((p) => p.z_index || 0), 0)
      const updated = prev.map((o) => (o.id === selectedObjectId ? { ...o, z_index: max + 1 } : o))
      const obj = updated.find(o => o.id === selectedObjectId)
      if (obj) syncUpdate(obj)
      return updated
    })
  }, [selectedObjectId])

  const sendToBack = useCallback(() => {
    if (!selectedObjectId) return
    setObjects((prev) => {
      const min = Math.min(...prev.map((p) => p.z_index || 0), 0)
      const updated = prev.map((o) => (o.id === selectedObjectId ? { ...o, z_index: min - 1 } : o))
      const obj = updated.find(o => o.id === selectedObjectId)
      if (obj) syncUpdate(obj)
      return updated
    })
  }, [selectedObjectId])

  const flipSelected = useCallback(() => {
    if (!selectedObjectId) return
    setObjects((prev) => {
      const updated = prev.map((o) => (o.id === selectedObjectId ? { ...o, flip_h: !o.flip_h } : o))
      const obj = updated.find(o => o.id === selectedObjectId)
      if (obj) syncUpdate(obj)
      return updated
    })
  }, [selectedObjectId])

  const scaleSelected = useCallback((factor) => {
    if (!selectedObjectId) return
    setObjects((prev) => {
      const updated = prev.map((o) => {
        if (o.id === selectedObjectId) {
          const newW = Math.max(gridSize, Math.round(o.width * factor / gridSize) * gridSize)
          const newH = Math.max(gridSize, Math.round(o.height * factor / gridSize) * gridSize)
          return { ...o, width: newW, height: newH }
        }
        return o
      })
      const obj = updated.find(o => o.id === selectedObjectId)
      if (obj) syncUpdate(obj)
      return updated
    })
  }, [selectedObjectId, gridSize])

  const handleToolClick = (tool) => {
    if (tool === 'save') {
      setSaveName(projectName)
      setSaveDescription('')
      setSaveTags('')
      setSaveIsPublic(false)
      setShowSaveModal(true)
      return
    }

    if (activeTool === tool) {
      if (tool === 'objects') {
        setShowObjectsPanel(!showObjectsPanel)
      } else {
        setShowObjectsPanel(false)
        setActiveTool(null)
      }
      return
    }

    setActiveTool(tool)
    setShowObjectsPanel(tool === 'objects')
  }

  const getSelectedObject = () => objects.find(o => o.id === selectedObjectId)
  const selectedObj = getSelectedObject()

  const handleSave = async () => {
    if (!saveName.trim()) return alert('Введите название')

    const grid = canvasGridRef.current
    if (!grid) return

    setSaving(true)
    try {
      const rect = grid.getBoundingClientRect()
      const c = document.createElement('canvas')
      c.width = rect.width
      c.height = rect.height
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      const list = objects.slice().sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
      for (const o of list) {
        if (!o.image_url) continue
        try {
          const img = await loadImage(o.image_url)
          ctx.save()
          ctx.translate(o.x + o.width / 2, o.y + o.height / 2)
          ctx.rotate(((o.rotation || 0) * Math.PI) / 180)
          ctx.scale(o.flip_h ? -1 : 1, o.flip_v ? -1 : 1)
          ctx.globalAlpha = o.opacity ?? 1
          ctx.drawImage(img, -o.width / 2, -o.height / 2, o.width, o.height)
          ctx.restore()
        } catch (imgErr) {
          console.warn('Failed to load image for object', o.id, imgErr)
        }
      }

      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'))

      if (blob && onSaveRendered) {
        onSaveRendered({
          name: saveName.trim(),
          description: saveDescription.trim(),
          tags: saveTags.trim(),
          is_public: saveIsPublic,
          blob,
        })
        setShowSaveModal(false)
      }
    } catch (e) {
      console.error('render fail', e)
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="canvas-editor-fullscreen">
        {/* Левая панель инструментов */}
        <div className="editor-sidebar">
          {/* Кнопка меню (гамбургер) */}
          <div className="sidebar-top">
            <div className="sidebar-menu-wrapper" ref={menuRef}>
              <button
                className={`sidebar-icon ${showMenu ? 'active' : ''}`}
                onClick={() => setShowMenu(!showMenu)}
                title="Меню"
              >
                <FiMenu size={20} />
              </button>

              {showMenu && (
                <div className="sidebar-dropdown-menu">
                  <button
                    className="sidebar-menu-item"
                    onClick={() => {
                      setShowMenu(false)
                      navigate('/map')
                    }}
                  >
                    <FiMap size={16} />
                    <span>Назад к картам</span>
                  </button>
                  <button
                    className="sidebar-menu-item"
                    onClick={() => {
                      setShowMenu(false)
                      navigate('/')
                    }}
                  >
                    <FiHome size={16} />
                    <span>Главное меню</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-icons">
            <button
              className={`sidebar-icon ${activeTool === 'objects' ? 'active' : ''}`}
              onClick={() => handleToolClick('objects')}
              title="Объекты"
            >
              <FiBox size={20} />
            </button>

            <button
              className={`sidebar-icon ${activeTool === 'brush' ? 'active' : ''}`}
              onClick={() => handleToolClick('brush')}
              title="Кисть"
            >
              <FiPenTool size={20} />
            </button>

            <button
              className={`sidebar-icon ${activeTool === 'text' ? 'active' : ''}`}
              onClick={() => handleToolClick('text')}
              title="Текст"
            >
              <FiType size={20} />
            </button>
          </div>

          <div className="sidebar-footer">
            <button
              className="sidebar-icon sidebar-icon-save"
              onClick={() => handleToolClick('save')}
              title="Сохранить"
            >
              <FiSave size={18} />
            </button>
          </div>
        </div>

        {/* Панель объектов */}
        <div className={`editor-objects-panel ${showObjectsPanel ? '' : 'collapsed'}`}>
          <div className="editor-objects-panel-content">
            <div className="selected-object-section">
              <h3>Выбранный объект</h3>
              {selectedObj ? (
                <div className="selected-object-preview">
                  <img
                    src={selectedObj.image_url}
                    alt="Selected"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                </div>
              ) : (
                <div className="selected-object-placeholder">
                  Нет выбранного объекта
                </div>
              )}
            </div>

            <div className="assets-section">
              <h3>Объекты пакета</h3>
              {assetsLoading ? (
                <p style={{ fontSize: 12, color: '#999' }}>Загрузка...</p>
              ) : assets.length === 0 ? (
                <p style={{ fontSize: 12, color: '#999' }}>
                  {selectedPack ? 'Нет ассетов в пакете' : 'Пакет не выбран'}
                </p>
              ) : (
                <div className="assets-mini-grid">
                  {assets.map((a) => (
                    <div
                      key={a.id}
                      className="asset-mini-item"
                      draggable
                      data-asset-id={a.id}
                      title={a.name || 'Asset'}
                    >
                      <img 
                        src={a.image_url} 
                        alt={a.name || 'Asset'} 
                        draggable={false}
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* {packs.length > 0 && (
              <div className="packs-section">
                <h4>Пакеты</h4>
                <div className="packs-mini-grid">
                  {packs.map((p) => (
                    <button
                      key={p.id}
                      className={`pack-mini-btn ${selectedPack && selectedPack.id === p.id ? 'active' : ''}`}
                      onClick={() => onSelectPack(p)}
                      title={p.name}
                    >
                      📦
                    </button>
                  ))}
                </div>
              </div>
            )} */}

            {selectedObj && (
              <div className="object-params-section">
                <h4>Параметры</h4>

                {/* Размер */}
                <div className="param-control">
                  <div className="param-slider-group">
                    <div className="param-slider-icon">
                      <FiMaximize2 size={16} />
                    </div>
                    <input
                      type="range"
                      min={Math.max(24, gridSize / 2)}
                      max={gridSize * 10}
                      step={1}
                      value={Math.round((selectedObj.width + selectedObj.height) / 2)}
                      onChange={(e) => {
                        const newAvgSize = Number(e.target.value)
                        const oldAvgSize = (selectedObj.width + selectedObj.height) / 2
                        const ratio = selectedObj.width / selectedObj.height || 1
                        const factor = newAvgSize / oldAvgSize
                        
                        setObjects((prev) =>
                          prev.map((o) => {
                            if (o.id === selectedObjectId) {
                              const newW = Math.max(24, Math.min(gridSize * 12, o.width * factor))
                              const newH = Math.max(24, Math.min(gridSize * 12, o.height * factor))
                              return { ...o, width: newW, height: newH }
                            }
                            return o
                          })
                        )
                      }}
                      onMouseUp={() => {
                        const obj = getSelectedObject()
                        if (obj) syncUpdate(obj)
                      }}
                      onTouchEnd={() => {
                        const obj = getSelectedObject()
                        if (obj) syncUpdate(obj)
                      }}
                      className="param-slider"
                    />
                    <span className="param-value">
                      {Math.round(selectedObj.width)}×{Math.round(selectedObj.height)}
                    </span>
                  </div>
                </div>

                {/* Поворот */}
                <div className="param-control">
                  <div className="param-slider-group">
                    <div className="param-slider-icon">
                      <FiRotateCw size={16} />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step={1}
                      value={selectedObj.rotation || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setObjects((prev) =>
                          prev.map((o) => (o.id === selectedObjectId ? { ...o, rotation: val } : o))
                        )
                      }}
                      onMouseUp={() => {
                        const obj = getSelectedObject()
                        if (obj) syncUpdate(obj)
                      }}
                      onTouchEnd={() => {
                        const obj = getSelectedObject()
                        if (obj) syncUpdate(obj)
                      }}
                      className="param-slider"
                    />
                    <span className="param-value">{selectedObj.rotation || 0}°</span>
                  </div>
                </div>

                {/* Слой */}
                <div className="param-control">
                  <div className="param-slider-group">
                    <div className="param-slider-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 22 8.5 12 15 2 8.5 12 2" />
                        <polyline points="2 15.5 12 22 22 15.5" />
                      </svg>
                    </div>
                    <input
                      type="range"
                      min={Math.min(...objects.map(o => o.z_index || 0), 0) - 5}
                      max={Math.max(...objects.map(o => o.z_index || 0), 0) + 5}
                      step={1}
                      value={selectedObj.z_index || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setObjects((prev) =>
                          prev.map((o) => (o.id === selectedObjectId ? { ...o, z_index: val } : o))
                        )
                      }}
                      onMouseUp={() => {
                        const obj = getSelectedObject()
                        if (obj) syncUpdate(obj)
                      }}
                      onTouchEnd={() => {
                        const obj = getSelectedObject()
                        if (obj) syncUpdate(obj)
                      }}
                      className="param-slider"
                    />
                    <span className="param-value">{selectedObj.z_index || 0}</span>
                  </div>
                </div>

                {/* Кнопки */}
                <button
                  className="param-btn-full"
                  onClick={flipSelected}
                  title="Отразить"
                >
                  <FiRotateCw size={14} style={{ transform: 'scaleX(-1)' }} />
                  <span>Отразить</span>
                </button>

                <button
                  className="param-btn-full danger"
                  onClick={removeSelected}
                  title="Удалить"
                >
                  <FiTrash2 size={14} />
                  <span>Удалить</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Холст */}
        <div className="editor-main">
          <div className="editor-canvas-wrapper">
            <div
              className="editor-canvas-area"
              ref={canvasAreaRef}
              onClick={handleCanvasClick}
            >
              <div
                className="editor-canvas-grid"
                ref={canvasGridRef}
                style={{ backgroundSize: `${gridSize}px ${gridSize}px` }}
              >
                {objects
                  .slice()
                  .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
                  .map((o) => (
                    <div
                      key={o.id}
                      className={`editor-canvas-object ${selectedObjectId === o.id ? 'selected' : ''}`}
                      style={{
                        left: o.x,
                        top: o.y,
                        width: o.width,
                        height: o.height,
                        transform: `rotate(${o.rotation || 0}deg) scaleX(${o.flip_h ? -1 : 1}) scaleY(${o.flip_v ? -1 : 1})`,
                        zIndex: o.z_index || 0,
                        backgroundImage: `url(${o.image_url})`,
                        opacity: o.opacity ?? 1,
                      }}
                      onMouseDown={(e) => onObjectMouseDown(e, o)}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="save-modal" onClick={() => setShowSaveModal(false)}>
          <div className="save-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Сохранить карту</h2>

            <div className="save-modal-form">
              <input
                type="text"
                placeholder="Название карты"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="save-modal-input"
              />

              <textarea
                placeholder="Описание (необязательно)"
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                className="save-modal-input"
                rows={3}
              />

              <input
                type="text"
                placeholder="Теги через запятую"
                value={saveTags}
                onChange={(e) => setSaveTags(e.target.value)}
                className="save-modal-input"
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: '#666' }}>
                <input
                  type="checkbox"
                  checked={saveIsPublic}
                  onChange={(e) => setSaveIsPublic(e.target.checked)}
                />
                Публичная карта
              </label>
            </div>

            <div className="save-modal-buttons">
              <button
                className="save-modal-btn secondary"
                onClick={() => setShowSaveModal(false)}
              >
                Отмена
              </button>
              <button
                className="save-modal-btn primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}