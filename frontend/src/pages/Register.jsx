import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import './Auth.css'

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (formData.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }

    setLoading(true)

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="logo">
          <span>Meetgazebo</span>
        </div>
      </header>

      <div className="auth-container">
        <div className="auth-card register">
          <h1>Регистрация</h1>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Email"
              />
            </div>
            <div className="form-group">
              <input
                type="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Имя"
              />
            </div>
            <div className="form-group">
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? '' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Пароль"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onMouseDown={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? '' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Подтверждение пароля"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onMouseDown={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="btn btn-submit" disabled={loading}>
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
            <Link to="/login" className="btn btn-back">
              Вернуться ко входу
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}
