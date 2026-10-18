// Local test infrastructure only: streaming round-robin proxy, fixed loopback destinations.
import http from 'node:http'

const port=Number(process.argv[2])
const backends=process.argv.slice(3).map(value=>new URL(value))
if (!Number.isInteger(port) || port<1024 || backends.length!==2 || backends.some(url=>url.protocol!=='http:' || url.hostname!=='127.0.0.1')) throw new Error('Loopback scale endpoints required')
const agents=backends.map(()=>new http.Agent({keepAlive:true,maxSockets:64}))
let next=0
const server=http.createServer((request,response)=>{
  request.socket.setNoDelay(true)
  if (!request.url?.startsWith('/') || request.url.startsWith('//')) { response.writeHead(400);response.end();return }
  const replica=next++%backends.length
  const backend=backends[replica]
  const upstream=http.request({hostname:'127.0.0.1',port:Number(backend.port),method:request.method,path:request.url,
    headers:{...request.headers,host:backend.host},agent:agents[replica],timeout:30000},incoming=>{
      response.writeHead(incoming.statusCode||502,{...incoming.headers,'X-Replica':String(replica)})
      incoming.pipe(response)
    })
  upstream.on('socket',socket=>socket.setNoDelay(true))
  upstream.on('timeout',()=>upstream.destroy())
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end()})
  request.on('aborted',()=>upstream.destroy())
  request.pipe(upstream)
})
server.listen(port,'127.0.0.1')
process.on('SIGTERM',()=>{server.close();agents.forEach(agent=>agent.destroy())})
