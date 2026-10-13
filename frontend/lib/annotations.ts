import { core, tools } from './cornerstone'
import { json, type Instance } from './api'

export interface SavedAnnotation {
  id: string; series_uid: string; instance_id: string; frame: number; tool: string
  points: number[][]; units: 'mm' | 'pixels'; text: string
  state: tools.Types.Annotation | null
  result: Record<string, string | number>
}
const mapping: Record<string, string> = {Length:'length',Angle:'angle',CobbAngle:'cobb',RectangleROI:'rectangle',EllipticalROI:'ellipse',PlanarFreehandROI:'polygon'}
export const notifyMeasurements = () => window.dispatchEvent(new Event('medvision:measurements'))

export async function restoreAnnotations(seriesUID: string, element: HTMLDivElement) {
  const saved = await json<SavedAnnotation[]>(`/series/${seriesUID}/annotations`)
  for (const item of saved) {
    if (item.state && !tools.annotation.state.getAnnotation(item.id)) {
      const state = structuredClone(item.state)
      state.annotationUID = item.id
      state.invalidated = true
      tools.annotation.state.addAnnotation(state, element)
    }
  }
}

export function watchAnnotations(seriesUID: string, frames: {instance: Instance; frame: number}[], onError: (message: string) => void) {
  let disposed = false
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const seriesInstances = new Map(frames.map(f => [f.instance.id, f.instance]))
  function annotationFrom(event: Event) {return (event as CustomEvent<{annotation?: tools.Types.Annotation}>).detail.annotation}
  async function save(item: tools.Types.Annotation) {
    const match = item.metadata?.referencedImageId?.match(/\/instances\/([a-f0-9]{32})\/dicom\?frame=(\d+)/)
    if (!match || !item.annotationUID || !item.metadata) return
    const instance = seriesInstances.get(match[1])
    if (!instance) return
    const tool = mapping[item.metadata.toolName]
    const points = tool === 'polygon' ? item.data.contour?.polyline : item.data.handles?.points
    if (!tool || !points?.length) return
    const metadata = {...item.metadata}
    delete metadata.enabledElement
    const state: tools.Types.Annotation = {
      annotationUID: item.annotationUID, metadata,
      data: {handles: item.data.handles, contour: item.data.contour ? {polyline:item.data.contour.polyline,closed:item.data.contour.closed} : undefined, label:item.data.label},
    }
    try {
      await json(`/annotations/${item.annotationUID}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        id:item.annotationUID, series_uid:seriesUID, instance_id:instance.id, frame:Number(match[2])-1, tool, points,
        units:instance.spacing ? 'mm' : 'pixels', text:item.data.label || '', state,
      })})
      if (!disposed) notifyMeasurements()
    } catch (error) {if (!disposed) onError(`Measurement could not be saved: ${error instanceof Error ? error.message : String(error)}`)}
  }
  function changed(event: Event) {
    const item = annotationFrom(event)
    if (!item?.annotationUID) return
    clearTimeout(timers.get(item.annotationUID))
    timers.set(item.annotationUID, setTimeout(() => {timers.delete(item.annotationUID!);void save(item)}, 200))
  }
  core.eventTarget.addEventListener(tools.Enums.Events.ANNOTATION_COMPLETED, changed)
  core.eventTarget.addEventListener(tools.Enums.Events.ANNOTATION_MODIFIED, changed)
  return () => {
    disposed = true
    for (const timer of timers.values()) clearTimeout(timer)
    core.eventTarget.removeEventListener(tools.Enums.Events.ANNOTATION_COMPLETED, changed)
    core.eventTarget.removeEventListener(tools.Enums.Events.ANNOTATION_MODIFIED, changed)
  }
}
