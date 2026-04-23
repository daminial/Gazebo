import { useState, useRef, useCallback } from 'react'
import { useRoom } from '../../context/RoomContext'
import { TokenEditModal } from './TokenEditModal'
import './Token.css'

export function Token({ token, gridSize, zoom, isSelected = false, onSelect, gridVisible = true }) {
  const { sendTokenMove, deleteToken } = useRoom()
  const [isDragging, setIsDragging] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, tokenX: 0, tokenY: 0 })
  const elementRef = useRef(null)

  const snapToGrid = useCallback((value) => {
    if (gridVisible) {
      return Math.round(value / gridSize) * gridSize
    }
    return value
  }, [gridSize, gridVisible])

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    
    if (onSelect) {
      onSelect(token.id, e.ctrlKey || e.metaKey)
    }
    
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      tokenX: token.position_x,
      tokenY: token.position_y,
    }

    const handleMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - dragStartRef.current.x) / zoom
      const deltaY = (moveEvent.clientY - dragStartRef.current.y) / zoom

      const newX = dragStartRef.current.tokenX + deltaX
      const newY = dragStartRef.current.tokenY + deltaY

      if (elementRef.current) {
        elementRef.current.style.left = `${newX}px`
        elementRef.current.style.top = `${newY}px`
      }
    }

    const handleMouseUp = (upEvent) => {
      const deltaX = (upEvent.clientX - dragStartRef.current.x) / zoom
      const deltaY = (upEvent.clientY - dragStartRef.current.y) / zoom

      let finalX = dragStartRef.current.tokenX + deltaX
      let finalY = dragStartRef.current.tokenY + deltaY
      
      finalX = snapToGrid(finalX)
      finalY = snapToGrid(finalY)

      if (elementRef.current) {
        elementRef.current.style.left = `${finalX}px`
        elementRef.current.style.top = `${finalY}px`
      }

      sendTokenMove(token.id, finalX, finalY, token.rotation)

      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const topY = rect.bottom + 2
      setShowContextMenu({ x: centerX, y: topY })
    }
  }

  const handleCloseMenu = () => {
    setShowContextMenu(null)
  }

  const tokenSize = token.width || gridSize
  const isCircle = token.token_type !== 'prop'
  const hasImage = token.image_url || token.creature_template?.image_url
  const firstLetter = token.name_in_room?.charAt(0).toUpperCase() || '?'

  return (
    <>
      <div
        ref={elementRef}
        data-token-id={token.id}
        className={`token ${isDragging ? 'dragging' : ''} ${isCircle ? 'token-circle' : 'token-square'} ${isSelected ? 'token-selected' : ''}`}
        style={{
          left: `${token.position_x}px`,
          top: `${token.position_y}px`,
          width: `${tokenSize}px`,
          height: `${tokenSize}px`,
          opacity: token.is_visible ? 1 : 0.4,
          zIndex: isDragging ? 1000 : 100,
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        {hasImage ? (
          <img
            src={token.image_url || token.creature_template?.image_url}
            alt={token.name_in_room}
            className="token-image"
            draggable={false}
          />
        ) : (
          <div className="token-placeholder">
            <span className="token-letter">{firstLetter}</span>
          </div>
        )}

        {token.current_hp !== null && token.creature_template?.max_hp && (
          <div className="token-hp-bar">
            <div
              className="token-hp-fill"
              style={{
                width: `${(token.current_hp / token.creature_template.max_hp) * 100}%`,
              }}
            />
          </div>
        )}

        <div className="token-name-label">{token.name_in_room}</div>
      </div>

      {showContextMenu && (
        <>
          <div className="context-menu-backdrop" onClick={handleCloseMenu} />
          <div className="token-context-menu" style={{ left: showContextMenu.x, top: showContextMenu.y }}>
            <button className="menu-item" onClick={() => {
              setShowEditModal(true)
              handleCloseMenu()
            }}>
              Редактировать
            </button>
            <button className="menu-item danger" onClick={async () => {
              if (window.confirm('Удалить этот токен?')) {
                try {
                  await deleteToken(token.id)
                } catch (err) {
                  console.error('Failed to delete token:', err)
                  alert('Ошибка при удалении')
                }
              }
              handleCloseMenu()
            }}>
              Удалить
            </button>
          </div>
        </>
      )}

      {showEditModal && (
        <TokenEditModal
          token={token}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  )
}