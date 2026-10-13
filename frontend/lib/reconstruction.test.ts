import {test,expect} from 'vitest'
import {obliqueGrid} from './reconstruction'
test('oblique basis stays orthonormal and centered in patient space',()=>{
  const geometry={dimensions:[8,6,5] as [number,number,number],spacing:[3,2,4] as [number,number,number],origin:[10,20,30] as [number,number,number],direction:[1,0,0,0,1,0,0,0,1],frame_of_reference_uid:'phantom',reconstruction:{plane:'axial' as const,origin:[10,20,30] as [number,number,number],u:[1,0,0] as [number,number,number],v:[0,1,0] as [number,number,number],normal_axis:2,rows:6,columns:8,spacing:[2,3] as [number,number],slice_count:5,slice_spacing:4}}
  const grid=obliqueGrid(geometry,37,61,0)
  expect(Math.hypot(...grid.u)).toBeCloseTo(1,12)
  expect(Math.hypot(...grid.v)).toBeCloseTo(1,12)
  expect(grid.u.reduce((sum,value,i)=>sum+value*grid.v[i],0)).toBeCloseTo(0,12)
  const center=grid.origin.map((p,i)=>p+grid.u[i]*grid.fov/2+grid.v[i]*grid.fov/2)
  expect(center).toEqual([20.5,25,38])
})
