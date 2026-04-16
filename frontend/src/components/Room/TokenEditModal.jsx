import { useState } from 'react'
import { useRoom } from '../../context/RoomContext'
import './TokenEditModal.css'

export function TokenEditModal({ token, onClose }) {
  const { updateToken, deleteToken, bestiary, updateTokenVisibility } = useRoom()
  const [name, setName] = useState(token.name_in_room || '')
  const [currentHp, setCurrentHp] = useState(token.current_hp || 0)
  const [currentAc, setCurrentAc] = useState(token.current_ac || 0)
  const [isVisible, setIsVisible] = useState(token.is_visible ?? true)
  const [creatureTemplateId, setCreatureTemplateId] = useState(token.creature_template_id || null)

  const handleSave = async () => {
    try {
      const payload = {
        name_in_room: name,
        current_hp: currentHp,
        current_ac: currentAc,
        creature_template_id: creatureTemplateId,
      }
      console.debug('[TokenEditModal] Saving token', token.id, payload)
      const updated = await updateToken(token.id, payload)
      console.debug('[TokenEditModal] Update response', updated)
      onClose()
    } catch (err) {
      console.error('Failed to update token:', err)
      alert('Ошибка при сохранении')
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Удалить этот токен?')) {
      try {
        await deleteToken(token.id)
        onClose()
      } catch (err) {
        console.error('Failed to delete token:', err)
        alert('Ошибка при удалении')
      }
    }
  }

  const handleToggleVisibility = async () => {
    try {
      await updateTokenVisibility(token.id, !isVisible)
      setIsVisible(!isVisible)
    } catch (err) {
      console.error('Failed to update visibility:', err)
    }
  }

  const handleHpChange = (delta) => {
    const newValue = Math.max(0, currentHp + delta)
    setCurrentHp(newValue)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content token-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Редактировать токен</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="token-edit-body">
          {/* Превью токена */}
          <div className="token-preview">
            <div className={`token-preview-shape ${token.token_type === 'prop' ? 'square' : 'circle'}`}>
              {token.image_url || token.creature_template?.image_url ? (
                <img
                  src={token.image_url || token.creature_template?.image_url}
                  alt={name}
                />
              ) : (
                <span className="token-letter">
                  {name?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
          </div>

          {/* Форма редактирования */}
          <div className="token-edit-form">
            <div className="form-group">
              <label>Имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  console.debug('[TokenEditModal] name change', e.target.value)
                  setName(e.target.value)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder="Имя токена"
              />
            </div>

            {token.creature_template && (
              <>
                <div className="form-group">
                  <label>Здоровье (HP)</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <input
                      type="number"
                      value={currentHp}
                      onChange={(e) => {
                        console.debug('[TokenEditModal] hp change', e.target.value)
                        setCurrentHp(parseInt(e.target.value) || 0)
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                      style={{width: 100}}
                      min={0}
                      max={token.creature_template.max_hp || undefined}
                    />
                    <span>/ {token.creature_template.max_hp || '?'}</span>
                  </div>
                  <div className="hp-bar-preview">
                    <span>
                      {currentHp} / {token.creature_template.max_hp || '?'}
                    </span>
                    <div className="hp-bar">
                      <div
                        className="hp-bar-fill"
                        style={{
                          width: `${token.creature_template.max_hp ? (currentHp / token.creature_template.max_hp) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Класс доспеха (AC)</label>
                  <input
                    type="number"
                    value={currentAc}
                    onChange={(e) => {
                      console.debug('[TokenEditModal] ac change', e.target.value)
                      setCurrentAc(parseInt(e.target.value) || 0)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => handleToggleVisibility()}
                />
                Видим для игроков
              </label>
            </div>
          </div>
        </div>

        <div className="token-edit-actions">
          <button className="btn-delete" onClick={handleDelete}>
            Удалить
          </button>
          <div className="action-spacer" />
          <button className="btn-cancel" onClick={onClose}>
            Отмена
          </button>
          <button className="btn-submit" onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
