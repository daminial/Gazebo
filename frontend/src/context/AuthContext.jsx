import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { authAPI } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  const updateUser = async (data) => {
    const { data: updatedUser } = await authAPI.updateMe(data)
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, getToken, isAuthenticated }}>
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
