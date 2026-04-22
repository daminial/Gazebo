import React, { useState, useEffect } from 'react';
import './DicePanel.css';

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
  const [favorites, setFavorites] = useState([
    '1d20', '2d6', '3d6', '1d100', '1d20+5', '4d6'
  ]);

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
          <h3>🎲 Кубики</h3>
          {!diceReady && <span className="loading-badge">Загрузка...</span>}
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="dice-panel-body">
        {/* Переключатель режимов */}
        <div className="mode-switcher">
          <button 
            className={`mode-btn ${mode === 'builder' ? 'active' : ''}`}
            onClick={() => setMode('builder')}
          >
            🔧 Конструктор
          </button>
          <button 
            className={`mode-btn ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >
            ✏️ Выражение
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
              placeholder="Например: 2d20+1d6+5"
              className="expr-input"
            />
            <div className="expr-hint">
              Поддерживается: 2d20, 1d6+3, 4d6kh3, 2d20!
            </div>
          </div>
        )}

        {/* Избранное */}
        <div className="favorites-section">
          <div className="section-label">⭐ Избранное</div>
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
                + Добавить
              </button>
            )}
          </div>
        </div>

        {/* Быстрые броски */}
        <div className="quick-rolls-section">
          <div className="section-label">⚡ Быстрые броски</div>
          <div className="quick-buttons">
            <button onClick={() => handleQuickRoll('1d20')}>D20</button>
            <button onClick={() => handleQuickRoll('1d20+5')}>D20+5</button>
            <button onClick={() => handleQuickRoll('2d6')}>2D6</button>
            <button onClick={() => handleQuickRoll('3d6')}>3D6</button>
            <button onClick={() => handleQuickRoll('4d6')}>4D6</button>
            <button onClick={() => handleQuickRoll('1d100')}>D100</button>
            <button onClick={() => handleQuickRoll('2d20')}>2D20</button>
            <button onClick={() => handleQuickRoll('1d8+2')}>D8+2</button>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="action-section">
          <button 
            className="roll-main-btn" 
            onClick={handleRoll}
            disabled={!diceReady || rolling || !currentExpr}
          >
            {rolling ? '🎲 Бросок...' : `🎲 Бросить ${currentExpr}`}
          </button>
          
          <div className="secondary-actions">
            <button 
              className="clear-btn" 
              onClick={onClear}
              disabled={!diceReady}
              title="Очистить кубы"
            >
              🧹 Очистить
            </button>
            
            {mode === 'builder' && (
              <button 
                className="fav-btn"
                onClick={() => addToFavorites(generatedExpr)}
                title="Добавить в избранное"
              >
                ⭐
              </button>
            )}
          </div>
        </div>

        {/* История бросков */}
        {history.length > 0 && (
          <div className="history-section">
            <div className="section-label">📜 История</div>
            <div className="history-list">
              {history.slice(0, 5).map((item, i) => (
                <div key={i} className="history-item">
                  <span className="history-expr">{item.expr}</span>
                  <span className="history-total">{item.total}</span>
                  <button 
                    className="history-reroll"
                    onClick={() => handleQuickRoll(item.expr)}
                    title="Повторить"
                  >
                    ↻
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Текущий результат */}
        {lastResult && (
          <div className="current-result">
            <div className="result-total">{lastResult.total}</div>
            {lastResult.dice && (
              <div className="result-breakdown">
                {lastResult.dice.map((die, i) => (
                  <span key={i} className="die-badge">
                    D{die.sides}: {die.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}