import fs from 'node:fs';
import {DAY,END,TASKS} from './src/content/dashboard/engine.mjs';

// Reproducible synthetic additions. Existing rail-trial event values are retained.
const path=new URL('./src/data.json',import.meta.url);
const snapshot=JSON.parse(fs.readFileSync(path,'utf8'));
const base={};
for(const key of ['players','matches','task_states','task_events'])base[key]=snapshot.queries[key].rows.filter(r=>!r.activityId||r.activityId==='rail-trial').map(r=>({...r,activityId:'rail-trial'}));
// Remove the legacy FF-02511/T3 attempt that fell six minutes after the event ended.
for(const state of base.task_states)if(state.attemptedAt!=null&&state.attemptedAt>=END)state.attemptedAt=null;
base.task_events=base.task_events.filter(event=>event.time<END);
let seed=2026111701;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const integer=(min,max)=>min+Math.floor(rand()*(max-min+1));
const activities=[
 {id:'rail-trial',name:'滑轨试炼',type:'任务链',typeKey:'chain',description:'沿主线逐步体验 Solara 滑轨',mode:'BR',map:'Solara',effectiveLabel:'滑轨有效体验',effectiveRule:'在 Solara BR 中成功滑行至少 50 米并正常结算。',duration:14,startAt:0,endAt:END,color:'#c9233f'},
 {id:'squad-assault',name:'协同突击',type:'任务链',typeKey:'chain',description:'从组队生存到协同作战',mode:'BR',map:'Bermuda',effectiveLabel:'组队有效体验',effectiveRule:'在组队 BR 对局中生存至少 5 分钟并正常结算。',duration:14,startAt:0,endAt:END,color:'#b94858'},
 {id:'map-calendar',name:'地图探索日历',type:'按天解锁',typeKey:'daily',description:'每天开放一个地图探索目标',mode:'BR',map:'Solara',effectiveLabel:'地图有效探索',effectiveRule:'在一局 Solara BR 中探索至少 2 个区域并正常结算。',duration:14,startAt:0,endAt:END,color:'#b65b65'},
 {id:'cs-daily',name:'CS 每日热身',type:'按天解锁',typeKey:'daily',description:'逐日开放 CS 对局挑战',mode:'CS',map:'Bermuda',effectiveLabel:'CS 有效体验',effectiveRule:'在一局 CS 中完成至少 3 个回合并正常结算。',duration:14,startAt:0,endAt:END,color:'#a34865'},
 {id:'supply-calendar',name:'战术补给日历',type:'按天解锁',typeKey:'daily',description:'每天练习不同补给目标',mode:'BR',map:'Bermuda',effectiveLabel:'补给有效体验',effectiveRule:'在一局 BR 中拾取至少 3 类补给并正常结算。',duration:14,startAt:0,endAt:END,color:'#bc6a66'}
];
const activity_tasks=TASKS.map((t,i)=>({...t,activityId:'rail-trial',unlockDay:1,order:i+1,releaseAt:0,prerequisite:i?TASKS[i-1].id:null}));
const squadNames=[['完成组队 BR','进入组队','完成一局组队 BR，正常淘汰计入。'],['与队友生存 5 分钟','协同生存','在组队 BR 中生存至少 5 分钟并正常结算。'],['再次进入组队对局','再次组队','在另一局组队 BR 中生存至少 5 分钟并正常结算。'],['完成 2 次助攻','战术配合','在一局组队 BR 中完成至少 2 次助攻并正常结算。'],['完成 2 次淘汰','协同出击','在一局组队 BR 中完成至少 2 次淘汰并正常结算。'],['完成团队收官局','完成主线','再完成一局组队 BR，并生存至少 5 分钟。']];
for(let i=0;i<6;i++)activity_tasks.push({activityId:'squad-assault',id:`T${i+1}`,name:squadNames[i][0],short:squadNames[i][1],requirement:squadNames[i][2],window:[120,360,720,1440,1440,1440][i],unlockDay:1,releaseAt:0,order:i+1,prerequisite:i?`T${i}`:null});
for(const activity of activities.filter(a=>a.typeKey==='daily'))for(let day=1;day<=14;day++){
 const required=activity.id==='map-calendar'?(day%3===0?3:2):activity.id==='cs-daily'?(day%3===0?4:3):(day%3===0?4:3);
 const objective=activity.id==='map-calendar'?`探索 ${required} 个区域`:activity.id==='cs-daily'?`完成 ${required} 个 CS 回合`:`拾取 ${required} 类补给`;
 activity_tasks.push({activityId:activity.id,id:`D${day}`,name:objective,short:objective,requirement:`在一局${activity.id==='map-calendar'?' Solara BR ':activity.id==='cs-daily'?' CS ':' BR '}中${objective}并正常结算。`,window:DAY,unlockDay:day,releaseAt:(day-1)*DAY,order:day,prerequisite:null,required});
}
const players=[...base.players],matches=[...base.matches],task_states=[...base.task_states],task_events=[...base.task_events],reward_events=[],feedback=[];

