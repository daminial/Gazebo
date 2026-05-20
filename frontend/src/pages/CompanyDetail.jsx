import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { roomsAPI, authAPI } from '../api'
import './CompanyDetail.css'

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [gameDate, setGameDate] = useState('')
  const [gameTime, setGameTime] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteTab, setInviteTab] = useState('link') 
  const [searchNickname, setSearchNickname] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  
  const [company, setCompany] = useState(null)
  const [roomUsers, setRoomUsers] = useState([])
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)

  useEffect(() => {
    loadRoomData()
  }, [id])

  const loadRoomData = async () => {
    try {
      setLoading(true)
      const roomRes = await roomsAPI.getById(id)
      const roomData = roomRes.data
      
      setCompany({
        id: roomData.id,
        name: roomData.name,
        logo: roomData.image_url || 'https://placehold.co/600x200/DC143C/FFFFFF?text=Room',
        description: roomData.description || '',
        ownerId: roomData.owner_id,
        status: roomData.status
      })
      
      const usersRes = await roomsAPI.getUsers(id)
      const users = usersRes.data || []
      setRoomUsers(users)
      
      if (roomData.owner_id) {
        try {

          const ownerUser = users.find(u => String(u.user_id) === String(roomData.owner_id))
          if (ownerUser) {
            setOwner({
              id: ownerUser.user_id,
              username: ownerUser.username,
              role: ownerUser.room_role,
              avatar_id: ownerUser.avatar_id
            })
          }
        } catch (err) {
          console.error('Ошибка при загрузке владельца:', err)
        }
      }
      
      setError('')
    } catch (err) {
      console.error('Ошибка при загрузке комнаты:', err)
      setError('Ошибка загрузки данных комнаты')
    } finally {
      setLoading(false)
    }
  }

  const handleLaunchGame = () => {
    navigate(`/game/${id}`)
  }

  const handleDateChange = (e) => {
    setGameDate(e.target.value)
  }

  const handleTimeChange = (e) => {
    setGameTime(e.target.value)
  }

  const generateInviteLink = () => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/join-company/${id}?token=${Math.random().toString(36).substring(7)}`
    setInviteLink(link)
  }

  const handleSearchUser = async () => {
    if (!searchNickname.trim()) return
    
    setIsSearching(true)
    try {
      const response = await authAPI.searchUsers(searchNickname)
      setSearchResults(response.data || [])
    } catch (error) {
      console.error('Ошибка при поиске пользователя:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleInviteUser = async (userId, nickname) => {
    try {
      await roomsAPI.addUser(id, userId)
      // Обновляем список пользователей
      await loadRoomData()
      setSearchNickname('')
      setSearchResults([])
      alert(`Пользователь ${nickname} успешно добавлен в комнату!`)
    } catch (error) {
      console.error('Ошибка при приглашении пользователя:', error)
      alert('Ошибка при приглашении пользователя')
    }
  }

  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      alert('Ссылка скопирована в буфер обмена!')
    }
  }

  const openInviteModal = () => {
    setShowInviteModal(true)
    if (inviteTab === 'link' && !inviteLink) {
      generateInviteLink()
    }
  }

  const closeInviteModal = () => {
    setShowInviteModal(false)
    setSearchNickname('')
    setSearchResults([])
  }

  const handlePlayerContextMenu = (e, userId) => {
    e.preventDefault()
    setSelectedUserId(userId)
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
    setSelectedUserId(null)
  }

  const handleDeletePlayer = async () => {
    if (!selectedUserId) return
    
    if (!window.confirm('Вы уверены, что хотите удалить этого игрока?')) {
      closeContextMenu()
      return
    }
    
    try {
      await roomsAPI.removeUser(id, selectedUserId)
      setRoomUsers(roomUsers.filter(u => u.user_id !== selectedUserId))
      closeContextMenu()
    } catch (err) {
      console.error('Ошибка при удалении игрока:', err)
      alert('Ошибка при удалении игрока')
      closeContextMenu()
    }
  }

  const handleSettingsClick = () => {
    navigate(`/room-settings/${id}`)
  }

  return (
    <div className="company-detail">
      {loading && <div className="loading">Загрузка...</div>}
      {error && <div className="error">{error}</div>}
      {!loading && !error && !company && <div className="error">Комната не найдена</div>}
      
      {/* Context Menu */}
      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={closeContextMenu}>
          <button className="context-menu-item" onClick={handleDeletePlayer}>
            🗑 Удалить игрока
          </button>
        </div>
      )}
      {contextMenu && <div className="context-menu-overlay" onClick={closeContextMenu} />}

      {!loading && !error && company && (
        <main className="company-main">
          {/* Left Column */}
          <div className="company-left">
          {/* Company Logo */}
          <div className="company-banner">
            <img src={company.logo} alt={company.name} className="company-logo-large" />
          </div>
          
          {/* Company Name */}
          <h1 className="company-name">{company.name}</h1>

          {/* Action Buttons */}
          <div className="company-actions">
            <button className="btn btn-launch" onClick={handleLaunchGame}>
               Запуск игры
            </button>
            <button className="btn btn-settings" onClick={handleSettingsClick}>
              ⚙ Настройки
            </button>
          </div>

          {/* Next Game Section */}
          <div className="next-game-section">
            <h3 className="next-game-title">Следующая игра будет</h3>
            
            <div className="datetime-picker">
              <div className="datetime-group">
                <label htmlFor="gameDate">Дата</label>
                <input
                  type="date"
                  id="gameDate"
                  value={gameDate}
                  onChange={handleDateChange}
                  className="datetime-input"
                />
              </div>
              
              <div className="datetime-group">
                <label htmlFor="gameTime">Время</label>
                <input
                  type="time"
                  id="gameTime"
                  value={gameTime}
                  onChange={handleTimeChange}
                  className="datetime-input"
                />
              </div>
            </div>

            {gameDate && gameTime && (
              <div className="selected-datetime">
                <p>📅 {new Date(gameDate).toLocaleDateString('ru-RU')} в {gameTime}</p>
              </div>
            )}
          </div>

          {/* Description Section */}
          <div className="description-section">
            <p className="description-placeholder">
              {company.description || 'Нажмите, чтобы ввести описание'}
            </p>
          </div>
        </div>

        {/* Right Column */}
        <div className="company-right">
          {/* Author Section */}
          <div className="author-section">
            <h4 className="section-label">Автор</h4>
            <div className="author-info">
              <div className="player-avatar">
                {owner?.avatar_id ? (
                  <img
                    src={`/api/auth/avatar/${owner.id}`}
                    alt={owner.username}
                    className="player-avatar-img"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="player-avatar-placeholder" style={{display: owner?.avatar_id ? 'none' : 'flex'}}>
                  {owner?.username?.[0]?.toUpperCase() || '?'}
                </div>
              </div>
              <span className="player-name">{owner?.username || 'Неизвестно'}</span>
            </div>
          </div>

          {/* Players Section */}
          <div className="players-section">
            <div className="players-header">
              <h4 className="section-label">Игроки:</h4>
              <span className="players-count">{roomUsers.length} / {roomUsers.length}</span>
              <button className="btn btn-invite" onClick={openInviteModal}>
                Пригласить
              </button>
            </div>
            <div className="players-list">
              {/* Show all players */}
              {roomUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="player-avatar"
                  title={user.username}
                  onContextMenu={(e) => handlePlayerContextMenu(e, user.user_id)}
                  style={{ cursor: 'context-menu' }}
                >
                  {user.avatar_id ? (
                    <img
                      src={`/api/auth/avatar/${user.user_id}`}
                      alt={user.username}
                      className="player-avatar-img"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div className="player-avatar-placeholder" style={{display: user.avatar_id ? 'none' : 'flex'}}>
                    {user.username?.[0]?.toUpperCase() || '?'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      )}

      {showInviteModal && (
        <div className="modal-overlay" onClick={closeInviteModal}>
          <div className="modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Пригласить игроков</h2>
              <button className="modal-close" onClick={closeInviteModal}>×</button>
            </div>

            <div className="modal-tabs">
              <button
                className={`tab-btn ${inviteTab === 'link' ? 'active' : ''}`}
                onClick={() => {
                  setInviteTab('link')
                  if (!inviteLink) generateInviteLink()
                }}
              >
                По ссылке
              </button>
              <button
                className={`tab-btn ${inviteTab === 'nickname' ? 'active' : ''}`}
                onClick={() => setInviteTab('nickname')}
              >
                По никнейму
              </button>
            </div>

            <div className="modal-body">
              {inviteTab === 'link' ? (
                <div className="invite-link-section">
                  <p className="invite-description">
                    Отправьте эту ссылку другим игрокам, чтобы они могли присоединиться к кампании:
                  </p>
                  <div className="link-container">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="link-input"
                    />
                    <button className="btn btn-copy" onClick={copyToClipboard}>
                      Скопировать
                    </button>
                  </div>
                  <p className="link-info">
                    Любой, кто получит эту ссылку, сможет присоединиться к кампании
                  </p>
                </div>
              ) : (
                <div className="invite-nickname-section">
                  <p className="invite-description">
                    Найдите игрока по никнейму и пригласите его в кампанию:
                  </p>
                  <div className="search-container">
                    <input
                      type="text"
                      placeholder="Введите никнейм игрока..."
                      value={searchNickname}
                      onChange={(e) => setSearchNickname(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                      className="search-input"
                    />
                    <button
                      className="btn btn-search"
                      onClick={handleSearchUser}
                      disabled={isSearching}
                    >
                      {isSearching ? 'Поиск...' : 'Найти'}
                    </button>
                  </div>

                  <div className="search-results">
                    {searchResults.length > 0 ? (
                      <div className="results-list">
                        {searchResults.map((user) => (
                          <div key={user.id} className="result-item">
                            <div className="result-avatar">
                              {user.avatar_id ? (
                                <img
                                  src={`/api/auth/avatar/${user.id}`}
                                  alt={user.username}
                                  className="result-avatar-img"
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                    e.target.nextSibling.style.display = 'flex'
                                  }}
                                />
                              ) : null}
                              <div className="result-avatar-placeholder" style={{display: user.avatar_id ? 'none' : 'flex'}}>
                                {user.username?.[0]?.toUpperCase() || '?'}
                              </div>
                            </div>
                            <span className="result-nickname">{user.username}</span>
                            <button
                              className="btn btn-invite-user"
                              onClick={() => handleInviteUser(user.id, user.username)}
                            >
                              Пригласить
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : searchNickname ? (
                      <p className="no-results">Пользователей не найдено</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
