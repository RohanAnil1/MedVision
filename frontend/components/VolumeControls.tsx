import {useState} from 'react'
import {Button} from './ui/button'
import {type VolumeStyle,type CropBounds} from '../lib/volume-style'

export function VolumeControls({style,range,onChange,onReset}:{style:VolumeStyle;range:[number,number];onChange:(style:VolumeStyle)=>void;onReset:()=>void}) {
  const [expanded,setExpanded]=useState(true)
  const update=(values:Partial<VolumeStyle>)=>onChange({...style,...values})
  function crop(index:number,value:number){const bounds=[...style.crop] as CropBounds;bounds[index]=index%2===0?Math.min(value,bounds[index+1]-1):Math.max(value,bounds[index-1]+1);update({crop:bounds})}
  return <div className="volume-settings" onPointerDown={e=>e.stopPropagation()}>
    <div className="flex justify-between items-center"><strong>VOLUME DISPLAY</strong><Button variant="ghost" onClick={()=>setExpanded(!expanded)}>{expanded?'Hide controls':'Show controls'}</Button></div>
    {expanded&&<><label>Color preset<select aria-label="Volume color preset" value={style.preset} onChange={e=>update({preset:e.target.value as VolumeStyle['preset']})}><option value="bone">Bone tones</option><option value="soft">Soft tissue tones</option><option value="grayscale">Grayscale</option></select></label>
      <label>Threshold<input aria-label="Volume threshold" type="number" min={range[0]} max={range[1]} value={style.threshold} onChange={e=>update({threshold:Number(e.target.value)})}/></label>
      <label>Opacity<input aria-label="Volume opacity" type="range" min={0} max={1} step={0.01} value={style.opacity} onChange={e=>update({opacity:Number(e.target.value)})}/><span>{Math.round(style.opacity*100)}%</span></label>
      <label><input type="checkbox" checked={style.shade} onChange={e=>update({shade:e.target.checked})}/> Lighting</label>
      <label>Sampling<select aria-label="Volume sampling" value={style.quality} onChange={e=>update({quality:Number(e.target.value)})}><option value={1}>Full quality</option><option value={2}>Balanced</option><option value={4}>Fast interaction</option></select></label>
      <div className="volume-subheading">Crop along acquisition axes (%)</div>
      {['X','Y','Z'].map((axis,i)=><div className="crop-row" key={axis}><span>{axis}</span><input aria-label={`Crop ${axis} minimum`} type="number" min={0} max={99} value={style.crop[i*2]} onChange={e=>crop(i*2,Number(e.target.value))}/><span>to</span><input aria-label={`Crop ${axis} maximum`} type="number" min={1} max={100} value={style.crop[i*2+1]} onChange={e=>crop(i*2+1,Number(e.target.value))}/></div>)}
      <label><input aria-label="Enable volume clipping" type="checkbox" checked={style.clip} onChange={e=>update({clip:e.target.checked})}/> Clipping plane</label>
      {style.clip&&<><label>Yaw °<input aria-label="Clip yaw" type="number" value={style.clipYaw} min={-180} max={180} onChange={e=>update({clipYaw:Number(e.target.value)})}/></label><label>Pitch °<input aria-label="Clip pitch" type="number" value={style.clipPitch} min={-90} max={90} onChange={e=>update({clipPitch:Number(e.target.value)})}/></label><label>Offset mm<input aria-label="Clip offset" type="number" value={style.clipOffset} onChange={e=>update({clipOffset:Number(e.target.value)})}/></label><label><input aria-label="Reverse clipping" type="checkbox" checked={style.clipReverse} onChange={e=>update({clipReverse:e.target.checked})}/> Keep opposite side</label></>}
      <Button onClick={onReset}>Reset volume display</Button>
    </>}
  </div>
}
