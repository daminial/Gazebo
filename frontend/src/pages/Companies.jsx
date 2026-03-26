import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomsAPI } from '../api'
import CreateRoomModal from '../components/CreateRoomModal.jsx'
import './Companies.css'

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadCompanies()
  }, [])

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

      <div className="companies-grid">
        {companies.map(company => (
          <div 
            key={company.id} 
            className="company-card"
            onClick={() => handleCompanyClick(company.id)}
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
