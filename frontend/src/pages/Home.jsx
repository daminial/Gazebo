import './Home.css'

export default function Home() {
  return (
    <div className="home">
      {/* Companies Section */}
      <section className="section">
        <h2 className="section-title">Компании</h2>
        <div className="cards-grid">
          <div className="card">
            <img src="https://placehold.co/400x120/DC143C/FFFFFF?text=D%26D" alt="D&D Logo" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x120/DC143C/FFFFFF?text=D%26D" alt="D&D Logo" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x120/DC143C/FFFFFF?text=D%26D" alt="D&D Logo" className="card-image" />
          </div>
        </div>
      </section>

      {/* Top Cards Section */}
      <section className="section">
        <h2 className="section-title">Топ карт</h2>
        <div className="cards-grid">
          <div className="card">
            <img src="https://placehold.co/400x180/D2B48C/8B4513?text=Map+1" alt="Map" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x180/D2B48C/8B4513?text=Map+2" alt="Map" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x180/D2B48C/8B4513?text=Map+3" alt="Map" className="card-image" />
          </div>
        </div>
      </section>

      {/* Best Albums Section */}
      <section className="section">
        <h2 className="section-title">Лучшие альбомы</h2>
        <div className="cards-grid">
          <div className="card">
            <img src="https://placehold.co/400x200/FFA500/000000?text=RECORD+Label" alt="Album" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x200/FFA500/000000?text=RECORD+Label" alt="Album" className="card-image" />
          </div>
          <div className="card">
            <img src="https://placehold.co/400x200/FFA500/000000?text=RECORD+Label" alt="Album" className="card-image" />
          </div>
        </div>
      </section>
    </div>
  )
}
