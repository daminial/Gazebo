import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { mapEditorAPI, mediaAPI } from '../api'
import './Assets.css'

export default function Assets() {
  const { user } = useAuth()
  const [packs, setPacks] = useState([])
  const [selectedPack, setSelectedPack] = useState(null)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('packs')

  // Pack form
  const [showPackForm, setShowPackForm] = useState(false)
  const [editingPack, setEditingPack] = useState(null)
  const [packName, setPackName] = useState('')
  const [packDescription, setPackDescription] = useState('')

  // Asset form
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [assetName, setAssetName] = useState('')
  const [assetCategory, setAssetCategory] = useState('building')
  const [assetWidth, setAssetWidth] = useState(100)
  const [assetHeight, setAssetHeight] = useState(100)
  const [assetImage, setAssetImage] = useState(null)
  const [assetPreview, setAssetPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fileInputRef = useRef()

  const categories = ['building', 'wall', 'tree', 'terrain', 'decoration', 'other']

  useEffect(() => { loadPacks() }, [])

  const loadPacks = async () => {
    setLoading(true)
    try {
      const { data } = await mapEditorAPI.getPacks()
      setPacks(data)
    } catch (err) {
      console.error('Failed to load packs:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAssets = async (packId) => {
    setLoading(true)
    try {
      const { data } = await mapEditorAPI.getPackAssets(packId)
      setAssets(data)
    } catch (err) {
      console.error('Failed to load assets:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectPack = (pack) => {
    setSelectedPack(pack)
    setTab('assets')
    loadAssets(pack.id)
  }

  const openCreatePack = () => {
    setEditingPack(null)
    setPackName('')
    setPackDescription('')
    setShowPackForm(true)
  }

  const openEditPack = (pack) => {
    setEditingPack(pack)
    setPackName(pack.name)
    setPackDescription(pack.description || '')
    setShowPackForm(true)
  }

  const savePack = async () => {
    if (!packName.trim()) return
    try {
      if (editingPack) {
        await mapEditorAPI.updatePack(editingPack.id, { name: packName, description: packDescription })
      } else {
        await mapEditorAPI.createPack({ name: packName, description: packDescription, is_public: true })
      }
      setShowPackForm(false)
      loadPacks()
    } catch (err) {
      console.error('Failed to save pack:', err)
    }
  }

  const deletePack = async (packId) => {
    if (!confirm('Delete this pack and all its assets?')) return
    try {
      await mapEditorAPI.deletePack(packId)
      if (selectedPack?.id === packId) {
        setSelectedPack(null)
        setAssets([])
        setTab('packs')
      }
      loadPacks()
    } catch (err) {
      console.error('Failed to delete pack:', err)
    }
  }

  const openAddAsset = () => {
    setAssetName('')
    setAssetCategory('building')
    setAssetWidth(100)
    setAssetHeight(100)
    setAssetImage(null)
    setAssetPreview(null)
    setShowAssetForm(true)
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAssetImage(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAssetPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const uploadAsset = async () => {
    if (!assetImage || !assetName.trim()) return
    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', assetImage)

      const uploadResponse = await mediaAPI.uploadImage(formData)
      const imageId = uploadResponse.data.id

      await mapEditorAPI.createAsset(selectedPack.id, {
        name: assetName,
        image_id: imageId,
        default_width: assetWidth,
        default_height: assetHeight,
        category: assetCategory,
        is_rotatable: true,
        snap_to_grid: true
      })

      setShowAssetForm(false)
      loadAssets(selectedPack.id)
    } catch (err) {
      console.error('Failed to upload asset:', err)
    } finally {
      setUploading(false)
    }
  }

  const deleteAsset = async (assetId) => {
    if (!confirm('Delete this asset?')) return
    try {
      await mapEditorAPI.deleteAsset(assetId)
      loadAssets(selectedPack.id)
    } catch (err) {
      console.error('Failed to delete asset:', err)
    }
  }

  const groupedAssets = assets.reduce((acc, asset) => {
    const cat = asset.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(asset)
    return acc
  }, {})

  if (loading) return <div className="assets-loading">Loading...</div>

  return (
    <div className="assets-page">
      <div className="assets-header">
        <h1>Asset Manager</h1>
        <div className="assets-header-actions">
          {tab === 'packs' && (
            <button className="btn btn-primary" onClick={openCreatePack}>
              + New Pack
            </button>
          )}
          {tab === 'assets' && selectedPack && (
            <>
              <button className="btn btn-secondary" onClick={() => { setTab('packs'); setSelectedPack(null) }}>
                ← Back to Packs
              </button>
              <button className="btn btn-primary" onClick={openAddAsset}>
                + Add Asset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="assets-tabs">
        <button
          className={`assets-tab ${tab === 'packs' ? 'active' : ''}`}
          onClick={() => { setTab('packs'); setSelectedPack(null) }}
        >
          Packs ({packs.length})
        </button>
        <button
          className={`assets-tab ${tab === 'assets' ? 'active' : ''}`}
          disabled={!selectedPack}
          onClick={() => tab === 'assets' && selectedPack && loadAssets(selectedPack.id)}
        >
          Assets {selectedPack ? `- ${selectedPack.name}` : ''}
        </button>
      </div>

      {/* Packs Grid */}
      {tab === 'packs' && (
        <div className="packs-grid">
          {packs.length === 0 && (
            <div className="empty-state">
              <p>No packs yet. Create your first asset pack!</p>
            </div>
          )}
          {packs.map((pack) => (
            <div
              key={pack.id}
              className={`pack-card ${selectedPack?.id === pack.id ? 'selected' : ''}`}
              onClick={() => selectPack(pack)}
            >
              <div className="pack-card-header">
                <span className="pack-icon">📁</span>
                <h3>{pack.name}</h3>
              </div>
              <p className="pack-description">{pack.description || 'No description'}</p>
              <div className="pack-meta">
                <span>{pack.assets_count || 0} assets</span>
              </div>
              <div className="pack-actions">
                <button className="btn-icon" title="Edit" onClick={(e) => { e.stopPropagation(); openEditPack(pack) }}>
                  ✏️
                </button>
                <button className="btn-icon" title="Delete" onClick={(e) => { e.stopPropagation(); deletePack(pack.id) }}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assets grouped by category */}
      {tab === 'assets' && selectedPack && (
        <div className="assets-content">
          {Object.keys(groupedAssets).length === 0 && (
            <div className="empty-state">
              <p>No assets in this pack. Add your first asset!</p>
            </div>
          )}
          {Object.entries(groupedAssets).map(([category, categoryAssets]) => (
            <div key={category} className="asset-category-group">
              <div className="category-header">
                <span className={`category-badge category-${category}`}>{category}</span>
                <span className="category-count">{categoryAssets.length} items</span>
              </div>
              <div className="assets-grid">
                {categoryAssets.map((asset) => (
                  <div key={asset.id} className="asset-card">
                    <div className="asset-image">
                      <img src={asset.image_url || '/placeholder.png'} alt={asset.name} />
                    </div>
                    <div className="asset-info">
                      <span className="asset-name" title={asset.name}>{asset.name}</span>
                      <span className="asset-size">{asset.default_width}×{asset.default_height}</span>
                    </div>
                    <button className="btn-icon asset-delete" onClick={() => deleteAsset(asset.id)}>
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pack Form Modal */}
      {showPackForm && (
        <div className="modal-overlay" onClick={() => setShowPackForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPack ? 'Edit Pack' : 'Create New Pack'}</h2>
              <button className="btn-icon" onClick={() => setShowPackForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="form-label">
                Name
                <input
                  type="text"
                  className="form-input"
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder="Enter pack name"
                />
              </label>
              <label className="form-label">
                Description
                <textarea
                  className="form-input"
                  value={packDescription}
                  onChange={(e) => setPackDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                  rows={3}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPackForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePack} disabled={!packName.trim()}>
                {editingPack ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Upload Modal */}
      {showAssetForm && (
        <div className="modal-overlay" onClick={() => !uploading && setShowAssetForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Asset to "{selectedPack?.name}"</h2>
              <button className="btn-icon" onClick={() => !uploading && setShowAssetForm(false)} disabled={uploading}>✕</button>
            </div>
            <div className="modal-body">
              <div
                className="image-upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                {assetPreview ? (
                  <img src={assetPreview} alt="Preview" className="image-preview" />
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📷</span>
                    <p>Click to select image</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImageSelect}
                />
              </div>

              <label className="form-label">
                Asset Name
                <input
                  type="text"
                  className="form-input"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Enter asset name"
                />
              </label>

              <label className="form-label">
                Category
                <select
                  className="form-input"
                  value={assetCategory}
                  onChange={(e) => setAssetCategory(e.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label className="form-label">
                  Width (px)
                  <input
                    type="number"
                    className="form-input"
                    value={assetWidth}
                    onChange={(e) => setAssetWidth(Number(e.target.value))}
                  />
                </label>
                <label className="form-label">
                  Height (px)
                  <input
                    type="number"
                    className="form-input"
                    value={assetHeight}
                    onChange={(e) => setAssetHeight(Number(e.target.value))}
                  />
                </label>
              </div>

              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span>Uploading... {uploadProgress}%</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAssetForm(false)} disabled={uploading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={uploadAsset}
                disabled={!assetImage || !assetName.trim() || uploading}
              >
                Upload Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}