// Original event facts stay unchanged; reward claims are newly simulated against completed milestones.
for(const s of base.task_states)if(s.completedAt!=null&&['T1','T3','T6'].includes(s.taskId)&&s.completedAt+2<END){
 reward_events.push({id:`rail-${s.playerId}-${s.taskId}`,activityId:'rail-trial',playerId:s.playerId,taskId:s.taskId,rewardName:s.taskId==='T6'?'主线完成奖励':s.taskId==='T3'?'滑轨体验奖励':'参与补给',claimedAt:s.completedAt+2});
}

let eventSequence=0;
for(const [activityNumber,activity] of activities.slice(1).entries()){
 const tasks=activity_tasks.filter(t=>t.activityId===activity.id);
 for(let joinDay=0;joinDay<14;joinDay++)for(let index=0;index<60;index++){
  const id=`${['SQ','MP','CS','SP'][activityNumber]}-${String(joinDay*60+index+1).padStart(5,'0')}`;
  const p={id,activityId:activity.id,region:['巴西','印度尼西亚','泰国'][index%3],segment:['新玩家','活跃玩家','回流玩家'][Math.floor(index/3)%3],preference:index%2?'偏好 BR':'偏好 CS',exposedAt:joinDay*DAY+integer(60,780),excluded:index===59};
  players.push(p);
  const group=index%10;
  let nextAvailable=p.exposedAt+5,matchCount=0,chainUnlock=p.exposedAt;
  const addEvent=(task,event,time,extra={})=>{if(time<END)task_events.push({id:`PE-${++eventSequence}`,activityId:activity.id,playerId:id,taskId:task.id,event,time,...extra});};
  function addMatch(task,at,good){
   const start=Math.max(Math.round(at),nextAvailable),settle=start+integer(activity.mode==='CS'?8:12,activity.mode==='CS'?15:20);
   if(settle>=END)return null;
   nextAvailable=settle+10;
   const m={id:`${id}-M${++matchCount}`,activityId:activity.id,playerId:id,taskId:task.id,startedAt:start,settledAt:settle,mode:activity.mode,map:activity.map,normalSettlement:good||rand()>.07,result:rand()<.8?'eliminated':'winner',activityAttempt:true,railAttempt:false,railSuccess:false,railDistance:0,teammates:activity.id==='squad-assault'?3:integer(0,3),survivalSeconds:good?integer(360,700):integer(80,260),assists:good?integer(2,5):integer(0,1),kills:good?integer(2,4):integer(0,1),exploredZones:good?(task.required||2)+integer(0,1):integer(0,1),completedRounds:good?(task.required||3)+integer(0,2):integer(1,2),supplyTypes:good?(task.required||3)+integer(0,1):integer(0,2)};
   m.actionText=activity.id==='squad-assault'?`组队生存 ${Math.floor(m.survivalSeconds/60)} 分钟 · ${m.assists} 次助攻`:activity.id==='map-calendar'?`探索 ${m.exploredZones} 个区域`:activity.id==='cs-daily'?`完成 ${m.completedRounds} 个回合`:`拾取 ${m.supplyTypes} 类补给`;
   matches.push(m);addEvent(task,'尝试',start+3);return m;
  }
  for(let i=0;i<tasks.length;i++){
   const task=tasks[i],unlockedAt=activity.typeKey==='chain'?chainUnlock:Math.max(p.exposedAt,task.releaseAt);
   if(unlockedAt>=END)break;
   let attemptedAt=null,completedAt=null;
   addEvent(task,'解锁',unlockedAt,{window:task.window});
   const activeOrdinal=i;
   let outcome='complete';
   if(group===3)outcome='none';
   else if(group<=1&&activeOrdinal===2)outcome='stall';
   else if(group<=1&&activeOrdinal>2)outcome='none';
   else if(group===2&&activeOrdinal>=2)outcome='none';
   else if(group===4&&activity.typeKey==='daily'&&i%2===0)outcome='none';
   else if(group===4&&activity.typeKey==='chain'&&i===1)outcome='late';
   const trouble=activity.id==='squad-assault'?(joinDay>=7&&i===1):activity.id==='map-calendar'?(i===7||i===8):activity.id==='cs-daily'?(i>=9&&p.segment==='新玩家'):(i===6||i===7);
   if(outcome==='complete'&&trouble&&rand()<.57)outcome=rand()<.6?'stall':'late';
   if(outcome==='complete'&&rand()<.07)outcome='late';
   const delay=activity.typeKey==='chain'?integer(30,Math.min(180,Math.floor(task.window*.6))):(task.releaseAt<p.exposedAt?20:integer(180,840));
   if(outcome==='complete'||outcome==='late'){
    const at=unlockedAt+(outcome==='late'?task.window+integer(40,420):delay);
    const m=addMatch(task,at,true);
    if(m){attemptedAt=m.startedAt+3;completedAt=m.settledAt;addEvent(task,'完成',completedAt);}
   }else if(outcome==='stall'){
    for(let attempt=0;attempt<2;attempt++){const m=addMatch(task,unlockedAt+delay+attempt*65,false);if(m)attemptedAt??=m.startedAt+3;}
   }
   task_states.push({activityId:activity.id,playerId:id,taskId:task.id,unlockedAt,window:task.window,attemptedAt,completedAt});
   if(completedAt!=null&&((activity.typeKey==='chain'&&[0,1,2,5].includes(i))||(activity.typeKey==='daily'&&[1,6,13].includes(i)))){
    const claimedAt=completedAt+2;
    reward_events.push({id:`${id}-${task.id}-reward`,activityId:activity.id,playerId:id,taskId:task.id,rewardName:activity.typeKey==='chain'?(i===5?'收官奖励':'阶段补给'):(i===13?'日历完成奖励':i===6?'七日参与奖励':'双日参与奖励'),claimedAt});
    nextAvailable=Math.max(nextAvailable,claimedAt+2);
   }
   if(activity.typeKey==='chain'){
    if(completedAt==null)break;
    chainUnlock=completedAt+1;
   }
  }
 }
}

