import {readFile,writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const destination=fileURLToPath(new URL('../.env',import.meta.url));
try{await access(destination);console.log('.env already exists; no values were overwritten.');}
catch{let template=await readFile(new URL('../.env.example',import.meta.url),'utf8');template=template.replace(/^SESSION_SECRET=$/m,`SESSION_SECRET=${randomBytes(32).toString('hex')}`).replace(/^ASSESSOR_PASSWORD=$/m,`ASSESSOR_PASSWORD=${randomBytes(18).toString('base64url')}`).replace(/^MODEL_SERVICE_TOKEN=$/m,`MODEL_SERVICE_TOKEN=${randomBytes(32).toString('hex')}`);await writeFile(destination,template,{flag:'wx',mode:0o600});console.log('Created ignored .env with generated session, assessor, and service credentials. Add your Atlas URI and hosted API keys. Secrets were not printed.');}
