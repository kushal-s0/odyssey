import { FIELD_KEYS,FIELD_LABELS,type Assessment,type EvidenceField,type FieldKey,type SourceSegment } from '../../../shared/types.js';
export const RUBRIC_VERSION = 'evidence-readiness-v1';
const rules:{key:string;label:string;weight:number;fields:FieldKey[]}[] = [
  {key:'clarity',label:'Clarity',weight:15,fields:['businessName','products','customers']},
  {key:'customer_need',label:'Customer need',weight:20,fields:['customers','problem','research']},
  {key:'market_potential',label:'Market potential',weight:15,fields:['customers','research','unitPrice','monthlyRevenue']},
  {key:'feasibility',label:'Feasibility',weight:25,fields:['materials','suppliers','investment','experience']},
  {key:'competition',label:'Competition',weight:10,fields:['competition','location']},
  {key:'differentiation',label:'Differentiation',weight:15,fields:['differentiation','competition']}
];
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function validateFields(raw:EvidenceField[],segments:SourceSegment[]):{fields:EvidenceField[];warnings:string[]} {
  const warnings:string[]=[];
  const ids = new Set(segments.map(s=>s.id));
  const fields = FIELD_KEYS.map(key=>{
    const item=raw.find(f=>f.key===key);
    if(!item || item.status==='missing') return {key,value:null,status:'missing' as const,evidenceIds:[],reason:'Not provided in the available evidence.'};
    const refs=[...new Set(item.evidenceIds)].filter(id=>ids.has(id));
    if(item.status!=='supported') return {key,value:null,status:item.status,evidenceIds:refs,reason:item.status==='ambiguous'?'The source contains conflicting or unclear answers. Please confirm.':'The response does not establish this business information.'};
    const value=item.value?.trim();
    const supported=!!value && refs.some(id=>{
      const s=segments.find(v=>v.id===id)!;
      return normalize(s.englishText).includes(normalize(value)) || normalize(s.originalText).includes(normalize(value));
    });
    if(!supported){warnings.push(`${FIELD_LABELS[key]} was withheld because its value could not be matched to cited source text.`);return {key,value:null,status:'missing' as const,evidenceIds:[],reason:'The proposed value did not pass source validation.'};}
    return {key,value:value!,status:'supported' as const,evidenceIds:refs,reason:'Quoted from the cited submission evidence; applicant-stated unless reviewed.'};
  });
  // Do not accidentally treat incompatible revenue values as a usable amount.
  return {fields,warnings};
}
export function assess(input:{fields:EvidenceField[];segments:SourceSegment[];language:string;providerModel:string;version?:number;warnings?:string[]}):Assessment {
  const checked=validateFields(input.fields,input.segments);
  const fields=checked.fields;
  const supported=(key:FieldKey)=>fields.find(f=>f.key===key && f.status==='supported');
  const dimensions=rules.map(rule=>{
    const provided=rule.fields.map(supported).filter((f):f is EvidenceField=>!!f);
    const refs=[...new Set(provided.flatMap(f=>f.evidenceIds))];
    const complete=provided.length===rule.fields.length;
    const score=provided.length===0?null:complete?3:Math.max(1,Math.round(provided.length/rule.fields.length*3));
    return {key:rule.key,label:rule.label,score,weight:rule.weight,evidenceIds:refs,explanation:provided.length===0?'Not assessable: no relevant information supplied.':`${provided.length} of ${rule.fields.length} evidence areas supplied. ${complete?'The proposal describes this dimension.':'Further information is needed.'} This rates the supporting information, not predicted business success.`};
  });
  const relevant:FieldKey[]=['businessName','products','customers','problem','location','materials','suppliers','investment','unitPrice','monthlyRevenue','research','competition','differentiation','experience'];
  const completeness=Math.round(relevant.filter(k=>supported(k)).length/relevant.length*100);
  const coverage=dimensions.reduce((sum,d)=>sum+(d.score===null?0:d.weight),0);
  const conflicts=fields.filter(f=>f.status==='ambiguous');
  const criticalConflict=conflicts.some(f=>['businessName','products','location','investment','monthlyRevenue'].includes(f.key));
  const score=coverage<70||criticalConflict?null:Math.round(dimensions.reduce((sum,d)=>sum+(d.score??0)/4*d.weight,0)/coverage*100);
  const priority:FieldKey[]=['businessName','products','customers','location','monthlyRevenue','investment','research','suppliers','competition','problem','differentiation','experience'];
  const needs=priority.map(key=>fields.find(f=>f.key===key)!).filter(f=>f.status!=='supported');
  needs.sort((a,b)=>(a.status==='ambiguous'?-1:0)-(b.status==='ambiguous'?-1:0));
  const questions=needs.slice(0,3).map(f=>({id:`repair-${input.version??1}-${f.key}`,field:f.key,question:f.status==='ambiguous'?`Please confirm ${FIELD_LABELS[f.key].toLowerCase()}. The source has conflicting or unclear values. If this is money, specify the amount, period, and whether it is sales, costs, or profit.`:`What can you tell us about ${FIELD_LABELS[f.key].toLowerCase()} for this business? Please provide specific details, or say if you do not know yet.`,reason:f.reason}));
  const warnings=[...(input.warnings??[]),...checked.warnings];
  if(input.segments.some(s=>!s.verified))warnings.push('Some source text is an AI transcription or translation and needs human verification.');
  return {version:input.version??1,createdAt:new Date().toISOString(),rubricVersion:RUBRIC_VERSION,fields,segments:input.segments,dimensions:[...dimensions,{key:'completeness',label:'Completeness',score:Math.round(completeness/25),weight:0,evidenceIds:[],explanation:`${completeness}% of the core information areas are supplied. Completeness is shown separately from the weighted assessment.`}],score,coverage,completeness,reviewRequired:criticalConflict||completeness<70||input.segments.some(s=>!s.verified),strengths:fields.filter(f=>f.status==='supported'&&relevant.includes(f.key)).slice(0,4).map(f=>`${FIELD_LABELS[f.key]} is described in the submission.`),gaps:needs.map(f=>`${FIELD_LABELS[f.key]}: ${f.reason}`),questions,warnings:[...new Set(warnings)],language:input.language,providerModel:input.providerModel,classifier:{status:'not_configured',flags:[]}};
}
export function cosine(a:number[],b:number[]):number {
  if(a.length!==b.length||!a.length||a.some(x=>!Number.isFinite(x))||b.some(x=>!Number.isFinite(x)))return 0;
  let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]!*b[i]!;aa+=a[i]!**2;bb+=b[i]!**2;}
  return aa&&bb?dot/Math.sqrt(aa*bb):0;
}
export const fieldValue=(a:Assessment|null,key:FieldKey)=>a?.fields.find(f=>f.key===key&&f.status==='supported')?.value??null;
