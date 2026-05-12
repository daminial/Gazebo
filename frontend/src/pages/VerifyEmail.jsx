import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './Auth.module.css'

export default function VerifyEmail() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { verifyEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const emailFromState = location.state?.email || ''
  if (emailFromState && !email) {
    setEmail(emailFromState)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await verifyEmail(email, code)
      navigate('/login', { state: { message: 'Email подтвержден. Теперь вы можете войти.' } })
    } catch (err) {
      setError(err.response?.data?.detail || 'Неверный код')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles['auth-page']} ${styles['register-page']}`}>
      <header className={styles['auth-header']}>
        <div className={styles['logo']}>
          <span>Meetgazebo</span>
        </div>
      </header>

      <div className={styles['auth-container']}>
        <div className={`${styles['auth-card']} ${styles['register']}`}>
          <h1>Подтверждение email</h1>
          <p style={{ textAlign: 'center', color: '#5A4A3A', marginBottom: '1.5rem' }}>
            Введите код, отправленный на вашу почту
          </p>
          <form onSubmit={handleSubmit}>
            <div className={styles['form-group']}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
              />
            </div>
            <div className={styles['form-group']}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="Код подтверждения"
                maxLength={6}
              />
            </div>
            {error && <p className={styles['error-message']}>{error}</p>}
            <button type="submit" className={`${styles['btn']} ${styles['btn-submit']}`} disabled={loading}>
              {loading ? 'Проверка...' : 'Подтвердить'}
            </button>
            <Link to="/login" className={`${styles['btn']} ${styles['btn-back']}`}>
              Вернуться ко входу
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}
