import { useState, useEffect } from 'react'
import { mapTemplatesAPI } from '../api'
import './Map.css'

export default function Map() {
  const [myMaps, setMyMaps] = useState([])
  const [topMaps, setTopMaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [order, setOrder] = useState('desc')
  const [tagsInput, setTagsInput] = useState('')

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
      // API returns rating as string/decimal in some cases; normalize and sort client-side if needed
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
        <button className="btn-create">Загрузить карту</button>
      </div>

      <section className="my-maps">
        <h2>Мои карты</h2>
        <div className="my-maps-row">
          {myMaps.length === 0 ? (
            <div className="no-maps-inline">У вас пока нет карт</div>
          ) : (
            myMaps.map((m) => (
              <div className="my-map-thumb" key={m.id}>
                {m.image_url ? (
                  <img src={m.image_url} alt={m.name} />
                ) : (
                  <div className="thumb-placeholder">Нет изображения</div>
                )}
                <div className="thumb-title">{m.name}</div>
              </div>
            ))
          )}
        </div>
      </section>

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
