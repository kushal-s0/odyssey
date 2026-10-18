import type { Assessment, AssessorSupport, FieldKey, ScreeningSummary } from "../../../shared/types.js";
import { validateFields } from "./assessment.js";

export function screeningSummary(a:Assessment, financials:AssessorSupport["financials"]):ScreeningSummary {
  const fields=validateFields(a.fields,a.segments).fields;
  const get=(key:FieldKey)=>fields.find(f=>f.key===key&&f.status==="supported");
  const refs=(keys:FieldKey[])=>[...new Set(keys.flatMap(key=>get(key)?.evidenceIds??[]))];
  const essential:FieldKey[]=["products","customers","problem","location","monthlyRevenue","monthlyCosts"];
  const priorityFields=[...fields.filter(f=>f.status==="ambiguous").map(f=>f.key),...essential.filter(key=>!get(key)),...a.questions.map(q=>q.field)].filter((key,i,all)=>all.indexOf(key)===i);
  const critical=fields.some(f=>f.status==="ambiguous"&&essential.includes(f.key));
  const missingCore=essential.slice(0,3).some(key=>!get(key));
  const loss=financials.monthlySurplus!==null&&financials.monthlySurplus<=0;
  const funding=financials.fundingPlanGap!==null&&financials.fundingPlanGap!==0;
  const noResearch=!get("research")||/\b(?:no|not|haven.t)\b/i.test(get("research")?.value??"");
  const reasons:ScreeningSummary["reasons"]=[];
  if(critical||missingCore)reasons.push({text:"The core proposal has missing or conflicting information. Clarify it before interpreting commercial potential.",evidenceIds:refs(essential)});
  if(loss)reasons.push({text:"Projected monthly sales do not exceed stated operating costs. Review prices, demand, costs and omitted expenses before proceeding.",evidenceIds:refs(["monthlyRevenue","monthlyCosts"])});
  if(funding)reasons.push({text:"The stated setup investment and funding plan do not reconcile. Requested funding is not approved funding.",evidenceIds:refs(["investment","selfInvestment","loan"])});
  if(noResearch)reasons.push({text:"Customer demand has not been established by the available research statement. Plan a small customer validation exercise.",evidenceIds:refs(["customers","problem","research"])});
  if(reasons.length===0)reasons.push({text:"The proposal is described sufficiently for deeper human evaluation. Applicant projections and market claims still need independent checks.",evidenceIds:refs(["products","customers","research","differentiation"])});
  const action=critical||missingCore?"clarification":loss||funding?"financial_mentoring":!get("experience")?"skills_review":"deeper_evaluation";
  const definitions:{key:string;label:string;fields:FieldKey[]}[]=[
    {key:"clarity",label:"Clarity",fields:["products","customers","problem"]},
    {key:"customer_need",label:"Customer need",fields:["customers","problem","research"]},
    {key:"market_potential",label:"Market potential",fields:["research","unitPrice","monthlyRevenue"]},
    {key:"feasibility",label:"Feasibility",fields:["materials","suppliers","investment","experience"]},
    {key:"competition",label:"Competition",fields:["competition","location"]},
    {key:"differentiation",label:"Differentiation",fields:["differentiation","competition"]},
  ];
  return {action,label:{clarification:"Clarify the proposal",financial_mentoring:"Financial mentoring before deeper evaluation",skills_review:"Check skills and support needs",deeper_evaluation:"Consider deeper evaluation"}[action],reasons:reasons.slice(0,3),priorityFields:priorityFields.slice(0,3),domains:definitions.map(d=>{
    const missing=d.fields.some(key=>!get(key));
    const concern=d.key==="feasibility"&&(loss||funding);
    const status=concern?"concern":missing?"missing":d.key==="clarity"?"described":"not_validated";
    return {key:d.key,label:d.label,status,explanation:concern?"Financial concerns are present in the applicant's stated figures; the information-readiness score does not measure this concern.":missing?"Relevant information is missing; commercial quality cannot be inferred.":d.key==="clarity"?"Products, customers and the stated problem are described. This does not establish demand.":"Applicant statements are present. The assessor must judge their adequacy and verify material assumptions.",evidenceIds:refs(concern?[...d.fields,"monthlyRevenue","monthlyCosts"]:d.fields)};
  })};
}
