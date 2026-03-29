import { useState, useEffect } from 'react'
import { useRoom } from '../../context/RoomContext'
import { roomsAPI, mapTemplatesAPI } from '../../api'
import './MapSelector.css'

export function MapSelector() {
  const { roomId, maps, activeMapId, setActiveMapId, setMaps } = useRoom()
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [templates, setTemplates] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [mapName, setMapName] = useState('')
  const [mapDescription, setMapDescription] = useState('')

  // Загрузка шаблонов при открытии
  useEffect(() => {
    if (showTemplatesModal) {
      loadTemplates()
    }
  }, [showTemplatesModal])

  const loadTemplates = async () => {
    try {
      const { data } = await mapTemplatesAPI.getMy()
      // Добавляем URL изображений к шаблонам с /api префиксом
      const templatesWithImages = data.map(template => ({
        ...template,
        image_url: `/api/media/${template.image_id}`
      }))
      setTemplates(templatesWithImages)
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  // Загрузка новой карты (создание шаблона + добавление в комнату)
  const handleUploadMap = async () => {
    if (!selectedFile || !mapName.trim()) return

    setUploading(true)
    try {
      // 1. Создаём шаблон карты
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', mapName)
      if (mapDescription) {
        formData.append('description', mapDescription)
      }
      formData.append('is_public', 'false')
      formData.append('caption', mapName)

      const { data: templateData } = await mapTemplatesAPI.create(formData)

      // 2. Добавляем шаблон в комнату
      const { data: mapData } = await roomsAPI.addMap(roomId, templateData.id, mapName)

      // 3. Добавляем в список карт комнаты с image_url
      const mapWithImage = {
        ...mapData,
        image_url: `/api/media/${templateData.image_id}`
      }
      setMaps(prev => [...prev, mapWithImage])

      // 4. Закрываем модалку
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

  // Выбор карты из существующих шаблонов
  const handleSelectTemplate = async (template) => {
    try {
      const { data } = await roomsAPI.addMap(roomId, template.id, template.name)
      // Добавляем image_url к новой карте с /api префиксом (если не полный URL)
      const imageUrl = template.image_url?.startsWith('http')
        ? template.image_url
        : (template.image_url?.startsWith('/api')
            ? template.image_url
            : `/api${template.image_url}`);
      
      const mapWithImage = {
        ...data,
        image_url: imageUrl
      }
      setMaps(prev => [...prev, mapWithImage])
      setShowTemplatesModal(false)
    } catch (err) {
      console.error('Failed to add template to room:', err)
      alert('Ошибка добавления карты')
    }
  }

  // Выбор активной карты
  const handleSelectMap = async (mapId) => {
    setActiveMapId(mapId)
  }

  const activeMap = maps.find(m => m.id === activeMapId)

  return (
    <div className="map-selector">
      {/* Текущая карта */}
      <div className="current-map">
        <span className="map-label">Карта:</span>
        {activeMap ? (
          <span className="map-name">{activeMap.name_in_room || activeMap.template_name}</span>
        ) : (
          <span className="no-map">Нет карты</span>
        )}
        <button
          className="btn-change-map"
          onClick={() => setShowUploadModal(true)}
        >
          📷 Загрузить
        </button>
        <button
          className="btn-change-map"
          onClick={() => setShowTemplatesModal(true)}
        >
          🗺️ Из библиотеки
        </button>
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
                  id="map-file"
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

      {/* Список карт */}
      {maps.length > 1 && (
        <div className="maps-list">
          <h4>Доступные карты</h4>
          <div className="maps-grid">
            {maps.map(map => (
              <div
                key={map.id}
                className={`map-card ${map.id === activeMapId ? 'active' : ''}`}
                onClick={() => handleSelectMap(map.id)}
              >
                {map.image_url ? (
                  <img src={map.image_url} alt={map.name_in_room || map.template_name} />
                ) : (
                  <div className="map-placeholder">🗺️</div>
                )}
                <span className="map-title">{map.name_in_room || map.template_name || 'Карта'}</span>
                {map.id === activeMapId && (
                  <span className="active-badge">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
