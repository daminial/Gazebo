import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { FaGithub, FaYandex } from 'react-icons/fa'
import TermsModal from '../components/TermsModal.jsx'
import PrivacyModal from '../components/PrivacyModal.jsx'
import styles from './Auth.module.css'

const API_URL = ''

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!agreedToTerms) {
      setError('Необходимо принять пользовательское соглашение')
      return
    }

    if (!agreedToPrivacy) {
      setError('Необходимо дать согласие на обработку персональных данных')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (formData.password.length < 8) {
      setError('Пароль должен быть не менее 8 символов')
      return
    }

    setLoading(true)

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })
      navigate('/verify-email', { state: { email: formData.email } })
    } catch (err) {
      const responseData = err.response?.data
      
      if (responseData?.detail) {
        if (Array.isArray(responseData.detail)) {
          const firstError = responseData.detail[0]
          const message = firstError.msg
            .replace(/^Value error,\s*/i, '')
            .replace(/^Assertion failed,\s*/i, '')
          setError(message)
        } else if (typeof responseData.detail === 'string') {
          setError(responseData.detail)
        } else {
          setError('Ошибка регистрации')
        }
      } else {
        setError('Ошибка регистрации')
      }
    } finally {
      setLoading(false)
    }
  }

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

  const handleOAuthLogin = (provider) => {
    window.location.href = `${API_URL}/auth/login/${provider}`
  }

  return (
    <>
      <div className={`${styles['auth-page']} ${styles['register-page']}`}>
        <header className={styles['auth-header']}>
          <div className={styles['logo']}>
            <span>Meetgazebo</span>
          </div>
        </header>

        <div className={styles['auth-container']}>
          <div className={`${styles['auth-card']} ${styles['register']}`}>
            <h1>Регистрация</h1>

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
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="Email"
                />
              </div>
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
              <div className={styles['form-group']}>
                <div className={styles['password-input-wrapper']}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Подтверждение пароля"
                  />
                  <button
                    type="button"
                    className={styles['password-toggle']}
                    onMouseDown={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className={styles['terms-checkbox']}>
                <label>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                  />
                  <span>
                    Я принимаю{' '}
                    <button
                      type="button"
                      className={styles['terms-link']}
                      onClick={() => setShowTermsModal(true)}
                    >
                      пользовательское соглашение
                    </button>
                  </span>
                </label>
              </div>

              <div className={styles['terms-checkbox']}>
                <label>
                  <input
                    type="checkbox"
                    checked={agreedToPrivacy}
                    onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  />
                  <span>
                    Я даю{' '}
                    <button
                      type="button"
                      className={styles['terms-link']}
                      onClick={() => setShowPrivacyModal(true)}
                    >согласие на обработку персональных данных</button>
                  </span>
                </label>
              </div>

              {error && <p className={styles['error-message']}>{error}</p>}
              {success && <p className={styles['success-message']}>{success}</p>}

              <button type="submit" className={`${styles['btn']} ${styles['btn-submit']}`} disabled={loading}>
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
              <Link to="/login" className={`${styles['btn']} ${styles['btn-back']}`}>
                Вернуться ко входу
              </Link>
            </form>
          </div>
        </div>
      </div>

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setAgreedToTerms(true)
          setShowTermsModal(false)
        }}
      />

      <PrivacyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAccept={() => {
          setAgreedToPrivacy(true)
          setShowPrivacyModal(false)
        }}
      />
    </>
  )
}