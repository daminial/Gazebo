import { useState, useRef, useEffect } from 'react'
import { useRoom } from '../../context/RoomContext'
import './PagesDropdown.css'

export function PagesDropdown() {
  const { pages, activePageId, setActivePage, roomId } = useRoom()
  const [showDropdown, setShowDropdown] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!showDropdown) return

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const activePage = pages.find(p => p.id === activePageId)
  const activeIndex = pages.findIndex(p => p.id === activePageId)

  const handleSelectPage = (pageId) => {
    setActivePage(pageId)
    setShowDropdown(false)
  }

  return (
    <>
      {/* Компактная иконка страниц — справа сверху на карте */}
      <button
        className={`pages-icon-btn ${showDropdown ? 'active' : ''}`}
        onClick={() => setShowDropdown(!showDropdown)}
        title="Страницы"
      >
        📄
        {pages.length > 1 && (
          <span className="pages-badge">{activeIndex + 1}</span>
        )}
      </button>

      {/* Панель страниц — фиксированная, поверх всего */}
      {showDropdown && (
        <div className="pages-panel" ref={panelRef}>
          <div className="pages-panel-header">
            <h3>Страницы</h3>
            <button className="pages-close-btn" onClick={() => setShowDropdown(false)}>✕</button>
          </div>

          {pages.length === 0 ? (
            <div className="pages-empty">
              <p>Нет страниц</p>
              <p className="pages-hint">Создайте первую страницу через «Карты комнаты»</p>
            </div>
          ) : (
            <div className="pages-grid">
              {pages.map((page, idx) => {
                const pageMap = page.map || null
                const imageUrl = pageMap?.image_url?.startsWith('http')
                  ? pageMap.image_url
                  : (pageMap?.image_url?.startsWith('/api')
                      ? pageMap.image_url
                      : `/api${pageMap?.image_url || ''}`)

                return (
                  <div
                    key={page.id}
                    className={`page-card ${page.id === activePageId ? 'active' : ''}`}
                    onClick={() => handleSelectPage(page.id)}
                  >
                    <div className="page-card-image">
                      {imageUrl ? (
                        <img src={imageUrl} alt={page.name} />
                      ) : (
                        <div className="page-card-placeholder">
                          <span>🗺️</span>
                        </div>
                      )}
                    </div>
                    <div className="page-card-info">
                      <span className="page-card-title">{page.name}</span>
                      <span className="page-card-number">{idx + 1}</span>
                    </div>
                    {page.id === activePageId && (
                      <div className="page-card-check">✓</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
