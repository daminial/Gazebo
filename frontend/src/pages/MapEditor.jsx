import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { mapEditorAPI } from '../api'
import { useParams } from 'react-router-dom'
import CanvasEditor from '../components/MapEditor/CanvasEditor.jsx'
import './Map.css'

export default function MapEditor() {
  const { id: routeId } = useParams()
  const [projectId, setProjectId] = useState(routeId || null)
  const [project, setProject] = useState(null)
  const [packList, setPackList] = useState([])
  const [selectedPack, setSelectedPack] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPacks()
    if (routeId) {
      loadProject(routeId)
    }
  }, [routeId])

  const loadPacks = async () => {
    try {
      const { data } = await mapEditorAPI.getPacks()
      const packs = data || []
      setPackList(packs)
      return packs
    } catch (e) {
      console.warn('Failed to load packs', e)
      return []
    }
  }

  const loadProject = async (id) => {
    setLoading(true)
    try {
      const { data } = await mapEditorAPI.getProject(id)
      setProject(data)
      setProjectId(data.id)

      const packs = await loadPacks()
      if (data.pack_id) {
        const pack = packs.find(p => p.id === data.pack_id)
        if (pack) {
          setSelectedPack(pack)
        } else if (packs.length > 0) {
          setSelectedPack(packs[0])
        }
      } else if (packs.length > 0) {
        setSelectedPack(packs[0])
      }
    } catch (e) {
      console.error('Failed to load project', e)
    } finally {
      setLoading(false)
    }
  }

  const createProject = async () => {
    setLoading(true)
    try {
      const activePack = selectedPack || (packList.length > 0 ? packList[0] : null)

      const body = {
        name: 'New project',
        orientation: 'horizontal',
        width: 2000,
        height: 1500,
        pack_id: activePack?.id || null,
        is_public: false
      }
      const { data } = await mapEditorAPI.createProject(body)
      setProjectId(data.id)
      setProject(data)
      if (activePack) setSelectedPack(activePack)
    } catch (e) {
      console.error('Failed create project', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRendered = async ({ name, description, tags, is_public, blob }) => {
    if (!projectId) return
    const fd = new FormData()
    fd.append('rendered_image', blob, `${name || 'map'}.png`)
    fd.append('name', name || project?.name || 'Map')
    if (description) fd.append('description', description)
    fd.append('is_public', String(is_public || false))
    if (tags) fd.append('tags', tags)

    try {
      await mapEditorAPI.saveProject(projectId, fd)
      alert('Карта сохранена!')
    } catch (e) {
      console.error('Save failed', e)
      alert('Ошибка сохранения')
    }
  }

  if (loading) return <div className="map-page"><p>Загрузка...</p></div>

  if (!projectId) {
    return (
      <div className="map-page">
        <div className="map-header">
          <h1>Редактор карт</h1>
          <button className="btn btn-primary" onClick={createProject}>
            Создать новый проект
          </button>
        </div>
      </div>
    )
  }

  // Рендерим редактор через портал прямо в body
  return createPortal(
    <div className="map-editor-page">
      <CanvasEditor
        projectId={projectId}
        packs={packList}
        selectedPack={selectedPack}
        initialObjects={project?.scene_objects || []}
        projectName={project?.name || 'Моя карта'}
        onSelectPack={(p) => setSelectedPack(p)}
        onSaveRendered={handleSaveRendered}
      />
    </div>,
    document.body
  )
}