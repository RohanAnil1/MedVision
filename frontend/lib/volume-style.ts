export type Vec3=[number,number,number]
export interface SpatialVolume {origin:Vec3;spacing:Vec3;dimensions:Vec3;direction:ArrayLike<number>}
export type CropBounds=[number,number,number,number,number,number]
export interface VolumeStyle {
  preset:'bone'|'soft'|'grayscale'; threshold:number; opacity:number; shade:boolean; quality:number
  crop:CropBounds; clip:boolean; clipYaw:number; clipPitch:number; clipOffset:number; clipReverse:boolean
}
export interface PlaneSpec {origin:Vec3;normal:Vec3}
export function defaultVolumeStyle(modality:string):VolumeStyle {
  return {preset:modality==='CT'?'bone':'grayscale',threshold:modality==='CT'?100:0,opacity:0.8,shade:true,quality:1,
    crop:[0,100,0,100,0,100],clip:false,clipYaw:0,clipPitch:0,clipOffset:0,clipReverse:false}
}
export function scalarRange(data:Float32Array):[number,number] {
  let min=Infinity,max=-Infinity
  for(const value of data){if(!Number.isFinite(value))throw new Error('Volume contains non-finite scalar values.');min=Math.min(min,value);max=Math.max(max,value)}
  if(min===Infinity)throw new Error('Volume has no pixels.')
  return [min,max===min?min+1:max]
}
export function transferNodes(range:[number,number],style:VolumeStyle) {
  const [min,max]=range
  const threshold=Math.max(min,Math.min(max-1e-6,style.threshold))
  const colors:Vec3[]=style.preset==='bone'?[[0.55,0.25,0.12],[0.95,0.8,0.6],[1,1,1]]:style.preset==='soft'?[[0.25,0.08,0.1],[0.85,0.45,0.35],[1,0.85,0.75]]:[[0,0,0],[0.65,0.65,0.65],[1,1,1]]
  const mid=(threshold+max)/2
  return {rgb:[[min,0,0,0],[threshold,...colors[0]],[mid,...colors[1]],[max,...colors[2]]],
    opacity:[[min,0],[threshold,0],[mid,style.opacity*0.4],[max,style.opacity]]}
}
export function clippingPlanes(geometry:SpatialVolume,style:VolumeStyle):PlaneSpec[] {
  const planes:PlaneSpec[]=[]
  for(let axis=0;axis<3;axis++){
    const lo=style.crop[axis*2],hi=style.crop[axis*2+1]
    if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo<0||hi>100||lo>=hi)throw new Error('Crop bounds must have a nonzero range within 0–100%.')
    const vector=[0,1,2].map(i=>geometry.direction[axis*3+i]) as Vec3
    for(const [fraction,sign,enabled] of [[lo/100,1,lo>0],[hi/100,-1,hi<100]] as const){
      if(!enabled)continue
      // Bounds describe voxel cells, retaining half a voxel beyond the first/last centers.
      const distance=(geometry.dimensions[axis]*fraction-0.5)*geometry.spacing[axis]
      planes.push({origin:geometry.origin.map((p,i)=>p+vector[i]*distance) as Vec3,normal:vector.map(p=>p*sign) as Vec3})
    }
  }
  if(style.clip){
    const yaw=style.clipYaw*Math.PI/180,pitch=style.clipPitch*Math.PI/180
    const normal:Vec3=[Math.cos(yaw)*Math.cos(pitch),Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch)]
    const lengths=geometry.dimensions.map((n,i)=>(n-1)*geometry.spacing[i])
    const center=geometry.origin.map((p,i)=>p+lengths.reduce((s,l,j)=>s+l/2*geometry.direction[j*3+i],0))
    const origin=center.map((p,i)=>p+normal[i]*style.clipOffset) as Vec3
    planes.push({origin,normal:normal.map(p=>p*(style.clipReverse?-1:1)) as Vec3})
  }
  return planes
}
