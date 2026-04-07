import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './CompanyDetail.css'

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [gameDate, setGameDate] = useState('')
  const [gameTime, setGameTime] = useState('')

  // Временные данные для демонстрации
  const company = {
    id: id,
    name: 'D&D Campaign',
    logo: 'https://placehold.co/600x200/DC143C/FFFFFF?text=D%26D',
    description: '',
    author: 'Goblin',
    players: 2,
    maxPlayers: 6
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

  return (
    <div className="company-detail">

      {/* Main Content */}
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
            <button className="btn btn-settings">
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
              <div className="player-avatar"></div>
              <span className="player-name">{company.author}</span>
            </div>
          </div>

          {/* Players Section */}
          <div className="players-section">
            <div className="players-header">
              <h4 className="section-label">Игроки:</h4>
              <span className="players-count">{company.players} / {company.maxPlayers}</span>
              <button className="btn btn-invite">
                Пригласить
              </button>
            </div>
            <div className="players-list">
              {/* Author */}
              <div className="player-avatar"></div>
              {/* Empty slots */}
              {Array.from({ length: company.maxPlayers - 1 }).map((_, i) => (
                <div key={i} className="player-avatar empty"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
