import { useState } from 'react'
import { useRoom } from '../../context/RoomContext'
import './MapSelector.css'

export function MapSelector() {
  const { maps, activeMapId, setActiveMapId } = useRoom()
  const [showMapsList, setShowMapsList] = useState(false)

  // Выбор активной карты
  const handleSelectMap = (mapId) => {
    setActiveMapId(mapId)
  }

  const activeMap = maps.find(m => m.id === activeMapId)

  return (
    <div className="map-selector">
      {/* Текущая карта */}
      <div className="current-map">
        <span className="map-label">Карта:</span>
        {activeMap ? (
          <span className="map-name">{activeMap.name_in_room || activeMap.template_name}</span>
        ) : (
          <span className="no-map">Нет карты</span>
        )}
        {maps.length > 1 && (
          <button
            className="btn-change-map"
            onClick={() => setShowMapsList(!showMapsList)}
          >
            {showMapsList ? 'Скрыть' : '📋 Список'}
          </button>
        )}
      </div>

      {/* Список карт */}
      {showMapsList && maps.length > 1 && (
        <div className="maps-list-dropdown">
          <div className="maps-grid">
            {maps.map(map => (
              <div
                key={map.id}
                className={`map-card ${map.id === activeMapId ? 'active' : ''}`}
                onClick={() => handleSelectMap(map.id)}
              >
                {map.image_url ? (
                  <img src={map.image_url} alt={map.name_in_room || map.template_name} />
                ) : (
                  <div className="map-placeholder">🗺️</div>
                )}
                <span className="map-title">{map.name_in_room || map.template_name || 'Карта'}</span>
                {map.id === activeMapId && (
                  <span className="active-badge">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
