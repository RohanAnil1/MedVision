import { useEffect, useState } from 'react'
import { FileDown, Trash2 } from 'lucide-react'
import { json, request } from '../lib/api'
import { notifyMeasurements, type SavedAnnotation } from '../lib/annotations'
import { tools } from '../lib/cornerstone'
import { Button } from './ui/button'

export function Measurements({seriesUID, onError}: {seriesUID:string;onError:(text:string)=>void}) {
  const [items,setItems]=useState<SavedAnnotation[]>([])
  useEffect(() => {
    let disposed=false
    const refresh=()=>json<SavedAnnotation[]>(`/series/${seriesUID}/annotations`).then(result=>{if(!disposed)setItems(result)}).catch(error=>{if(!disposed)onError(String(error))})
    void refresh()
    window.addEventListener('medvision:measurements',refresh)
    return()=>{disposed=true;window.removeEventListener('medvision:measurements',refresh)}
  },[seriesUID])
  async function remove(id:string) {
    try {await json(`/annotations/${id}`,{method:'DELETE'});tools.annotation.state.removeAnnotation(id);notifyMeasurements()} catch(error){onError(String(error))}
  }
  async function exportFile(format:'csv'|'json'|'pdf') {
    try {
      const response=await request(`/series/${seriesUID}/exports/measurements?format=${format}`)
      const bytes=await response.arrayBuffer()
      const name=format==='pdf'?'MedVision-report.pdf':`MedVision-measurements.${format}`
      if(window.medvision) await window.medvision.save(name,bytes)
      else {const url=URL.createObjectURL(new Blob([bytes],{type:response.headers.get('Content-Type')!}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
    } catch(error){onError(String(error))}
  }
  return <aside className="measurement-panel"><div className="section-heading">SAVED MEASUREMENTS <span>{items.length}</span></div><p className="px-4 text-xs text-slate-500 mb-3">Draw on a 2D stack. Saved values use the referenced image calibration.</p>
    <div className="flex gap-1 px-3 mb-3">{(['csv','json','pdf'] as const).map(format=><Button key={format} onClick={()=>void exportFile(format)}><FileDown size={13}/>{format.toUpperCase()}</Button>)}</div>
    {items.map(item=><div className="measurement-item" key={item.id}><div className="flex items-center justify-between"><strong>{item.tool} · frame {item.frame+1}</strong><Button variant="ghost" size="icon" title="Delete measurement" onClick={()=>void remove(item.id)}><Trash2 size={13}/></Button></div>{Object.entries(item.result).filter(([key])=>['length','angle','area','mean','std','min','max'].includes(key)).map(([key,value])=><div key={key}><span>{key}</span><span>{typeof value==='number'?value.toFixed(2):value} {key==='length'?item.units:key==='angle'?'°':key==='area'?`${item.units}²`:''}</span></div>)}</div>)}
    {!items.length&&<p className="p-4 text-xs text-slate-500">No saved measurements in this series.</p>}
  </aside>
}
