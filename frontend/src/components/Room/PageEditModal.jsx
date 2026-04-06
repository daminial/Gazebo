import { useState, useEffect } from 'react'
import Modal from '../Modal'
import './PageCreateModal.css'

export default function PageEditModal({ isOpen, onClose, onUpdate, page }) {
  const [formData, setFormData] = useState({
    name: '',
    canvas_width: 1920,
    canvas_height: 1080,
    background_color: '#FFFFFF',
    grid_size: 50,
    grid_visible: true,
    players_can_draw: false,
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen && page) {
      setFormData({
        name: page.name || '',
        canvas_width: page.canvas_width || 1920,
        canvas_height: page.canvas_height || 1080,
        background_color: page.background_color || '#FFFFFF',
        grid_size: page.grid_size || 50,
        grid_visible: page.grid_visible ?? true,
        players_can_draw: page.players_can_draw ?? false,
      })
      setErrors({})
    }
  }, [isOpen, page])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) {
      newErrors.name = 'Введите название страницы'
    }
    if (formData.canvas_width < 100 || formData.canvas_width > 10000) {
      newErrors.canvas_width = 'Ширина от 100 до 10000'
    }
    if (formData.canvas_height < 100 || formData.canvas_height > 10000) {
      newErrors.canvas_height = 'Высота от 100 до 10000'
    }
    if (formData.grid_size < 10 || formData.grid_size > 200) {
      newErrors.grid_size = 'Размер сетки от 10 до 200'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    onUpdate(page.id, {
      ...formData,
      canvas_width: parseInt(formData.canvas_width),
      canvas_height: parseInt(formData.canvas_height),
      grid_size: parseInt(formData.grid_size),
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать страницу">
      <form className="page-create-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Название *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Страница 1"
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="canvas_width">Ширина холста</label>
            <input
              type="number"
              id="canvas_width"
              name="canvas_width"
              value={formData.canvas_width}
              onChange={handleChange}
              min="100"
              max="10000"
              className={errors.canvas_width ? 'error' : ''}
            />
            {errors.canvas_width && <span className="error-text">{errors.canvas_width}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="canvas_height">Высота холста</label>
            <input
              type="number"
              id="canvas_height"
              name="canvas_height"
              value={formData.canvas_height}
              onChange={handleChange}
              min="100"
              max="10000"
              className={errors.canvas_height ? 'error' : ''}
            />
            {errors.canvas_height && <span className="error-text">{errors.canvas_height}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="background_color">Цвет фона</label>
          <div className="color-input-wrapper">
            <input
              type="color"
              id="background_color"
              name="background_color"
              value={formData.background_color}
              onChange={handleChange}
            />
            <input
              type="text"
              value={formData.background_color}
              onChange={(e) => handleChange({ target: { name: 'background_color', value: e.target.value } })}
              className="color-text-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="grid_size">Размер сетки</label>
          <input
            type="number"
            id="grid_size"
            name="grid_size"
            value={formData.grid_size}
            onChange={handleChange}
            min="10"
            max="200"
            className={errors.grid_size ? 'error' : ''}
          />
          {errors.grid_size && <span className="error-text">{errors.grid_size}</span>}
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="grid_visible"
              checked={formData.grid_visible}
              onChange={handleChange}
            />
            <span>Показывать сетку</span>
          </label>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="players_can_draw"
              checked={formData.players_can_draw}
              onChange={handleChange}
            />
            <span>Игроки могут рисовать</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
