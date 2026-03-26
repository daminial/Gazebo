import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import './Auth.css'

export default function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(formData)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="logo">
          <div className="logo-icon"></div>
          <span>Logo</span>
        </div>
      </header>

      <div className="auth-container">
        <div className="auth-card">
          <h1>Вход</h1>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Имя пользователя"
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Пароль"
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="btn btn-submit" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </button>
            <Link to="/register" className="btn btn-back">
              Нет аккаунта? Зарегистрироваться
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}
