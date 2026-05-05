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
import { AudioPlayer } from '../components/Room/AudioPlayer'
import { LuMousePointer2, LuHand } from 'react-icons/lu'
import { PiPencilSimple, PiTextT } from 'react-icons/pi'
import { BiCloud } from 'react-icons/bi'
import { FaRuler, FaDiceD6, FaComment, FaImage, FaMask, FaMusic, FaStickyNote, FaCog, FaEye, FaUsers, FaBars } from 'react-icons/fa'
import { GiSwordman, GiBattleGear } from 'react-icons/gi'
import { MdMenu } from 'react-icons/md'
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
  const [measureMode, setMeasureMode] = useState('line')

  const diceBoxRef = useRef(null)
  const [diceReady, setDiceReady] = useState(false)
  const [diceRolling, setDiceRolling] = useState(false)
  const [diceResult, setDiceResult] = useState(null)
  const currentNotationRef = useRef('');
  const currentModifierRef = useRef(0);

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
  
  currentNotationRef.current = notation;
  
  let modifier = 0;
  const modMatch = notation.match(/([+-]\d+)$/);
  if (modMatch) {
    modifier = parseInt(modMatch[1], 10);
  }
  currentModifierRef.current = modifier;
  
  setDiceRolling(true);
  setDiceResult(null);
  
  try {
    const success = diceBoxRef.current.roll(notation, diceCount);
    if (!success) {
      setDiceRolling(false);
      handleFallbackRoll(notation);
    }
  } catch (error) {
    console.error('Ошибка броска костей:', error);
    setDiceRolling(false);
    handleFallbackRoll(notation);
  }
};

  const handleFallbackRoll = (notation) => {
  try {
    // Парсим нотацию
    const diceRegex = /(\d+)d(\d+)/g;
    let match;
    const allRolls = [];
    let total = 0;
    
    while ((match = diceRegex.exec(notation)) !== null) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      
      for (let i = 0; i < count; i++) {
        const value = Math.floor(Math.random() * sides) + 1;
        allRolls.push({ sides, value });
        total += value;
      }
    }
    
    // Парсим модификатор
    let modifier = 0;
    const modMatch = notation.match(/([+-]\d+)$/);
    if (modMatch) {
      modifier = parseInt(modMatch[1], 10);
      total += modifier;
    }
    
    const result = { 
      total, 
      dice: allRolls,
      fallback: true,
      notation,
      modifier
    };
    
    setDiceResult(result);
    
    // Формируем детальную строку
    const rollValues = allRolls.map(r => r.value);
    const rollsString = rollValues.join(' + ');
    const modifierString = modifier !== 0 
      ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`)
      : '';
    const detailedString = modifierString 
      ? `${rollsString}${modifierString} = ${total}`
      : `${rollsString} = ${total}`;
    
    sendDiceRoll(notation, total, allRolls, modifier, detailedString);
  } catch (error) {
    console.error('Ошибка fallback броска:', error);
    setDiceResult({ error: 'Ошибка броска', notation });
  } finally {
    setDiceRolling(false);
  }
};

  const handleDiceRollComplete = useCallback((results) => {
    
    setDiceResult(results);
    setDiceRolling(false);
    
    if (results && results.total !== undefined) {
      let rolls = results.dice || [];
      
      const normalizedRolls = rolls.map(die => {
        let actualValue = die.value;
        let actualSides = die.sides;
        
        if (typeof actualValue === 'object' && actualValue !== null) {
          actualValue = actualValue.value || actualValue.val || 0;
          actualSides = actualValue.sides || die.sides;
        }
        
        if (typeof actualValue !== 'number') {
          actualValue = parseInt(actualValue, 10) || 0;
        }
        
        return {
          sides: actualSides,
          value: actualValue,
          rollId: die.rollId
        };
      });
      
      const total = normalizedRolls.reduce((sum, die) => sum + die.value, 0) + currentModifierRef.current;
      
      const notation = currentNotationRef.current;
      let modifier = currentModifierRef.current;
      
      const rollValues = normalizedRolls.map(r => r.value);
      const rollsString = rollValues.join(' + ');
      const modifierString = modifier !== 0 
        ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`)
        : '';
      const detailedString = modifierString 
        ? `(${rollsString})${modifierString} = ${total}`
        : `${rollsString} = ${total}`;
      
      sendDiceRoll(
        notation,
        total,
        normalizedRolls,
        modifier,
        detailedString
      );
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
  
      {/* Left Toolbar */}
      <aside className="toolbar-left">
        <div className="toolbar-section">
          <button className="toolbar-btn menu-btn">
            <FaBars size={20} />
          </button>
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

        {activeTool === 'measure' && (
        <div className="ruler-submenu">
          <button className={`ruler-mode-btn ${measureMode === 'line' ? 'active' : ''}`} onClick={() => setMeasureMode('line')}>📏</button>
          <button className={`ruler-mode-btn ${measureMode === 'circle' ? 'active' : ''}`} onClick={() => setMeasureMode('circle')}>⭕</button>
          <button className={`ruler-mode-btn ${measureMode === 'cone' ? 'active' : ''}`} onClick={() => setMeasureMode('cone')}>🔺</button>
        </div>
      )}

        <div className="toolbar-section">
          <button className="toolbar-btn" title="Бой">
            <GiBattleGear size={20} />
          </button>
        </div>

        <div className="toolbar-section">
          <button
            className={`toolbar-btn dice-btn ${showDicePanel ? 'tool-active' : ''}`}
            onClick={() => setShowDicePanel(s => !s)}
            title="Кости"
          >
            <FaDiceD6 size={20} />
          </button>
        </div>

        <div className="toolbar-section bottom">
          <button className="toolbar-btn" title="Обзор">
            <FaEye size={18} />
          </button>
          <button className="toolbar-btn" title="Игроки">
            <FaUsers size={18} />
          </button>
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
            measureMode={activeTool === 'measure' ? measureMode : null}
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
            title="Чат"
          >
            <FaComment size={18} />
          </button>
          <button
            className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
            onClick={() => setActiveTab('images')}
            title="Изображения"
          >
            <FaImage size={18} />
          </button>
          <button
            className={`tab-btn ${activeTab === 'tokens' ? 'active' : ''}`}
            onClick={() => setActiveTab('tokens')}
            title="Токены"
          >
            <FaMask size={18} />
          </button>
          <button
            className={`tab-btn ${activeTab === 'music' ? 'active' : ''}`}
            onClick={() => setActiveTab('music')}
            title="Музыка"
          >
            <FaMusic size={18} />
          </button>
          <button
            className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
            title="Заметки"
          >
            <FaStickyNote size={18} />
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            title="Настройки"
          >
            <FaCog size={18} />
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
          {activeTab === 'music' && <AudioPlayer />}
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