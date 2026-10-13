import * as core from '@cornerstonejs/core'
import * as tools from '@cornerstonejs/tools'
import dicomLoader from '@cornerstonejs/dicom-image-loader'
import { API, getSession } from './api'

let initialization: Promise<void> | undefined
export const toolClasses = [tools.WindowLevelTool, tools.PanTool, tools.ZoomTool, tools.LengthTool, tools.AngleTool, tools.CobbAngleTool, tools.RectangleROITool, tools.EllipticalROITool, tools.PlanarFreehandROITool, tools.StackScrollTool, tools.TrackballRotateTool]
export function initializeImaging() {
  return initialization ??= (async () => {
    await core.init()
    tools.init()
    dicomLoader.init({ maxWebWorkers: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)), useLegacyMetadataProvider: true,
      beforeSend: () => ({ Authorization: `Bearer ${getSession()}` }),
    })
    for (const ToolClass of toolClasses) tools.addTool(ToolClass)
    core.cache.setMaxCacheSize(512 * 1024 * 1024)
  })()
}
export const imageId = (id: string, frame = 0) => `wadouri:${API}/api/v1/instances/${id}/dicom?frame=${frame + 1}`
export { core, tools }
