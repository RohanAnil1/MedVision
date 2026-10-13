import {test,expect} from 'vitest'
import {defaultVolumeStyle,clippingPlanes,scalarRange,transferNodes} from './volume-style'
test('cropping follows rotated acquisition axes in patient space',()=>{
  const style=defaultVolumeStyle('CT');style.crop=[50,100,0,75,0,100]
  const planes=clippingPlanes({origin:[10,20,30],spacing:[2,3,4],dimensions:[10,20,30],direction:[0,1,0,-1,0,0,0,0,1]},style)
  expect(planes).toEqual([{origin:[10,29,30],normal:[0,1,0]},{origin:[-33.5,20,30],normal:[1,-0,-0]}])
  const inside=[-10,35,35]
  for(const plane of planes)expect(inside.reduce((sum,p,i)=>sum+(p-plane.origin[i])*plane.normal[i],0)).toBeGreaterThan(0)
})
test('arbitrary clipping plane is centered and reversible',()=>{
  const style=defaultVolumeStyle('MR');style.clip=true;style.clipPitch=90;style.clipOffset=5
  const geometry={origin:[0,0,0] as [number,number,number],spacing:[1,1,1] as [number,number,number],dimensions:[11,21,31] as [number,number,number],direction:[1,0,0,0,1,0,0,0,1]}
  const plane=clippingPlanes(geometry,style)[0]
  expect(plane.origin[2]).toBeCloseTo(20)
  expect(plane.normal[2]).toBeCloseTo(1)
  style.clipReverse=true
  expect(clippingPlanes(geometry,style)[0].normal[2]).toBeCloseTo(-1)
})
test('transfer functions adapt to scalar range and opacity',()=>{
  const style=defaultVolumeStyle('MR');style.opacity=0.5
  const range=scalarRange(new Float32Array([-20,500,0,1000]))
  expect(range).toEqual([-20,1000])
  const nodes=transferNodes(range,style)
  expect(nodes.opacity.at(-1)).toEqual([1000,0.5])
  expect(nodes.rgb.at(-1)).toEqual([1000,1,1,1])
  expect(()=>scalarRange(new Float32Array([NaN]))).toThrow('non-finite')
  style.crop[0]=100
  expect(()=>clippingPlanes({origin:[0,0,0],spacing:[1,1,1],dimensions:[3,3,3],direction:[1,0,0,0,1,0,0,0,1]},style)).toThrow('nonzero')
})
