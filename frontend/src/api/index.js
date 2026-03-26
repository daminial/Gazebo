import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Интерцептор для добавления токена
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Интерцептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Токен истёк, пробуем обновить
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await api.post('/auth/refresh', {
            refresh_token: refreshToken
          })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)

          // Повторяем исходный запрос с новым токеном
          error.config.headers.Authorization = `Bearer ${data.access_token}`
          return api.request(error.config)
        } catch (refreshError) {
          // Не удалось обновить, выходим
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      }
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
}

export const roomsAPI = {
  getAll: () => api.get('/rooms'),
  getMy: () => api.get('/rooms/my'),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (name, imageId = null) => api.post('/rooms', { name, image_id: imageId }),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  updateHP: (id, data) => api.patch(`/rooms/${id}/hp`, data),
  getLiveKitToken: (id) => api.post(`/rooms/${id}/livekit-token`),
  getMaps: (id) => api.get(`/rooms/${id}/maps`),
  getTokens: (id) => api.get(`/rooms/${id}/tokens`),
  updateTokenPosition: (id, token_id, data) => api.patch(`/rooms/${id}/tokens/${token_id}/position`, data),
}

export const mediaAPI = {
  uploadImage: (formData) => api.post('/media/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
}

export const bestiaryAPI = {
  getAll: () => api.get('/bestiary/'),
  getById: (id) => api.get(`/bestiary/${id}`),
  create: (data) => api.post('/bestiary/', data),
  update: (id, data) => api.put(`/bestiary/${id}`, data),
  delete: (id) => api.delete(`/bestiary/${id}`),
}

export const mapAPI = {
  getAll: () => api.get('/map/'),
  getById: (id) => api.get(`/map/${id}`),
  create: (data) => api.post('/map/', data),
  update: (id, data) => api.put(`/map/${id}`, data),
  delete: (id) => api.delete(`/map/${id}`),
}

export default api
