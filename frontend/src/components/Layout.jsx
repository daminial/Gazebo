import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import './Layout.css'

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <div className="layout">
      {/* Header */}
      <header className="header">
        <div className="header-top">
          <Link to="/" className="logo">
            <span>Meetgazebo</span>
          </Link>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <ul className="nav-menu">
            <li>
              <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
                Главная
              </Link>
            </li>
            <li>
              <Link to="/companies" className={location.pathname === '/companies' ? 'active' : ''}>
                Компании
              </Link>
            </li>
            <li>
              <Link to="/map" className={location.pathname === '/map' ? 'active' : ''}>
                Карты
              </Link>
            </li>
            <li>
              <Link to="/music" className={location.pathname === '/music' ? 'active' : ''}>
                Музыка
              </Link>
            </li>
            <li>
              <Link to="/help" className={location.pathname === '/help' ? 'active' : ''}>
                Помощь
              </Link>
            </li>
          </ul>
          <div className="nav-profile">
            {isAuthenticated ? (
              <div className="user-menu">
                <Link to="/profile" className="user-name">
                  {user?.username || 'Профиль'}
                </Link>
                <button onClick={handleLogout} className="logout-btn">
                  Выход
                </button>
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="btn-auth">
                  Вход
                </Link>
                <Link to="/register" className="btn-auth btn-register">
                  Регистрация
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <p>&copy; 2026 Gazebo. All rights reserved.</p>
      </footer>
    </div>
  )
}
