const snapshot=value=>JSON.parse(JSON.stringify(value));
async function record(tx,req,{entityType,entityId,action,reason,before,after}){
 return tx.auditEvent.create({data:{entityType,entityId,actorId:req.user.id,actorName:req.user.fullName,action,reason,before:snapshot(before),after:snapshot(after)}});
}
module.exports={snapshot,record};
