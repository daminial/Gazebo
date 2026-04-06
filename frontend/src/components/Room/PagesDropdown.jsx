import { useState, useRef, useEffect } from 'react'
import { useRoom } from '../../context/RoomContext'
import { LuSettings2, LuTrash2 } from 'react-icons/lu'
import PageCreateModal from './PageCreateModal'
import PageEditModal from './PageEditModal'
import './PagesDropdown.css'

export function PagesDropdown() {
  const { pages, activePageId, setActivePage, createPage, deletePage, updatePage, roomId } = useRoom()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editPage, setEditPage] = useState(null)
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

  const handleCreatePage = async (pageData) => {
    try {
      await createPage(pageData)
      setShowCreateModal(false)
    } catch (err) {
      console.error('Failed to create page:', err)
      alert('Ошибка при создании страницы: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleDeletePage = async (e, pageId) => {
    e.stopPropagation()
    if (!confirm('Удалить эту страницу?')) return

    try {
      await deletePage(pageId)
    } catch (err) {
      console.error('Failed to delete page:', err)
      alert('Ошибка при удалении страницы: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleEditPage = async (pageId, pageData) => {
    try {
      await updatePage(pageId, pageData)
      setEditPage(null)
    } catch (err) {
      console.error('Failed to update page:', err)
      alert('Ошибка при обновлении страницы: ' + (err.response?.data?.detail || err.message))
    }
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
            <div className="pages-header-actions">
              <button
                className="pages-add-btn"
                onClick={() => setShowCreateModal(true)}
                title="Создать страницу"
              >
                + Создать
              </button>
              <button className="pages-close-btn" onClick={() => setShowDropdown(false)}>✕</button>
            </div>
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
                const imageUrl = pageMap?.image_url
                  ? (pageMap.image_url.startsWith('http')
                      ? pageMap.image_url
                      : (pageMap.image_url.startsWith('/api')
                          ? pageMap.image_url
                          : `/api${pageMap.image_url}`))
                  : null

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
                        <div className="page-card-placeholder-green">
                          <span>{page.name}</span>
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
                    <button
                      className="page-card-settings"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditPage(page)
                      }}
                      title="Настройки страницы"
                    >
                      <LuSettings2 size={14} />
                    </button>
                    <button
                      className="page-card-delete"
                      onClick={(e) => handleDeletePage(e, page.id)}
                      title="Удалить страницу"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <PageCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreatePage}
      />

      <PageEditModal
        isOpen={!!editPage}
        onClose={() => setEditPage(null)}
        onUpdate={handleEditPage}
        page={editPage}
      />
    </>
  )
}
