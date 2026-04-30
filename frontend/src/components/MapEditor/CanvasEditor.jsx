import React, { useEffect, useRef, useState } from 'react'
import { mapEditorAPI } from '../../api'
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
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState(projectName)
  const [saveDescription, setSaveDescription] = useState('')
  const [saveTags, setSaveTags] = useState('')
  const [saveIsPublic, setSaveIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef(null)
  const paletteRef = useRef(null)
  const [assets, setAssets] = useState([])
  const [objects, setObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState(null)
  const [gridSize, setGridSize] = useState(48)

  useEffect(() => {
    if (initialObjects.length > 0) {
      const loaded = initialObjects.map(obj => ({
        id: obj.id,
        asset_id: obj.asset_id,
        image_url: obj.image_url,
        x: obj.x,
        y: obj.y,
        width: obj.width || gridSize,
        height: obj.height || gridSize,
        rotation: obj.rotation || 0,
        flip_h: obj.flipped_h || false,
        z_index: obj.z_index || 0,
        tint_color: obj.tint_color,
        opacity: obj.opacity,
        locked: obj.locked
      }))
      setObjects(loaded)
    }
  }, [initialObjects])

  useEffect(() => {
    if (selectedPack) loadAssets(selectedPack.id)
  }, [selectedPack])

  const loadAssets = async (packId) => {
    try {
      const { data } = await mapEditorAPI.getPackAssets(packId)
      setAssets(data || [])
    } catch (e) {
      console.warn('fail load assets', e)
    }
  }
  useEffect(() => {
    const palette = paletteRef.current
    const canvas = canvasRef.current
    if (!palette || !canvas) return

    const onDragStart = (e) => {
      const id = e.target.dataset.assetId
      if (!id) return
      e.dataTransfer.setData('text/asset-id', id)
    }

    palette.querySelectorAll('.asset-item').forEach((el) => {
      el.addEventListener('dragstart', onDragStart)
    })

    const onDrop = async (e) => {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/asset-id')
      const asset = assets.find((a) => String(a.id) === String(id))
      if (!asset) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.round((e.clientX - rect.left) / gridSize) * gridSize
      const y = Math.round((e.clientY - rect.top) / gridSize) * gridSize
      
      // Сначала создаём объект на бэкенде
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
        
        // Добавляем в стейт с serverId
        const obj = {
          id: serverObj.id,
          asset_id: asset.id,
          image_url: asset.image_url,
          x,
          y,
          width: asset.default_width || gridSize,
          height: asset.default_height || gridSize,
          rotation: 0,
          flip_h: false,
          z_index: objects.length,
        }
        setObjects((prev) => [...prev, obj])
      } catch (e) {
        console.error('Failed to add object', e)
      }
    }

    const onDragOver = (e) => e.preventDefault()
    canvas.addEventListener('drop', onDrop)
    canvas.addEventListener('dragover', onDragOver)

    return () => {
      palette.querySelectorAll('.asset-item').forEach((el) => {
        el.removeEventListener('dragstart', onDragStart)
      })
      canvas.removeEventListener('drop', onDrop)
      canvas.removeEventListener('dragover', onDragOver)
    }
  }, [assets, objects, gridSize, projectId])

  const syncUpdate = async (obj) => {
    if (!projectId) return
    try {
      await mapEditorAPI.updateObject(obj.id, {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        rotation: obj.rotation || 0,
        z_index: obj.z_index,
        flipped_h: obj.flip_h,
        flipped_v: obj.flip_v || false,
        opacity: obj.opacity || 1,
        locked: obj.locked || false
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

  // Object interactions
const onObjectMouseDown = (e, obj) => {
    e.stopPropagation()
    setSelectedObjectId(obj.id)
    
    let currentObj = { ...obj }
    const startX = e.clientX
    const startY = e.clientY

    const onMove = (ev) => {
      const canvasRect = canvasRef.current.getBoundingClientRect()
      let nx = Math.round((ev.clientX - canvasRect.left - currentObj.width / 2) / gridSize) * gridSize
      let ny = Math.round((ev.clientY - canvasRect.top - currentObj.height / 2) / gridSize) * gridSize
      
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
      syncUpdate(currentObj)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const removeSelected = () => {
    if (!selectedObjectId) return
    setObjects((prev) => prev.filter((o) => o.id !== selectedObjectId))
    syncDelete(selectedObjectId)
    setSelectedObjectId(null)
  }

  const bringToFront = () => {
    if (!selectedObjectId) return
    setObjects((prev) => {
      const max = Math.max(...prev.map((p) => p.z_index))
      const updated = prev.map((o) => (o.id === selectedObjectId ? { ...o, z_index: max + 1 } : o))
      const obj = updated.find(o => o.id === selectedObjectId)
      if (obj) syncUpdate(obj)
      return updated
    })
  }

  const sendToBack = () => {
    if (!selectedObjectId) return
    setObjects((prev) => {
      const min = Math.min(...prev.map((p) => p.z_index))
      const updated = prev.map((o) => (o.id === selectedObjectId ? { ...o, z_index: min - 1 } : o))
      const obj = updated.find(o => o.id === selectedObjectId)
      if (obj) syncUpdate(obj)
      return updated
    })
  }

  const flipSelected = () => {
    if (!selectedObjectId) return
    setObjects((prev) => {
      const updated = prev.map((o) => (o.id === selectedObjectId ? { ...o, flip_h: !o.flip_h } : o))
      const obj = updated.find(o => o.id === selectedObjectId)
      if (obj) syncUpdate(obj)
      return updated
    })
  }

return (
    <div className="canvas-editor-root">
      <aside className="palette" ref={paletteRef}>
        <h4>Пакеты/ассеты</h4>
        <div className="packs-list">
          {packs.map((p) => (
            <div
              key={p.id}
              className={`pack-item ${selectedPack && selectedPack.id === p.id ? 'active' : ''}`}
              onClick={() => onSelectPack(p)}
            >
              {p.name}
            </div>
          ))}
        </div>

        <div className="assets-list">
          {assets.map((a) => (
            <img
              key={a.id}
              draggable
              className="asset-item"
              data-asset-id={a.id}
              src={a.image_url}
              alt={a.name}
              title={a.name}
            />
          ))}
        </div>
      </aside>

      <div className="canvas-editor-area" ref={canvasRef}>
        <div className="canvas-grid" style={{ backgroundSize: `${gridSize}px ${gridSize}px` }}>
          {objects
            .slice()
            .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
            .map((o) => (
              <div
                key={o.id}
                className={`canvas-object ${selectedObjectId === o.id ? 'selected' : ''}`}
                style={{
                  left: o.x,
                  top: o.y,
                  width: o.width,
                  height: o.height,
                  transform: `rotate(${o.rotation || 0}deg) scaleX(${o.flip_h ? -1 : 1})`,
                  zIndex: o.z_index || 0,
                  backgroundImage: `url(${o.image_url})`,
                  opacity: o.opacity || 1
                }}
                onMouseDown={(e) => onObjectMouseDown(e, o)}
                onDoubleClick={() => setSelectedObjectId(o.id)}
              />
            ))}
        </div>
      </div>

      <div className="editor-tools">
        <div>
          <label>Grid size</label>
          <input type="number" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value) || 16)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={bringToFront} className="btn">На передний план</button>
          <button onClick={sendToBack} className="btn">На задний план</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={flipSelected} className="btn">Отразить</button>
          <button onClick={removeSelected} className="btn btn-danger">Удалить</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => {
              setSaveName(projectName)
              setSaveDescription('')
              setSaveTags('')
              setSaveIsPublic(false)
              setShowSaveModal(true)
            }}
            className="btn-apply"
          >
            Сохранить
          </button>
        </div>
      </div>

      {showSaveModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            style={{
              background: '#FEF3DF',
              borderRadius: 16,
              width: 420,
              padding: 24,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#333' }}>
              Сохранить карту
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>
                Название
                <input
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E0D5C0',
                    borderRadius: 8,
                    fontSize: 14,
                    marginTop: 4,
                    boxSizing: 'border-box',
                  }}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>
                Описание
                <textarea
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E0D5C0',
                    borderRadius: 8,
                    fontSize: 14,
                    marginTop: 4,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                  rows={2}
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>
                Теги (через запятую)
                <input
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E0D5C0',
                    borderRadius: 8,
                    fontSize: 14,
                    marginTop: 4,
                    boxSizing: 'border-box',
                  }}
                  value={saveTags}
                  onChange={(e) => setSaveTags(e.target.value)}
                  placeholder="фэнтези, город, подземелье"
                />
              </label>

              <label style={{ fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={saveIsPublic}
                  onChange={(e) => setSaveIsPublic(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Публичная карта
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowSaveModal(false)}
                disabled={saving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#BC6C25',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  if (!saveName.trim()) return alert('Введите название')
                  
                  const node = canvasRef.current.querySelector('.canvas-grid')
                  if (!node) return

                  setSaving(true)
                  try {
                    const rect = node.getBoundingClientRect()
                    const c = document.createElement('canvas')
                    c.width = rect.width
                    c.height = rect.height
                    const ctx = c.getContext('2d')
                    ctx.fillStyle = '#fff'
                    ctx.fillRect(0, 0, c.width, c.height)
                    const list = objects.slice().sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
                    for (const o of list) {
                      if (!o.image_url) continue
                      const img = await loadImage(o.image_url)
                      ctx.save()
                      ctx.translate(o.x + o.width / 2, o.y + o.height / 2)
                      ctx.rotate(((o.rotation || 0) * Math.PI) / 180)
                      ctx.scale(o.flip_h ? -1 : 1, 1)
                      ctx.globalAlpha = o.opacity || 1
                      ctx.drawImage(img, -o.width / 2, -o.height / 2, o.width, o.height)
                      ctx.restore()
                    }
                    
                    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'))
                    
                    if (blob && onSaveRendered) {
                      onSaveRendered({ 
                        name: saveName.trim(),
                        description: saveDescription.trim(),
                        tags: saveTags.trim(),
                        is_public: saveIsPublic,
                        blob 
                      })
                      setShowSaveModal(false)
                    }
                  } catch (e) {
                    console.error('render fail', e)
                    alert('Ошибка сохранения')
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#5F6C37',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
