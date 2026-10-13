import {useEffect,useRef,useState} from 'react'
import {request,json,type Series} from '../lib/api'
import {useViewer,type Mode} from '../lib/store'
import {obliqueGrid,type ReconstructionGeometry} from '../lib/reconstruction'
import {Button} from './ui/button'
import {Download} from 'lucide-react'

export function Reconstruction({series,mode,active,onActive}:{series:Series;mode:Mode;active:boolean;onActive:()=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null)
  const container=useRef<HTMLDivElement>(null)
  const bitmap=useRef<ImageBitmap>()
  const pixelSpacing=useRef<[number,number]>([1,1])
  const [geometry,setGeometry]=useState<ReconstructionGeometry>()
  const [index,setIndex]=useState(0)
  const [yaw,setYaw]=useState(0),[pitch,setPitch]=useState(0),[offset,setOffset]=useState(0)
  const [error,setError]=useState(''),[loading,setLoading]=useState(true)
  const {center,width,invert,projection}=useViewer()
  const invertRef=useRef(invert);invertRef.current=invert
  function draw(){
    const source=bitmap.current, target=canvas.current, parent=container.current
    if(!source||!target||!parent)return
    target.width=Math.max(1,Math.round(parent.clientWidth*devicePixelRatio));target.height=Math.max(1,Math.round(parent.clientHeight*devicePixelRatio))
    const ctx=target.getContext('2d')!
    ctx.fillStyle='black';ctx.fillRect(0,0,target.width,target.height)
    const physicalWidth=source.width*pixelSpacing.current[1],physicalHeight=source.height*pixelSpacing.current[0]
    const scale=Math.min(target.width/physicalWidth,target.height/physicalHeight)
    ctx.filter=invertRef.current?'invert(1)':'none'
    ctx.drawImage(source,(target.width-physicalWidth*scale)/2,(target.height-physicalHeight*scale)/2,physicalWidth*scale,physicalHeight*scale)
    ctx.filter='none'
  }
  useEffect(()=>{
    const controller=new AbortController()
    bitmap.current?.close();bitmap.current=undefined
    const ctx=canvas.current?.getContext('2d');if(ctx&&canvas.current)ctx.clearRect(0,0,canvas.current.width,canvas.current.height)
    setGeometry(undefined);setIndex(0);setLoading(true);setError('')
    json<ReconstructionGeometry>(`/series/${series.series_uid}/geometry?plane=${mode==='oblique'?'axial':mode}`,{signal:controller.signal})
      .then(result=>{setGeometry(result);setIndex(Math.floor(result.reconstruction.slice_count/2))})
      .catch(error=>{if(!controller.signal.aborted){setError(String(error));setLoading(false)}})
    return()=>controller.abort()
  },[series.series_uid,mode])
  useEffect(()=>{
    if(!geometry)return
    const controller=new AbortController()
    setLoading(true);setError('')
    const timer=setTimeout(async()=>{
      try{
        let response:Response
        if(mode==='oblique'){
          const grid=obliqueGrid(geometry,yaw,pitch,offset)
          pixelSpacing.current=grid.spacing
          response=await request(`/series/${series.series_uid}/oblique`,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({...grid,center,width})})
        }else{
          pixelSpacing.current=geometry.reconstruction.spacing
          response=await request(`/series/${series.series_uid}/reconstruction?plane=${mode}&index=${index}&projection=${projection}&center=${center}&width=${width}`,{signal:controller.signal})
        }
        const image=await createImageBitmap(await response.blob())
        if(controller.signal.aborted){image.close();return}
        bitmap.current?.close();bitmap.current=image;draw();setLoading(false)
      }catch(error){if(!controller.signal.aborted){setError(String(error));setLoading(false)}}
    },120)
    return()=>{clearTimeout(timer);controller.abort()}
  },[geometry,index,mode,projection,center,width,yaw,pitch,offset])
  useEffect(()=>{draw()},[invert])
  useEffect(()=>{const observer=new ResizeObserver(draw);if(container.current)observer.observe(container.current);return()=>{observer.disconnect();bitmap.current?.close();bitmap.current=undefined}},[])
  async function exportImage(){
    const blob=await new Promise<Blob|null>(resolve=>canvas.current?.toBlob(resolve,'image/png'))
    if(!blob)return
    if(window.medvision)await window.medvision.save('MedVision-reconstruction.png',await blob.arrayBuffer())
    else{const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='MedVision-reconstruction.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  }
  return <section className={`viewport ${active?'active':''}`} onPointerDown={onActive}>
    <div className="viewport-label"><span>{series.modality} · {mode.toUpperCase()} · LOCAL CPU{mode==='oblique'?'':` · ${projection.toUpperCase()}`}</span><span>{series.description}</span></div>
    <div className="render-surface" ref={container}><canvas ref={canvas} style={{width:'100%',height:'100%'}}/></div>
    {loading&&<div className="viewport-message">Loading local image data…</div>}{error&&<div className="viewport-message error" role="alert">{error}</div>}
    {mode==='oblique'&&<div className="oblique-controls"><label>Yaw °<input aria-label="Oblique yaw" type="number" min={-180} max={180} value={yaw} onChange={e=>setYaw(Number(e.target.value))}/></label><label>Pitch °<input aria-label="Oblique pitch" type="number" min={-90} max={90} value={pitch} onChange={e=>setPitch(Number(e.target.value))}/></label><label>Offset mm<input aria-label="Oblique offset" type="number" value={offset} onChange={e=>setOffset(Number(e.target.value))}/></label><Button onClick={()=>{setYaw(0);setPitch(0);setOffset(0)}}>Reset plane</Button></div>}
    <div className="viewport-controls"><span className="text-xs text-slate-400">{mode==='oblique'?'Patient LPS plane':`${index+1} / ${geometry?.reconstruction.slice_count||0}`}</span>{mode!=='oblique'&&<input aria-label="Slice" type="range" min={0} max={Math.max(0,(geometry?.reconstruction.slice_count||1)-1)} value={index} onChange={e=>setIndex(Number(e.target.value))} disabled={projection!=='slice'}/>}<span className="flex-1"/><Button size="icon" variant="ghost" title="Export PNG" onClick={()=>void exportImage()} disabled={loading||!!error}><Download size={15}/></Button></div>
  </section>
}
