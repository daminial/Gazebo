import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { mapEditorAPI, mediaAPI } from '../api'
import { 
  FiFolder, 
  FiPlus, 
  FiEdit2, 
  FiTrash2, 
  FiArrowLeft, 
  FiImage, 
  FiX,
  FiGrid,
  FiPackage,
  FiAlertCircle
} from 'react-icons/fi'
import './Assets.css'

export default function Assets() {
  const { user } = useAuth()
  const [packs, setPacks] = useState([])
  const [selectedPack, setSelectedPack] = useState(null)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('packs')

  // Форма набора
  const [showPackForm, setShowPackForm] = useState(false)
  const [editingPack, setEditingPack] = useState(null)
  const [packName, setPackName] = useState('')
  const [packDescription, setPackDescription] = useState('')

  // Форма объекта
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [assetName, setAssetName] = useState('')
  const [assetCategory, setAssetCategory] = useState('Строение')
  const [assetWidth, setAssetWidth] = useState(100)
  const [assetHeight, setAssetHeight] = useState(100)
  const [assetImage, setAssetImage] = useState(null)
  const [assetPreview, setAssetPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState(null)

  const fileInputRef = useRef()

  const categories = ['Строение', 'Стена', 'Растение', 'Декорация', 'Другое']

  // Мемоизированная группировка ассетов по категориям
  const groupedAssets = useMemo(() => {
    return assets.reduce((acc, asset) => {
      const cat = asset.category || 'Другое'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(asset)
      return acc
    }, {})
  }, [assets])

  // Загрузка наборов
  const loadPacks = useCallback(async () => {
    setLoading(true)
    setUploadError(null)
    try {
      const { data } = await mapEditorAPI.getPacks()
      setPacks(data)
    } catch (err) {
      console.error('Ошибка загрузки наборов:', err)
      setUploadError('Не удалось загрузить наборы. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Загрузка ассетов выбранного набора
  const loadAssets = useCallback(async (packId) => {
    if (!packId) return
    
    setLoading(true)
    setUploadError(null)
    try {
      const { data } = await mapEditorAPI.getPackAssets(packId)
      // Проверяем, что все еще выбран тот же набор
      setAssets(prevAssets => {
        if (selectedPack?.id === packId) {
          return data
        }
        return prevAssets
      })
    } catch (err) {
      console.error('Ошибка загрузки объектов:', err)
      setUploadError('Не удалось загрузить объекты. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }, [selectedPack?.id])

  // Выбор набора
  const selectPack = useCallback(async (pack) => {
    setSelectedPack(pack)
    setTab('assets')
    await loadAssets(pack.id)
  }, [loadAssets])

  // Открыть форму создания набора
  const openCreatePack = useCallback(() => {
    setEditingPack(null)
    setPackName('')
    setPackDescription('')
    setShowPackForm(true)
  }, [])

  // Открыть форму редактирования набора
  const openEditPack = useCallback((pack) => {
    setEditingPack(pack)
    setPackName(pack.name)
    setPackDescription(pack.description || '')
    setShowPackForm(true)
  }, [])

  // Сохранение набора
  const savePack = useCallback(async () => {
    if (!packName.trim()) {
      setUploadError('Введите название набора')
      return
    }
    
    setUploadError(null)
    try {
      if (editingPack) {
        await mapEditorAPI.updatePack(editingPack.id, { 
          name: packName.trim(), 
          description: packDescription 
        })
      } else {
        await mapEditorAPI.createPack({ 
          name: packName.trim(), 
          description: packDescription, 
          is_public: true 
        })
      }
      setShowPackForm(false)
      await loadPacks()
    } catch (err) {
      console.error('Ошибка сохранения набора:', err)
      setUploadError('Не удалось сохранить набор')
    }
  }, [packName, packDescription, editingPack, loadPacks])

  // Удаление набора
  const deletePack = useCallback(async (packId) => {
    if (!confirm('Вы уверены? Это действие удалит набор и все объекты внутри него.')) return
    
    setUploadError(null)
    try {
      await mapEditorAPI.deletePack(packId)
      if (selectedPack?.id === packId) {
        setSelectedPack(null)
        setAssets([])
        setTab('packs')
      }
      await loadPacks()
    } catch (err) {
      console.error('Ошибка удаления набора:', err)
      setUploadError('Не удалось удалить набор')
    }
  }, [selectedPack?.id, loadPacks])

  // Открыть форму добавления ассета
  const openAddAsset = useCallback(() => {
    setAssetName('')
    setAssetCategory('Строение')
    setAssetWidth(100)
    setAssetHeight(100)
    setAssetImage(null)
    setAssetPreview(null)
    setUploadError(null)
    setShowAssetForm(true)
  }, [])

  // Обработка выбора изображения
  const handleImageSelect = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Валидация файла
    if (!file.type.startsWith('image/')) {
      setUploadError('Пожалуйста, выберите изображение')
      return
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Файл слишком большой. Максимальный размер: 10 МБ')
      return
    }
    
    setUploadError(null)
    setAssetImage(file)
    
    // Очищаем предыдущий preview URL если есть
    if (assetPreview && assetPreview.startsWith('blob:')) {
      URL.revokeObjectURL(assetPreview)
    }
    
    const reader = new FileReader()
    reader.onload = (ev) => setAssetPreview(ev.target.result)
    reader.onerror = () => setUploadError('Не удалось прочитать файл')
    reader.readAsDataURL(file)
  }, [assetPreview])

  // Очистка preview URL при размонтировании
  useEffect(() => {
    return () => {
      if (assetPreview && assetPreview.startsWith('blob:')) {
        URL.revokeObjectURL(assetPreview)
      }
    }
  }, [assetPreview])

  // Загрузка ассета на сервер
  const uploadAsset = useCallback(async () => {
    if (!assetImage) {
      setUploadError('Выберите изображение')
      return
    }
    
    if (!assetName.trim()) {
      setUploadError('Введите название объекта')
      return
    }
    
    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', assetImage)

      // Симуляция прогресса загрузки
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const uploadResponse = await mediaAPI.uploadImage(formData)
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      const imageId = uploadResponse.data.id

      await mapEditorAPI.createAsset(selectedPack.id, {
        name: assetName.trim(),
        image_id: imageId,
        default_width: assetWidth,
        default_height: assetHeight,
        category: assetCategory,
        is_rotatable: true,
        snap_to_grid: true
      })

      setShowAssetForm(false)
      await loadAssets(selectedPack.id)
    } catch (err) {
      console.error('Ошибка загрузки объекта:', err)
      setUploadError('Не удалось загрузить объект. Проверьте соединение.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [assetImage, assetName, assetWidth, assetHeight, assetCategory, selectedPack?.id, loadAssets])

  // Удаление ассета
  const deleteAsset = useCallback(async (assetId) => {
    if (!confirm('Удалить этот объект?')) return
    
    setUploadError(null)
    try {
      await mapEditorAPI.deleteAsset(assetId)
      await loadAssets(selectedPack.id)
    } catch (err) {
      console.error('Ошибка удаления объекта:', err)
      setUploadError('Не удалось удалить объект')
    }
  }, [selectedPack?.id, loadAssets])

  // Загрузка наборов при монтировании
  useEffect(() => {
    loadPacks()
  }, [loadPacks])

  if (loading && packs.length === 0) {
    return <div className="assets-loading">Загрузка...</div>
  }

  return (
    <div className="assets-page">
      <div className="assets-header">
        <h1>Библиотека объектов</h1>
        <div className="assets-header-actions">
          {tab === 'packs' && (
            <button className="btn btn-primary" onClick={openCreatePack}>
              <FiPlus /> Создать набор
            </button>
          )}
          {tab === 'assets' && selectedPack && (
            <>
              <button 
                className="btn btn-secondary" 
                onClick={() => { 
                  setTab('packs')
                  setSelectedPack(null)
                  setAssets([])
                }}
              >
                <FiArrowLeft /> Назад к наборам
              </button>
              <button className="btn btn-primary" onClick={openAddAsset}>
                <FiPlus /> Добавить объект
              </button>
            </>
          )}
        </div>
      </div>

      {/* Сообщения об ошибках */}
      {uploadError && (
        <div className="error-message">
          <FiAlertCircle />
          <span>{uploadError}</span>
          <button className="error-close" onClick={() => setUploadError(null)}>
            <FiX />
          </button>
        </div>
      )}

      {/* Вкладки */}
      <div className="assets-tabs">
        <button
          className={`assets-tab ${tab === 'packs' ? 'active' : ''}`}
          onClick={() => { 
            setTab('packs')
            setSelectedPack(null)
            setAssets([])
            setUploadError(null)
          }}
        >
          <FiPackage /> Наборы ({packs.length})
        </button>
        <button
          className={`assets-tab ${tab === 'assets' ? 'active' : ''}`}
          disabled={!selectedPack}
          onClick={() => tab === 'assets' && selectedPack && loadAssets(selectedPack.id)}
        >
          <FiGrid /> {selectedPack ? `Набор: ${selectedPack.name}` : 'Выберите набор'}
        </button>
      </div>

      {/* Сетка наборов */}
      {tab === 'packs' && (
        <div className="packs-grid">
          {packs.length === 0 && (
            <div className="empty-state">
              <FiPackage size={48} />
              <p>У вас пока нет наборов</p>
              <button className="btn btn-primary" onClick={openCreatePack}>
                <FiPlus /> Создать первый набор
              </button>
            </div>
          )}
          {packs.map((pack) => (
            <div
              key={pack.id}
              className={`pack-card ${selectedPack?.id === pack.id ? 'selected' : ''}`}
              onClick={() => selectPack(pack)}
            >
              <div className="pack-card-header">
                <FiFolder size={24} />
                <h3>{pack.name}</h3>
              </div>
              {pack.description && (
                <p className="pack-description">{pack.description}</p>
              )}
              <div className="pack-meta">
                <span>{pack.assets_count || 0} объектов</span>
              </div>
              <div className="pack-actions">
                <button 
                  className="btn-icon" 
                  title="Редактировать" 
                  onClick={(e) => { 
                    e.stopPropagation()
                    openEditPack(pack)
                  }}
                >
                  <FiEdit2 />
                </button>
                <button 
                  className="btn-icon" 
                  title="Удалить" 
                  onClick={(e) => { 
                    e.stopPropagation()
                    deletePack(pack.id)
                  }}
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Содержимое набора: ассеты по категориям */}
      {tab === 'assets' && selectedPack && (
        <div className="assets-content">
          {loading && <div className="assets-loading">Загрузка объектов...</div>}
          
          {!loading && Object.keys(groupedAssets).length === 0 && (
            <div className="empty-state">
              <FiImage size={48} />
              <p>В наборе «{selectedPack.name}» пока нет объектов</p>
              <button className="btn btn-primary" onClick={openAddAsset}>
                <FiPlus /> Добавить первый объект
              </button>
            </div>
          )}
          
          {!loading && Object.entries(groupedAssets).map(([category, categoryAssets]) => (
            <div key={category} className="asset-category-group">
              <div className="category-header">
                <span className={`category-badge category-${category}`}>
                  {category}
                </span>
                <span className="category-count">
                  {categoryAssets.length} объект{categoryAssets.length !== 1 ? 'ов' : ''}
                </span>
              </div>
              <div className="assets-grid">
                {categoryAssets.map((asset) => (
                  <div key={asset.id} className="asset-card">
                    <div className="asset-image">
                      <img 
                        src={asset.image_url || '/placeholder.png'} 
                        alt={asset.name}
                        onError={(e) => {
                          e.target.src = '/placeholder.png'
                        }}
                      />
                    </div>
                    <div className="asset-info">
                      <span className="asset-name" title={asset.name}>
                        {asset.name.length > 20 ? `${asset.name.slice(0, 20)}...` : asset.name}
                      </span>
                      <span className="asset-size">
                        {asset.default_width}×{asset.default_height} px
                      </span>
                    </div>
                    <button 
                      className="btn-icon asset-delete" 
                      onClick={() => deleteAsset(asset.id)}
                      title="Удалить"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно: создание/редактирование набора */}
      {showPackForm && (
        <div className="modal-overlay" onClick={() => setShowPackForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPack ? 'Редактирование набора' : 'Создание нового набора'}</h2>
              <button className="btn-icon" onClick={() => setShowPackForm(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <label className="form-label">
                Название набора *
                <input
                  type="text"
                  className="form-input"
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder="Например: Природа, Городские объекты..."
                  autoFocus
                />
              </label>
              <label className="form-label">
                Описание
                <textarea
                  className="form-input"
                  value={packDescription}
                  onChange={(e) => setPackDescription(e.target.value)}
                  placeholder="Краткое описание набора (необязательно)"
                  rows={3}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPackForm(false)}>
                Отмена
              </button>
              <button 
                className="btn btn-primary" 
                onClick={savePack} 
                disabled={!packName.trim()}
              >
                {editingPack ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: добавление ассета */}
      {showAssetForm && (
        <div className="modal-overlay" onClick={() => !uploading && setShowAssetForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавление объекта в набор «{selectedPack?.name}»</h2>
              <button 
                className="btn-icon" 
                onClick={() => setShowAssetForm(false)} 
                disabled={uploading}
              >
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <div
                className={`image-upload-area ${assetPreview ? 'has-preview' : ''}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
              >
                {assetPreview ? (
                  <img src={assetPreview} alt="Предпросмотр" className="image-preview" />
                ) : (
                  <div className="upload-placeholder">
                    <FiImage size={48} />
                    <p>Нажмите, чтобы выбрать изображение</p>
                    <small>PNG, JPG, GIF до 10 МБ</small>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImageSelect}
                  disabled={uploading}
                />
              </div>

              <label className="form-label">
                Название объекта *
                <input
                  type="text"
                  className="form-input"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Например: Дуб, Кирпичная стена..."
                  disabled={uploading}
                />
              </label>

              <label className="form-label">
                Категория
                <select
                  className="form-input"
                  value={assetCategory}
                  onChange={(e) => setAssetCategory(e.target.value)}
                  disabled={uploading}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label className="form-label">
                  Ширина (px)
                  <input
                    type="number"
                    className="form-input"
                    value={assetWidth}
                    onChange={(e) => setAssetWidth(Math.max(1, Number(e.target.value)))}
                    min="1"
                    max="1000"
                    disabled={uploading}
                  />
                </label>
                <label className="form-label">
                  Высота (px)
                  <input
                    type="number"
                    className="form-input"
                    value={assetHeight}
                    onChange={(e) => setAssetHeight(Math.max(1, Number(e.target.value)))}
                    min="1"
                    max="1000"
                    disabled={uploading}
                  />
                </label>
              </div>

              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span>Загрузка... {uploadProgress}%</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowAssetForm(false)} 
                disabled={uploading}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={uploadAsset}
                disabled={!assetImage || !assetName.trim() || uploading}
              >
                {uploading ? 'Загрузка...' : 'Добавить объект'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}