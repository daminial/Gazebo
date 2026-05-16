import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { FaGithub, FaYandex } from 'react-icons/fa'
import styles from './Auth.module.css'

const API_URL = ''

export default function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

  const handleOAuthLogin = (provider) => {
    window.location.href = `${API_URL}/auth/login/${provider}`
  }
  
  return (
    <div className={styles['auth-page']}>
      <header className={styles['auth-header']}>
        <div className={styles['logo']}>
          <span>Meetgazebo</span>
        </div>
      </header>

      <div className={styles['auth-container']}>
        <div className={styles['auth-card']}>
          <h1>Вход</h1>

          <div className={styles['oauth-buttons']}>
            <button
              type="button"
              className={`${styles['btn-oauth']} ${styles['btn-google']}`}
              onClick={() => handleOAuthLogin('google')}
            >
              <FcGoogle size={20} />
              <span>Google</span>
            </button>

            <button
              type="button"
              className={`${styles['btn-oauth']} ${styles['btn-github']}`}
              onClick={() => handleOAuthLogin('github')}
            >
              <FaGithub size={20} />
              <span>GitHub</span>
            </button>

            <button type="button" 
              className={`${styles['btn-oauth']} ${styles['btn-yandex']}`}
              onClick={() => handleOAuthLogin('yandex')}
            >
              <FaYandex size={20} />
              <span>Yandex</span>
            </button>
          </div>

          <div className={styles['divider']}>
            <span>или</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles['form-group']}>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Имя пользователя"
              />
            </div>
            <div className={styles['form-group']}>
              <div className={styles['password-input-wrapper']}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Пароль"
                />
                <button
                  type="button"
                  className={styles['password-toggle']}
                  onMouseDown={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {error && <p className={styles['error-message']}>{error}</p>}

            <button type="submit" className={`${styles['btn']} ${styles['btn-submit']}`} disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </button>
            <Link to="/register" className={`${styles['btn']} ${styles['btn-back']}`}>
              Нет аккаунта? Зарегистрироваться
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}