const feedbackTemplates={
 'rail-trial':[
  ['T2','操作反馈','负向','点了滑轨但没有滑成功，连续试了两局。'],['T2','目标说明','建议','任务里直接写清要滑行 50 米，会更容易理解。'],['T2','交互提示','负向','落地后忙着找物资，没注意到滑轨入口。'],['T2','交互提示','建议','第一次靠近滑轨时加一个操作提示。'],['T3','奖励节奏','正向','拿到体验奖励后，这条路线已经玩熟了。'],['T3','奖励节奏','建议','下一档奖励再突出一点，我会继续做。'],['T4','任务难度','负向','刚滑完就被淘汰，生存任务一直没完成。'],['T5','组队门槛','建议','单人玩家也能有替代目标就好了。'],['T2','操作反馈','负向','成功滑起来之后才明白任务想让我做什么。'],['T6','参与体验','正向','按顺序推进很清楚，最后一档奖励也拿到了。']
 ],
 'squad-assault':[
  ['T2','生存难度','负向','组队后总是没活到五分钟。'],['T2','队伍协作','建议','能先展示适合新人的组队路线吗？'],['T2','目标说明','建议','希望进局前就显示本局要完成的目标。'],['T3','奖励节奏','正向','阶段补给拿到了，今天先玩到这里。'],['T4','助攻目标','负向','经常是队友击倒，我的助攻却没达到两次。'],['T4','助攻目标','建议','助攻数量在对局结束时显示得更明显些。'],['T5','组队门槛','负向','熟悉的队友不在线，后面几步没继续。'],['T6','参与体验','正向','队友一起推进任务，感觉很顺。'],['T2','生存难度','负向','连续两局在开场交战中淘汰。'],['T3','组队门槛','建议','加一个一键邀请队友的入口。']
 ],
 'map-calendar':[
  ['D8','目标说明','负向','今天要走两个区域，我只找到了一个。'],['D8','路线引导','建议','地图上标出探索区域会更容易找。'],['D9','内容解锁','建议','我想先做今天的任务，前几天的留着补。'],['D3','奖励节奏','正向','双日补给领到了，过两天再来。'],['D8','路线引导','负向','两次落点都没有覆盖到目标区域。'],['D7','奖励节奏','正向','七日奖励是我继续做的动力。'],['D10','任务难度','建议','探索三个区域能否拆成两局累计？'],['D12','内容解锁','正向','漏掉一天还可以补做，这样很好。'],['D2','操作反馈','建议','探索成功时给个明显的确认。'],['D9','目标说明','负向','以为进入区域就算，结算后才发现没完成。']
 ],
 'cs-daily':[
  ['D10','回合目标','负向','不熟悉 CS 的节奏，今天的任务没完成。'],['D11','玩法引导','建议','加一段 CS 回合目标的简短说明。'],['D12','玩法引导','负向','连续打了几次，都没达到任务要求。'],['D3','奖励节奏','正向','拿到了双日补给，今天先休息。'],['D5','内容解锁','正向','可以跳过昨天的任务直接做今天。'],['D10','回合目标','建议','对局中常驻显示还差几个回合。'],['D7','奖励节奏','正向','七日奖励很明确，准备继续参加。'],['D2','参与体验','正向','每天一小段，安排得挺轻松。'],['D11','玩法引导','负向','第一次玩 CS，不清楚什么时候任务才算完成。'],['D14','内容解锁','建议','结束前提醒一下还有哪些天没有补完。']
 ],
 'supply-calendar':[
  ['D7','补给分类','负向','捡了很多物资，但种类数还是没够。'],['D8','目标说明','建议','直接列出还差哪一类补给。'],['D7','补给分类','负向','同一类物资重复拾取没有推进进度。'],['D3','奖励节奏','正向','双日奖励已经领了，后面先放一放。'],['D9','路线引导','建议','给新人推荐一条容易找全物资的路线。'],['D4','参与体验','正向','补给任务和正常对局可以一起做。'],['D8','目标说明','负向','我以为拾取四件就够，后来才知道要不同种类。'],['D10','内容解锁','正向','昨天没完成不会挡住今天的任务。'],['D12','奖励节奏','建议','把最终奖励提前展示出来。'],['D7','补给分类','建议','拾取到新种类时给出计数提示。']
 ]};
