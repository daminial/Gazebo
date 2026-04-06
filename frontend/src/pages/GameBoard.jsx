import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { RoomProvider, useRoom } from '../context/RoomContext'
import { VideoGrid } from '../components/Room/VideoGrid'
import { ChatPanel } from '../components/Room/ChatPanel'
import { ImagesPanel } from '../components/Room/ImagesPanel'
import { MapSelector } from '../components/Room/MapSelector'
import { PagesDropdown } from '../components/Room/PagesDropdown'
import { RoomSettingsPanel } from '../components/Room/RoomSettingsPanel'
import './GameBoard.css'

// Внутренний компонент для контента с доступом к контексту
function GameBoardContent() {
  const { id } = useParams()
  const { sendChatMessage, sendDiceRoll, isConnected, tokens, pages, activePageId, roomSettings } = useRoom()
  const [activeTab, setActiveTab] = useState('chat')
  const [chatMessage, setChatMessage] = useState('')
  const [diceResult, setDiceResult] = useState(null)

  // Получаем активную страницу
  const activePage = pages.find(p => p.id === activePageId)

  // Используем настройки страницы или настройки комнаты по умолчанию
  const backgroundColor = activePage?.background_color || roomSettings?.background_color || '#FFFFFF'
  const canvasWidth = activePage?.canvas_width || roomSettings?.canvas_width || 1920
  const canvasHeight = activePage?.canvas_height || roomSettings?.canvas_height || 1080
  const gridSize = activePage?.grid_size || roomSettings?.grid_size || 50
  const gridVisible = roomSettings?.grid_visible ?? true

  // Инструменты
  const tools = [
    { id: 'select', icon: '◧', name: 'Выделение' },
    { id: 'hand', icon: '✋', name: 'Рука' },
    { id: 'draw', icon: '✏️', name: 'Рисование' },
    { id: 'text', icon: 'T', name: 'Текст' },
    { id: 'measure', icon: '📏', name: 'Измерение' },
    { id: 'fog', icon: '☁️', name: 'Туман' },
  ]

  // Кубики
  const dice = [
    { id: 'd4', name: 'D4', sides: 4 },
    { id: 'd6', name: 'D6', sides: 6 },
    { id: 'd8', name: 'D8', sides: 8 },
    { id: 'd10', name: 'D10', sides: 10 },
    { id: 'd12', name: 'D12', sides: 12 },
    { id: 'd20', icon: '⬡', name: 'D20', sides: 20 },
  ]

  const rollDice = (sides) => {
    const result = Math.floor(Math.random() * sides) + 1
    setDiceResult({ die: `D${sides}`, value: result })
    
    // Отправка броска куба через LiveKit
    sendDiceRoll(`d${sides}`, result)
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (chatMessage.trim() && isConnected) {
      sendChatMessage(chatMessage.trim())
      setChatMessage('')
    }
  }

  return (
    <div className="game-board">
      {/* Left Toolbar */}
      <aside className="toolbar-left">
        <div className="toolbar-section">
          <button className="toolbar-btn menu-btn">☰</button>
        </div>

        <div className="toolbar-section tools">
          {tools.map(tool => (
            <button key={tool.id} className="toolbar-btn" title={tool.name}>
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="toolbar-section">
          <button className="toolbar-btn" title="Бой">⚔️</button>
        </div>

        <div className="toolbar-section">
          <button className="toolbar-btn dice-btn" onClick={() => rollDice(20)} title="Бросок D20">
            ⬡
          </button>
        </div>

        <div className="toolbar-section bottom">
          <button className="toolbar-btn" title="Обзор">👁️</button>
          <button className="toolbar-btn" title="Игроки">👤</button>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="canvas-area">
        {/* Map Container */}
        <div className="map-container" style={{ background: backgroundColor }}>
          <MapSelector />
          <div className={`map-wrapper ${gridVisible ? 'show-grid' : ''}`} style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`
          }}>
            <ActiveMapImage />
            <div className="grid-overlay" style={{
              backgroundImage: `
                linear-gradient(rgba(0, 0, 0, 0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 0, 0, 0.5) 1px, transparent 1px)
              `,
              backgroundSize: `${gridSize}px ${gridSize}px`
            }}></div>
          </div>

          {/* Кнопка страниц — выезжает сверху */}
          <PagesDropdown />
        </div>
      </main>

      {/* Fixed Video Section (слева внизу) */}
      <div className="fixed-video-section">
        <VideoGrid />
      </div>

      {/* Right Sidebar */}
      <aside className="sidebar-right">
        {/* Top Tabs */}
        <div className="sidebar-tabs">
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬
          </button>
          <button
            className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
            onClick={() => setActiveTab('images')}
          >
            🖼️
          </button>
          <button
            className={`tab-btn ${activeTab === 'music' ? 'active' : ''}`}
            onClick={() => setActiveTab('music')}
          >
            🎵
          </button>
          <button
            className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            📝
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️
          </button>
        </div>

        {/* Tab Content */}
        <div className="sidebar-content">
          {activeTab === 'chat' && <ChatPanel />}

          {activeTab === 'images' && <ImagesPanel />}

          {activeTab === 'music' && (
            <div className="tab-placeholder">
              <h3>Музыка</h3>
              <p>Аудио треки для игры</p>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="tab-placeholder">
              <h3>Заметки</h3>
              <p>Ваши заметки к игре</p>
            </div>
          )}

          {activeTab === 'settings' && <RoomSettingsPanel />}
        </div>
      </aside>

      {/* Dice Panel (Quick Roll) */}
      <div className="dice-panel">
        <h4>Бросок куба</h4>
        <div className="dice-list">
          {dice.map(d => (
            <button 
              key={d.id} 
              className="dice-btn-small"
              onClick={() => rollDice(d.sides)}
            >
              {d.icon || d.name}
            </button>
          ))}
        </div>
        {diceResult && (
          <div className="dice-result-display">
            <span>{diceResult.die}</span>
            <strong>{diceResult.value}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

// Компонент отображения активной карты
function ActiveMapImage() {
  const { maps, activeMapId, pages, activePageId } = useRoom()

  // Сначала пытаемся получить карту из активной страницы
  const activePage = pages.find(p => p.id === activePageId)
  let activeMap = null
  
  if (activePage?.map) {
    activeMap = activePage.map
  } else if (activeMapId) {
    activeMap = maps.find(m => m.id === activeMapId)
  }

  // image_url уже должен быть с /api префиксом из RoomContext
  const imageUrl = activeMap?.image_url

  if (!activeMap || !imageUrl) {
    return (
      <img
        src="https://placehold.co/1200x800/FFFFFF/CCCCCC?text=Game+Map"
        alt="Game Map"
        className="map-image"
      />
    )
  }

  return (
    <img
      src={imageUrl}
      alt={activeMap.name_in_room || activeMap.template_name || 'Карта'}
      className="map-image"
    />
  )
}

// Основной компонент с провайдером
export default function GameBoard() {
  const { id } = useParams()
  
  return (
    <RoomProvider roomId={id}>
      <GameBoardContent />
    </RoomProvider>
  )
}
