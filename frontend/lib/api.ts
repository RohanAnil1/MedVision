export const API = 'http://127.0.0.1:8000'
let session = ''
export function setSession(token: string) { session = token }
export function getSession() { return session }
export async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session}`)
  const response = await fetch(`${API}/api/v1${path}`, { ...options, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : `Local API error ${response.status}`)
  }
  return response
}
export async function json<T>(path: string, options?: RequestInit): Promise<T> { return (await request(path, options)).json() }
export interface Series { series_uid: string; description: string; modality: string; instance_count: number; frame_count: number; first_instance_id: string }
export interface Study { study_uid: string; patient_name: string; patient_id: string; study_date: string; study_description: string; instance_count: number; series: Series[] }
export interface Instance { id: string; series_uid: string; sop_uid: string; frames: number; instance_number: number; rows: number; columns: number; spacing: number[] | null; position: number[] | null; orientation: number[] | null }
export interface Job { id: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'; progress: number; error: string | null; result: { imported: number; duplicates: number; errors: {file: string; message: string}[] } | null }
declare global { interface Window { medvision?: { session: () => Promise<string>; save: (name: string, bytes: ArrayBuffer) => Promise<boolean> } } }
