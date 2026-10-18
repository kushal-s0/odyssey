import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuditModel, LocalContextModel, SubmissionModel } from "./db.js";
import { distanceMeters, localContextSchema, localObservationSchema } from "../../shared/local-context.js";
export const localContextRouter = Router({ mergeParams: true });
localContextRouter.use(rateLimit({windowMs:60000,limit:30,standardHeaders:"draft-8",legacyHeaders:false}));
localContextRouter.use(async (req, res, next) => {
  const recordId = String((req.params as Record<string,string>).id);
  if (!mongoose.isValidObjectId(recordId)) { res.status(400).json({error:"Invalid submission ID."}); return; }
  if (!await SubmissionModel.exists({_id:recordId})) { res.status(404).json({error:"Submission not found."}); return; }
  next();
});
const empty = {place:null,category:"",radius:3000,observations:[],revision:0};
function serialize(doc: any) { return doc ? {place:doc.place??null,category:doc.category??"",radius:doc.radius??3000,observations:doc.observations??[],revision:doc.revision??0} : empty; }
localContextRouter.get("/", async (req,res) => {
  res.json({context:serialize(await LocalContextModel.findOne({submissionId:(req.params as any).id}).lean())});
});
localContextRouter.post("/", async (req,res) => {
  const input=localContextSchema.parse(req.body), submissionId=(req.params as any).id;
  // Initialize separately, then update using a compare-and-swap revision.
  await LocalContextModel.updateOne({submissionId},{$setOnInsert:{submissionId,revision:0,observations:[]}},{upsert:true});
  const doc=await LocalContextModel.findOneAndUpdate({submissionId,revision:input.revision},{$set:{place:input.place,category:input.category,radius:input.radius},$inc:{revision:1}},{new:true});
  if(!doc){res.status(409).json({error:"Local context changed. Reopen this assessment before saving."});return;}
  await AuditModel.create({submissionId,userId:req.actor!.id,action:"local_context.confirmed",details:{revision:doc.revision,place:input.place,category:input.category,radius:input.radius}});
  res.json({context:serialize(doc)});
});
localContextRouter.post("/observations", async(req,res)=>{
  const input=localObservationSchema.parse(req.body),submissionId=(req.params as any).id;
  const context=await LocalContextModel.findOne({submissionId}).lean();
  if(!context?.place){res.status(400).json({error:"Save a confirmed location before adding observations."});return;}
  if(distanceMeters(context.place as any,input)>5000){res.status(400).json({error:"Place the observed business within 5 km of the saved location."});return;}
  const observation={...input,id:randomUUID(),recordedAt:new Date().toISOString()};
  const doc=await LocalContextModel.findOneAndUpdate({submissionId,"observations.49":{$exists:false},revision:context.revision},{$push:{observations:observation},$inc:{revision:1}},{new:true});
  if(!doc){res.status(409).json({error:"Local context changed or has 50 observations. Refresh before adding more."});return;}
  await AuditModel.create({submissionId,userId:req.actor!.id,action:"local_observation.added",details:{observationId:observation.id,checked:input.checked}});
  res.status(201).json({context:serialize(doc)});
});
localContextRouter.delete("/observations/:observationId", async(req,res)=>{
  const observationId=z.string().uuid().parse(req.params.observationId),submissionId=(req.params as any).id;
  const doc=await LocalContextModel.findOneAndUpdate({submissionId,"observations.id":observationId},{$pull:{observations:{id:observationId}},$inc:{revision:1}},{new:true});
  if(!doc){res.status(404).json({error:"Observation not found."});return;}
  await AuditModel.create({submissionId,userId:req.actor!.id,action:"local_observation.removed",details:{observationId}});
  res.json({context:serialize(doc)});
});
