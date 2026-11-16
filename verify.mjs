import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,alertCandidates,taskStatus,simulationTime,visibleEvidence,playerTimeline,isEffective,DEFAULT_FILTERS,BASE_TIME,END,DAY,RULES,REFRESH_MS,TASKS,trendRows,taskTrendRows} from './src/content/dashboard/engine.mjs';
import {selectActivityData,participationTrend,behaviorGroups} from './src/content/dashboard/platform-data.mjs';
const snapshot=JSON.parse(fs.readFileSync(new URL('./src/data.json',import.meta.url),'utf8'));
const allRows=Object.fromEntries(Object.entries(snapshot.queries).map(([key,v])=>[key,v.rows]));
const data=selectActivityData(allRows,'rail-trial');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const p={id:'P',exposedAt:0,region:'巴西',segment:'新玩家',preference:'偏好 BR',excluded:false};
const m={id:'M1',playerId:'P',startedAt:10,settledAt:20,mode:'BR',map:'Solara',railSuccess:true,railAttempt:true,railDistance:60,normalSettlement:true};
const simple=(matches=[],states=[])=>({players:[p],matches,task_states:states});
test('24h maturity boundary excludes incomplete observation',()=>{assert.equal(analyze(simple([m]),DEFAULT_FILTERS,1439).experience.total,0);assert.equal(analyze(simple([m]),DEFAULT_FILTERS,1440).experience.rate,1);});
test('late effective experience does not count in exposure conversion',()=>{const a=analyze(simple([{...m,settledAt:1441}]),DEFAULT_FILTERS,3000);assert.equal(a.experience.rate,0);assert.equal(a.repeat.total,1);});
test('elimination qualifies; interrupted match and short rail do not',()=>{assert.equal(isEffective({...m,result:'eliminated'}),true);assert.equal(isEffective({...m,normalSettlement:false}),false);assert.equal(isEffective({...m,railDistance:49}),false);});
test('repeat needs another match and a full 24h observation',()=>{assert.equal(analyze(simple([m,m]),DEFAULT_FILTERS,2000).repeat.yes,0);assert.equal(analyze(simple([m,{...m,id:'M2',settledAt:100}]),DEFAULT_FILTERS,1460).repeat.rate,1);assert.equal(analyze(simple([m,{...m,id:'M2',settledAt:100}]),DEFAULT_FILTERS,1459).repeat.total,0);});
test('late completion remains timeout; exact deadline is on time',()=>{const s={playerId:'P',taskId:'T1',unlockedAt:0,window:120,attemptedAt:10,completedAt:121};assert.equal(taskStatus(s,200),'超时后完成');assert.equal(taskStatus({...s,completedAt:120},200),'按时完成');assert.equal(taskStatus(s,119),'观察中');});
test('task not unlocked is never a failure',()=>{assert.equal(analyze(simple(),DEFAULT_FILTERS,2000).tasks[0].metric.total,0);});
test('end of event does not force immature players into failures',()=>{const d={players:[{...p,exposedAt:END-20}],matches:[],task_states:[]};assert.equal(analyze(d,DEFAULT_FILTERS,END+2000).experience.total,0);assert.equal(analyze(d,DEFAULT_FILTERS,END+2000).experience.pending,1);});
test('5-minute clock cadence, catch-up and cap',()=>{assert.equal(REFRESH_MS,300000);assert.equal(simulationTime(299999,0),BASE_TIME);assert.equal(simulationTime(300000,0),BASE_TIME+5);assert.equal(simulationTime(600000,0),BASE_TIME+10);assert.equal(simulationTime(1e10,0),END);});
test('all generated identities and sequential prerequisites are consistent',()=>{assert.equal(new Set(data.players.map(p=>p.id)).size,data.players.length);assert.equal(new Set(data.matches.map(m=>m.id)).size,data.matches.length);const last=new Map();for(const s of data.task_states){assert.ok(s.unlockedAt<END);if(s.taskId!=='T1'){const prev=last.get(s.playerId);assert.ok(prev?.completedAt!=null&&s.unlockedAt>prev.completedAt);}if(s.completedAt!=null)assert.ok(data.matches.some(m=>m.playerId===s.playerId&&m.settledAt===s.completedAt&&(s.taskId==='T1'||isEffective(m))));last.set(s.playerId,s);}});
test('visible evidence and timelines never expose future behavior',()=>{const a=analyze(data,DEFAULT_FILTERS,BASE_TIME);const evidence=visibleEvidence(data,a.experiences,BASE_TIME);assert.ok(evidence.players.every(p=>data.players.includes(p)));assert.ok(evidence.matches.every(m=>m.settledAt<=BASE_TIME));assert.ok(evidence.task_events.every(s=>s.time<=BASE_TIME));assert.ok(a.players.every(p=>playerTimeline(data,p,BASE_TIME).every(e=>e.time<=BASE_TIME)));});
test('regional populations reconcile with whole scope',()=>{const whole=analyze(data,DEFAULT_FILTERS,BASE_TIME);const parts=['巴西','印度尼西亚','泰国'].map(region=>analyze(data,{...DEFAULT_FILTERS,region},BASE_TIME));assert.equal(parts.reduce((n,a)=>n+a.experience.total,0),whole.experience.total);assert.equal(parts.reduce((n,a)=>n+a.experience.yes,0),whole.experience.yes);});
test('day cohorts reconcile; newest empty observation is null',()=>{const a=analyze(data,DEFAULT_FILTERS,BASE_TIME),rows=trendRows(data,DEFAULT_FILTERS,BASE_TIME);assert.equal(rows.reduce((n,r)=>n+r.experienceUsers,0),a.experience.total);assert.equal(rows.at(-1).experienceRate,null);});
test('zero-sample scope is empty, never 0% success',()=>{const a=analyze(data,{...DEFAULT_FILTERS,region:'不存在'},BASE_TIME);assert.equal(a.experience.rate,null);assert.equal(alertCandidates(data,{...DEFAULT_FILTERS,region:'不存在'},BASE_TIME).length,0);});
test('alert requires all 3 distinct snapshots and min sample',()=>{const a=alertCandidates(data,DEFAULT_FILTERS,BASE_TIME);for(const alert of a)for(const t of [BASE_TIME-10,BASE_TIME-5,BASE_TIME]){const s=analyze(data,DEFAULT_FILTERS,t);const metric=alert.type==='task'?s.tasks.find(x=>x.id===alert.taskId).metric:s[alert.type];assert.ok(metric.total>=RULES.minSample);assert.ok(alert.type==='task'?metric.rate>RULES.blocked:metric.rate<RULES[alert.type]);}assert.deepEqual(alertCandidates(data,DEFAULT_FILTERS,BASE_TIME),a);assert.equal(alertCandidates(simple(),DEFAULT_FILTERS,2000).length,0);});
test('task time charts reconcile to node totals across global filters',()=>{
  const scopes=[DEFAULT_FILTERS,{...DEFAULT_FILTERS,period:'后 7 天',region:'印度尼西亚',segment:'回流玩家'}];
  for(const filters of scopes){
    const result=analyze(data,filters,BASE_TIME);
    for(const task of result.tasks){
      const rows=taskTrendRows(data,filters,BASE_TIME,task.id);
      assert.equal(rows.reduce((sum,row)=>sum+row.统计人数,0),task.metric.total);
      assert.equal(rows.reduce((sum,row)=>sum+row.超时人数,0),task.metric.yes);
      for(const row of rows)assert.equal(row.blockedRate,row.统计人数?row.超时人数/row.统计人数:null);
    }
  }
});
test('five activities keep isolated original row references and rail baseline',()=>{
  assert.equal(allRows.activities.length,5);assert.equal(allRows.activities.filter(a=>a.typeKey==='chain').length,2);
  assert.equal(allRows.activities.filter(a=>a.typeKey==='daily').length,3);
  assert.equal(new Set(allRows.players.map(p=>p.id)).size,allRows.players.length);
  for(const a of allRows.activities){const d=selectActivityData(allRows,a.id);assert.equal(d.activity,a);for(const key of ['players','matches','task_states','task_events','feedback','reward_events'])assert.ok(d[key].every(row=>row.activityId===a.id&&allRows[key].includes(row)));}
  const rail=analyze(data,DEFAULT_FILTERS,BASE_TIME);assert.equal(data.players.length,2520);assert.equal(rail.experience.yes,1606);assert.equal(rail.experience.total,2240);assert.equal(rail.tasks[1].metric.yes,755);assert.equal(rail.tasks[1].metric.total,2170);
});
test('daily tasks unlock by day and do not require previous completion',()=>{
  for(const a of allRows.activities.filter(a=>a.typeKey==='daily')){
    const d=selectActivityData(allRows,a.id),pMap=new Map(d.players.map(p=>[p.id,p]));assert.equal(d.tasks.length,14);
    for(const t of d.tasks){assert.equal(t.releaseAt,(t.unlockDay-1)*DAY);assert.equal(t.prerequisite,null);}
    for(const s of d.task_states){const t=d.tasks.find(t=>t.id===s.taskId);assert.equal(s.unlockedAt,Math.max(pMap.get(s.playerId).exposedAt,t.releaseAt));}
    assert.ok(d.task_states.some(s=>s.taskId==='D2'&&s.completedAt!=null&&d.task_states.some(prev=>prev.playerId===s.playerId&&prev.taskId==='D1'&&prev.completedAt==null)));
    const early=analyze(d,DEFAULT_FILTERS,DAY-1);assert.ok(early.tasks.filter(t=>t.unlockDay>1).every(t=>t.rows.length===0&&t.completion.total===0));
  }
});
test('task completion includes late completion and only unlocked players',()=>{
  for(const activity of allRows.activities){const d=selectActivityData(allRows,activity.id),a=analyze(d,DEFAULT_FILTERS,BASE_TIME);for(const t of a.tasks){assert.equal(t.completion.total,t.rows.length);assert.equal(t.completion.yes,t.rows.filter(r=>r.completedAt!=null&&r.completedAt<=BASE_TIME).length);assert.ok(t.rows.every(r=>r.unlockedAt<=BASE_TIME));assert.ok(t.completion.yes<=t.completion.total);}}
});
test('activity participation counts actual unique player-day behavior',()=>{
  for(const activity of allRows.activities){const d=selectActivityData(allRows,activity.id),valid=new Set(d.players.filter(p=>!p.excluded&&p.exposedAt<=BASE_TIME).map(p=>p.id));const expected=new Set();
    for(const m of d.matches)if(valid.has(m.playerId)&&m.settledAt<=BASE_TIME)expected.add(`${Math.floor(m.startedAt/DAY)+1}|${m.playerId}`);
    for(const e of d.task_events)if(e.event==='尝试'&&valid.has(e.playerId)&&e.time<=BASE_TIME)expected.add(`${Math.floor(e.time/DAY)+1}|${e.playerId}`);
    const trend=participationTrend(d,DEFAULT_FILTERS,BASE_TIME);assert.equal(trend.reduce((sum,r)=>sum+r.participants,0),expected.size);assert.ok(trend.every(r=>r.day<=14));
    const earliest=participationTrend(d,DEFAULT_FILTERS,0);assert.equal(earliest.length,1);assert.equal(earliest[0].participants,0);
  }
});
test('behavior groups are exclusive and inactivity has full 48h evidence',()=>{
  for(const activity of allRows.activities){const d=selectActivityData(allRows,activity.id),groups=behaviorGroups(d,DEFAULT_FILTERS,BASE_TIME),seen=new Set();
    for(const g of groups){assert.equal(g.count,g.players.length);for(const p of g.players){assert.ok(d.players.includes(p));assert.ok(!seen.has(p.id));seen.add(p.id);}
      for(const example of g.examples){const current=d.task_states.find(s=>s.playerId===example.playerId&&s.taskId===example.taskId&&s.unlockedAt+s.window<=BASE_TIME&&(s.completedAt==null||s.completedAt>BASE_TIME));assert.ok(current);if(g.id!=='not-started')assert.ok(BASE_TIME-example.lastActionAt>=2*DAY);if(g.id==='attempt-stall'){assert.ok(current.attemptedAt!=null&&current.attemptedAt<=BASE_TIME);assert.ok(d.task_states.some(s=>s.playerId===example.playerId&&s.taskId!==example.taskId&&s.completedAt!=null&&s.completedAt<=BASE_TIME&&(activity.typeKey==='daily'||s.completedAt<current.unlockedAt)));}}
    }
  }
  const d=selectActivityData(allRows,'squad-assault'),groups=behaviorGroups(d,DEFAULT_FILTERS,BASE_TIME);assert.ok(groups.find(g=>g.id==='attempt-stall').count>0);
  assert.ok(behaviorGroups(selectActivityData(allRows,'map-calendar'),DEFAULT_FILTERS,BASE_TIME).find(g=>g.id==='reward-stop').count>0);
});
test('date range, day and period intersect in all trend views',()=>{
  const filters={...DEFAULT_FILTERS,period:'后 7 天',fromDay:5,toDay:10};
  assert.deepEqual(participationTrend(data,filters,BASE_TIME).map(r=>r.day),[8,9,10]);
  assert.deepEqual(trendRows(data,filters,BASE_TIME).map(r=>r.day),[8,9,10]);
  assert.equal(analyze(data,{...filters,day:4},BASE_TIME).experience.total,0);
  assert.equal(analyze(data,{...DEFAULT_FILTERS,segment:'老玩家'},BASE_TIME).experience.total,analyze(data,{...DEFAULT_FILTERS,segment:'活跃玩家'},BASE_TIME).experience.total);
});
test('reward and feedback records reference valid simulated activity events',()=>{
  const byPlayer=new Map(allRows.players.map(p=>[p.id,p]));const completed=new Map(allRows.task_states.filter(s=>s.completedAt!=null).map(s=>[`${s.activityId}|${s.playerId}|${s.taskId}`,s.completedAt]));
  for(const r of allRows.reward_events){assert.equal(byPlayer.get(r.playerId).activityId,r.activityId);assert.ok(r.claimedAt>=completed.get(`${r.activityId}|${r.playerId}|${r.taskId}`));assert.ok(r.claimedAt<END);}
  const taskByPlayer=new Map(allRows.task_states.map(s=>[`${s.activityId}|${s.playerId}|${s.taskId}`,s]));
  assert.equal(allRows.feedback.length,50);for(const f of allRows.feedback){assert.equal(byPlayer.get(f.playerId).activityId,f.activityId);assert.ok(f.createdAt>=byPlayer.get(f.playerId).exposedAt&&f.createdAt<END);assert.ok(allRows.activity_tasks.some(t=>t.activityId===f.activityId&&t.id===f.taskId));assert.ok(f.createdAt>=taskByPlayer.get(`${f.activityId}|${f.playerId}|${f.taskId}`).unlockedAt);}
});
function meetsTaskRequirement(activityId,task,match){
  if(!match||!match.normalSettlement)return false;
  if(activityId==='rail-trial'){
    if(match.mode!=='BR'||match.map!=='Solara')return false;
    if(task.id==='T1')return true;
    if(!match.railSuccess||match.railDistance<50)return false;
    return task.id==='T4'?match.survivalSeconds>=300:task.id==='T5'?match.teammates>=1:true;
  }
  if(activityId==='squad-assault'){
    if(match.mode!=='BR'||match.teammates<1)return false;
    if(task.id==='T1')return true;
    if(task.id==='T4')return match.assists>=2;
    if(task.id==='T5')return match.kills>=2;
    return match.survivalSeconds>=300;
  }
  if(activityId==='map-calendar')return match.mode==='BR'&&match.map==='Solara'&&match.exploredZones>=task.required;
  if(activityId==='cs-daily')return match.mode==='CS'&&match.completedRounds>=task.required;
  if(activityId==='supply-calendar')return match.mode==='BR'&&match.supplyTypes>=task.required;
  throw new Error('Unknown task activity');
}
test('every completion satisfies its own task conditions, not just activity experience',()=>{
  const taskMap=new Map(allRows.activity_tasks.map(t=>[`${t.activityId}|${t.id}`,t]));
  const matchMap=new Map(allRows.matches.map(m=>[`${m.playerId}|${m.settledAt}`,m]));
  const states=new Map(allRows.task_states.map(s=>[`${s.activityId}|${s.playerId}|${s.taskId}`,s]));
  for(const s of allRows.task_states)if(s.completedAt!=null){
    const t=taskMap.get(`${s.activityId}|${s.taskId}`),m=matchMap.get(`${s.playerId}|${s.completedAt}`);
    assert.ok(meetsTaskRequirement(s.activityId,t,m),`${s.activityId}/${s.playerId}/${s.taskId}`);assert.ok(m.startedAt>=s.unlockedAt);if(m.taskId)assert.equal(m.taskId,s.taskId);
    if(t.prerequisite){const previous=states.get(`${s.activityId}|${s.playerId}|${t.prerequisite}`);assert.ok(previous.completedAt<s.unlockedAt);assert.notEqual(m.id,matchMap.get(`${s.playerId}|${previous.completedAt}`).id);}
  }
  for(const m of allRows.matches.filter(m=>m.activityId!=='rail-trial')){
    const t=taskMap.get(`${m.activityId}|${m.taskId}`),s=states.get(`${m.activityId}|${m.playerId}|${m.taskId}`);
    if(!meetsTaskRequirement(m.activityId,t,m))assert.notEqual(s.completedAt,m.settledAt);
  }
  const mapD3=taskMap.get('map-calendar|D3'),csD3=taskMap.get('cs-daily|D3'),supplyD3=taskMap.get('supply-calendar|D3');
  const mapMatch={activityId:'map-calendar',mode:'BR',map:'Solara',normalSettlement:true,exploredZones:2};
  const csMatch={activityId:'cs-daily',mode:'CS',normalSettlement:true,completedRounds:3};
  const supplyMatch={activityId:'supply-calendar',mode:'BR',normalSettlement:true,supplyTypes:3};
  for(const [task,match] of [[mapD3,mapMatch],[csD3,csMatch],[supplyD3,supplyMatch]]){assert.equal(isEffective(match),true);assert.equal(meetsTaskRequirement(match.activityId,task,match),false);}
});
test('exposure, unlock, attempts and completions share one causal timeline',()=>{
  const players=new Map(allRows.players.map(p=>[p.id,p]));const tasks=new Map(allRows.activity_tasks.map(t=>[`${t.activityId}|${t.id}`,t]));
  const states=new Map(allRows.task_states.map(s=>[`${s.activityId}|${s.playerId}|${s.taskId}`,s]));
  for(const s of allRows.task_states){assert.ok(s.unlockedAt>=players.get(s.playerId).exposedAt);assert.ok(s.unlockedAt>=tasks.get(`${s.activityId}|${s.taskId}`).releaseAt);assert.ok(s.unlockedAt<END);if(s.attemptedAt!=null)assert.ok(s.attemptedAt>=s.unlockedAt&&s.attemptedAt<END);if(s.completedAt!=null)assert.ok(s.completedAt>=s.attemptedAt&&s.completedAt<END);}
  for(const e of allRows.task_events){assert.ok(e.time>=states.get(`${e.activityId}|${e.playerId}|${e.taskId}`).unlockedAt&&e.time<END);}
  for(const activity of allRows.activities){const d=selectActivityData(allRows,activity.id);for(const cutoff of [DAY-1,7*DAY+720,BASE_TIME]){const result=analyze(d,DEFAULT_FILTERS,cutoff);assert.ok(result.players.every(p=>p.exposedAt<=cutoff));assert.ok(result.tasks.every(t=>t.rows.every(r=>r.unlockedAt<=cutoff)));for(const task of result.tasks)assert.equal(task.completion.yes,task.rows.filter(r=>r.completedAt!=null&&r.completedAt<=cutoff).length);}}
});
test('participation is supported by visible sources during an ongoing match',()=>{
  const ongoing={players:[p],matches:[m],task_states:[],task_events:[{playerId:'P',taskId:'T1',event:'尝试',time:13}]};
  assert.equal(participationTrend(ongoing,DEFAULT_FILTERS,11)[0].participants,0);
  assert.equal(participationTrend(ongoing,DEFAULT_FILTERS,13)[0].participants,1);
  assert.equal(participationTrend(ongoing,DEFAULT_FILTERS,20)[0].participants,1);
  for(const activity of allRows.activities){const d=selectActivityData(allRows,activity.id),source=visibleEvidence(d,d.players.filter(p=>!p.excluded&&p.exposedAt<=BASE_TIME),BASE_TIME),evidenceDays=new Map();
    const add=(id,time)=>{const day=Math.floor(time/DAY)+1;if(!evidenceDays.has(day))evidenceDays.set(day,new Set());evidenceDays.get(day).add(id);};
    for(const m of source.matches)add(m.playerId,m.startedAt);for(const e of source.task_events)if(e.event==='尝试')add(e.playerId,e.time);
    for(const row of participationTrend(d,DEFAULT_FILTERS,BASE_TIME))assert.equal(row.participants,evidenceDays.get(row.day)?.size||0);
  }
});
const current=analyze(data,DEFAULT_FILTERS,BASE_TIME);
console.log(JSON.stringify({passed,experience:current.experience,repeat:current.repeat,tasks:current.tasks.map(t=>({id:t.id,...t.metric})),alerts:alertCandidates(data,DEFAULT_FILTERS,BASE_TIME).map(a=>a.title)},null,2));
