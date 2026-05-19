import { useState, useEffect } from 'react'
import { mapTemplatesAPI, mapEditorAPI } from '../api'
import { useNavigate } from 'react-router-dom'
import './Map.css'
import { useAuth } from '../context/AuthContext'
import { FiMoreHorizontal, FiTrash2, FiStar, FiShield } from 'react-icons/fi'

export default function Map() {
  const { user, canDeleteContent } = useAuth()
  const [myMaps, setMyMaps] = useState([])
  const [topMaps, setTopMaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [order, setOrder] = useState('desc')
  const [tagsInput, setTagsInput] = useState('')
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState(1)
  const [projName, setProjName] = useState('')
  const [projWidth, setProjWidth] = useState(2000)
  const [projHeight, setProjHeight] = useState(1500)
  const [projOrientation, setProjOrientation] = useState('horizontal')
  const [projPublic, setProjPublic] = useState(false)
  const [availablePacks, setAvailablePacks] = useState([])
  const [selectedPackId, setSelectedPackId] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingMap, setDeletingMap] = useState(null)
  const [isModeratorDelete, setIsModeratorDelete] = useState(false)

  const [selectedMapForRating, setSelectedMapForRating] = useState(null)
  const [hoverRating, setHoverRating] = useState(0)
  const [selectedRating, setSelectedRating] = useState(0)

  const getUserRatings = () => {
    try {
      return JSON.parse(localStorage.getItem('mapRatings') || '{}')
    } catch {
      return {}
    }
  }

  const saveUserRating = (mapId, rating) => {
    const ratings = getUserRatings()
    ratings[mapId] = rating
    localStorage.setItem('mapRatings', JSON.stringify(ratings))
  }

  const openCreate = () => {
    setProjName('')
    setProjWidth(2000)
    setProjHeight(1500)
    setProjOrientation('horizontal')
    setProjPublic(false)
    setSelectedPackId(null)
    setCreateStep(1)
    setShowCreateModal(true)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [myRes, topRes] = await Promise.all([
        mapTemplatesAPI.getMy(),
        mapTemplatesAPI.getTop(order, null),
      ])
      setMyMaps(myRes.data || [])
      let topData = topRes.data || []
      topData = topData.map((t) => ({ ...t, rating: Number(t.rating || 0) }))
      if (order === 'asc') topData.sort((a, b) => a.rating - b.rating)
      else topData.sort((a, b) => b.rating - a.rating)
      setTopMaps(topData)
    } catch (err) {
      setError('Ошибка загрузки карт')
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = async () => {
    setLoading(true)
    try {
      const tags = tagsInput.trim() === '' ? null : tagsInput
      const { data } = await mapTemplatesAPI.getTop(order, tags)
      let topData = data || []
      topData = topData.map((t) => ({ ...t, rating: Number(t.rating || 0) }))
      if (order === 'asc') topData.sort((a, b) => a.rating - b.rating)
      else topData.sort((a, b) => b.rating - a.rating)
      setTopMaps(topData)
    } catch (err) {
      setError('Ошибка фильтрации')
    } finally {
      setLoading(false)
    }
  }

  const toggleOrder = () => {
    setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))
  }

  const handleRate = async (rating) => {
    if (!selectedMapForRating || !rating) return
    try {
      const { data } = await mapTemplatesAPI.rate(selectedMapForRating.id, rating)
      saveUserRating(selectedMapForRating.id, rating)
      
      const newRating = Number(data.rating)
      const newVotes = Number(data.votes)
      
      setTopMaps(prev => prev.map(m => 
        m.id === selectedMapForRating.id 
          ? { ...m, rating: newRating, votes: newVotes }
          : { ...m }
      ))
      
      setSelectedMapForRating(null)
    } catch (err) {
      console.error('Ошибка при выставлении рейтинга:', err)
      alert('Не удалось выставить рейтинг')
    }
  }

  if (loading) return <div className="loading">Загрузка...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="map-page">
      <div className="map-header">
        <h1>Карты</h1>
        <button onClick={openCreate} className="btn-create">Создать карту</button>
      </div>

      {showCreateModal && (
        <div className="create-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="create-modal-header">
              <h3>{createStep === 1 ? 'Шаг 1 — Параметры карты' : 'Шаг 2 — Выберите пакет ассетов'}</h3>
              <button className="create-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <div className="create-modal-body">
              {createStep === 1 ? (
                <div className="create-form">
                  <label className="create-label">
                    Название
                    <input
                      className="create-input"
                      value={projName}
                      onChange={(e) => setProjName(e.target.value)}
                      placeholder="Введите название карты"
                    />
                  </label>

                  <label className="create-label">Разрешение</label>
                  <div className="create-row">
                    <input
                      type="number"
                      className="create-input"
                      value={projWidth}
                      onChange={(e) => setProjWidth(Number(e.target.value) || 0)}
                      placeholder="Ширина"
                    />
                    <input
                      type="number"
                      className="create-input"
                      value={projHeight}
                      onChange={(e) => setProjHeight(Number(e.target.value) || 0)}
                      placeholder="Высота"
                    />
                  </div>

                  <label className="create-label">
                    Ориентация
                    <select
                      className="create-select"
                      value={projOrientation}
                      onChange={(e) => setProjOrientation(e.target.value)}
                    >
                      <option value="horizontal">Горизонтальная</option>
                      <option value="vertical">Вертикальная</option>
                    </select>
                  </label>

                  <label className="create-checkbox">
                    <input
                      type="checkbox"
                      checked={projPublic}
                      onChange={(e) => setProjPublic(e.target.checked)}
                    />
                    Публичная карта
                  </label>
                </div>
              ) : (
                <div className="packs-grid">
                  {availablePacks.map((p) => (
                    <div
                      key={p.id}
                      className={`pack-card ${selectedPackId === p.id ? 'active' : ''}`}
                      onClick={() => setSelectedPackId(p.id)}
                    >
                      <div className="pack-name">{p.name}</div>
                      <div className="pack-desc">{p.description || 'Без описания'}</div>
                      <div className="pack-meta">{p.assets_count || 0} ассетов</div>
                    </div>
                  ))}
                  {availablePacks.length === 0 && (
                    <div className="empty-state">Нет доступных паков</div>
                  )}
                </div>
              )}
            </div>

            <div className="create-modal-footer">
              <div>
                {createStep === 2 && (
                  <button className="btn-secondary" onClick={() => setCreateStep(1)}>
                    ← Назад
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Отмена
                </button>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    if (createStep === 1) {
                      if (!projName) return alert('Укажите название')
                      try {
                        const { data } = await mapEditorAPI.getPacks()
                        setAvailablePacks(data || [])
                        setCreateStep(2)
                      } catch (e) {
                        alert('Ошибка загрузки паков')
                      }
                    } else {
                      try {
                        const body = {
                          name: projName,
                          orientation: projOrientation,
                          width: projWidth,
                          height: projHeight,
                          pack_id: selectedPackId,
                          is_public: projPublic,
                        }
                        const { data } = await mapEditorAPI.createProject(body)
                        setShowCreateModal(false)
                        navigate(`/map-editor/${data.id}`)
                      } catch (e) {
                        alert('Ошибка создания проекта')
                      }
                    }
                  }}
                >
                  {createStep === 1 ? 'Далее' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="my-maps">
        <h2>Мои карты</h2>
        <div className="my-maps-grid">
          {myMaps.length === 0 ? (
            <div className="no-maps-inline">У вас пока нет карт</div>
          ) : (
            myMaps.map((m) => (
              <div className="my-map-thumb" key={m.id}>
                <div className="map-actions">
                  <button
                    className="map-actions-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      const menu = e.currentTarget.nextElementSibling
                      menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
                    }}
                  >
                    <FiMoreHorizontal size={16} />
                  </button>
                  <div className="map-actions-menu" style={{ display: 'none' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.target.closest('.map-actions-menu').style.display = 'none'
                        setDeletingMap(m)
                        setIsModeratorDelete(false)
                        setShowDeleteModal(true)
                      }}
                    >
                      <FiTrash2 size={14} style={{ marginRight: 6 }} />
                      Удалить
                    </button>
                    {canDeleteContent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          e.target.closest('.map-actions-menu').style.display = 'none'
                          setDeletingMap(m)
                          setIsModeratorDelete(true)
                          setShowDeleteModal(true)
                        }}
                        className="moderator-delete-btn"
                      >
                        <FiShield size={14} style={{ marginRight: 6 }} />
                        Удалить (Модератор)
                      </button>
                    )}
                  </div>
                </div>
                <div
                  onClick={async () => {
                    try {
                      const { data: project } = await mapEditorAPI.getProjectByTemplate(m.id)
                      navigate(`/map-editor/${project.id}`)
                    } catch (e) {
                      alert('Этот шаблон нельзя редактировать (проект не найден)')
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {m.image_url ? (
                    <img src={m.image_url} alt={m.name} />
                  ) : (
                    <div className="thumb-placeholder">Нет изображения</div>
                  )}
                  <div className="thumb-title">{m.name}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {showDeleteModal && deletingMap && (
        <div className="create-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="create-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="create-modal-header">
              <h3>{isModeratorDelete ? 'Удалить карту (Модератор)' : 'Удалить карту'}</h3>
              <button className="create-modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="create-modal-body">
              <p style={{ margin: 0, color: '#333', fontSize: 14 }}>
                {isModeratorDelete
                  ? `Вы уверены, что хотите удалить публичную карту «${deletingMap.name}»? Это действие необратимо.`
                  : `Вы уверены, что хотите удалить карту «${deletingMap.name}»?`
                }
              </p>
            </div>
            <div className="create-modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Отмена
              </button>
              <button
                className="btn-delete"
                onClick={async () => {
                  try {
                    if (isModeratorDelete && canDeleteContent) {
                      await mapTemplatesAPI.moderatorDelete(deletingMap.id)
                    } else {
                      await mapTemplatesAPI.delete(deletingMap.id)
                    }
                    setShowDeleteModal(false)
                    setDeletingMap(null)
                    setIsModeratorDelete(false)
                    loadAll()
                  } catch (err) {
                    console.error('Ошибка удаления:', err)
                    alert('Ошибка удаления')
                  }
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
      
      <section className="top-maps">
        <div className="top-header">
          <h2>Топ карт</h2>
          <div className="filters">
            <input
              placeholder="Теги (через запятую)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <button onClick={applyFilter} className="btn-apply">Применить</button>
            <button onClick={() => { toggleOrder(); applyFilter(); }} className="btn-order">
              Сортировать: {order === 'desc' ? 'убыв.' : 'возр.'}
            </button>
          </div>
        </div>

        {topMaps.length === 0 ? (
          <div className="no-maps">Публичных карт не найдено</div>
        ) : (
          <div className="top-list">
            {topMaps.map((m) => (
              <div 
                className="top-card" 
                key={m.id}
                onClick={() => {
                  setSelectedMapForRating(m)
                  const ratings = getUserRatings()
                  setSelectedRating(ratings[m.id] || 0)
                }}
              >
                {canDeleteContent && (
                  <button
                    className="moderator-delete-top-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeletingMap(m)
                      setIsModeratorDelete(true)
                      setShowDeleteModal(true)
                    }}
                    title="Удалить карту (Модератор)"
                  >
                    <FiShield size={18} />
                  </button>
                )}
                <div className="top-card-image-wrapper">
                  {m.image_url ? (
                    <img src={m.image_url} alt={m.name} />
                  ) : (
                    <div className="top-card-image-placeholder">
                      Нет изображения
                    </div>
                  )}
                </div>

                <div className="top-card-content">
                  <div className="top-card-header">
                    <div className="top-card-info">
                      <h3>{m.name}</h3>
                      <div className="top-card-meta">
                         Автор: {m.owner_username}
                      </div>
                      {m.description && (
                        <p className="top-card-description">
                          {m.description}
                        </p>
                      )}
                    </div>

                    <div className="top-card-rating-box">
                      <div className="rating-badge">
                        <FiStar style={{ fill: 'transparent', stroke: '#eee', strokeWidth: 2, width: 16, height: 16 }} />
                        <span>{typeof m.rating === 'number' ? m.rating.toFixed(2) : '0.00'}</span>
                      </div>
                      
                      <div className="top-card-tags">
                        {(m.tags || []).slice(0, 4).map((tagName, index) => (
                          <span key={index} className="top-card-tag">
                            {tagName}
                          </span>
                        ))}
                        {m.tags && m.tags.length > 4 && (
                          <span className="top-card-tag-more">
                            +{m.tags.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rating Modal */}
      {selectedMapForRating && (
        <div className="modal-overlay" onClick={() => setSelectedMapForRating(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMapForRating(null)}>✕</button>
            
            <div className="modal-image-wrapper">
              {selectedMapForRating.image_url ? (
                <img 
                  src={selectedMapForRating.image_url} 
                  alt={selectedMapForRating.name} 
                  className="modal-image"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '50vh',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto'
                  }}
                />
              ) : (
                <div className="modal-image-placeholder">{selectedMapForRating.name}</div>
              )}
            </div>
            
            <h3 className="modal-title">{selectedMapForRating.name}</h3>
            
            {selectedMapForRating.tags && selectedMapForRating.tags.length > 0 && (
              <div className="modal-tags-section">
                <p className="modal-tags-label">Теги:</p>
                <div className="modal-tags-container">
                  {selectedMapForRating.tags.map((tagName, index) => (
                    <span key={index} className="modal-tag">
                      {tagName}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="rating-section">
              <p className="rating-label">Ваш рейтинг (1-10):</p>
              <div className="stars-container">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starValue) => (
                  <button
                    key={starValue}
                    className={`star-btn ${starValue <= (hoverRating || selectedRating) ? 'active' : ''}`}
                    onClick={() => setSelectedRating(starValue)}
                    onMouseEnter={() => setHoverRating(starValue)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    <FiStar className="star-icon" />
                  </button>
                ))}
              </div>
              <p className="current-rating">
                Средний рейтинг: {Number(selectedMapForRating.rating || 0).toFixed(1)}/10 
                ({selectedMapForRating.votes || 0} {selectedMapForRating.votes === 1 ? 'голос' : 'голосов'})
              </p>
              <button 
                className="btn-rate-submit"
                onClick={() => handleRate(selectedRating)}
                disabled={!selectedRating}
              >
                Оценить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}