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
export type Series = components['schemas']['SeriesResponse']
export type Study = components['schemas']['StudyResponse']
export type Instance = components['schemas']['InstanceResponse']
export type Job = components['schemas']['JobResponse']
declare global { interface Window { medvision?: { session: () => Promise<string>; save: (name: string, bytes: ArrayBuffer) => Promise<boolean>; chooseStorage:()=>Promise<string|null> } } }
import type { components } from './generated-api'
