import test from "node:test";
import assert from "node:assert/strict";
import { companionOptions, main } from "../cli/private-browser-companion.mjs";
import { runKittensCompanionOnce } from "../lib/capabilities/kittens-companion.mjs";
test("companion requires explicit loopback target and pre-existing OAuth", () => {
 const args = ["--cdp-url", "http://127.0.0.1:9222", "--target-id", "page", "--browser-id", "private-browser-0001", "--once"];
 assert.equal(companionOptions(args,{LUSU_MCP_ACCESS_TOKEN:"test-only"}).once,true);
 assert.throws(()=>companionOptions(args,{}),/existing owner/);
 assert.throws(()=>companionOptions(args.map(x=>x.replace("127.0.0.1","example.com")),{LUSU_MCP_ACCESS_TOKEN:"test-only"}),/loopback/);
});

test("CLI initializes HTTP MCP, claims once, evaluates selected page and returns completion", async () => {
 const methods=[];let closed=0, evaluated=0;
 class FakeCDP {
  async connect() {}
  async send(method,input) { if(input.expression==='location.href') return {result:{value:'http://127.0.0.1:8080/games/kittens-game/source/'}}; evaluated++;return {result:{value:{source:'live-browser',action:'observe'}}}; }
  close(){closed++;}
 }
 await main(['--cdp-url','http://127.0.0.1:9222','--target-id','fixture','--browser-id','test-browser-cli-0001','--once'],{
  env:{LUSU_MCP_ACCESS_TOKEN:'synthetic-test-only'},CDP:FakeCDP,
  fetch:async()=>Response.json([{id:'fixture',type:'page',url:'http://127.0.0.1:8080/games/kittens-game/source/',webSocketDebuggerUrl:'ws://127.0.0.1:9222/devtools/page/fixture'}]),
  createNetwork:()=>({close:async()=>{closed++;},fetch:async(url,request)=>{
   assert.equal(url,'https://lusu575.com/mcp');const body=JSON.parse(request.body);methods.push(body.method);
   if(body.method==='notifications/initialized')return new Response(null,{status:202});
   let result={};
   if(body.method==='tools/call'){
    if(body.params.name==='browser_command_claim')result={structuredContent:{job:{jobId:'isolated-job',request:{action:'observe'}}}};
    else {assert.equal(body.params.name,'browser_command_complete');assert.equal(body.params.arguments.result.source,'live-browser');result={structuredContent:{accepted:true}};}
   }
   return new Response('data: '+JSON.stringify({jsonrpc:'2.0',id:body.id,result})+'\n\n',{headers:{'content-type':'text/event-stream','mcp-session-id':'test-session'}});
  }})
 });
 assert.deepEqual(methods,['initialize','notifications/initialized','tools/call','tools/call']);assert.equal(evaluated,1);assert.equal(closed,2);
});
test("companion never replays uncertain browser execution", async () => {
 let evaluations=0, completions=0;
 const result=await runKittensCompanionOnce({browserId:"private-browser-0001",
 evaluate:async()=>{evaluations++;throw new Error("connection lost");},
 callTool:async(name,args)=>{if(name==="browser_command_claim") return {job:{jobId:"test-job",request:{action:"gather"}}};completions++;assert.equal(args.result.execution,"unknown");return {accepted:true};}});
 assert.equal(evaluations,1);assert.equal(completions,1);assert.equal(result.failed,true);
});
