import { useState, useEffect } from 'react'
import { bestiaryAPI } from '../api'
import './Bestiary.css'

export default function Bestiary() {
  const [creatures, setCreatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCreatures()
  }, [])

  const loadCreatures = async () => {
    try {
      const { data } = await bestiaryAPI.getAll()
      setCreatures(data)
    } catch (err) {
      setError('Ошибка загрузки бестиария')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Загрузка...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="bestiary-page">
      <div className="bestiary-header">
        <h1>Бестиарий</h1>
        <button className="btn-create">Добавить существо</button>
      </div>

      {creatures.length === 0 ? (
        <p className="no-entries">Бестиарий пуст</p>
      ) : (
        <div className="creatures-grid">
          {creatures.map((creature) => (
            <div key={creature.id} className="creature-card">
              <h3>{creature.name}</h3>
              {creature.creature_type && (
                <span className="creature-type">{creature.creature_type}</span>
              )}
              {creature.description && (
                <p className="creature-description">{creature.description}</p>
              )}
              <div className="creature-stats">
                {creature.ac !== null && <span>AC: {creature.ac}</span>}
                {creature.hp !== null && <span>HP: {creature.hp}</span>}
                {creature.speed !== null && <span>SPD: {creature.speed}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
