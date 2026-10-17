import {createApp} from './app.js';
import {config} from './config.js';
import {connectDatabase} from './db.js';
import {bootstrapAssessor} from './auth.js';
import {startWorker,stopWorker} from './processing.js';
try{const connected=await connectDatabase();if(connected){await bootstrapAssessor();startWorker();console.log('MongoDB Atlas connected.');}else console.log('Atlas is not configured. Read-only examples are available.');}catch(error){console.error('Atlas initialization failed:',error instanceof Error?error.message:'Unknown error');}
const server=createApp().listen(config.PORT,'127.0.0.1',()=>console.log(`STRIVE API: http://localhost:${config.PORT}`));
process.on('SIGTERM',()=>{stopWorker();server.close();});
