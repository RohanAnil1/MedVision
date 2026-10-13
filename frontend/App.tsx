import { useEffect, useRef, useState } from 'react'
import { Activity, FolderOpen, Upload, Search, ShieldCheck, Grid2X2, Square, Move, ZoomIn, Sun, Ruler, Triangle, ScanLine, Circle, Info, Layers, Box, X } from 'lucide-react'
import { Button } from './components/ui/button'
import { Viewport } from './components/Viewport'
import { json, setSession, type Job, type Series, type Study } from './lib/api'
import { useViewer, type Mode, type Tool } from './lib/store'

const toolOptions: {name: Tool; label: string; icon: typeof Move}[] = [
  {name:'WindowLevel',label:'Window / level',icon:Sun},{name:'Pan',label:'Pan',icon:Move},{name:'Zoom',label:'Zoom',icon:ZoomIn},
  {name:'Length',label:'Length',icon:Ruler},{name:'Angle',label:'Angle',icon:Triangle},{name:'CobbAngle',label:'Cobb angle',icon:ScanLine},
  {name:'RectangleROI',label:'Rectangle ROI',icon:Square},{name:'EllipticalROI',label:'Ellipse ROI',icon:Circle},{name:'PlanarFreehandROI',label:'Freehand ROI',icon:Activity},
]
export function App() {
  const [connected, setConnected] = useState(false)
  const [studies, setStudies] = useState<Study[]>([])
  const [query, setQuery] = useState('')
  const [slots, setSlots] = useState<(Series | null)[]>([null, null, null, null])
  const [active, setActive] = useState(0)
  const [layout, setLayout] = useState(1)
  const [mode, setMode] = useState<Mode>('stack')
  const [job, setJob] = useState<Job | null>(null)
  const [status, setStatus] = useState('Local archive ready')
  const [error, setError] = useState('')
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const viewer = useViewer()
  const refresh = async () => setStudies(await json<Study[]>('/studies'))
  useEffect(() => {
    let cancelled = false
    async function connect() {
      const token = window.medvision ? await window.medvision.session() : (await (await fetch('/session')).json()).token
      if (!token) throw new Error('Start this workstation using the MedVision launcher.')
      setSession(token)
      const data = await json<Study[]>('/studies')
      if (!cancelled) { setStudies(data); setConnected(true) }
    }
    connect().catch(() => { if (!cancelled) setError('Start MedVision with npm start or the desktop launcher, then open its launch page.') })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!job || !['queued','running'].includes(job.status)) return
    const timer = setInterval(async () => {
      try {
        const next = await json<Job>(`/jobs/${job.id}`)
        setJob(next)
        if (next.status === 'completed' || next.status === 'cancelled') {
          await refresh()
          const result = next.result
          setStatus(`${next.status === 'cancelled' ? 'Cancelled · ' : ''}${result?.imported || 0} imported · ${result?.duplicates || 0} duplicates · ${result?.errors.length || 0} errors`)
          if (result?.errors.length) setError(result.errors.slice(0, 8).map(e => `${e.file}: ${e.message}`).join('\n'))
        } else if (next.status === 'failed') setError(next.error || 'Import failed.')
      } catch (error) { setError(String(error)) }
    }, 400)
    return () => clearInterval(timer)
  }, [job?.id, job?.status])
  async function importFiles(files: FileList | null) {
    if (!files?.length) return
    const form = new FormData()
    for (const file of Array.from(files)) form.append('files', file, file.webkitRelativePath || file.name)
    setError(''); setStatus('Importing into local archive…')
    try { setJob(await json<Job>('/imports', {method:'POST',body:form})) } catch (error) { setError(String(error)) }
    if (uploadRef.current) uploadRef.current.value = ''
    if (folderRef.current) folderRef.current.value = ''
  }
  function openSeries(series: Series) { setSlots(current => current.map((item, i) => i === active ? series : item)) }
  async function inspect(id: string) {
    try { setMetadata(await json<Record<string, unknown>>(`/instances/${id}/metadata`)) } catch (error) { setError(String(error)) }
  }
  const importing = job?.status === 'queued' || job?.status === 'running'
  const filtered = studies.filter(study => JSON.stringify(study).toLowerCase().includes(query.toLowerCase()))
  return <div className="workstation">
    <header className="app-header"><div className="brand"><div className="brand-icon"><Activity size={23}/></div><div><strong>MedVision</strong><small>IMAGING WORKSTATION</small></div></div>
      <div className="privacy"><ShieldCheck size={15}/> Fully local <span>·</span> Research & education</div>
      <Button variant="default" onClick={() => folderRef.current?.click()} disabled={!connected || importing}><FolderOpen size={16}/> Import folder</Button>
      <Button onClick={() => uploadRef.current?.click()} disabled={!connected || importing}><Upload size={16}/> Files</Button>
      <input ref={uploadRef} type="file" multiple className="hidden" onChange={e => void importFiles(e.target.files)}/>
      <input ref={folderRef} type="file" multiple {...{webkitdirectory: '', directory: ''}} className="hidden" onChange={e => void importFiles(e.target.files)}/>
    </header>
    <div className="tool-row"><div className="tool-set">{toolOptions.map(item => <Button key={item.name} size="icon" title={item.label} aria-label={item.label} variant={viewer.tool === item.name ? 'default' : 'ghost'} onClick={() => viewer.setTool(item.name)}><item.icon size={18}/></Button>)}</div>
      <div className="divider"/><label>W <input type="number" min={1} value={viewer.width} onChange={e => viewer.setWindow(viewer.center, Math.max(1, Number(e.target.value)))}/></label><label>L <input type="number" value={viewer.center} onChange={e => viewer.setWindow(Number(e.target.value), viewer.width)}/></label>
      <select aria-label="Window preset" onChange={e => {const [c,w] = e.target.value.split(',').map(Number); viewer.setWindow(c,w)}} defaultValue="40,400"><option value="40,400">Soft tissue</option><option value="-600,1500">Lung</option><option value="400,1800">Bone</option><option value="40,80">Brain</option></select>
      <label><input type="checkbox" checked={viewer.invert} onChange={e => viewer.setInvert(e.target.checked)}/> Invert</label>
      <div className="flex-1"/><Button size="icon" title="Single viewport" variant={layout===1?'default':'ghost'} onClick={() => {setLayout(1);setActive(0)}}><Square size={18}/></Button><Button size="icon" title="Four viewports" variant={layout===4?'default':'ghost'} onClick={() => setLayout(4)}><Grid2X2 size={18}/></Button>
      <Button size="icon" title="Metadata" variant={showInfo?'default':'ghost'} onClick={() => setShowInfo(!showInfo)}><Info size={18}/></Button>
    </div>
    <main className="workspace"><aside className="archive"><div className="section-heading"><span>STUDY ARCHIVE</span><span>{studies.length}</span></div><div className="search"><Search size={15}/><input placeholder="Search local studies" value={query} onChange={e => setQuery(e.target.value)}/></div>
      <div className="study-list">{filtered.map(study => <div className="study" key={study.study_uid}><div className="study-name">{study.patient_name.replaceAll('^',' ') || 'Unnamed patient'}</div><div className="study-meta">{study.patient_id || 'No patient ID'} · {study.study_date || 'Undated'}</div><p>{study.study_description || 'Imaging study'}</p>{study.series.map(series => <button className={`series ${slots[active]?.series_uid === series.series_uid ? 'selected' : ''}`} key={series.series_uid} onClick={() => openSeries(series)}><div className="modality">{series.modality}</div><div><strong>{series.description || 'Unnamed series'}</strong><span>{series.frame_count} frames</span></div></button>)}</div>)}{!studies.length && <div className="archive-empty">Studies stay on this computer.<br/>Import a folder to begin.</div>}</div>
      <div className="archive-foot"><ShieldCheck size={14}/> No cloud connection</div>
    </aside><div className="viewing-area"><div className="mode-row">{([{id:'stack',label:'2D stack',icon:Layers},{id:'axial',label:'Axial',icon:ScanLine},{id:'coronal',label:'Coronal',icon:ScanLine},{id:'sagittal',label:'Sagittal',icon:ScanLine},{id:'volume',label:'3D volume',icon:Box}] as const).map(item => <Button key={item.id} variant={mode===item.id?'secondary':'ghost'} onClick={() => setMode(item.id)}><item.icon size={14}/>{item.label}</Button>)}<div className="flex-1"/><label><input type="checkbox" checked={viewer.cpu} onChange={e => viewer.setCPU(e.target.checked)}/> CPU 2D</label></div>
      <div className={`viewport-grid layout-${layout}`}>{slots.slice(0,layout).map((series,i) => series ? <Viewport key={`${i}-${series.series_uid}`} series={series} mode={mode} active={active===i} onActive={() => setActive(i)} onMetadata={id => void inspect(id)}/> : <div className={`empty-viewport ${active===i?'active':''}`} key={i} onClick={() => setActive(i)}><div className="empty-symbol"><Layers size={36}/></div><h2>{connected ? 'Your images. Your computer.' : 'Connect your local session'}</h2><p>{connected ? 'Import a DICOM study, then select a series from the archive.' : 'Use the MedVision launcher to open a protected session.'}</p><span>VIEWPORT {i+1}</span></div>)}</div>
    </div>{showInfo && <aside className="metadata"><div className="section-heading">DICOM METADATA<Button size="icon" variant="ghost" onClick={() => setShowInfo(false)}><X size={15}/></Button></div>{metadata ? Object.entries(metadata).map(([tag,value]) => <div className="tag" key={tag}><code>{tag}</code><pre>{JSON.stringify(value,null,2)}</pre></div>) : <p>Select a stack image to inspect its metadata.</p>}</aside>}</main>
    {error && <div className="error-banner" role="alert"><span>{error}</span><Button size="icon" variant="ghost" aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></Button></div>}
    <footer className="status-bar"><span className={`status-dot ${connected?'connected':''}`}/><span>{connected ? status : 'Awaiting launch session'}</span>{importing && <><progress max={1} value={job.progress}/><Button variant="ghost" onClick={() => void json(`/jobs/${job.id}/cancel`,{method:'POST'})}>Cancel import</Button></>}<div className="flex-1"/><span>MedVision 0.1 · Platform qualification pending</span></footer>
  </div>
}
