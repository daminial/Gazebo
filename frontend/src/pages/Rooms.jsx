import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { roomsAPI } from '../api'
import './Rooms.css'

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadRooms()
  }, [])

  const loadRooms = async () => {
    try {
      const { data } = await roomsAPI.getAll()
      setRooms(data)
    } catch (err) {
      setError('Ошибка загрузки комнат')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Загрузка...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="rooms-page">
      <div className="rooms-header">
        <h1>Комнаты</h1>
        <Link to="/rooms/create" className="create-room-btn">
          Создать комнату
        </Link>
      </div>

      {rooms.length === 0 ? (
        <p className="no-rooms">Пока нет созданных комнат</p>
      ) : (
        <div className="rooms-grid">
          {rooms.map((room) => (
            <div key={room.id} className="room-card">
              <h3>{room.name}</h3>
              <p className="room-description">{room.description}</p>
              <div className="room-meta">
                <span>HP: {room.current_hp}/{room.max_hp}</span>
                {room.owner_id && <span>• Владелец: {room.owner_id}</span>}
              </div>
              <Link to={`/rooms/${room.id}`} className="btn-join">
                Подробнее
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
