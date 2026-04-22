import { useState, useEffect } from 'react'
import './Room/TokensPanel.css'

export default function CreatureDetailsPanel({ initial, onClose, onSave }) {
  const [details, setDetails] = useState(() => ({
    strength: '', dexterity: '', constitution: '', intelligence: '', wisdom: '', charisma: '',
    hp_max: '', hit_dice: '', ac: '', speed: '', languages: '', cr: '',
    traits: [], actions: [], reactions: [], legendary_actions: [], attacks: [], resistances: [], skills: [], saves: []
  }))

  useEffect(() => {
    if (initial) {
      setDetails({
        strength: initial.strength ?? '', dexterity: initial.dexterity ?? '', constitution: initial.constitution ?? '', intelligence: initial.intelligence ?? '', wisdom: initial.wisdom ?? '', charisma: initial.charisma ?? '',
        hp_max: initial.hp_max ?? '', hit_dice: initial.hit_dice ?? '', ac: initial.ac ?? '', speed: initial.speed ?? '', languages: initial.languages ?? '', cr: initial.cr ?? '',
        traits: initial.traits ?? [], actions: initial.actions ?? [], reactions: initial.reactions ?? [], legendary_actions: initial.legendary_actions ?? [], attacks: initial.attacks ?? [], resistances: initial.resistances ?? [], skills: initial.skills ?? [], saves: initial.saves ?? []
      })
    }
  }, [initial])

  const change = (k, v) => setDetails(d => ({...d, [k]: v}))
  // debug: log input changes to help trace uneditable-field issues
  const debugChange = (k, v) => {
    try { console.debug('[CreatureDetailsPanel] change', k, v) } catch (e) {}
    setDetails(d => ({...d, [k]: v}))
  }

  const addItem = (listKey) => {
    setDetails(d => ({...d, [listKey]: [...(d[listKey]||[]), { name: '', description: '' }]}))
  }
  const updateItem = (listKey, idx, key, value) => {
    setDetails(d => ({...d, [listKey]: d[listKey].map((it,i)=> i===idx ? {...it, [key]: value} : it)}))
  }
  const removeItem = (listKey, idx) => {
    setDetails(d => ({...d, [listKey]: d[listKey].filter((_,i)=>i!==idx)}))
  }

  const handleSave = () => {
    // normalize numeric fields
    const payload = { ...details }
    payload.strength = payload.strength === '' ? null : parseInt(payload.strength)
    payload.dexterity = payload.dexterity === '' ? null : parseInt(payload.dexterity)
    payload.constitution = payload.constitution === '' ? null : parseInt(payload.constitution)
    payload.intelligence = payload.intelligence === '' ? null : parseInt(payload.intelligence)
    payload.wisdom = payload.wisdom === '' ? null : parseInt(payload.wisdom)
    payload.charisma = payload.charisma === '' ? null : parseInt(payload.charisma)
    payload.hp_max = payload.hp_max === '' ? null : parseInt(payload.hp_max)
    payload.ac = payload.ac === '' ? null : parseInt(payload.ac)
    payload.cr = payload.cr === '' ? null : parseInt(payload.cr)

    onSave(payload)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e)=>e.stopPropagation()} style={{maxWidth:900}}>
        <div className="modal-header">
          <h3>Подробные характеристики</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:20}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8}}>
            {['strength','dexterity','constitution','intelligence','wisdom','charisma'].map(k => (
              <div key={k} className="form-group">
                <label>{k.toUpperCase()}</label>
                <input type="number" value={details[k] ?? ''} onChange={(e)=>debugChange(k,e.target.value)} />
              </div>
            ))}
          </div>

          <div className="form-row" style={{marginTop:12}}>
            <div className="form-group">
              <label>HP (Max)</label>
              <input type="number" value={details.hp_max ?? ''} onChange={(e)=>change('hp_max', e.target.value)} />
            </div>
            <div className="form-group">
              <label>AC</label>
              <input type="number" value={details.ac ?? ''} onChange={(e)=>change('ac', e.target.value)} />
            </div>
          </div>

          <div className="form-row" style={{marginTop:12}}>
            <div className="form-group">
              <label>Hit dice</label>
              <input value={details.hit_dice ?? ''} onChange={(e)=>change('hit_dice', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Speed</label>
              <input value={details.speed ?? ''} onChange={(e)=>change('speed', e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{marginTop:12}}>
            <label>Languages</label>
            <input value={details.languages ?? ''} onChange={(e)=>change('languages', e.target.value)} />
          </div>

          <div style={{marginTop:12}}>
            <h4>Traits</h4>
            {(details.traits||[]).map((it,idx)=> (
              <div key={idx} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:8}}>
                <input style={{flex:1}} placeholder="Name" value={it.name||''} onChange={(e)=>updateItem('traits', idx, 'name', e.target.value)} />
                <input style={{flex:2}} placeholder="Description" value={it.description||''} onChange={(e)=>updateItem('traits', idx, 'description', e.target.value)} />
                <button className="btn-cancel" type="button" onClick={()=>removeItem('traits', idx)}>Удалить</button>
              </div>
            ))}
            <div style={{marginTop:6}}><button className="btn-next" type="button" onClick={()=>addItem('traits')}>Добавить Trait</button></div>
          </div>

          <div style={{marginTop:12}}>
            <h4>Actions</h4>
            {(details.actions||[]).map((it,idx)=> (
              <div key={idx} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:8}}>
                <input style={{flex:1}} placeholder="Name" value={it.name||''} onChange={(e)=>updateItem('actions', idx, 'name', e.target.value)} />
                <input style={{flex:2}} placeholder="Description" value={it.description||''} onChange={(e)=>updateItem('actions', idx, 'description', e.target.value)} />
                <button className="btn-cancel" type="button" onClick={()=>removeItem('actions', idx)}>Удалить</button>
              </div>
            ))}
            <div style={{marginTop:6}}><button className="btn-next" type="button" onClick={()=>addItem('actions')}>Добавить Action</button></div>
          </div>

          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:20}}>
            <button className="btn-cancel" onClick={onClose}>Отмена</button>
            <button className="btn-submit" onClick={handleSave}>Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  )
}
