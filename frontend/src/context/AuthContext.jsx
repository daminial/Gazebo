import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    
    if (accessToken) {
      localStorage.setItem('access_token', accessToken)
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken)
      }
      navigate('/', { replace: true })
      window.location.reload()
      return
    }

    const token = localStorage.getItem('access_token')
    if (token) {
      authAPI.getMe()
        .then(({ data }) => setUser(data))
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.success) {
        const token = localStorage.getItem('access_token')
        if (token) {
          authAPI.getMe()
            .then(({ data }) => setUser(data))
            .catch(() => {
              localStorage.removeItem('access_token')
              localStorage.removeItem('refresh_token')
            })
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const userData = await authAPI.getMe()
    setUser(userData.data)
    return data
  }

  const register = async (userData) => {
    const { data } = await authAPI.register(userData)
    return data
  }

  const verifyEmail = async (email, code) => {
    const { data } = await authAPI.verifyEmail(email, code)
    return data
  }

  const refreshToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      throw new Error('No refresh token')
    }
    const { data } = await authAPI.refreshToken(refreshToken)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return data
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    navigate('/login')
  }

  const updateUser = async (data) => {
    const { data: updatedUser } = await authAPI.updateMe(data)
    setUser(updatedUser)
    return updatedUser
  }

  const uploadAvatar = async (file) => {
    const { data: updatedUser } = await authAPI.uploadAvatar(file)
    setUser(updatedUser)
    return updatedUser
  }

  const deleteAvatar = async () => {
    const { data: updatedUser } = await authAPI.deleteAvatar()
    setUser(updatedUser)
    return updatedUser
  }

  const getToken = () => {
    return localStorage.getItem('access_token')
  }

  const isAuthenticated = useMemo(() => {
    return !!user || !!localStorage.getItem('access_token')
  }, [user])

  return (
    <AuthContext.Provider value={{ 
      user, loading, login, register, verifyEmail, 
      refreshToken, logout, updateUser, uploadAvatar, 
      deleteAvatar, getToken, isAuthenticated 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}