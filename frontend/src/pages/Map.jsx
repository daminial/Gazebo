import { useState, useEffect } from 'react'
import { mapTemplatesAPI, mapEditorAPI } from '../api'
import { useNavigate } from 'react-router-dom'
import './Map.css'
import { FiMoreHorizontal, FiTrash2 } from 'react-icons/fi'

export default function Map() {
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
                        setShowDeleteModal(true)
                      }}
                    >
                      <FiTrash2 size={14} style={{ marginRight: 6 }} />
                      Удалить
                    </button>
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
              <h3>Удалить карту</h3>
              <button className="create-modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="create-modal-body">
              <p style={{ margin: 0, color: '#333', fontSize: 14 }}>
                Вы уверены, что хотите удалить карту <strong>«{deletingMap.name}»</strong>?
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
                    await mapTemplatesAPI.delete(deletingMap.id)
                    setShowDeleteModal(false)
                    setDeletingMap(null)
                    loadAll()
                  } catch (err) {
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
              <div className="top-card" key={m.id}>
                <div className="top-card-left">
                  {m.image_url ? (
                    <img src={m.image_url} alt={m.name} />
                  ) : (
                    <div className="map-placeholder">Нет изображения</div>
                  )}
                </div>
                <div className="top-card-body">
                  <h3>{m.name}</h3>
                  <div className="meta">
                    <span className="author">Автор: {m.owner_id ? m.owner_id.slice(0, 8) : '-'}</span>
                    <span className="rating">★ {m.rating ?? 0}</span>
                  </div>
                  {m.description && <p className="map-description">{m.description}</p>}
                  <div className="tags-row">
                    {(m.tags || []).map((t) => (
                      <span className="tag" key={t.id}>{t.name}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}