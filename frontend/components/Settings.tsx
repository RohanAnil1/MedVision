import {useEffect,useState} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {FolderOpen,X} from 'lucide-react'
import {Button} from './ui/button'
import {json} from '../lib/api'
import type {components} from '../lib/generated-api'

export function Settings({onClose}:{onClose:()=>void}){
  const [path,setPath]=useState(''),[saved,setSaved]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{let disposed=false;json<components['schemas']['SettingsResponse']>('/settings').then(settings=>{if(!disposed){setPath(settings.storage_path);setSaved(settings.storage_path)}}).catch(error=>{if(!disposed)setError(String(error))});return()=>{disposed=true}},[])
  async function select(){try{const chosen=await window.medvision?.chooseStorage();if(chosen)setPath(chosen)}catch(error){setError(String(error))}}
  async function save(){setBusy(true);setError('');try{const result=await json<{storage_path:string}>('/settings/storage',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})});setPath(result.storage_path);setSaved(result.storage_path)}catch(error){setError(error instanceof Error?error.message:String(error))}finally{setBusy(false)}}
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose()}}><Dialog.Portal><Dialog.Overlay className="settings-overlay"/><Dialog.Content className="settings-dialog"><div className="flex justify-between items-center"><Dialog.Title className="text-lg text-slate-100">Local workstation settings</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close settings"><X size={17}/></Button></Dialog.Close></div>
    <Dialog.Description className="text-sm text-slate-400 mt-3 mb-5">Choose where new studies are stored on this computer. Existing studies stay in their current folders and remain in the archive.</Dialog.Description>
    <label htmlFor="study-storage-path" className="mb-2">Study storage folder</label><input id="study-storage-path" aria-label="Study storage folder" className="storage-path" value={path} onChange={e=>setPath(e.target.value)} placeholder="Absolute local folder path"/>
    <div className="flex gap-2 mt-3">{window.medvision&&<Button onClick={()=>void select()}><FolderOpen size={15}/> Choose folder</Button>}<Button variant="default" onClick={()=>void save()} disabled={busy||!path||path===saved}>{busy?'Saving…':'Save storage location'}</Button></div>
    <p className="text-xs text-slate-500 mt-4">Archive index and measurements stay in the application data folder. Network connectivity remains disabled.</p>{path===saved&&saved&&<p role="status" className="text-xs text-teal-400 mt-3">Storage location saved</p>}{error&&<p role="alert" className="text-sm text-red-300 mt-3">{error}</p>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}