for(const activity of activities){
 const candidates=players.filter(p=>p.activityId===activity.id&&!p.excluded);
 const candidateIds=new Set(candidates.map(p=>p.id));
 const states=task_states.filter(s=>s.activityId===activity.id);
 for(const [i,template] of feedbackTemplates[activity.id].entries()){
  const [taskId,topic,sentiment,text]=template;
  const eligible=states.filter(s=>s.taskId===taskId&&candidateIds.has(s.playerId)&&Math.max(s.unlockedAt+90,(s.attemptedAt??s.unlockedAt)+40)+180<END);
  const matching=eligible.filter(s=>s.attemptedAt!=null&&(sentiment!=='负向'||s.completedAt==null));
  const state=matching.length?matching[(i*17)%matching.length]:eligible[i%eligible.length];
  if(!state)throw new Error(`No eligible feedback state: ${activity.id}/${taskId}`);
  const p=candidates.find(p=>p.id===state.playerId);
  const createdAt=Math.max(p.exposedAt+90,state.unlockedAt+90,(state.attemptedAt??state.unlockedAt)+40)+integer(30,180);
  feedback.push({id:`FB-${activity.id}-${i+1}`,activityId:activity.id,taskId,day:Math.floor(createdAt/DAY)+1,source:i%2?'社区':'游戏内',topic,sentiment,playerId:p.id,segment:p.segment,region:p.region,text,createdAt});
 }
}
const source=(label,description)=>({label,description,tables:[label],caveats:['固定种子 AI 模拟数据，非 Garena 生产记录。','活动、任务、奖励和玩家反馈均为虚拟案例。','当前界面仅计入模拟快照时间之前的行为。']});
const entries={
 players:[players,'模拟 · 玩家与活动曝光','一行一名活动玩家；activityId隔离活动，首次曝光和人群属性。'],
 matches:[matches,'模拟 · 对局与活动行为','一行一场玩家对局；动作计数、地图、模式及结算状态。'],
 task_states:[task_states,'模拟 · 玩家任务状态','一行一个活动玩家任务；任务链按前置解锁，日历按发布日期独立解锁。'],
 task_events:[task_events,'模拟 · 任务事件流水','一行一个解锁、尝试或完成事件；每次尝试独立记录。'],
 activities:[activities,'模拟 · 活动配置','两个活动类型，五个14天活动及有效体验定义。'],
 activity_tasks:[activity_tasks,'模拟 · 任务配置','活动任务定义、发布日期、前置关系及超时统计时长。'],
 reward_events:[reward_events,'模拟 · 奖励领取','一行一次奖励领取；时间位于对应任务完成之后。滑轨试炼奖励为本轮新增模拟。'],
 feedback:[feedback,'模拟 · 玩家反馈','AI撰写的虚拟社区及游戏内反馈；关联活动、任务和模拟玩家，不是真实抓取内容。']
};
snapshot.queries=Object.fromEntries(Object.entries(entries).map(([key,[rows,label,description]])=>[key,{rows,source:source(label,description)}]));
snapshot.buildStatus='updating';snapshot.status='fixture';snapshot.subtitle='五个活动 · 两种内容类型';
fs.writeFileSync(path,JSON.stringify(snapshot));
console.log(JSON.stringify(Object.fromEntries(Object.entries(entries).map(([key,[rows]])=>[key,rows.length])),null,2));
