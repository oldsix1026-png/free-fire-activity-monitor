import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
http.createServer((req,res)=>{
 const urlPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const target=path.resolve(root,'.'+(urlPath==='/'?'/index.html':urlPath));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(target,(err,bytes)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':target.endsWith('.json')?'application/json; charset=utf-8':target.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);});
}).listen(4317,'127.0.0.1',()=>console.log('Free Fire dashboard: http://127.0.0.1:4317'));
