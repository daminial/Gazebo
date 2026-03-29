import { Outlet } from 'react-router-dom'
import './GameLayout.css'

export default function GameLayout() {
  return (
    <div className="game-layout">
      <Outlet />
    </div>
  )
}
