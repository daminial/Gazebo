import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomsAPI } from '../api'
import { useAuth } from '../context/AuthContext.jsx'
import CreateRoomModal from '../components/CreateRoomModal.jsx'
import './Companies.css'

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [contextMenu, setContextMenu] = useState(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    if (user) {
      loadCompanies()
    }
  }, [user?.avatar_id])

  const loadCompanies = async () => {
    try {
      const { data } = await roomsAPI.getMy()
      setCompanies(data)
    } catch (err) {
      setError('Ошибка загрузки компаний')
    } finally {
      setLoading(false)
    }
  }

  const handleCompanyClick = (companyId) => {
    navigate(`/companies/${companyId}`)
  }

  const handleCompanyContextMenu = (e, companyId) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedCompanyId(companyId)
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
    setSelectedCompanyId(null)
  }

  const handleDeleteCompany = async () => {
    if (!selectedCompanyId) return

    if (!window.confirm('Вы уверены, что хотите удалить эту компанию? Это действие нельзя отменить.')) {
      closeContextMenu()
      return
    }

    try {
      await roomsAPI.delete(selectedCompanyId)
      setCompanies(companies.filter(c => c.id !== selectedCompanyId))
      closeContextMenu()
    } catch (err) {
      console.error('Ошибка при удалении компании:', err)
      alert('Ошибка при удалении компании')
      closeContextMenu()
    }
  }

  if (loading) {
    return (
      <div className="companies">
        <div className="loading-state">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="companies">
      <div className="companies-header">
        <h2 className="section-title">Мои компании</h2>
        <div className="companies-actions">
          <button className="btn btn-create" onClick={() => setIsModalOpen(true)}>
            Создать игру
          </button>
          <a href="/companies/search" className="btn btn-search">
            Найти игру
          </a>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      {contextMenu && (
        <>
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '150px'
            }}
            onClick={closeContextMenu}
          >
            <button
              className="context-menu-item"
              onClick={handleDeleteCompany}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#dc3545',
                fontSize: '14px'
              }}
            >
              🗑 Удалить компанию
            </button>
          </div>
          <div className="context-menu-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={closeContextMenu} />
        </>
      )}

      <div className="companies-grid">
        {companies.map(company => (
          <div
            key={company.id}
            className="company-card"
            onClick={() => handleCompanyClick(company.id)}
            onContextMenu={(e) => handleCompanyContextMenu(e, company.id)}
            style={{ cursor: 'context-menu' }}
          >
            {company.image_id ? (
              <>
                <img 
                  src={`/api/media/${company.image_id}`} 
                  alt={company.name} 
                  className="company-logo"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
                <div className="company-logo-placeholder" style={{display: 'none'}}>
                  {company.name.charAt(0).toUpperCase()}
                </div>
              </>
            ) : (
              <div className="company-logo-placeholder">
                {company.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="company-name">{company.name}</div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="empty-state">
            <p>У вас пока нет компаний</p>
            <button className="btn btn-create" onClick={() => setIsModalOpen(true)}>
              Создать первую компанию
            </button>
          </div>
        )}
      </div>

      <CreateRoomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
