import { useState } from 'react'
import { FaTrash, FaLock } from 'react-icons/fa'
import './DrawingToolbar.css'

export function DrawingToolbar({ 
  color, 
  onColorChange, 
  brushSize, 
  onBrushSizeChange, 
  onClear,
  canDraw 
}) {
  if (!canDraw) {
    return (
      <div className="drawing-toolbar disabled">
        <FaLock size={14} />
        <span className="drawing-toolbar-label">Запрещено</span>
      </div>
    )
  }

  return (
    <div className="drawing-toolbar">
      <div className="drawing-toolbar-group">
        <label className="drawing-toolbar-label">Цвет</label>
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="drawing-color-picker"
          title="Цвет кисти"
        />
      </div>
      
      <div className="drawing-toolbar-group">
        <label className="drawing-toolbar-label">Размер</label>
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="drawing-size-slider"
          title={`Размер кисти: ${brushSize}px`}
        />
        <span className="drawing-size-value">{brushSize}px</span>
      </div>
      
      <button 
        onClick={onClear} 
        className="drawing-clear-btn" 
        title="Очистить рисунок"
      >
        <FaTrash size={14} />
        <span>Очистить</span>
      </button>
    </div>
  )
}
