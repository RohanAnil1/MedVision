import { create } from 'zustand'

export type Mode = 'stack' | 'axial' | 'coronal' | 'sagittal' | 'volume'
export type Tool = 'WindowLevel' | 'Pan' | 'Zoom' | 'Length' | 'Angle' | 'CobbAngle' | 'RectangleROI' | 'EllipticalROI' | 'PlanarFreehandROI' | 'TrackballRotate'
interface State {
  tool: Tool; center: number; width: number; invert: boolean; cpu: boolean
  setTool: (tool: Tool) => void; setWindow: (center: number, width: number) => void
  setInvert: (invert: boolean) => void; setCPU: (cpu: boolean) => void
}
export const useViewer = create<State>(set => ({
  tool: 'WindowLevel', center: 40, width: 400, invert: false, cpu: false,
  setTool: tool => set({tool}), setWindow: (center, width) => set({center, width}),
  setInvert: invert => set({invert}), setCPU: cpu => set({cpu}),
}))
