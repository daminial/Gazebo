import './Home.css'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { mapTemplatesAPI } from '../api'

export default function Home() {
  const navigate = useNavigate()
  const [topMaps, setTopMaps] = useState([])
  const [loading, setLoading] = useState(true)

  const isAuthenticated = !!localStorage.getItem('access_token')

  useEffect(() => {
    const fetchTopMaps = async () => {
      try {
        const response = await mapTemplatesAPI.getTop()
        const sortedMaps = response.data
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 3)
        setTopMaps(sortedMaps)
      } catch (error) {
        console.error('Failed to fetch top maps:', error)
        setTopMaps([])
      } finally {
        setLoading(false)
      }
    }

    fetchTopMaps()
  }, [])

  const handleMapClick = () => {
    if (isAuthenticated) {
      navigate('/map')
    } else {
      navigate('/register')
    }
  }

  return (
    <div className="home">
      <section className="section">
        <h2 className="section-title">Компании</h2>
        <div className="cards-grid">
          <div className="card">
            <img src="https://placehold.co/400x120/DC143C/FFFFFF?text=D%26D" alt="D&D Logo" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x120/DC143C/FFFFFF?text=D%26D" alt="D&D Logo" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x120/DC143C/FFFFFF?text=D%26D" alt="D&D Logo" className="card-image" />
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Топ карт</h2>
        <div className="cards-grid">
           {loading ? (
            <div className="card">Загрузка...</div>
          ) : topMaps.length > 0 ? (
            topMaps.map((map) => (
              <div
                key={map.id}
                className="card map-card-clickable"
                onClick={handleMapClick}
              >
                <img
                  src={map.image_url || map.preview_url || 'https://placehold.co/400x180/D2B48C/8B4513?text=Map'}
                  alt={map.name || 'Карта'}
                  className="card-image"
                />
              </div>
            ))
          ) : (
            <div className="card">Нет доступных карт</div>
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Лучшие альбомы</h2>
        <div className="cards-grid">
          <div className="card">
            <img src="https://placehold.co/400x200/FFA500/000000?text=RECORD+Label" alt="Album" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x200/FFA500/000000?text=RECORD+Label" alt="Album" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x200/FFA500/000000?text=RECORD+Label" alt="Album" className="card-image" />
          </div>
        </div>
      </section>
    </div>
  )
}