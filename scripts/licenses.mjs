import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
const root=process.cwd()
const entries=[]
async function packages(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    if(!entry.isDirectory()||entry.name.startsWith('.'))continue
    const location=path.join(directory,entry.name)
    if(entry.name.startsWith('@')) {await packages(location);continue}
    try {
      const pkg=JSON.parse(await readFile(path.join(location,'package.json'),'utf8'))
      const licenses=(await readdir(location)).filter(name=>/^(license|licence|copying|notice)(\.|$)/i.test(name))
      entries.push({name:pkg.name,version:pkg.version,license:pkg.license||'UNKNOWN',licenseFiles:licenses.map(name=>path.relative(root,path.join(location,name)).replaceAll('\\','/'))})
    }catch{}
    try{await packages(path.join(location,'node_modules'))}catch{}
  }
}
await packages(path.join(root,'node_modules'))
entries.sort((a,b)=>a.name.localeCompare(b.name))
await mkdir('docs',{recursive:true})
await writeFile('docs/javascript-licenses.json',JSON.stringify(entries,null,2)+'\n')
console.log(`Recorded ${entries.length} JavaScript dependency license declarations; publisher review remains required.`)
