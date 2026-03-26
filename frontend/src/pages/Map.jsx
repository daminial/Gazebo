import { useState, useEffect } from 'react'
import { mapAPI } from '../api'
import './Map.css'

export default function Map() {
  const [maps, setMaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMaps()
  }, [])

  const loadMaps = async () => {
    try {
      const { data } = await mapAPI.getAll()
      setMaps(data)
    } catch (err) {
      setError('Ошибка загрузки карт')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Загрузка...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="map-page">
      <div className="map-header">
        <h1>Карта</h1>
        <button className="btn-create">Загрузить карту</button>
      </div>

      {maps.length === 0 ? (
        <p className="no-maps">Карт пока нет</p>
      ) : (
        <div className="maps-grid">
          {maps.map((map) => (
            <div key={map.id} className="map-card">
              <h3>{map.name}</h3>
              {map.description && (
                <p className="map-description">{map.description}</p>
              )}
              {map.image_url ? (
                <img src={map.image_url} alt={map.name} className="map-image" />
              ) : (
                <div className="map-placeholder">Нет изображения</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
