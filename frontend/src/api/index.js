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
  create: (name, imageFile = null) => {
    const formData = new FormData()
    formData.append('name', name)
    if (imageFile) {
      formData.append('image', imageFile)
    }
    return api.post('/rooms', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  update: (id, name, imageFile = null, status = null) => {
    const formData = new FormData()
    if (name) formData.append('name', name)
    if (status) formData.append('status', status)
    if (imageFile) formData.append('image', imageFile)
    return api.patch(`/rooms/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  delete: (id) => api.delete(`/rooms/${id}`),
  updateHP: (id, data) => api.patch(`/rooms/${id}/hp`, data),
  getLiveKitToken: (id) => api.post(`/rooms/${id}/livekit-token`),
  
  // Карты
  getMaps: (id) => api.get(`/rooms/${id}/maps`),
  addMap: (id, templateId, nameInRoom, file = null) => {
    const formData = new FormData()
    formData.append('name_in_room', nameInRoom)
    if (templateId) {
      formData.append('template_id', templateId)
    }
    if (file) {
      formData.append('file', file)
    }
    return api.post(`/rooms/${id}/maps`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  deleteMap: (roomId, mapId) => api.delete(`/rooms/${roomId}/maps/${mapId}`),
  setActiveMap: (id, mapId) => api.patch(`/rooms/${id}/maps/${mapId}/active`),
  
  // Токены
  getTokens: (id) => api.get(`/rooms/${id}/tokens`),
  updateTokenPosition: (id, token_id, data) => api.patch(`/rooms/${id}/tokens/${token_id}/position`, data),
  
  // Настройки комнаты
  getSettings: (id) => api.get(`/rooms/${id}/settings`),
  updateSettings: (id, data) => api.patch(`/rooms/${id}/settings`, data),
  
  // Страницы комнаты
  getPages: (id) => api.get(`/rooms/${id}/pages`),
  getPage: (id, pageId) => api.get(`/rooms/${id}/pages/${pageId}`),
  createPage: (id, data) => api.post(`/rooms/${id}/pages`, data),
  updatePage: (id, pageId, data) => api.put(`/rooms/${id}/pages/${pageId}`, data),
  deletePage: (id, pageId) => api.delete(`/rooms/${id}/pages/${pageId}`),
  setActivePage: (id, pageId) => api.post(`/rooms/${id}/pages/${pageId}/set-active`),
  
  // Участники
  getUsers: (id) => api.get(`/rooms/${id}/users`),
  addUser: (id, userId, role = 'PLAYER') => api.post(`/rooms/${id}/users/${userId}?role=${role}`),
  removeUser: (id, userId) => api.delete(`/rooms/${id}/users/${userId}`),
  updateUserRole: (id, userId, role) => api.patch(`/rooms/${id}/users/${userId}/role`, { room_role: role }),
}

export const mediaAPI = {
  uploadImage: (formData) => api.post('/media/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
}

export const mapTemplatesAPI = {
  create: (formData) => {
    const data = new FormData()
    data.append('file', formData.get('file'))
    data.append('name', formData.get('name'))
    const description = formData.get('description')
    if (description) {
      data.append('description', description)
    }
    const isPublic = formData.get('is_public')
    data.append('is_public', isPublic === true || isPublic === 'true' ? 'true' : 'false')
    const caption = formData.get('caption')
    if (caption) {
      data.append('caption', caption)
    }
    return api.post('/map-templates', data, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  getMy: () => api.get('/map-templates/my'),
  getById: (id) => api.get(`/map-templates/${id}`),
  delete: (id) => api.delete(`/map-templates/${id}`),
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
