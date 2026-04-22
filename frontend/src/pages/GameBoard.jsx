import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { RoomProvider, useRoom } from '../context/RoomContext'
import { VideoGrid } from '../components/Room/VideoGrid'
import { ChatPanel } from '../components/Room/ChatPanel'
import { ImagesPanel } from '../components/Room/ImagesPanel'
import { TokensPanel } from '../components/Room/TokensPanel'
import { MapCanvas } from '../components/Room/MapCanvas'
import { PagesDropdown } from '../components/Room/PagesDropdown'
import { RoomSettingsPanel } from '../components/Room/RoomSettingsPanel'
import DiceBox3D from '../components/Dice/DiceBox3D'
import DicePanel from '../components/Dice/DicePanel'
import { LuMousePointer2, LuHand } from 'react-icons/lu'
import { PiPencilSimple, PiTextT } from 'react-icons/pi'
import { BiCloud } from 'react-icons/bi'
import { FaRuler } from 'react-icons/fa'
import './GameBoard.css'

const isDev = process.env.NODE_ENV === 'development'
const log = (...args) => isDev && console.log(...args)

function GameBoardContent() {
  const { id } = useParams()
  const { sendChatMessage, sendDiceRoll, isConnected, tokens, pages, activePageId, roomSettings } = useRoom()
  
  const [activeTab, setActiveTab] = useState('chat')
  const [chatMessage, setChatMessage] = useState('')
  const [activeTool, setActiveTool] = useState('select')
  const [showDicePanel, setShowDicePanel] = useState(false)

  const diceBoxRef = useRef(null)
  const [diceReady, setDiceReady] = useState(false)
  const [diceRolling, setDiceRolling] = useState(false)
  const [diceResult, setDiceResult] = useState(null)

  const activePage = pages.find(p => p.id === activePageId)

  const backgroundColor = activePage?.background_color || roomSettings?.background_color || '#FFFFFF'
  const canvasWidth = activePage?.canvas_width || roomSettings?.canvas_width || 1920
  const canvasHeight = activePage?.canvas_height || roomSettings?.canvas_height || 1080
  const gridSize = activePage?.grid_size || roomSettings?.grid_size || 50
  const gridVisible = roomSettings?.grid_visible ?? true

  const tools = [
    { id: 'select', icon: <LuMousePointer2 size={20} />, name: 'Выделение' },
    { id: 'hand', icon: <LuHand size={20} />, name: 'Рука (перемещение)' },
    { id: 'draw', icon: <PiPencilSimple size={20} />, name: 'Рисование' },
    { id: 'text', icon: <PiTextT size={20} />, name: 'Текст' },
    { id: 'measure', icon: <FaRuler size={18} />, name: 'Измерение' },
    { id: 'fog', icon: <BiCloud size={20} />, name: 'Туман' },
  ]

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (chatMessage.trim() && isConnected) {
      sendChatMessage(chatMessage.trim())
      setChatMessage('')
    }
  }

  const handleDiceRoll = (notation, diceCount = 1) => {
    if (!diceBoxRef.current || diceRolling) return;
    
    setDiceRolling(true);
    setDiceResult(null);
    
    try {
      const success = diceBoxRef.current.roll(notation, diceCount);
      if (!success) {
        setDiceRolling(false);
      }
    } catch (error) {
      console.error('Ошибка броска кубов:', error);
      setDiceRolling(false);
      handleFallbackRoll(notation);
    }
  };

  const handleFallbackRoll = (notation) => {
    try {
      const diceRegex = /(\d+)d(\d+)/g;
      let total = 0;
      let match;
      
      while ((match = diceRegex.exec(notation)) !== null) {
        const [, count, sides] = match;
        for (let i = 0; i < Number(count); i++) {
          total += Math.floor(Math.random() * Number(sides)) + 1;
        }
      }
      
      const modMatch = notation.match(/([+-]\d+)$/);
      if (modMatch) {
        total += Number(modMatch[1]);
      }
      
      const result = { 
        total, 
        fallback: true,
        notation 
      };
      
      setDiceResult(result);
      sendDiceRoll(notation, total);
    } catch (error) {
      console.error('Ошибка fallback броска:', error);
      setDiceResult({ error: 'Ошибка броска', notation });
    } finally {
      setDiceRolling(false);
    }
  };


  const handleDiceRollComplete = useCallback((results) => {
    
    setDiceResult(results)
    setDiceRolling(false)
    
    if (results && results.total !== undefined) {
      const notation = results.dice?.map(d => `d${d.sides}`).join('+') || 'd20'
      sendDiceRoll(notation, results.total)
    }
  }, [sendDiceRoll]);

  const handleDiceReady = useCallback(() => {
    setDiceReady(true);
  }, []); 

  const handleClearDice = () => {
    
    if (diceBoxRef.current) {
      const result = diceBoxRef.current.clear();
      
      setDiceResult(null);
      setDiceRolling(false);
    } else {
      console.warn('❌ [GameBoard] diceBoxRef.current недоступен');
    }
  }

   return (
   <div className="game-board">
      <DiceBox3D
        ref={diceBoxRef}
        onRollComplete={handleDiceRollComplete}
        onReady={handleDiceReady}
        debug={true}
      />

      {/* Плавающий результат броска */}
      {diceResult && !showDicePanel && (
        <div className="dice-result-floating">
          <div className="result-total">{diceResult.total}</div>
          {diceResult.dice && (
            <div className="result-breakdown">
              {diceResult.dice.map((die, i) => (
                <span key={i} className="die-value">
                  d{die.sides}: {die.value}
                </span>
              ))}
            </div>
          )}
          {diceResult.fallback && (
            <div className="fallback-badge">(без 3D)</div>
          )}
          {diceResult.error && (
            <div className="error-badge">{diceResult.error}</div>
          )}
        </div>
      )}

      {/* Left Toolbar */}
      <aside className="toolbar-left">
        <div className="toolbar-section">
          <button className="toolbar-btn menu-btn">☰</button>
        </div>

        <div className="toolbar-section tools">
          {tools.map(tool => (
            <button
              key={tool.id}
              className={`toolbar-btn ${activeTool === tool.id ? 'tool-active' : ''}`}
              title={tool.name}
              onClick={() => setActiveTool(tool.id)}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="toolbar-section">
          <button className="toolbar-btn" title="Бой">⚔️</button>
        </div>

        <div className="toolbar-section">
          <button
            className={`toolbar-btn dice-btn ${showDicePanel ? 'tool-active' : ''}`}
            onClick={() => setShowDicePanel(s => !s)}
            title="Кубики"
          >
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
        <div className="map-container" style={{ background: backgroundColor }}>
          <MapCanvas
            activeTool={activeTool}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            gridSize={gridSize}
            gridVisible={gridVisible}
          />
          <PagesDropdown />
        </div>
      </main>

      {/* Fixed Video Section */}
      <div className="fixed-video-section">
        <VideoGrid />
      </div>

      {/* Right Sidebar */}
      <aside className="sidebar-right">
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
            className={`tab-btn ${activeTab === 'tokens' ? 'active' : ''}`}
            onClick={() => setActiveTab('tokens')}
          >
            🎭
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

        <div className="sidebar-content">
          {activeTab === 'chat' && (
            <ChatPanel 
              chatMessage={chatMessage}
              setChatMessage={setChatMessage}
              onSendMessage={handleSendMessage}
            />
          )}
          {activeTab === 'images' && <ImagesPanel />}
          {activeTab === 'tokens' && <TokensPanel />}
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

      {/* Dice Panel */}
      <DicePanel
        visible={showDicePanel}
        onClose={() => setShowDicePanel(false)}
        onRoll={handleDiceRoll}
        onClear={handleClearDice}
        diceReady={diceReady}
        rolling={diceRolling}
        lastResult={diceResult}
      />
    </div>
  )
}

export default function GameBoard() {
  const { id } = useParams()
  
  return (
    <RoomProvider roomId={id}>
      <GameBoardContent />
    </RoomProvider>
  )
}