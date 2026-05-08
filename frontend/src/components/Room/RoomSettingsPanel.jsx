import { useState, useEffect } from 'react'
import { useRoom } from '../../context/RoomContext'
import './RoomSettingsPanel.css'

export function RoomSettingsPanel() {
  const { roomSettings, updateRoomSettings } = useRoom()
  const [formData, setFormData] = useState({
    grid_size: roomSettings?.grid_size || 50,
    grid_visible: roomSettings?.grid_visible ?? true,
    music_volume: roomSettings?.music_volume || 70,
    is_public: roomSettings?.is_public || false,
    players_can_draw: roomSettings?.players_can_draw || false,
  })

  // Синхронизация при изменении roomSettings извне
  useEffect(() => {
    if (roomSettings) {
      setFormData(prev => ({
        grid_size: roomSettings.grid_size ?? prev.grid_size,
        grid_visible: roomSettings.grid_visible ?? prev.grid_visible,
        music_volume: roomSettings.music_volume ?? prev.music_volume,
        is_public: roomSettings.is_public ?? prev.is_public,
        players_can_draw: roomSettings.players_can_draw ?? prev.players_can_draw,
      }))
    }
  }, [roomSettings])

  const handleChange = (field) => async (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value)
    setFormData(prev => ({ ...prev, [field]: value }))
    try {
      await updateRoomSettings({ [field]: value })
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  if (!roomSettings) {
    return <div className="settings-loading">Загрузка настроек...</div>
  }

  return (
    <div className="room-settings-panel">
      <h3>Настройки комнаты</h3>

      <div className="settings-section">
        <h4>Сетка</h4>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={formData.grid_visible}
              onChange={handleChange('grid_visible')}
            />
            Показывать сетку
          </label>
        </div>
      </div>

      {/* <div className="settings-section">
        <h4>Аудио</h4>
        <div className="setting-row">
          <label>Громкость музыки</label>
          <div className="setting-control">
            <input
              type="range"
              min="0"
              max="100"
              value={formData.music_volume}
              onChange={handleChange('music_volume')}
            />
            <span className="setting-value">{formData.music_volume}%</span>
          </div>
        </div>
      </div> */}

      <div className="settings-section">
        <h4>Доступ</h4>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={formData.is_public}
              onChange={handleChange('is_public')}
            />
            Публичная комната
          </label>
        </div>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={formData.players_can_draw}
              onChange={handleChange('players_can_draw')}
            />
            Игроки могут рисовать
          </label>
        </div>
      </div>
    </div>
  )
}
