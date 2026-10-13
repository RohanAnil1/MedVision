import type {components} from './generated-api'
export type ReconstructionGeometry=components['schemas']['VolumeGeometryResponse']
export function obliqueGrid(geometry: ReconstructionGeometry, yawDegrees: number, pitchDegrees: number, offset: number) {
  const yaw=yawDegrees*Math.PI/180, pitch=pitchDegrees*Math.PI/180
  const u=[Math.cos(yaw),Math.sin(yaw),0]
  const v=[-Math.sin(yaw)*Math.cos(pitch),Math.cos(yaw)*Math.cos(pitch),Math.sin(pitch)]
  const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
  const lengths=geometry.dimensions.map((n,i)=>(n-1)*geometry.spacing[i])
  const fov=Math.max(1,Math.hypot(...lengths))
  const center=geometry.origin.map((p,i)=>p+lengths.reduce((sum,l,j)=>sum+l/2*geometry.direction[j*3+i],0))
  const origin=center.map((p,i)=>p+normal[i]*offset-u[i]*fov/2-v[i]*fov/2)
  return {origin,u,v,rows:256,columns:256,spacing:[fov/255,fov/255] as [number,number],fov}
}
