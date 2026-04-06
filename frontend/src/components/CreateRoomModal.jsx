import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomsAPI } from '../api'
import Modal from './Modal.jsx'
import './CreateRoomModal.css'

export default function CreateRoomModal({ isOpen, onClose }) {
  const [roomName, setRoomName] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!roomName.trim()) {
      setError('Введите название комнаты')
      return
    }

    setLoading(true)

    try {
      const { data: roomData } = await roomsAPI.create(roomName, imageFile)
      onClose()
      navigate(`/companies/${roomData.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка создания комнаты')
    } finally {
      setLoading(false)
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleClose = () => {
    setRoomName('')
    setImageFile(null)
    setImagePreview(null)
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Создать комнату">
      <form onSubmit={handleSubmit} className="create-room-form">
        <div className="form-group">
          <label htmlFor="roomName">Название комнаты</label>
          <input
            type="text"
            id="roomName"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Введите название комнаты"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="imageUpload">Изображение комнаты (необязательно)</label>
          <div className="image-upload">
            {imagePreview ? (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button 
                  type="button" 
                  className="remove-image"
                  onClick={() => {
                    setImageFile(null)
                    setImagePreview(null)
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <label className="upload-placeholder" htmlFor="imageUpload">
                <span className="upload-icon">📷</span>
                <span>Нажмите для загрузки</span>
                <input
                  type="file"
                  id="imageUpload"
                  accept="image/*"
                  onChange={handleImageChange}
                  hidden
                />
              </label>
            )}
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn-cancel" onClick={handleClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-create" disabled={loading}>
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
