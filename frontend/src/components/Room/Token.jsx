import { useState, useRef, useCallback } from 'react'
import { useRoom } from '../../context/RoomContext'
import { TokenEditModal } from './TokenEditModal'
import './Token.css'

export function Token({ token, gridSize, zoom }) {
  const { sendTokenMove, updateRoomSettings, roomId, deleteToken, updateTokenHp } = useRoom()
  const [isDragging, setIsDragging] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, tokenX: 0, tokenY: 0 })
  const elementRef = useRef(null)

  // Привязка к сетке
  const snapToGrid = useCallback((value) => {
    return Math.round(value / gridSize) * gridSize
  }, [gridSize])

  // Начало перетаскивания
  const handleMouseDown = (e) => {
    if (e.button !== 0) return // Только левая кнопка мыши
    e.preventDefault()
    e.stopPropagation()

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

      // Обновляем позицию в реальном времени
      if (elementRef.current) {
        elementRef.current.style.left = `${newX}px`
        elementRef.current.style.top = `${newY}px`
      }
    }

    const handleMouseUp = (upEvent) => {
      const deltaX = (upEvent.clientX - dragStartRef.current.x) / zoom
      const deltaY = (upEvent.clientY - dragStartRef.current.y) / zoom

      const finalX = snapToGrid(dragStartRef.current.tokenX + deltaX)
      const finalY = snapToGrid(dragStartRef.current.tokenY + deltaY)

      // Отправляем через LiveKit
      sendTokenMove(token.id, finalX, finalY, token.rotation)

      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Контекстное меню
  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCloseMenu = () => {
    setShowContextMenu(null)
  }

  // Определяем внешний вид токена
  const tokenSize = token.width || gridSize
  const isCircle = token.token_type !== 'prop' // Круглые для существ, квадратные для prop

  // Placeholder с первой буквой имени, если нет изображения
  const hasImage = token.image_url || token.creature_template?.image_url
  const firstLetter = token.name_in_room?.charAt(0).toUpperCase() || '?'

  return (
    <>
      <div
        ref={elementRef}
        className={`token ${isDragging ? 'dragging' : ''} ${isCircle ? 'token-circle' : 'token-square'}`}
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

        {/* HP бар */}
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

        {/* Имя токена */}
        <div className="token-name-label">{token.name_in_room}</div>
      </div>

      {/* Контекстное меню */}
      {showContextMenu && (
        <>
          <div className="context-menu-backdrop" onClick={handleCloseMenu} />
          <div
            className="token-context-menu"
            style={{ left: showContextMenu.x, top: showContextMenu.y }}
          >
            <button className="menu-item" onClick={() => {
              setShowEditModal(true)
              handleCloseMenu()
            }}>
              ✏️ Редактировать
            </button>
            {token.current_hp !== null && (
              <>
                <button className="menu-item" onClick={async () => {
                  try {
                    await updateTokenHp(token.id, 1)
                  } catch (err) {
                    console.error('Failed to heal:', err)
                  }
                  handleCloseMenu()
                }}>
                  💚 Лечение +1
                </button>
                <button className="menu-item" onClick={async () => {
                  try {
                    await updateTokenHp(token.id, -1)
                  } catch (err) {
                    console.error('Failed to damage:', err)
                  }
                  handleCloseMenu()
                }}>
                  ⚔️ Урон -1
                </button>
              </>
            )}
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
              🗑️ Удалить
            </button>
          </div>
        </>
      )}

      {/* Модальное окно редактирования */}
      {showEditModal && (
        <TokenEditModal
          token={token}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  )
}
