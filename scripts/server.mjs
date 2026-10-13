import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' }
const equal = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
export function serveFrontend(root, token, bootstrapCode) {
  const cookie = crypto.randomBytes(32).toString('hex')
  let bootstrapUsed = false
  const absoluteRoot = path.resolve(root)
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: http://127.0.0.1:8000; connect-src 'self' http://127.0.0.1:8000; worker-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
    if (req.headers.host !== '127.0.0.1:3000') { res.writeHead(403).end(); return }
    const url = new URL(req.url, 'http://127.0.0.1:3000')
    if (url.pathname === '/bootstrap' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) {
        body += chunk.toString()
        if (body.length > 256) { res.writeHead(413).end(); return }
      }
      const code = new URLSearchParams(body).get('code')
      if (!bootstrapCode || bootstrapUsed || !equal(code, bootstrapCode)) { res.writeHead(403).end(); return }
      bootstrapUsed = true
      res.writeHead(303, { 'Set-Cookie': `medvision_session=${cookie}; HttpOnly; SameSite=Strict; Path=/`, Location: '/' }).end()
      return
    }
    if (url.pathname === '/session') {
      const supplied = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('medvision_session='))?.slice('medvision_session='.length)
      if (req.method !== 'GET' || req.headers['sec-fetch-site'] !== 'same-origin' || !equal(supplied, cookie)) { res.writeHead(401).end(); return }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ token }))
      return
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return }
    try {
      let pathname = decodeURIComponent(url.pathname)
      if (pathname.includes('\0') || pathname.includes('\\')) { res.writeHead(400).end(); return }
      let target = path.resolve(absoluteRoot, '.' + pathname)
      if (target !== absoluteRoot && !target.startsWith(absoluteRoot + path.sep)) { res.writeHead(403).end(); return }
      if (pathname === '/') target = path.join(absoluteRoot, 'index.html')
      if (!(await stat(target)).isFile()) { res.writeHead(404).end(); return }
      const data = await readFile(target)
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' })
      res.end(req.method === 'HEAD' ? undefined : data)
    } catch { res.writeHead(404).end() }
  })
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(3000, '127.0.0.1', () => resolve(server)) })
}
