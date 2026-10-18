// Extract application copy for the bundled translation catalogues. Does not read data/ or .env.
import ts from 'typescript';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const result=JSON.parse(await readFile('client/src/locales/en.json','utf8'));
function collect(source,file) {
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const visit=n=>{
  if(ts.isStringLiteral(n) && /[A-Za-z]{2}/.test(n.text) && (/\s/.test(n.text)||/^[A-Z][a-z]+$/.test(n.text)) && !/^https?:|^\/|^\./.test(n.text) && n.text.length<1600 && !/[{};]\s*(?:from|const|return)/.test(n.text))result[n.text]=n.text;
  ts.forEachChild(n,visit);
 };visit(ast);
}
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,item.name);if(item.isDirectory()){if(item.name!=='locales')await walk(f);}else if(/\.tsx?$/.test(f))collect(await readFile(f,'utf8'),f);}}
await walk('client/src');
for(const file of ['shared/entrepreneur-guide.ts','shared/business-review.ts','shared/repair-questions.ts','shared/input-rules.ts','server/src/domain/assessment.ts','server/src/domain/decision-support.ts','server/src/providers/quota.ts','server/src/providers/cloud.ts'])collect(await readFile(file,'utf8'),file);
await writeFile('client/src/locales/en.json',JSON.stringify(Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b))),null,2)+'\n');
console.log(JSON.stringify({staticMessages:Object.keys(result).length}));
