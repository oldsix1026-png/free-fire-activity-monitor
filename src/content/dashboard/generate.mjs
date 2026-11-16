import fs from 'node:fs';
import { TASKS, DAY, END } from './engine.mjs';
let state = 20261116;
function random() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }
const players=[], matches=[], task_states=[];
for(let day=0;day<14;day++) for(let n=0;n<180;n++) {
  const id=`FF-${String(day*180+n+1).padStart(5,'0')}`;
  const region=['巴西','印度尼西亚','泰国'][n%3];
  const segment=['新玩家','活跃玩家','回流玩家'][Math.floor(n/3)%3];
  const preference=n%2?'偏好 BR':'偏好 CS';
  const exposedAt=day*DAY+Math.floor(random()*DAY);
  const excluded=n===179;
  const p={ id,region,segment,preference,exposedAt,excluded };
  players.push(p);
  let unlockedAt=exposedAt, matchCount=0;
  const trouble=day>=7 && (segment==='新玩家'||region==='印度尼西亚'||preference==='偏好 CS');
  function match(at, task, good) {
    const m={id:`${id}-M${++matchCount}`,playerId:id,startedAt:at,settledAt:at+12+Math.floor(random()*9),mode:'BR',map:'Solara',railAttempt:task>0,railSuccess:good&&task>0,railDistance:good&&task>0?60+Math.floor(random()*280):0,normalSettlement:true,result:random()<.85?'eliminated':'winner',survivalSeconds:task>=3?360+Math.floor(random()*300):180+Math.floor(random()*500),teammates:task>=4?3:Math.floor(random()*4)};
    if(!good&&task===0) {m.mode='CS';m.map='Bermuda';}
    if(!good&&random()<.08) {m.normalSettlement=false;m.railSuccess=true;m.railDistance=80;}
    if(m.settledAt<=END) matches.push(m);
    return m;
  }
  for(let t=0;t<TASKS.length&&unlockedAt<END;t++) {
    const task=TASKS[t];
    const chance=t===0?.92:t===1?(trouble?.52:.94):t===2?(trouble?.77:.92):.9;
    const eventually=random()<chance;
    const late=random()<(t===1?(trouble?.43:.08):.09);
    const delay=late?task.window+40+Math.floor(random()*480):22+Math.floor(random()*Math.min(task.window*.6,240));
    let attemptedAt=null,completedAt=null;
    if(eventually) {
      if(t>0&&random()<.55) {const attempt=match(unlockedAt+8,t,false);if(attempt.startedAt+3<END)attemptedAt=attempt.startedAt+3;}
      const m=match(unlockedAt+delay,t,true);
      if(m.settledAt<=END) {completedAt=m.settledAt;attemptedAt ??=m.startedAt+(t>0?3:0);}
    } else if(random()<.68) {
      const m=match(unlockedAt+20+Math.floor(random()*80),t,false);
      if(m.settledAt<=END) attemptedAt=m.startedAt+(t>0?3:0);
    }
    task_states.push({playerId:id,taskId:task.id,unlockedAt,window:task.window,attemptedAt,completedAt});
    if(completedAt==null) break;
    unlockedAt=completedAt+1;
  }
}
const source=(label,grain)=>({label,description:grain,tables:[label],caveats:['固定种子 AI 模拟记录；非 Garena 生产数据。','活动与任务规则为虚拟案例；不代表官方活动效果。','完整 14 天事件库按模拟数据时间逐步展示，未来行为不计入当前指标。']});
const path=new URL('../../data.json',import.meta.url);
const existing=JSON.parse(fs.readFileSync(path,'utf8'));
const snapshot={...existing,title:'Free Fire · 活动监控',subtitle:'滑轨试炼',buildStatus:'creating',status:'fixture',generatedAt:'2026-11-16T04:00:00Z',filters:[],queries:{
  players:{rows:players,source:source('模拟 · 玩家与活动曝光','一行一名匿名玩家；首次实际曝光时间及人群标签。')},
  matches:{rows:matches,source:source('模拟 · 对局与互动','一行一场玩家对局；真实动作条件、地图、结算状态。')},
  task_states:{rows:task_states,source:source('模拟 · 任务状态','一行一个玩家任务；前置解锁、尝试、完成时间。')},
  task_events:{rows:task_states.flatMap(s=>[{playerId:s.playerId,taskId:s.taskId,event:'解锁',time:s.unlockedAt,window:s.window},...(s.attemptedAt==null?[]:[{playerId:s.playerId,taskId:s.taskId,event:'尝试',time:s.attemptedAt}]),...(s.completedAt==null?[]:[{playerId:s.playerId,taskId:s.taskId,event:'完成',time:s.completedAt}])]),source:source('模拟 · 任务事件流水','一行一条任务事件；按发生时刻支持任务状态复核。')},
}};
fs.writeFileSync(path,JSON.stringify(snapshot));
console.log(JSON.stringify({players:players.length,matches:matches.length,tasks:task_states.length,bytes:fs.statSync(path).size}));
