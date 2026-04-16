import { useState, useEffect } from 'react'
import { useRoom } from '../../context/RoomContext'
import { roomsAPI, mapTemplatesAPI } from '../../api'
import './ImagesPanel.css'

export function ImagesPanel() {
  const { roomId, maps, setMaps, syncMapAdded, syncMapDeleted } = useRoom()
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [templates, setTemplates] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [mapName, setMapName] = useState('')
  const [mapDescription, setMapDescription] = useState('')

  // Обработчик начала перетаскивания изображения
  const handleDragStart = (e, map) => {
    const imageUrl = map.image_url?.startsWith('http')
      ? map.image_url
      : (map.image_url?.startsWith('/api')
          ? map.image_url
          : `/api${map.image_url}`)
    
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'prop',
      imageId: map.image_id || map.template_image_id,
      imageUrl: imageUrl,
      name: map.name_in_room || map.template_name || 'Объект'
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  // Загрузка шаблонов при открытии модалки
  useEffect(() => {
    if (showTemplatesModal) {
      loadTemplates()
    }
  }, [showTemplatesModal])

  const loadTemplates = async () => {
    try {
      const { data } = await mapTemplatesAPI.getMy()
      const templatesWithImages = data.map(template => ({
        ...template,
        image_url: template.image_url?.startsWith('http')
          ? template.image_url
          : (template.image_url?.startsWith('/api')
              ? template.image_url
              : `/api${template.image_url}`)
      }))
      setTemplates(templatesWithImages)
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  // Загрузка новой карты
  const handleUploadMap = async () => {
    if (!selectedFile || !mapName.trim()) return

    setUploading(true)
    try {
      // Отправляем файл напрямую в комнату (без создания шаблона)
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name_in_room', mapName)

      const { data: mapData } = await roomsAPI.addMap(roomId, null, mapName, selectedFile)

      // Получаем image_url из ответа
      const imageUrl = mapData.image_url?.startsWith('http')
        ? mapData.image_url
        : (mapData.image_url?.startsWith('/api')
            ? mapData.image_url
            : `/api${mapData.image_url}`)

      const mapWithImage = {
        ...mapData,
        image_url: imageUrl
      }
      setMaps(prev => [...prev, mapWithImage])

      // Синхронизируем с другими участниками
      syncMapAdded(mapWithImage)

      setShowUploadModal(false)
      setMapName('')
      setMapDescription('')
      setSelectedFile(null)
    } catch (err) {
      console.error('Failed to upload map:', err)
      alert('Ошибка загрузки карты: ' + (err.response?.data?.detail || err.message))
    } finally {
      setUploading(false)
    }
  }

  // Выбор карты из шаблонов
  const handleSelectTemplate = async (template) => {
    try {
      const { data } = await roomsAPI.addMap(roomId, template.id, template.name)
      const imageUrl = template.image_url?.startsWith('http')
        ? template.image_url
        : (template.image_url?.startsWith('/api')
            ? template.image_url
            : `/api${template.image_url}`)

      const mapWithImage = {
        ...data,
        image_url: imageUrl
      }
      setMaps(prev => [...prev, mapWithImage])

      // Синхронизируем
      syncMapAdded(mapWithImage)

      setShowTemplatesModal(false)
    } catch (err) {
      console.error('Failed to add template to room:', err)
      alert('Ошибка добавления карты')
    }
  }

  // Удаление карты из комнаты
  const handleDeleteMap = async (e, mapId) => {
    e.stopPropagation()
    if (!confirm('Удалить эту карту из комнаты?')) return

    try {
      await roomsAPI.deleteMap(roomId, mapId)
      setMaps(prev => prev.filter(m => m.id !== mapId))

      // Синхронизируем
      syncMapDeleted(mapId)
    } catch (err) {
      console.error('Failed to delete map:', err)
      alert('Ошибка удаления карты')
    }
  }

  return (
    <div className="images-panel">
      <div className="images-header">
        <div className="images-actions">
          <button
            className="btn-add-image"
            onClick={() => setShowUploadModal(true)}
            title="Загрузить новую карту"
          >
            Загрузить
          </button>
          <button
            className="btn-add-image"
            onClick={() => setShowTemplatesModal(true)}
            title="Выбрать из библиотеки"
          >
            Из библиотеки
          </button>
        </div>
      </div>

      <div className="images-list">
        {maps.length === 0 ? (
          <div className="images-empty">
            <p>В комнате пока нет карт</p>
            <p className="images-hint">Загрузите карту или выберите из библиотеки</p>
          </div>
        ) : (
          <div className="maps-grid">
            {maps.map(map => (
              <div
                key={map.id}
                className={`map-card`}
                draggable
                onDragStart={(e) => handleDragStart(e, map)}
                onDragEnd={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
                onDrag={(e) => {
                  e.currentTarget.style.opacity = '0.5'
                }}
              >
                <div className="map-card-image">
                  {map.image_url ? (
                    <img src={map.image_url} alt={map.name_in_room || map.template_name} draggable={false} />
                  ) : (
                    <div className="map-placeholder">🗺️</div>
                  )}
                </div>
                <div className="map-card-info">
                  <span className="map-title">{map.name_in_room || map.template_name || 'Карта'}</span>
                  <span className="map-drag-hint">⋮⋮ перетащите</span>
                </div>
                <button
                  className="btn-delete-map"
                  onClick={(e) => handleDeleteMap(e, map.id)}
                  title="Удалить карту"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка загрузки */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="map-upload-modal" onClick={e => e.stopPropagation()}>
            <h3>Загрузить новую карту</h3>

            <div className="form-group">
              <label>Название карты</label>
              <input
                type="text"
                value={mapName}
                onChange={e => setMapName(e.target.value)}
                placeholder="Введите название карты"
                disabled={uploading}
              />
            </div>

            <div className="form-group">
              <label>Описание (необязательно)</label>
              <input
                type="text"
                value={mapDescription}
                onChange={e => setMapDescription(e.target.value)}
                placeholder="Описание карты"
                disabled={uploading}
              />
            </div>

            <div className="form-group">
              <label>Изображение</label>
              <div className="file-upload">
                <input
                  type="file"
                  id="map-file-upload"
                  accept="image/*"
                  onChange={e => setSelectedFile(e.target.files[0])}
                  disabled={uploading}
                />
                {selectedFile && (
                  <span className="file-name">{selectedFile.name}</span>
                )}
              </div>
            </div>

            {selectedFile && (
              <div className="image-preview">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                />
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                Отмена
              </button>
              <button
                className="btn-upload"
                onClick={handleUploadMap}
                disabled={uploading || !selectedFile || !mapName.trim()}
              >
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка выбора из шаблонов */}
      {showTemplatesModal && (
        <div className="modal-overlay" onClick={() => setShowTemplatesModal(false)}>
          <div className="map-templates-modal" onClick={e => e.stopPropagation()}>
            <h3>Выбрать из моих карт</h3>

            {templates.length === 0 ? (
              <p className="no-templates">У вас пока нет загруженных карт</p>
            ) : (
              <div className="templates-grid">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="template-card"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    {template.image_url ? (
                      <img src={template.image_url} alt={template.name} />
                    ) : (
                      <div className="template-placeholder">🗺️</div>
                    )}
                    <span className="template-name">{template.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowTemplatesModal(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
