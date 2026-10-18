import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import type {Server} from "node:http";
import mongoose from "mongoose";
import {createApp} from "../src/app.js";
import {digest} from "../src/auth.js";
import {SessionModel,UserModel,SubmissionModel,CohortModel,AuditModel,LocalContextModel} from "../src/db.js";
import {assess} from "../src/domain/assessment.js";
import {decisionSupport} from "../src/domain/decision-support.js";
import {distanceMeters,localObservationSchema} from "../../shared/local-context.js";
import {BUSINESS_DOMAINS,reviewedPotential} from "../../shared/business-review.js";
import {assessorReviewSchema,reviewEvidenceError} from "../../shared/input-rules.js";
import type {FieldKey,Submission} from "../../shared/types.js";

function fixture(revenue:string){
 const values:Partial<Record<FieldKey,string>>={products:"Meals",customers:"Office workers",problem:"Affordable lunches",experience:"Two years preparing lunches",monthlyRevenue:revenue,monthlyCosts:"INR 35000 per month"};
 const entries=Object.entries(values) as [FieldKey,string][];
 return assess({fields:entries.map(([key,value])=>({key,value,status:"supported",evidenceIds:[key],reason:"Quoted"})),segments:entries.map(([key,value])=>({id:key,originalText:value,englishText:value,kind:"text",verified:false,page:null,startSeconds:null,endSeconds:null})),language:"en-IN",providerModel:"synthetic-test"});
}
test("the same readiness does not conceal opposite projected financial implications",()=>{
 const good=fixture("INR 65000 per month"),bad=fixture("INR 12000 per month");
 assert.equal(good.score,bad.score);
 assert.equal(decisionSupport(good).screening.action,"deeper_evaluation");
 const support=decisionSupport(bad);
 assert.equal(support.screening.action,"financial_mentoring");
 assert.equal(support.screening.domains.find(d=>d.key==="feasibility")!.status,"concern");
 assert.ok(support.screening.reasons.some(r=>r.evidenceIds.includes("monthlyCosts")));
 assert.notEqual(support.screening.domains.find(d=>d.key==="market_potential")!.status,"described");
});
test("manual local observations require bounded coordinates and a genuine web source",()=>{
 const value={name:"Public shop",category:"food",lat:18.52,lon:73.85,sourceUrl:"https://www.openstreetmap.org/node/123",note:"Checked public listing; current opening needs confirmation.",checked:false};
 assert.equal(localObservationSchema.safeParse(value).success,true);
 for(const sourceUrl of ["javascript:alert(1)","data:text/html,test","https://user:secret@example.com"])
   assert.equal(localObservationSchema.safeParse({...value,sourceUrl}).success,false);
 assert.equal(localObservationSchema.safeParse({...value,lat:99}).success,false);
 assert.equal(distanceMeters(value,value),0);
});
test("human potential remains unknown until all domains are rated on the current version",()=>{
 const a=fixture("INR 65000 per month"),domainRatings=BUSINESS_DOMAINS.map(d=>({key:d.key,score:2,reason:"The cited statements make this plausible; independent checks remain.",evidenceIds:["products"]}));
 const record={assessment:a,review:{assessmentVersion:a.version,domainRatings}} as Submission;
 assert.equal(reviewedPotential(record).score,50);
 assert.equal(reviewedPotential({...record,review:{...record.review!,domainRatings:domainRatings.slice(0,5)}}).score,null);
 assert.equal(reviewedPotential({...record,assessment:{...a,version:a.version+1}}).ratings.length,0);
 const review=assessorReviewSchema.parse({decision:"deeper_evaluation",note:"Review of the supplied evidence supports a further human check.",reasonCodes:["clear_proposal"],evidenceIds:["products"],nextAction:"Validate customer demand with the entrepreneur.",sourceReviewed:true,version:a.version,domainRatings});
 assert.equal(reviewEvidenceError(review,a),null);
 assert.match(reviewEvidenceError({...review,domainRatings:[{...domainRatings[0]!,evidenceIds:["another-submission-source"]}]},a)!,/this assessment version/);
 assert.equal(assessorReviewSchema.safeParse({...review,domainRatings:[domainRatings[0],domainRatings[0]]}).success,false);
});

const recordId="444444444444444444444444",cohortId="555555555555555555555555",owner="111111111111111111111111";
let server:Server,base:string;
const original={state:mongoose.connection.readyState,session:SessionModel.findOne,user:UserModel.findById,update:SubmissionModel.findOneAndUpdate,exists:SubmissionModel.exists,cohort:CohortModel.findById,audit:AuditModel.create,context:LocalContextModel.findOne};
before(async()=>{
 mongoose.connection.readyState=1;
 SessionModel.findOne=((filter:any)=>({lean:async()=>({userId:filter.tokenHash===digest("assessor")?"assessor":owner})})) as any;
 UserModel.findById=((id:string)=>({lean:async()=>({_id:id,name:"Test",email:"test@example.test",role:id==="assessor"?"assessor":"entrepreneur"})})) as any;
 SubmissionModel.exists=(async()=>({_id:recordId})) as any;
 SubmissionModel.findOneAndUpdate=(async(filter:any,update:any)=>filter.updatedAt.toISOString()==="2026-10-18T00:00:00.000Z"?{_id:recordId,ownerId:owner,title:"Synthetic",inputType:"text",createdAt:new Date(),updatedAt:new Date(),history:[],...update.$set}:null) as any;
 CohortModel.findById=(async()=>({_id:cohortId,name:"Programme A",synthetic:false})) as any;
 LocalContextModel.findOne=(()=>({lean:async()=>null})) as any;
 AuditModel.create=(async()=>({})) as any;
 server=createApp().listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));const address=server.address();if(!address||typeof address==="string")throw new Error("No test port");base=`http://127.0.0.1:${address.port}/api`;
});
after(async()=>{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));mongoose.connection.readyState=original.state;SessionModel.findOne=original.session;UserModel.findById=original.user;SubmissionModel.findOneAndUpdate=original.update;SubmissionModel.exists=original.exists;CohortModel.findById=original.cohort;AuditModel.create=original.audit;LocalContextModel.findOne=original.context;});
function request(path:string,token:string,body?:unknown){return fetch(base+path,{method:body?"POST":"GET",headers:{Cookie:`strive_session=${token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});}
test("cohort assignment is assessor-only and rejects stale writes",async()=>{
 const path=`/submissions/${recordId}/cohort`,body={cohortId,updatedAt:"2026-10-18T00:00:00.000Z"};
 assert.equal((await request(path,"owner",body)).status,403);
 const response=await request(path,"assessor",body);assert.equal(response.status,200);assert.equal((await response.json() as any).submission.cohortId,cohortId);
 assert.equal((await request(path,"assessor",{...body,updatedAt:"2026-10-17T00:00:00.000Z"})).status,409);
});
test("entrepreneurs cannot read or write assessor local context",async()=>{
 const path=`/submissions/${recordId}/local-context`;
 assert.equal((await request(path,"owner")).status,403);
 assert.equal((await request(path,"owner",{place:{lat:18.52,lon:73.85,name:"Pune"},category:"food",radius:1000,revision:0})).status,403);
 const response=await request(path,"assessor");assert.equal(response.status,200);assert.equal((await response.json() as any).context.place,null);
});
test("map tiles are allowed narrowly and browser referrers meet tile policy",async()=>{
 const response=await fetch(base+"/health");assert.match(response.headers.get("content-security-policy")??"",/img-src[^;]*https:\/\/tile\.openstreetmap\.org/);assert.equal(response.headers.get("referrer-policy"),"strict-origin-when-cross-origin");
});
