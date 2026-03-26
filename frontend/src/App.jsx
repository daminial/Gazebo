import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Map from './pages/Map.jsx'
import Profile from './pages/Profile.jsx'
import Companies from './pages/Companies.jsx'
import CompanyDetail from './pages/CompanyDetail.jsx'
import GameBoard from './pages/GameBoard.jsx'
import './App.css'

// Заглушки для страниц
function Music() {
  return (
    <div className="placeholder-page">
      <h2 className="section-title">Музыка</h2>
      <p>Страница в разработке</p>
    </div>
  )
}

function Help() {
  return (
    <div className="placeholder-page">
      <h2 className="section-title">Помощь</h2>
      <p>Страница в разработке</p>
    </div>
  )
}

function CompaniesSearch() {
  return (
    <div className="companies-search">
      <h2 className="section-title">Поиск компаний</h2>
      <p>Поиск открытых компаний в разработке</p>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="companies" element={
          <PrivateRoute>
            <Companies />
          </PrivateRoute>
        } />
        <Route path="companies/:id" element={
          <PrivateRoute>
            <CompanyDetail />
          </PrivateRoute>
        } />
        <Route path="game/:id" element={
          <PrivateRoute>
            <GameBoard />
          </PrivateRoute>
        } />
        <Route path="companies/search" element={
          <PrivateRoute>
            <CompaniesSearch />
          </PrivateRoute>
        } />
        <Route path="map" element={<Map />} />
        <Route path="music" element={<Music />} />
        <Route path="help" element={<Help />} />
        <Route path="profile" element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
