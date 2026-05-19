import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { authAPI, mapTemplatesAPI, roomsAPI } from '../api'
import './Profile.css'

export default function Profile() {
  const { user, updateUser, uploadAvatar, deleteAvatar, deleteAccount, setUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  
  const [activeTab, setActiveTab] = useState('companies')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAvatarDeleteConfirm, setShowAvatarDeleteConfirm] = useState(false)
  
  const [maps, setMaps] = useState([])
  const [companies, setCompanies] = useState([])
  
  const [editingName, setEditingName] = useState(false)
  const [newUsername, setNewUsername] = useState(user?.username || '')

  useEffect(() => {
    setNewUsername(user?.username || '')
  }, [user?.username])

  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now())

  useEffect(() => {
    if (activeTab === 'maps') {
      loadMaps()
    } else if (activeTab === 'companies') {
      loadCompanies()
    }
  }, [activeTab])

  const loadMaps = async () => {
    try {
      setLoading(true)
      setError('')
      const { data } = await mapTemplatesAPI.getMy()
      setMaps(data)
    } catch (err) {
      setError('Ошибка загрузки карт')
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      setLoading(true)
      setError('')
      const { data } = await roomsAPI.getMy()
      setCompanies(data)
    } catch (err) {
      setError('Ошибка загрузки компаний')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой. Максимальный размер 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Можно загружать только изображения')
      return
    }

    try {
      setLoading(true)
      setError('')
      const updatedUser = await uploadAvatar(file)
      if (setUser) {
        setUser(updatedUser)
      }
      setAvatarTimestamp(Date.now())
      setSuccess('Аватар обновлен')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка загрузки аватара')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteAvatar = async () => {
    try {
      setLoading(true)
      setError('')
      const updatedUser = await deleteAvatar()
      if (setUser) {
        setUser(updatedUser)
      }
      setAvatarTimestamp(Date.now())
      setShowAvatarDeleteConfirm(false)
      setSuccess('Аватар удален')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка удаления аватара')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || newUsername.trim().length < 3) {
      setError('Имя пользователя должно быть не менее 3 символов')
      return
    }

    try {
      setLoading(true)
      setError('')
      const response = await authAPI.updateUsername(newUsername.trim())
      const updatedUser = response.data
      
      setUser(updatedUser)
      setNewUsername(updatedUser.username)
      
      setSuccess('Имя обновлено')
      setEditingName(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Update error:', err)
      setError(err.response?.data?.detail || 'Ошибка обновления имени')
    } finally {
      setLoading(false)
    }
  }
  
  const handleDeleteAccount = async () => {
    try {
      setLoading(true)
      await deleteAccount()
      navigate('/')
    } catch (err) {
      console.error('Delete account error:', err)
      console.error('Response:', err.response)
      setError(err.response?.data?.detail || err.message || 'Ошибка удаления аккаунта')
      setShowDeleteConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  const getAvatarUrl = () => {
    if (!user?.id || !user?.avatar_id) return null
    return `/api/auth/avatar/${user.id}?t=${avatarTimestamp}`
  }

  const hasAvatar = Boolean(user?.avatar_id)

  if (!user) {
    return (
      <div className="profile-error">
        <p>Пользователь не найден</p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          Войти
        </button>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-header-content">
          <div className="avatar-section">
            <div className="avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
              {hasAvatar ? (
                <img
                  src={getAvatarUrl()}
                  alt={user.username}
                  className="avatar-image"
                  key={avatarTimestamp}
                  onError={(e) => {
                    e.target.style.display = 'none'
                    const placeholder = e.target.nextElementSibling
                    if (placeholder) {
                      placeholder.style.display = 'flex'
                    }
                  }}
                />
              ) : null}
              <div 
                className="avatar-placeholder"
                style={{ display: hasAvatar ? 'none' : 'flex' }}
              >
                {user.username?.charAt(0).toUpperCase() || '?'}
              </div>
              
              {loading && (
                <div className="avatar-overlay">
                  <div className="spinner-small" />
                </div>
              )}
              
              <div className="avatar-controls">
                <button
                  className="avatar-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  disabled={loading}
                  title="Загрузить фото"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
                {hasAvatar && (
                  <button
                    className="avatar-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAvatarDeleteConfirm(true)
                    }}
                    disabled={loading}
                    title="Удалить фото"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          
          <div className="user-info">
            {editingName ? (
              <div className="username-edit">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="username-input"
                  placeholder="Введите имя"
                  minLength={3}
                  autoFocus
                />
                <div className="username-edit-actions">
                  <button 
                    className="btn-primary btn-sm"
                    onClick={handleUpdateUsername}
                    disabled={loading}
                  >
                    Сохранить
                  </button>
                  <button 
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setEditingName(false)
                      setNewUsername(user.username)
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <h1 className="username" onClick={() => setEditingName(true)}>
                {user.username}
                <button className="edit-username-btn" title="Изменить имя">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </h1>
            )}
            <p className="user-email">{user.email}</p>
            <button
              className="delete-account-link"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Удалить аккаунт
            </button>
          </div>
        </div>
      </div>

      <div className="profile-body">
        <div className="profile-nav-wrapper">
          <nav className="profile-nav">
            <button
              className={`nav-btn ${activeTab === 'companies' ? 'active' : ''}`}
              onClick={() => setActiveTab('companies')}
            >
              Мои компании
            </button>
            <button
              className={`nav-btn ${activeTab === 'maps' ? 'active' : ''}`}
              onClick={() => setActiveTab('maps')}
            >
              Мои карты
            </button>
            <button
              className={`nav-btn ${activeTab === 'music' ? 'active' : ''}`}
              onClick={() => setActiveTab('music')}
            >
              Музыка
            </button>
          </nav>
        </div>

        <div className="profile-content">
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
              <button onClick={() => setError('')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="companies-tab">
              <div className="tab-header">
                <h2>Мои компании</h2>
                <button className="btn-create" onClick={() => navigate('/companies')}>
                  Все компании
                </button>
              </div>
              
              {loading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Загрузка компаний...</p>
                </div>
              ) : companies.length === 0 ? (
                <div className="empty-state">
                  <p>У вас пока нет компаний</p>
                  <button className="btn-create" onClick={() => navigate('/companies')}>
                    Создать компанию
                  </button>
                </div>
              ) : (
                <div className="companies-grid">
                  {companies.map(company => (
                    <div 
                      key={company.id} 
                      className="company-card"
                      onClick={() => navigate(`/companies/${company.id}`)}
                    >
                      <div className="company-cover">
                        {(company.image_url || company.image_id) ? (
                          <img 
                            src={company.image_url || `/api/media/${company.image_id}`}
                            alt={company.name} 
                            className="company-cover-image"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div 
                          className="company-cover-placeholder"
                          style={{ display: (company.image_url || company.image_id) ? 'none' : 'flex' }}
                        >
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                          </svg>
                        </div>
                      </div>
                      <div className="company-name">{company.name || 'Без названия'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'maps' && (
            <div className="maps-tab">
              <div className="tab-header">
                <h2>Мои карты</h2>
                <button className="btn-create" onClick={() => navigate('/map')}>
                  Все карты
                </button>
              </div>
              
              {loading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Загрузка карт...</p>
                </div>
              ) : maps.length === 0 ? (
                <div className="empty-state">
                  <p>У вас пока нет карт</p>
                  <button className="btn-create" onClick={() => navigate('/map')}>
                    Создать первую карту
                  </button>
                </div>
              ) : (
                <div className="maps-grid">
                  {maps.map(map => (
                    <div 
                      key={map.id} 
                      className="map-card"
                      onClick={() => navigate(`/map-editor/${map.id}`)}
                    >
                      {map.image_url ? (
                        <div className="map-card-image">
                          <img src={map.image_url} alt={map.name} />
                        </div>
                      ) : (
                        <div className="map-card-image map-card-placeholder">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                            <line x1="8" y1="2" x2="8" y2="18"/>
                            <line x1="16" y1="6" x2="16" y2="22"/>
                          </svg>
                        </div>
                      )}
                      <div className="map-card-info">
                        <h3>{map.name || 'Без названия'}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'music' && (
            <div className="music-tab">
              <div className="tab-header">
                <h2>Музыка</h2>
              </div>
              <div className="music-placeholder-content">
                <p>Здесь будет музыкальный плеер</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <h3>Удаление аккаунта</h3>
            <p>Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить.</p>
            <p>Все ваши данные будут безвозвратно удалены.</p>
            <div className="modal-actions">
              <button
                className="btn-danger"
                onClick={handleDeleteAccount}
                disabled={loading}
              >
                {loading ? 'Удаление...' : 'Удалить аккаунт'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {showAvatarDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowAvatarDeleteConfirm(false)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <h3>Удаление аватарки</h3>
            <p>Вы уверены, что хотите удалить аватарку?</p>
            <div className="modal-actions">
              <button
                className="btn-danger"
                onClick={handleDeleteAvatar}
                disabled={loading}
              >
                {loading ? 'Удаление...' : 'Удалить'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowAvatarDeleteConfirm(false)}
                disabled={loading}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}