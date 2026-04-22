import React, { useState, useEffect } from 'react';
import './DicePanel.css';
// Импортируем иконки
import { FaDice, FaWrench, FaPen, FaStar, FaHistory, FaBroom, FaRedo, FaTimes } from 'react-icons/fa';
import { GiDiceSixFacesTwo } from 'react-icons/gi';
import { MdRefresh } from 'react-icons/md';

export default function DicePanel({ 
  visible = false, 
  onClose = () => {},
  onRoll,
  onClear,
  diceReady = true,
  rolling = false,
  lastResult = null
}) {
  const [mode, setMode] = useState('builder');
  const [sides, setSides] = useState(20);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [customExpr, setCustomExpr] = useState('');
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);

  // Генерируем выражение
  const generatedExpr = `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''}`;
  const currentExpr = mode === 'builder' ? generatedExpr : customExpr;

  const getDiceCount = (expr) => {
    if (!expr) return 1;
    
    const diceRegex = /(\d+)d(\d+)/gi;
    let totalDice = 0;
    let match;
    
    while ((match = diceRegex.exec(expr)) !== null) {
      totalDice += parseInt(match[1], 10);
    }
    
    return totalDice || 1;
  };

  useEffect(() => {
    if (lastResult && lastResult.total) {
      setHistory(prev => {
        const newHistory = [
          { 
            expr: currentExpr, 
            total: lastResult.total,
            timestamp: Date.now(),
            dice: lastResult.dice
          },
          ...prev
        ].slice(0, 10);
        return newHistory;
      });
    }
  }, [lastResult]);

  const handleRoll = () => {
    if (!currentExpr || rolling) return;
    
    const diceCount = getDiceCount(currentExpr);
    onRoll?.(currentExpr, diceCount);
  };

  const handleQuickRoll = (expr) => {
    setCustomExpr(expr);
    setMode('custom');
    
    const diceCount = getDiceCount(expr);
    onRoll?.(expr, diceCount);
  };

  const addToFavorites = (expr) => {
    if (!favorites.includes(expr)) {
      setFavorites(prev => [...prev, expr].slice(0, 12));
    }
  };

  if (!visible) return null;

  return (
    <div className="dice-panel-container">
      <div className="dice-panel-header">
        <div className="header-left">
          <h3><GiDiceSixFacesTwo style={{ marginRight: '8px' }} /> Кости</h3>
          {!diceReady && <span className="loading-badge">Загрузка...</span>}
        </div>
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <div className="dice-panel-body">
        {/* Переключатель режимов */}
        <div className="mode-switcher">
          <button 
            className={`mode-btn ${mode === 'builder' ? 'active' : ''}`}
            onClick={() => setMode('builder')}
          >
            <FaWrench style={{ marginRight: '6px' }} /> Конструктор
          </button>
          <button 
            className={`mode-btn ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >
            <FaPen style={{ marginRight: '6px' }} /> Выражение
          </button>
        </div>

        {/* Режим конструктора */}
        {mode === 'builder' && (
          <div className="builder-section">
            <div className="builder-row">
              <select 
                value={sides} 
                onChange={e => setSides(Number(e.target.value))}
                className="dice-select"
              >
                <option value={4}>D4</option>
                <option value={6}>D6</option>
                <option value={8}>D8</option>
                <option value={10}>D10</option>
                <option value={12}>D12</option>
                <option value={20}>D20</option>
                <option value={100}>D100</option>
              </select>

              <input 
                type="number" 
                min={1} 
                max={50} 
                value={count} 
                onChange={e => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} 
                className="count-input"
                placeholder="Кол-во"
              />

              <input 
                type="number" 
                value={modifier} 
                onChange={e => setModifier(Number(e.target.value) || 0)} 
                className="modifier-input"
                placeholder="Мод."
              />
            </div>

            <div className="current-expression">
              Текущее выражение: <code>{generatedExpr}</code>
            </div>
          </div>
        )}

        {/* Режим выражения */}
        {mode === 'custom' && (
          <div className="custom-section">
            <input 
              type="text"
              value={customExpr}
              onChange={e => setCustomExpr(e.target.value)}
              placeholder="Например: 2d20+3"
              className="expr-input"
            />
            <div className="expr-hint">
              Поддерживается: 2d20, 1d6+3
            </div>
          </div>
        )}

        {/* Избранное */}
        <div className="favorites-section">
          <div className="section-label">
            <FaStar style={{ marginRight: '6px', color: '#ffd700' }} /> Избранное
          </div>
          <div className="favorites-list">
            {favorites.map((expr, i) => (
              <button
                key={i}
                className="favorite-btn"
                onClick={() => handleQuickRoll(expr)}
              >
                {expr}
              </button>
            ))}
            {mode === 'custom' && customExpr && !favorites.includes(customExpr) && (
              <button
                className="add-favorite-btn"
                onClick={() => addToFavorites(customExpr)}
                title="Добавить в избранное"
              >
                <FaStar style={{ marginRight: '4px' }} /> Добавить
              </button>
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="action-section">
          <button 
            className="roll-main-btn" 
            onClick={handleRoll}
            disabled={!diceReady || rolling || !currentExpr}
          >
            {rolling ? (
              <>Бросок...</>
            ) : (
              <>
                <GiDiceSixFacesTwo style={{ marginRight: '8px' }} />
                Бросить {currentExpr}
              </>
            )}
          </button>
          
          <div className="secondary-actions">
            <button 
              className="clear-btn" 
              onClick={onClear}
              disabled={!diceReady}
              title="Очистить кости"
            >
              <FaBroom style={{ marginRight: '6px' }} />
              Очистить
            </button>
            
            {mode === 'builder' && (
              <button 
                className="fav-btn"
                onClick={() => addToFavorites(generatedExpr)}
                title="Добавить в избранное"
              >
                <FaStar style={{ color: '#ffd700' }} />
              </button>
            )}
          </div>
        </div>

        {/* Текущий результат */}
        {lastResult && (
          <div className="current-result">
            <div className="result-total">
              {typeof lastResult.total === 'number' ? lastResult.total : 0}
            </div>
            {lastResult.dice && lastResult.dice.length > 0 && (
              <div className="result-breakdown">
                {lastResult.dice.map((die, i) => {
                  let dieValue = die.value;
                  let dieSides = die.sides;
                  
                  if (typeof dieValue === 'object' && dieValue !== null) {
                    dieValue = dieValue.value || dieValue.val || 0;
                    dieSides = dieValue.sides || dieSides;
                  }
                  
                  return (
                    <span key={i} className="die-badge">
                      D{dieSides}: {dieValue}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}