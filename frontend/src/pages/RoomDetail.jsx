import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { roomsAPI } from '../api'
import './RoomDetail.css'

export default function RoomDetail() {
  const { id } = useParams()
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadRoom()
  }, [id])

  const loadRoom = async () => {
    try {
      const { data } = await roomsAPI.getById(id)
      setRoom(data)
    } catch (err) {
      setError('Ошибка загрузки комнаты')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Загрузка...</div>
  if (error) return <div className="error">{error}</div>
  if (!room) return <div className="error">Комната не найдена</div>

  return (
    <div className="room-detail">
      <h1>{room.name}</h1>
      <p className="description">{room.description}</p>
      
      <div className="room-stats">
        <div className="stat-card">
          <h3>Здоровье</h3>
          <p className="stat-value">{room.current_hp} / {room.max_hp}</p>
        </div>
        <div className="stat-card">
          <h3>Класс брони</h3>
          <p className="stat-value">{room.armor_class}</p>
        </div>
      </div>

      <div className="room-info">
        <p><strong>ID:</strong> {room.id}</p>
        <p><strong>Создана:</strong> {new Date(room.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  )
}
