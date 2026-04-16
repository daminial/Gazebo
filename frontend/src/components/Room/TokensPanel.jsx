import { useState, useRef } from 'react'
import { useRoom } from '../../context/RoomContext'
import './TokensPanel.css'

export function TokensPanel() {
  const { tokens, activePageId, createToken, createPropToken, bestiary } = useRoom()
  const [activeTab, setActiveTab] = useState('on-map') // 'on-map' или 'library'
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [draggedCreature, setDraggedCreature] = useState(null)

  // Токены на текущей странице
  const tokensOnPage = tokens.filter(t => t.page_id === activePageId)

  // Фильтр токенов на странице по типу
  const creatureTokens = tokensOnPage.filter(t => t.token_type === 'creature')
  const propTokens = tokensOnPage.filter(t => t.token_type === 'prop')

  // Обработчик начала перетаскивания существа из библиотеки
  const handleDragStart = (creature, e) => {
    setDraggedCreature(creature)
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'creature',
      creatureId: creature.id,
      name: creature.name,
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  // Обработчик конца перетаскивания
  const handleDragEnd = () => {
    setDraggedCreature(null)
  }

  return (
    <div className="tokens-panel">
      <div className="tokens-panel-header">
        <h3>🎭 Токены</h3>
        <button
          className="btn-add-token"
          onClick={() => setShowCreateModal(true)}
          title="Создать токен"
        >
          +
        </button>
      </div>

      {/* Переключатель вкладок */}
      <div className="tokens-tabs">
        <button
          className={`tab-btn ${activeTab === 'on-map' ? 'active' : ''}`}
          onClick={() => setActiveTab('on-map')}
        >
          На поле ({tokensOnPage.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          Библиотека
        </button>
      </div>

      {/* Содержимое вкладок */}
      <div className="tokens-content">
        {activeTab === 'on-map' && (
          <div className="tokens-on-map">
            {tokensOnPage.length === 0 ? (
              <div className="tokens-empty">
                <p>Нет токенов на поле</p>
                <button onClick={() => setActiveTab('library')}>
                  Добавить из библиотеки
                </button>
              </div>
            ) : (
              <>
                {creatureTokens.length > 0 && (
                  <div className="token-group">
                    <h4>🐉 Существа ({creatureTokens.length})</h4>
                    <div className="tokens-list">
                      {creatureTokens.map(token => (
                        <div key={token.id} className="token-card">
                          <div className="token-card-image">
                            {!token.image_url && !token.creature_template?.image_url && (
                              <span className="token-letter">
                                {token.name_in_room?.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="token-card-info">
                            <div className="token-card-name">{token.name_in_room}</div>
                            <div className="token-card-stats">
                              {token.current_hp !== null && (
                                <span>❤️ {token.current_hp}</span>
                              )}
                              {token.current_ac !== null && (
                                <span>🛡️ {token.current_ac}</span>
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
                    <h4>📦 Объекты ({propTokens.length})</h4>
                    <div className="tokens-list">
                      {propTokens.map(token => (
                        <div key={token.id} className="token-card">
                          <div className="token-card-image">
                            {!token.image_url && (
                              <span className="token-letter">📦</span>
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
        )}

        {activeTab === 'library' && (
          <div className="tokens-library">
            <div className="library-section">
              <h4>🐉 Существа</h4>
              <p className="library-hint">
                Перетащите существо на карту, чтобы создать токен
              </p>
              <div className="creatures-list">
                {bestiary.length === 0 ? (
                  <div className="creature-placeholder">
                    Загрузка существ...
                  </div>
                ) : (
                  bestiary.map(creature => (
                    <div
                      key={creature.id}
                      className="creature-card"
                      draggable
                      onDragStart={(e) => handleDragStart(creature, e)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="creature-card-image">
                        {creature.image_url ? (
                          <img src={creature.image_url} alt={creature.name} />
                        ) : (
                          <span className="token-letter">
                            {creature.name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="creature-card-info">
                        <div className="creature-card-name">{creature.name}</div>
                        <div className="creature-card-stats">
                          <span>❤️ {creature.max_hp || '?'}</span>
                          <span>🛡️ {creature.ac || '?'}</span>
                          <span>⚔️ CR {creature.cr}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="library-section">
              <h4>🖼️ Изображения</h4>
              <p className="library-hint">
                Перетащите изображение на карту, чтобы создать prop-токен
              </p>
              <div className="images-list">
                <div className="images-placeholder">
                  Загрузка изображений...
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно создания токена */}
      {showCreateModal && (
        <TokenCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreateToken={createToken}
          onCreateProp={createPropToken}
        />
      )}
    </div>
  )
}

// Модальное окно создания токена
function TokenCreateModal({ onClose, onCreateToken, onCreateProp }) {
  const [tokenType, setTokenType] = useState('creature')
  const [name, setName] = useState('')
  const [creatureId, setCreatureId] = useState(null)
  const [positionX, setPositionX] = useState(0)
  const [positionY, setPositionY] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (tokenType === 'creature') {
        await onCreateToken({
          name_in_room: name,
          creature_template_id: creatureId,
          position_x: positionX,
          position_y: positionY,
        })
      } else {
        await onCreateProp({
          name_in_room: name,
          position_x: positionX,
          position_y: positionY,
          width: 50,
          height: 50,
        })
      }
      onClose()
    } catch (err) {
      console.error('Failed to create token:', err)
      alert('Ошибка при создании токена')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content token-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Создать токен</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Тип токена</label>
            <div className="token-type-selector">
              <button
                type="button"
                className={`token-type-btn ${tokenType === 'creature' ? 'active' : ''}`}
                onClick={() => setTokenType('creature')}
              >
                🐉 Существо
              </button>
              <button
                type="button"
                className={`token-type-btn ${tokenType === 'prop' ? 'active' : ''}`}
                onClick={() => setTokenType('prop')}
              >
                📦 Объект
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите имя токена"
              required
            />
          </div>

          {tokenType === 'creature' && (
            <div className="form-group">
              <label>Шаблон существа</label>
              <select
                value={creatureId || ''}
                onChange={(e) => setCreatureId(parseInt(e.target.value))}
                required
              >
                <option value="">Выберите существо</option>
                {/* TODO: Загрузить из бестиария */}
              </select>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-submit">
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
