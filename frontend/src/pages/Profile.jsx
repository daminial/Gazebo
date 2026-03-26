import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { authAPI } from '../api'
import './Profile.css'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      await updateUser(formData)
      setSuccess('Данные успешно обновлены')
      setEditing(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка обновления')
    }
  }

  if (!user) return <div className="error">Пользователь не найден</div>

  return (
    <div className="profile-page">
      <h1>Профиль</h1>
      
      <div className="profile-card">
        {!editing ? (
          <div className="profile-view">
            <div className="profile-field">
              <label>Имя пользователя</label>
              <p>{user.username}</p>
            </div>
            <div className="profile-field">
              <label>Email</label>
              <p>{user.email}</p>
            </div>
            <button
              className="btn-create"
              onClick={() => setEditing(true)}
            >
              Редактировать
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label htmlFor="username">Имя пользователя</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}
            <div className="form-actions">
              <button type="submit" className="btn-create">
                Сохранить
              </button>
              <button
                type="button"
                className="btn-join"
                onClick={() => setEditing(false)}
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
