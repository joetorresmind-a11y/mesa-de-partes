import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../docs/',import.meta.url));
const port=Number(process.env.PORT||8787);
createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  let path=decodeURIComponent(url.pathname);
  // /repositorio/ mirrors a GitHub Pages repository path for local verification.
  if(path.startsWith('/repositorio/')) path=path.slice('/repositorio'.length);
  const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end();return}
  const body=await readFile(file);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Página no encontrada')}
}).listen(port,'127.0.0.1',()=>console.log('Mesa de Partes disponible en http://127.0.0.1:'+port));
