import { invokePrivateAdminOperation } from "./[[route]].js";
const reply=(body,status)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export async function onRequest({request,env}) {
 if(request.method!=="POST")return reply({error:"Method not allowed"},405);
 if(new URL(request.url).origin!=="https://lusu575.com" || (request.headers.has("Origin")&&request.headers.get("Origin")!=="https://lusu575.com"))return reply({error:"Forbidden"},403);
 if(!env.PRIVATE_MCP_AUTH?.verify || (!env.MCP_OWNER_USER_ID && !env.MCP_OWNER_USER_ID_SHA256))return reply({error:"Unavailable"},503);
 const authorization=request.headers.get("Authorization")||"";
 if(!authorization.startsWith("Bearer ")||authorization.length>4103)return reply({error:"Unauthorized"},401);
 try {
  const verified=await env.PRIVATE_MCP_AUTH.verify(authorization);
  const ownerId=verified?.principal?.userId;
  const digest=typeof ownerId==="string"?Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ownerId)))).map(b=>b.toString(16).padStart(2,"0")).join(""):"";
  if(!verified?.ok || !(env.MCP_OWNER_USER_ID ? ownerId===env.MCP_OWNER_USER_ID : digest===env.MCP_OWNER_USER_ID_SHA256))return reply({error:"Unauthorized"},401);
  if(!request.headers.get("Content-Type")?.startsWith("application/json"))return reply({error:"JSON required"},415);
  const reader=request.body?.getReader();if(!reader)return reply({error:"Body required"},400);
  let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();return reply({error:"Body too large"},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!['operation','input'].includes(k))||typeof body.operation!=="string"||!body.input||typeof body.input!=="object"||Array.isArray(body.input))return reply({error:"Invalid operation"},400);
  return reply(await invokePrivateAdminOperation({env:{...env,MCP_OWNER_USER_ID:ownerId},principal:verified.principal,operation:body.operation,input:body.input}),200);
 }catch(error){const status=[400,401,403,404,409,422,429].includes(error?.status)?error.status:500;return reply({error:"Operation rejected"},status);}
}
