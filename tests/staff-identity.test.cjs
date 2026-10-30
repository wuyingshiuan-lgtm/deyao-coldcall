const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/manage-staff/index.ts','utf8').replace(/^import .*;\n/,'');
async function run(action,{employee='DY0624',role='admin',duplicate=false,profileError=false}={}){
 const writes=[];let handler;const target={id:'staff',employee_no:'DY062',name:'蔡喜禎'};
 const client={auth:{getUser:async()=>({data:{user:{id:'caller'}}}),admin:{updateUserById:async(id,body)=>{writes.push(['auth',id,body]);return{error:null}}}},from:()=>{const state={columns:'',updated:null};const query={select(columns){state.columns=columns;return query},eq(){return query},single:async()=>state.columns==='role, active'?{data:{role,active:true}}:{data:target},update(body){state.updated=body;writes.push(['profile',body]);return query},then(resolve){return Promise.resolve(state.updated?{error:profileError?{message:'write failed'}:null}:{data:duplicate?[target,{id:'duplicate',employee_no:employee,name:'其他人'}]:[target],error:null}).then(resolve)}};return query}};
 const context={createClient:()=>client,Deno:{env:{get:()=>''},serve(fn){handler=fn}},Response,Error};vm.createContext(context);vm.runInContext(stripTypeScriptTypes(source),context);
 const response=await handler({method:'POST',headers:new Headers({Authorization:'Bearer test-only'}),json:async()=>({action,user_id:'staff',employee_no:employee,name:'蔡喜禎'})});return {status:response.status,body:await response.json(),writes};
}
(async()=>{for(const action of ['update','update_identity']){const result=await run(action);assert.equal(result.status,200);assert.equal(result.body.success,true);assert.equal(result.writes[0][0],'auth');assert.equal(result.writes[0][2].email,'dy0624@staff.de-yao.local');assert.equal(result.writes[1][1].employee_no,'DY0624')}
 let result=await run('update',{role:'editor'});assert.equal(result.status,403);assert.equal(result.writes.length,0);
 result=await run('update',{duplicate:true});assert.equal(result.status,400);assert.match(result.body.error,/工號已存在/);assert.equal(result.writes.length,0);
 result=await run('update',{profileError:true});assert.equal(result.status,400);assert.equal(result.writes.at(-1)[2].email,'dy062@staff.de-yao.local');
 result=await run('update',{employee:'DY062'});assert.equal(result.status,200);assert.equal(result.writes.filter(x=>x[0]==='auth').length,0);
 console.log('PASS old and new update actions, DY0624 login synchronization, admin-only check, duplicate rejection and rollback');})().catch(error=>{console.error(error);process.exitCode=1});
