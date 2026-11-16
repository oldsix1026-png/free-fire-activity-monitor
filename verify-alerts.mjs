import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlatformAlerts,alertInsight} from './src/content/dashboard/alert-analysis.mjs';
import {selectActivityData} from './src/content/dashboard/platform-data.mjs';
import {BASE_TIME,DAY,DEFAULT_FILTERS,analyze} from './src/content/dashboard/engine.mjs';

let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
function fixture({lowDays=[8,9,10,11,12,13],sample=50,lateDay=false}={}){
 const data={activity:{id:'test',name:'测试活动'},players:[],matches:[],task_states:[],task_events:[],reward_events:[],feedback:[]};
 for(let day=1;day<=13;day++)for(let i=0;i<sample;i++){
  const id=`P${day}-${i}`,exposedAt=lateDay&&day===13?BASE_TIME-DAY-5:(day-1)*DAY+10;
  data.players.push({id,activityId:'test',region:'巴西',segment:'新玩家',preference:'偏好 BR',exposedAt,excluded:false});
  if(i<Math.floor(sample*(lowDays.includes(day)?.6:.9)))data.matches.push({id:'M'+id,playerId:id,startedAt:exposedAt+15,settledAt:exposedAt+30,mode:'BR',map:'Solara',railSuccess:true,railAttempt:true,railDistance:70,normalSettlement:true});
 }
 return data;
}
test('low consecutive days trigger even when total conversion is healthy',()=>{
 const data=fixture(),alerts=buildPlatformAlerts(data,DEFAULT_FILTERS,BASE_TIME);
 assert.ok(analyze(data,DEFAULT_FILTERS,BASE_TIME).experience.rate>.65);
 const alert=alerts.find(row=>row.key==='experience-from-8');
 assert.deepEqual(alert.extraFilters,{fromDay:8,toDay:13});
 assert.equal(alert.metric.yes,180);assert.equal(alert.metric.total,300);assert.equal(alert.metric.rate,.6);
 assert.equal(alerts.filter(row=>row.type==='experience').length,1);
});
test('one bad date or daily sample below 30 does not create a date warning',()=>{
 assert.equal(buildPlatformAlerts(fixture({lowDays:[8]}),DEFAULT_FILTERS,BASE_TIME).some(row=>row.extraFilters),false);
 assert.equal(buildPlatformAlerts(fixture({sample:29}),DEFAULT_FILTERS,BASE_TIME).some(row=>row.extraFilters),false);
});
test('newly mature date must qualify in all three distinct snapshots',()=>{
 const alert=buildPlatformAlerts(fixture({lateDay:true}),DEFAULT_FILTERS,BASE_TIME).find(row=>row.extraFilters);
 assert.equal(alert.extraFilters.toDay,12);
});
test('scope excludes unrelated regions and future feedback',()=>{
 const data=fixture();
 data.feedback=[{id:'F1',playerId:'P9-40',activityId:'test',taskId:'T2',region:'巴西',segment:'新玩家',createdAt:8*DAY+100,source:'游戏内',sentiment:'建议',topic:'目标引导',text:'希望任务入口更清楚。'},
 {id:'F2',playerId:'P9-41',activityId:'test',taskId:'T2',region:'巴西',segment:'新玩家',createdAt:BASE_TIME+5,source:'社区',sentiment:'负向',topic:'目标引导',text:'未来反馈'},
 {id:'F3',playerId:'OTHER',activityId:'test',taskId:'T2',region:'泰国',segment:'新玩家',createdAt:8*DAY+100,source:'社区',sentiment:'负向',topic:'目标引导',text:'其他人群'}];
 const alert=buildPlatformAlerts(data,DEFAULT_FILTERS,BASE_TIME).find(row=>row.extraFilters);
 const insight=alertInsight(data,DEFAULT_FILTERS,BASE_TIME,alert);
 assert.deepEqual(insight.feedback.map(row=>row.id),['F1']);
 assert.equal(insight.problems.length,120);
 assert.ok(insight.evidence.feedback[0]===data.feedback[0]);
 assert.equal(buildPlatformAlerts(data,{...DEFAULT_FILTERS,region:'泰国'},BASE_TIME).length,0);
});
const snapshot=JSON.parse(fs.readFileSync(new URL('./src/data.json',import.meta.url),'utf8'));
const queries=Object.fromEntries(Object.entries(snapshot.queries).map(([key,value])=>[key,value.rows]));
test('generated activity alerts reconcile to their current filtered metrics',()=>{
 const activities=queries.activities||[{id:'rail-trial'}];
 for(const activity of activities){
  const data=selectActivityData(queries,activity.id);
  for(const alert of buildPlatformAlerts(data,DEFAULT_FILTERS,BASE_TIME)){
   const result=analyze(data,{...DEFAULT_FILTERS,...alert.extraFilters},BASE_TIME);
   const metric=alert.type==='task'?result.tasks.find(row=>row.id===alert.taskId).metric:result[alert.type];
   assert.equal(alert.metric.yes,metric.yes);assert.equal(alert.metric.total,metric.total);assert.equal(alert.metric.rate,metric.rate);
   const insight=alertInsight(data,DEFAULT_FILTERS,BASE_TIME,alert);
   assert.ok(insight.feedback.every(row=>row.createdAt<=BASE_TIME));
   assert.ok(insight.evidence.players.every(row=>data.players.includes(row)));
  }
 }
});
console.log(JSON.stringify({passed},null,2));
