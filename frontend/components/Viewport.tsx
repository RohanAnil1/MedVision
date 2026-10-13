import { useEffect, useRef, useState } from 'react'
import { core, tools, initializeImaging, imageId, toolClasses } from '../lib/cornerstone'
import { json, request, type Instance, type Series } from '../lib/api'
import { useViewer, type Mode } from '../lib/store'
import { Button } from './ui/button'
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Download, Play, Pause } from 'lucide-react'
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction'
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction'
import { restoreAnnotations, watchAnnotations } from '../lib/annotations'
import { VolumeControls } from './VolumeControls'
import {defaultVolumeStyle,clippingPlanes,scalarRange,transferNodes} from '../lib/volume-style'
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane'
import type {vtkVolume} from '@kitware/vtk.js/Rendering/Core/Volume'

interface Props { series: Series; mode: Mode; active: boolean; onActive: () => void; onMetadata: (id: string) => void }
interface Geometry { dimensions: [number, number, number]; spacing: [number, number, number]; origin: [number, number, number]; direction: core.Types.Mat3; frame_of_reference_uid: string }

export function Viewport({series, mode, active, onActive, onMetadata}: Props) {
  const element = useRef<HTMLDivElement>(null)
  const engine = useRef<core.RenderingEngine>()
  const groupId = useRef(`tools-${crypto.randomUUID()}`)
  const viewportId = useRef(`viewport-${crypto.randomUUID()}`)
  const frames = useRef<{instance: Instance; frame: number}[]>([])
  const [count, setCount] = useState(0)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [version, setVersion] = useState(0)
  const {tool, center, width, invert, cpu, projection} = useViewer()
  const volumeId = useRef('')
  const cameraRotation = useRef(0)
  const volumeGeometry=useRef<Geometry>()
  const volumeActor=useRef<vtkVolume>()
  const [volumeStyle,setVolumeStyle]=useState(()=>defaultVolumeStyle(series.modality))
  const [range,setRange]=useState<[number,number]>([-1000,1200])
  const getViewport = () => engine.current?.getViewport(viewportId.current)

  useEffect(() => {
    let disposed = false
    const controller = new AbortController()
    let resize: ResizeObserver | undefined
    let stopAnnotations: (() => void) | undefined
    setLoading(true); setError(''); setPlaying(false); setIndex(0)
    async function start() {
      await initializeImaging()
      if (disposed || !element.current) return
      core.setUseCPURendering(cpu)
      const currentEngine = new core.RenderingEngine(`engine-${crypto.randomUUID()}`)
      engine.current = currentEngine
      const type = mode === 'stack' ? core.Enums.ViewportType.STACK : mode === 'volume' ? core.Enums.ViewportType.VOLUME_3D : core.Enums.ViewportType.ORTHOGRAPHIC
      if (cpu && mode !== 'stack') throw new Error('GPU MPR/3D is unavailable in CPU stack mode. Use backend reconstruction export for MPR.')
      currentEngine.enableElement({viewportId: viewportId.current, element: element.current, type,
        defaultOptions: {background: [0, 0, 0], ...(mode !== 'stack' && mode !== 'volume' ? {orientation: mode as core.Enums.OrientationAxis} : {})},
      })
      const group = tools.ToolGroupManager.createToolGroup(groupId.current)!
      for (const ToolClass of toolClasses) group.addTool(ToolClass.toolName)
      group.addViewport(viewportId.current, currentEngine.id)
      if (mode === 'stack') {
        const instances = await json<Instance[]>(`/series/${series.series_uid}/instances`, {signal: controller.signal})
        if (disposed) return
        frames.current = instances.flatMap(instance => Array.from({length: instance.frames}, (_, frame) => ({instance, frame})))
        setCount(frames.current.length)
        const viewport = getViewport() as core.StackViewport
        await viewport.setStack(frames.current.map(item => imageId(item.instance.id, item.frame)))
        if (disposed) return
        onMetadata(frames.current[0].instance.id)
        await restoreAnnotations(series.series_uid, element.current!)
        if (disposed) return
        stopAnnotations = watchAnnotations(series.series_uid, frames.current, setError)
        group.setToolActive('StackScroll', {bindings: [{mouseButton: tools.Enums.MouseBindings.Wheel}]})
        element.current.addEventListener(core.Enums.Events.STACK_NEW_IMAGE, stackChanged)
      } else {
        const response = await request(`/series/${series.series_uid}/volume`, {signal: controller.signal})
        const geometry: Geometry = JSON.parse(response.headers.get('X-Image-Geometry')!)
        volumeGeometry.current=geometry
        const bytes = await response.arrayBuffer()
        if (disposed) return
        const scalarData=new Float32Array(bytes)
        const limits=scalarRange(scalarData)
        setRange(limits)
        if(mode==='volume'&&series.modality!=='CT')setVolumeStyle(style=>({...style,threshold:limits[0]+(limits[1]-limits[0])*0.15}))
        volumeId.current = `medvision-volume:${crypto.randomUUID()}`
        const localVolume = core.volumeLoader.createLocalVolume(volumeId.current, {
          ...geometry, scalarData,
          metadata: {
            Modality: series.modality, FrameOfReferenceUID: geometry.frame_of_reference_uid,
            BitsAllocated: 32, BitsStored: 32, HighBit: 31, SamplesPerPixel: 1,
            PhotometricInterpretation: 'MONOCHROME2', PixelRepresentation: 1,
            ImageOrientationPatient: Array.from(geometry.direction).slice(0, 6), PixelSpacing: [geometry.spacing[1], geometry.spacing[0]],
            Columns: geometry.dimensions[0], Rows: geometry.dimensions[1],
            voiLut: [{windowCenter: 40, windowWidth: 400}], VOILUTFunction: 'LINEAR',
          },
        })
        for (const localImageId of localVolume.imageIds) {
          core.utilities.genericMetadataProvider.add(localImageId, {
            type: core.Enums.MetadataModules.VOI_LUT,
            metadata: {windowCenter: [center], windowWidth: [width], voiLUTFunction: 'LINEAR'},
          })
        }
        await core.setVolumesForViewports(currentEngine, [{volumeId: volumeId.current,
          callback: ({volumeActor:actor}) => {volumeActor.current=actor},
        }], [viewportId.current])
        if (disposed) return
        currentEngine.getViewport(viewportId.current).resetCamera()
        const viewport=getViewport() as core.VolumeViewport
        setCount(mode==='volume'?1:viewport.getNumberOfSlices())
        setIndex(mode==='volume'?0:viewport.getSliceIndex())
      }
      resize = new ResizeObserver(() => { if (!disposed) { currentEngine.resize(true, false); currentEngine.render() } })
      resize.observe(element.current!)
      setLoading(false); setVersion(v => v + 1)
      currentEngine.render()
    }
    function stackChanged() {
      const viewport = getViewport() as core.StackViewport
      const n = viewport.getCurrentImageIdIndex()
      setIndex(n)
      if (frames.current[n]) onMetadata(frames.current[n].instance.id)
    }
    start().catch(error => { if (!disposed) { setError(error instanceof Error ? error.message : 'DICOM rendering failed.'); setLoading(false) } })
    return () => {
      disposed = true; controller.abort(); resize?.disconnect(); stopAnnotations?.()
      element.current?.removeEventListener(core.Enums.Events.STACK_NEW_IMAGE, stackChanged)
      tools.ToolGroupManager.destroyToolGroup(groupId.current)
      engine.current?.destroy(); engine.current = undefined
      if (volumeId.current && core.cache.getVolume(volumeId.current)) {
        const imageIds=[...core.cache.getVolume(volumeId.current)!.imageIds]
        core.cache.removeVolumeLoadObject(volumeId.current)
        for(const id of imageIds)if(core.cache.getImageLoadObject(id))core.cache.removeImageLoadObject(id)
      }
      volumeId.current = ''
      volumeActor.current=undefined
    }
  }, [series.series_uid, mode, cpu])

  useEffect(()=>{setVolumeStyle(defaultVolumeStyle(series.modality))},[series.series_uid])
  useEffect(()=>{
    if(loading||mode!=='volume'||!volumeActor.current||!volumeGeometry.current)return
    const actor=volumeActor.current,geometry=volumeGeometry.current
    const nodes=transferNodes(range,volumeStyle)
    const rgb=vtkColorTransferFunction.newInstance(),opacity=vtkPiecewiseFunction.newInstance()
    for(const [value,r,g,b] of nodes.rgb)rgb.addRGBPoint(value,r,g,b)
    for(const [value,alpha] of nodes.opacity)opacity.addPoint(value,alpha)
    const property=actor.getProperty()
    const previousRGB=property.getRGBTransferFunction(0),previousOpacity=property.getScalarOpacity(0)
    property.setRGBTransferFunction(0,rgb);property.setScalarOpacity(0,opacity);property.setShade(volumeStyle.shade)
    previousRGB?.delete();previousOpacity?.delete()
    const mapper=actor.getMapper()
    if(!mapper)return
    // vtk.js 36.4.1 declares six uniform slots despite accepting more planes.
    // Use its supported post-generation shader replacement API for six crop faces + one clip plane.
    const shaderMapper=mapper as typeof mapper & {setViewSpecificProperties:(properties:Record<string,unknown>)=>void}
    shaderMapper.setViewSpecificProperties({OpenGL:{ShaderReplacements:[['vec3','vClipPlaneNormals'],['float','vClipPlaneDistances'],['vec3','vClipPlaneOrigins']].map(([type,name])=>({
      shaderType:'Fragment',replaceFirst:false,replaceAll:true,
      originalValue:`uniform ${type} ${name}\\[6\\];`,replacementValue:`uniform ${type} ${name}[7];`,
    }))}})
    const oldPlanes=[...mapper.getClippingPlanes()]
    mapper.removeAllClippingPlanes()
    for(const spec of clippingPlanes(geometry,volumeStyle)){
      const plane=vtkPlane.newInstance();plane.setOrigin(...spec.origin);plane.setNormal(...spec.normal);mapper.addClippingPlane(plane)
    }
    for(const plane of oldPlanes)plane.delete()
    ;(getViewport() as core.BaseVolumeViewport).setSampleDistanceMultiplier(volumeStyle.quality)
    getViewport()?.render()
  },[volumeStyle,range,mode,loading,version])

  useEffect(() => {
    const group = tools.ToolGroupManager.getToolGroup(groupId.current)
    if (!group || loading) return
    for (const ToolClass of toolClasses) if (ToolClass.toolName !== 'StackScroll') group.setToolPassive(ToolClass.toolName)
    const chosen = mode === 'volume' && tool!=='Pan' && tool!=='Zoom' ? 'TrackballRotate' : tool
    group.setToolActive(chosen, {bindings: [{mouseButton: tools.Enums.MouseBindings.Primary}]})
    group.setToolActive('Pan', {bindings: [{mouseButton: tools.Enums.MouseBindings.Auxiliary}]})
    group.setToolActive('Zoom', {bindings: [{mouseButton: tools.Enums.MouseBindings.Secondary}]})
  }, [tool, mode, loading, version])

  useEffect(() => {
    const viewport = getViewport()
    if (!viewport || loading || mode === 'volume') return
    ;(viewport as core.StackViewport).setProperties({voiRange: {lower: center - width / 2, upper: center + width / 2}, invert})
    viewport.render()
  }, [center, width, invert, loading, version])

  useEffect(()=>{
    if(loading||!['axial','coronal','sagittal'].includes(mode)||!volumeGeometry.current)return
    const viewport=getViewport() as core.VolumeViewport
    if(!viewport)return
    const geometry=volumeGeometry.current
    const thickness=Math.hypot(...geometry.dimensions.map((n,i)=>n*geometry.spacing[i]))
    const blend={slice:core.Enums.BlendModes.COMPOSITE,mip:core.Enums.BlendModes.MAXIMUM_INTENSITY_BLEND,minip:core.Enums.BlendModes.MINIMUM_INTENSITY_BLEND,aip:core.Enums.BlendModes.AVERAGE_INTENSITY_BLEND}[projection]
    viewport.setBlendMode(blend)
    if(projection==='slice')viewport.resetSlabThickness()
    else viewport.setSlabThickness(thickness)
    viewport.render()
  },[projection,mode,loading,version])

  async function navigate(n: number) {
    if (loading || !count) return
    const target = Math.max(0, Math.min(count - 1, n))
    try {
      if (mode === 'stack') await (getViewport() as core.StackViewport).setImageIdIndex(target)
      else if (mode !== 'volume') core.utilities.scroll(getViewport()!, {delta: target - index, volumeId: volumeId.current})
      setIndex(target); getViewport()?.render()
    } catch (error) { setError(String(error)); setPlaying(false) }
  }
  useEffect(() => {
    if (!playing || mode !== 'stack') return
    const interval = setInterval(() => { const viewport = getViewport() as core.StackViewport; if (viewport) void navigate((viewport.getCurrentImageIdIndex() + 1) % count) }, 100)
    return () => clearInterval(interval)
  }, [playing, count, mode])
  async function exportImage() {
    const canvas = element.current?.querySelector('canvas')
    if (!canvas) return
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) { setError('Image export failed.'); return }
    if (window.medvision) await window.medvision.save('MedVision-image.png', await blob.arrayBuffer())
    else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'MedVision-image.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  }
  function transform(kind: string) {
    const viewport = getViewport()
    if (!viewport) return
    if (kind === 'rotate') { cameraRotation.current += 90; viewport.setCamera({rotation: cameraRotation.current}) }
    if (kind === 'horizontal') viewport.setCamera({flipHorizontal: !viewport.getCamera().flipHorizontal})
    if (kind === 'vertical') viewport.setCamera({flipVertical: !viewport.getCamera().flipVertical})
    if (kind === 'reset') { viewport.resetCamera(); cameraRotation.current = 0 }
    viewport.render()
  }
  return <section className={`viewport ${active ? 'active' : ''}`} onPointerDown={onActive}>
    <div className="viewport-label"><span>{series.modality} · {mode.toUpperCase()}</span><span>{series.description || 'Unnamed series'}</span></div>
    <div className="render-surface" ref={element} onContextMenu={e => e.preventDefault()}/>
    {loading && <div className="viewport-message">Loading local image data…</div>}
    {error && <div className="viewport-message error" role="alert">{error}</div>}
    {mode==='volume'&&!loading&&!error&&<VolumeControls style={volumeStyle} range={range} onChange={setVolumeStyle} onReset={()=>setVolumeStyle(defaultVolumeStyle(series.modality))}/>}
    <div className="viewport-controls">
      <span className="text-xs text-slate-400">{count ? `${index + 1} / ${count}` : '—'}</span>
      {mode !== 'volume' && <input aria-label="Slice" type="range" min={0} max={Math.max(0, count - 1)} value={index} disabled={mode!=='stack'&&projection!=='slice'} onChange={e => void navigate(Number(e.target.value))}/>}
      {mode === 'stack' && <Button size="icon" variant="ghost" title="Cine (10 fps)" onClick={() => setPlaying(!playing)} disabled={loading}>{playing ? <Pause size={15}/> : <Play size={15}/>}</Button>}
      <Button size="icon" variant="ghost" title="Rotate 90°" onClick={() => transform('rotate')}><RotateCw size={15}/></Button>
      <Button size="icon" variant="ghost" title="Flip horizontal" onClick={() => transform('horizontal')}><FlipHorizontal size={15}/></Button>
      <Button size="icon" variant="ghost" title="Flip vertical" onClick={() => transform('vertical')}><FlipVertical size={15}/></Button>
      <Button size="icon" variant="ghost" title="Reset view" onClick={() => transform('reset')}><RotateCcw size={15}/></Button>
      <Button size="icon" variant="ghost" title="Export PNG" onClick={() => void exportImage()}><Download size={15}/></Button>
    </div>
  </section>
}
