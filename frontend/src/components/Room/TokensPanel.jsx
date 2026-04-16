import { useState, useRef } from 'react'
import { useRoom } from '../../context/RoomContext'
import './TokensPanel.css'
import { FiBookOpen, FiUpload } from 'react-icons/fi'
import { BiPackage } from 'react-icons/bi'
// removed Gi* icons due to inconsistent exports in this react-icons build
import { FaDragon } from 'react-icons/fa'
import { FaHeart, FaShieldAlt } from 'react-icons/fa'

export function TokensPanel() {
  const { tokens, activePageId, createTokenWithUpload, createToken, bestiary, deleteToken } = useRoom()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLibraryModal, setShowLibraryModal] = useState(false)
  const [draggedCreature, setDraggedCreature] = useState(null)
  const [libraryContextMenu, setLibraryContextMenu] = useState(null)

  // Токены на текущей странице
  const tokensOnPage = tokens.filter(t => t.page_id === activePageId)
  const libraryTokens = tokens.filter(t => t.page_id == null)

  // Фильтр токенов на странице по типу
  const creatureTokens = tokensOnPage.filter(t => t.token_type === 'creature')
  const propTokens = tokensOnPage.filter(t => t.token_type === 'prop')


  // Обработчик начала перетаскивания существа из библиотеки
  const handleDragStart = (creature, e) => {
    setDraggedCreature(creature)
    try {
      const payload = { type: 'creature', creatureId: creature.id, name: creature.name }
      const json = JSON.stringify(payload)
      e.dataTransfer.setData('text/plain', json)
      try { e.dataTransfer.setData('application/json', json) } catch (err) {}
      e.dataTransfer.effectAllowed = 'copy'
      console.debug('[TokensPanel] dragstart creature', payload)

      // drag image
      const img = document.createElement('img')
      if (creature.image_url) {
        img.src = creature.image_url
        img.style.width = '64px'
        img.style.height = '64px'
        document.body.appendChild(img)
        try { e.dataTransfer.setDragImage(img, 32, 32) } catch (err) {}
        setTimeout(() => img.remove(), 0)
      }
    } catch (err) {
      console.error('Failed to set drag data for creature:', err)
    }
  }

  const handleTokenDragStart = (token, e) => {
    try {
      const payload = {
        type: 'room-token',
        tokenId: token.id,
        name: token.name_in_room,
        creatureTemplateId: token.creature_template?.id || null,
        currentHp: token.current_hp ?? null,
        currentAc: token.current_ac ?? null,
        width: token.width ?? null,
        height: token.height ?? null,
      }
      const json = JSON.stringify(payload)
      e.dataTransfer.setData('text/plain', json)
      try { e.dataTransfer.setData('application/json', json) } catch (err) {}
      e.dataTransfer.effectAllowed = 'copyMove'
      console.debug('[TokensPanel] dragstart room-token', payload)

      const img = document.createElement('img')
      const src = token.image_url || token.creature_template?.image_url
      if (src) {
        img.src = src
        img.style.width = '64px'
        img.style.height = '64px'
        document.body.appendChild(img)
        try { e.dataTransfer.setDragImage(img, 32, 32) } catch (err) {}
        setTimeout(() => img.remove(), 0)
      }
    } catch (err) {
      console.error('Failed to set drag data for room-token:', err)
    }
  }

  // ensure dragend clears dragged state for library tokens
  const handleTokenDragEnd = () => {
    setDraggedCreature(null)
  }

  // Обработчик конца перетаскивания
  const handleDragEnd = () => {
    setDraggedCreature(null)
  }

  return (
    <div className="tokens-panel">
      <div className="tokens-actions">
        <button
          className="tokens-action-btn"
          onClick={() => {
            setShowCreateModal(true)
          }}
        >
          Создать
        </button>
        <button
          className="tokens-action-btn"
          onClick={() => {
            setShowLibraryModal(true)
          }}
        >
          Из библиотеки
        </button>
      </div>

      <div className="tokens-content">
          <div className="tokens-on-map">
          {tokensOnPage.length === 0 ? (
            <div className="tokens-empty">
              <p>Нет токенов на поле</p>
              <p className="library-hint">Перетащите токен из библиотеки ниже на карту.</p>
            </div>
          ) : (
            <>
                {creatureTokens.length > 0 && (
                  <div className="token-group">
                    <h4><FaDragon className="panel-icon"/> Существа ({creatureTokens.length})</h4>
                  <div className="tokens-list">
                    {creatureTokens.map(token => (
                      <div key={token.id} className="token-card">
                        <div className="token-card-image">
                          {!token.image_url && !token.creature_template?.image_url && (
                            <span className="token-letter">
                              {token.name_in_room?.charAt(0).toUpperCase()}
                            </span>
                          )}
                          {(token.image_url || token.creature_template?.image_url) && (
                            <img
                              src={token.image_url || token.creature_template?.image_url}
                              alt={token.name_in_room}
                            />
                          )}
                        </div>
                        <div className="token-card-info">
                          <div className="token-card-name">{token.name_in_room}</div>
                          <div className="token-card-stats">
                            {token.current_hp !== null && (
                              <span style={{display:'inline-flex',alignItems:'center',gap:6}}><FaHeart /> {token.current_hp}</span>
                            )}
                            {token.current_ac !== null && (
                              <span style={{display:'inline-flex',alignItems:'center',gap:6}}><FaShieldAlt /> {token.current_ac}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {propTokens.length > 0 && (
                <div className="token-group">
                    <h4><BiPackage className="panel-icon"/> Объекты ({propTokens.length})</h4>
                  <div className="tokens-list">
                    {propTokens.map(token => (
                      <div key={token.id} className="token-card">
                        <div className="token-card-image">
                          {!token.image_url && (
                            <BiPackage className="token-letter" />
                          )}
                          {token.image_url && (
                            <img src={token.image_url} alt={token.name_in_room} />
                          )}
                        </div>
                        <div className="token-card-info">
                          <div className="token-card-name">{token.name_in_room}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="tokens-library">
          <div className="library-section">
              <h4><FiBookOpen className="panel-icon"/> Библиотека комнаты</h4>
            <p className="library-hint">
              Перетащите токен на карту, чтобы разместить его на текущей странице
            </p>
            <div className="creatures-list">
                {libraryTokens.length === 0 ? (
                <div className="creature-placeholder">
                  В библиотеке комнаты пока нет токенов
                </div>
              ) : (
                libraryTokens.map(token => (
                  <div
                    key={token.id}
                    className="creature-card"
                    draggable
                    onDragStart={(e) => handleTokenDragStart(token, e)}
                    onDragEnd={handleTokenDragEnd}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setLibraryContextMenu({ token, x: e.clientX, y: e.clientY })
                    }}
                  >
                    <div className="creature-card-image">
                      {(token.image_url || token.creature_template?.image_url) ? (
                        <img src={token.image_url || token.creature_template?.image_url} alt={token.name_in_room} />
                      ) : (
                        <span className="token-letter">
                          {token.name_in_room?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="creature-card-info">
                      <div className="creature-card-name">{token.name_in_room}</div>
                      <div className="creature-card-stats">
                          <span>{token.token_type === 'prop' ? <BiPackage style={{verticalAlign:'middle'}}/> : <FaDragon style={{verticalAlign:'middle'}}/>} {token.token_type === 'prop' ? 'Объект' : 'Существо'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* room templates removed - room has single library only */}
          </div>

          {/* Global library removed from in-room panel (kept in main library modal) */}

          <div className="library-section">
          </div>
        </div>
      </div>

      {/* Модальное окно создания токена */}
      {showCreateModal && (
        <TokenCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreateToken={createTokenWithUpload}
          bestiary={bestiary}
        />
      )}

      {showLibraryModal && (
        <TokenLibraryModal
          onClose={() => setShowLibraryModal(false)}
          onCreateFromLibrary={createToken}
          bestiary={bestiary}
        />
      )}

      {libraryContextMenu && (
        <div
          className="library-context-menu"
          style={{ left: libraryContextMenu.x, top: libraryContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="menu-item danger"
            onClick={async () => {
              const ok = window.confirm('Удалить этот токен из библиотеки комнаты?')
              if (!ok) {
                setLibraryContextMenu(null)
                return
              }
              try {
                await deleteToken(libraryContextMenu.token.id)
              } catch (err) {
                console.error('Failed to delete library token:', err)
                alert('Не удалось удалить токен')
              } finally {
                setLibraryContextMenu(null)
              }
            }}
          >
            Удалить
          </button>
          <button className="menu-item" onClick={() => setLibraryContextMenu(null)}>Отмена</button>
        </div>
      )}
      {/* room templates removed */}
    </div>
  )
}

// Модальное окно создания токена с загрузкой изображения
function TokenCreateModal({ onClose, onCreateToken, bestiary }) {
  // Состояние шага
  const [step, setStep] = useState(1) // 1: загрузка фото, 2: данные существа
  
  // Состояние загрузки
  const [uploading, setUploading] = useState(false)
  
  // Данные формы
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  
  // Основные данные токена
  const [nameInRoom, setNameInRoom] = useState('')
  
  // Данные о существе
  const [creatureName, setCreatureName] = useState('')
  const [maxHp, setMaxHp] = useState('')
  const [ac, setAc] = useState('')
  const [cr, setCr] = useState('1')
  const [description, setDescription] = useState('')
  const [size, setSize] = useState('medium')
  const [type, setType] = useState('humanoid')
  
  // Привязка к шаблону из бестиария
  const [creatureTemplateId, setCreatureTemplateId] = useState('')
  
  // Обработка выбора файла
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      // Автозаполняем имя файла
      const fileName = file.name.replace(/\.[^/.]+$/, '')
      if (!nameInRoom) {
        setNameInRoom(fileName)
      }
      if (!creatureName) {
        setCreatureName(fileName)
      }
    }
  }
  
  // Привязка к шаблону
  const handleTemplateSelect = (templateId) => {
    setCreatureTemplateId(templateId)
    if (templateId) {
      const template = bestiary.find(t => t.id === parseInt(templateId))
      if (template) {
        setCreatureName(template.name)
        setMaxHp(template.max_hp || '')
        setAc(template.ac || '')
        setCr(template.cr?.toString() || '1')
        if (!nameInRoom) {
          setNameInRoom(template.name)
        }
      }
    }
  }
  
  // Переход к следующему шагу
  const handleNextStep = () => {
    if (step === 1) {
      // На первом шаге просто переходим дальше (файл опциональный)
      setStep(2)
    }
  }
  
  // Создание токена
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!nameInRoom.trim()) {
      alert('Введите имя токена')
      return
    }
    
    setUploading(true)
    try {
      const tokenData = {
        name_in_room: nameInRoom,
        position_x: 0,
        position_y: 0,
        page_id: null,
      }
      
      const creatureData = {
        creature_name: creatureName || null,
        max_hp: maxHp ? parseInt(maxHp) : null,
        ac: ac ? parseInt(ac) : null,
        cr: cr ? parseInt(cr) : 1,
        size: size,
        type: type,
        description: description || null,
      }
      
      // Если выбран шаблон из бестиария, используем его данные
      if (creatureTemplateId) {
        const template = bestiary.find(t => t.id === parseInt(creatureTemplateId))
        if (template) {
          creatureData.creature_name = template.name
          creatureData.max_hp = template.max_hp
          creatureData.ac = template.ac
          creatureData.cr = template.cr
        }
      }
      
      await onCreateToken(tokenData, selectedFile, creatureData)
      onClose()
    } catch (err) {
      console.error('Failed to create token:', err)
      alert('Ошибка при создании токена: ' + (err.response?.data?.detail || err.message))
    } finally {
      setUploading(false)
    }
  }
  
  // Размеры существ
  const sizes = [
    { value: 'tiny', label: 'Крошечный (Tiny)' },
    { value: 'small', label: 'Маленький (Small)' },
    { value: 'medium', label: 'Средний (Medium)' },
    { value: 'large', label: 'Большой (Large)' },
    { value: 'huge', label: 'Огромный (Huge)' },
    { value: 'gargantuan', label: 'Громадный (Gargantuan)' },
  ]
  
  // Типы существ
  const types = [
    { value: 'aberration', label: 'Аберрация' },
    { value: 'beast', label: 'Зверь' },
    { value: 'celestial', label: 'Небожитель' },
    { value: 'construct', label: 'Конструкт' },
    { value: 'dragon', label: 'Дракон' },
    { value: 'elemental', label: 'Элементаль' },
    { value: 'fey', label: 'Фея' },
    { value: 'fiend', label: 'Вельможа' },
    { value: 'giant', label: 'Великан' },
    { value: 'humanoid', label: 'Гуманоид' },
    { value: 'monstrosity', label: 'Монстр' },
    { value: 'ooze', label: 'Слизь' },
    { value: 'plant', label: 'Растение' },
    { value: 'undead', label: 'Нежить' },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content token-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{step === 1 ? 'Создать токен' : 'Данные существа'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Прогресс-бар */}
        <div className="create-token-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Изображение</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Данные</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Шаг 1: Загрузка изображения */}
          {step === 1 && (
            <div className="step-content">
              {/* Привязка к шаблону из бестиария */}
              {bestiary.length > 0 && (
                <div className="form-group">
                  <label>Или выберите из существ:</label>
                  <select
                    value={creatureTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="template-select"
                  >
                    <option value="">-- Без шаблона --</option>
                    {bestiary.map(creature => (
                      <option key={creature.id} value={creature.id}>
                        {creature.name} (HP: {creature.max_hp || '?'}, AC: {creature.ac || '?'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Загрузка изображения */}
              <div className="form-group">
                <label>Изображение токена (опционально):</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="token-file-upload"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="file-input"
                  />
                  <label htmlFor="token-file-upload" className="file-upload-label">
                    <FiUpload className="upload-icon" />
                    <span>Выберите файл или перетащите сюда</span>
                  </label>
                </div>
              </div>
              
              {/* Превью */}
              {previewUrl && (
                <div className="image-preview">
                  <img src={previewUrl} alt="Preview" />
                  <button
                    type="button"
                    className="btn-remove-image"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              
              {/* Имя токена */}
              <div className="form-group">
                <label>Имя токена на карте:</label>
                <input
                  type="text"
                  value={nameInRoom}
                  onChange={(e) => setNameInRoom(e.target.value)}
                  placeholder="Введите имя токена"
                  disabled={uploading}
                />
              </div>

              <div className="step-actions">
                <button type="button" className="btn-cancel" onClick={onClose}>
                  Отмена
                </button>
                <button type="button" className="btn-next" onClick={handleNextStep}>
                  Далее →
                </button>
              </div>
            </div>
          )}

          {/* Шаг 2: Данные существа */}
          {step === 2 && (
            <div className="step-content">
              <p className="step-hint">
                Заполните данные о существе (если хотите создать полноценное существо с HP и AC)
              </p>
              
              {/* Имя существа */}
              <div className="form-group">
                <label>Имя существа:</label>
                <input
                  type="text"
                  value={creatureName}
                  onChange={(e) => setCreatureName(e.target.value)}
                  placeholder="Имя существа (например: Гоблин)"
                  disabled={uploading}
                />
              </div>
              
              {/* HP и AC в одной строке */}
              <div className="form-row">
                <div className="form-group">
                  <label>HP (здоровье):</label>
                  <input
                    type="number"
                    value={maxHp}
                    onChange={(e) => setMaxHp(e.target.value)}
                    placeholder="Макс. HP"
                    min="1"
                    disabled={uploading}
                  />
                </div>
                <div className="form-group">
                  <label>AC (класс доспеха):</label>
                  <input
                    type="number"
                    value={ac}
                    onChange={(e) => setAc(e.target.value)}
                    placeholder="КД"
                    min="0"
                    disabled={uploading}
                  />
                </div>
              </div>
              
              {/* CR */}
              <div className="form-group">
                <label>CR ( уровень опасности):</label>
                <input
                  type="number"
                  value={cr}
                  onChange={(e) => setCr(e.target.value)}
                  placeholder="1"
                  min="0"
                  max="30"
                  disabled={uploading}
                />
              </div>
              
              {/* Размер */}
              <div className="form-group">
                <label>Размер:</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  disabled={uploading}
                >
                  {sizes.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Тип */}
              <div className="form-group">
                <label>Тип:</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={uploading}
                >
                  {types.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Описание */}
              <div className="form-group">
                <label>Описание (опционально):</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткое описание существа..."
                  rows="3"
                  disabled={uploading}
                />
              </div>

              <div className="step-actions">
                <button type="button" className="btn-cancel" onClick={() => setStep(1)}>
                  ← Назад
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={uploading}
                >
                  {uploading ? 'Создание...' : 'Создать токен'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// Простое модальное редактирования шаблона комнаты
// room-scoped template editor removed

function TokenLibraryModal({ onClose, onCreateFromLibrary, bestiary }) {
  const [uploading, setUploading] = useState(false)
  const [creatureTemplateId, setCreatureTemplateId] = useState('')
  const [nameInRoom, setNameInRoom] = useState('')

  const handleTemplateSelect = (templateId) => {
    setCreatureTemplateId(templateId)
    if (templateId && !nameInRoom.trim()) {
      const template = bestiary.find(t => t.id === parseInt(templateId))
      if (template) {
        setNameInRoom(template.name)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!creatureTemplateId) {
      alert('Выберите существо из глобальной библиотеки')
      return
    }
    if (!nameInRoom.trim()) {
      alert('Введите имя токена')
      return
    }

    setUploading(true)
    try {
      const template = bestiary.find(t => t.id === parseInt(creatureTemplateId))
      await onCreateFromLibrary({
        name_in_room: nameInRoom,
        creature_template_id: parseInt(creatureTemplateId),
        page_id: null,
        current_hp: template?.max_hp ?? null,
        current_ac: template?.ac ?? null,
      })
      onClose()
    } catch (err) {
      console.error('Failed to create token from global library:', err)
      alert('Ошибка при добавлении из библиотеки: ' + (err.response?.data?.detail || err.message))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content token-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Добавить из библиотеки</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="step-content">
            <div className="form-group">
              <label>Существо из глобальной библиотеки:</label>
              <select
                value={creatureTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="template-select"
                disabled={uploading}
              >
                <option value="">-- Выберите существо --</option>
                {bestiary.map(creature => (
                  <option key={creature.id} value={creature.id}>
                    {creature.name} (HP: {creature.max_hp || '?'}, AC: {creature.ac || '?'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Имя токена в комнате:</label>
              <input
                type="text"
                value={nameInRoom}
                onChange={(e) => setNameInRoom(e.target.value)}
                placeholder="Введите имя токена"
                disabled={uploading}
              />
            </div>

            <div className="step-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Отмена
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={uploading}
              >
                {uploading ? 'Добавление...' : 'Добавить в комнату'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
