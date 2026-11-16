import {analyze,alertCandidates,DAY,END,RULES,dayOf,inPeriod,visibleEvidence,pct} from './engine.mjs';
import {behaviorGroups} from './platform-data.mjs';

function dailyExperience(result){
 const days=new Map();
 for(const row of result.experiences){
  if(!row.mature)continue;
  const day=dayOf(row.exposedAt),value=days.get(day)||{day,yes:0,total:0};
  value.total++;if(row.success)value.yes++;days.set(day,value);
 }
 return days;
}

export function buildPlatformAlerts(data,filters,asOf){
 const base=alertCandidates(data,filters,asOf).map(alert=>({...alert,kindLabel:alert.type==='task'?'任务受阻':alert.type==='experience'?'体验不足':'再次体验不足'}));
 const times=[asOf-10,asOf-5,asOf].map(time=>Math.max(0,Math.min(time,END)));
 const snapshots=times.map(time=>analyze(data,filters,time));
 const daily=snapshots.map(dailyExperience);
 const runs=[];let run=[];
 for(let day=1;day<=14;day++){
  const bad=daily.every(days=>{const value=days.get(day);return value&&value.total>=RULES.minSample&&value.yes/value.total<RULES.experience;});
  if(bad)run.push(day);else{if(run.length>=2)runs.push(run);run=[];}
 }
 if(run.length>=2)runs.push(run);
 const recent=runs.at(-1);
 let alerts=base;
 if(recent){
  const start=recent[0],end=recent.at(-1),values=recent.map(day=>daily[2].get(day));
  const yes=values.reduce((sum,row)=>sum+row.yes,0),total=values.reduce((sum,row)=>sum+row.total,0);
  const periodLabel=`第 ${start}—${end} 天`;
  alerts=base.filter(alert=>alert.type!=='experience');
  alerts.push({key:`experience-from-${start}`,type:'experience',kindLabel:'日期体验异常',title:`第 ${start} 天起体验率偏低`,periodLabel,extraFilters:{fromDay:start,toDay:end},metric:{yes,total,pending:0,rate:yes/total},threshold:RULES.experience});
 }
 const priority={task:0,experience:1,repeat:2};
 return alerts.sort((a,b)=>priority[a.type]-priority[b.type]||(b.metric.rate-b.threshold)-(a.metric.rate-a.threshold));
}

const sameSegment=(a,b)=>a===b||(a==='活跃玩家'&&b==='老玩家')||(a==='老玩家'&&b==='活跃玩家');
export function alertInsight(data,filters,asOf,alert){
 const scoped={...filters,...alert.extraFilters};
 const result=analyze(data,scoped,asOf);
 const task=result.tasks.find(value=>value.id===alert.taskId);
 const rows=alert.type==='task'?(task?.rows||[]):alert.type==='repeat'?result.repeats:result.experiences;
 const problems=rows.filter(row=>row.mature&&!row.success);
 const problemIds=new Set(problems.map(row=>row.id));
 const metric=alert.type==='task'?task?.metric:alert.type==='repeat'?result.repeat:result.experience;
 const states=[...new Set(problems.map(row=>row.status))].map(status=>({status,count:problems.filter(row=>row.status===status).length})).sort((a,b)=>b.count-a.count);
 const patterns=behaviorGroups(data,scoped,asOf,alert.taskId).map(group=>({...group,count:group.players.filter(player=>problemIds.has(player.id)).length})).filter(group=>group.count>0);
 const scopedIds=new Set(result.players.map(player=>player.id));
 const feedback=(data.feedback||[]).filter(row=>
  row.createdAt<=Math.min(asOf,END)&&inPeriod(row.createdAt,scoped,asOf)&&scopedIds.has(row.playerId)&&
  (!alert.taskId||row.taskId===alert.taskId)&&
  (filters.region==='全部地区'||row.region===filters.region)&&
  (filters.segment==='全部玩家'||sameSegment(row.segment,filters.segment))
 ).sort((a,b)=>(a.sentiment==='正向'?1:0)-(b.sentiment==='正向'?1:0)||b.createdAt-a.createdAt);
 const primary=states[0];
 let cause='后续内容的参与动力不足，首次体验后没有形成连续游玩。';
 let actions=['在首次体验结算页展示下一步任务与奖励。','对已体验但未回访玩家推送一次活动提醒。'];
 if(primary?.status==='未尝试'||primary?.status.includes('未进入')){
  cause='任务入口或目标玩法引导不足，玩家在开始体验前流失。';
  actions=['在任务卡上增加一键进入目标模式。','在任务解锁时展示目标位置与简短操作示例。'];
 }else if(primary?.status.includes('未达成')||primary?.status==='已尝试未完成'||primary?.status.includes('未完成')){
  cause='玩家已经尝试，但任务操作或达成条件阻碍了首次完成。';
  actions=['在互动点展示达成条件和实时进度。','核对互动成功、对局结算与任务完成事件，修复失败路径。'];
 }else if(primary?.status==='超时后完成'){
  cause='玩家对局间隔较长，任务解锁后未及时继续，部分玩家稍后才完成。';
  actions=['按玩家常用游戏时段安排任务投放和解锁提醒。','减少进入目标模式与完成前置操作的步骤，缩短任务启动时间。'];
 }else if(primary?.status.includes('未尝试')||primary?.status.includes('未互动')){
  cause='玩家已进入玩法，但缺少目标互动提示。';
  actions=['强化目标互动位置与可操作提示。','将首次互动目标放到任务卡首行。'];
 }
 const stoppedAfterReward=patterns.find(group=>group.id==='reward-stop');
 const attemptStall=patterns.find(group=>group.id==='attempt-stall');
 const signals=[];
 if(primary)signals.push({label:primary.status,value:primary.count,unit:'人',description:'受影响玩家中的主要行为'});
 const largestPattern=[attemptStall,stoppedAfterReward].filter(Boolean).sort((a,b)=>b.count-a.count)[0];
 if(largestPattern)signals.push({label:largestPattern.id==='attempt-stall'?'中途停滞 48 小时':'领奖后 48 小时未继续',value:largestPattern.count,unit:'人',description:'任务仍未完成'});
 if(stoppedAfterReward&&stoppedAfterReward.count>=Math.max(1,problems.length*.35)){
  cause='阶段奖励之后缺少继续完成任务的吸引力，玩家的参与停在领奖节点。';
  actions=['在领奖页展示下一阶段奖励与剩余任务。','将后续任务拆成更短的目标，并提前露出终点奖励。'];
 }
 if(feedback.length)signals.push({label:'相关玩家反馈',value:feedback.length,unit:'条',description:'游戏内与社区模拟反馈'});
 const majorFeedback=feedback.find(row=>row.sentiment!=='正向');
 let feedbackHint='';
 if(majorFeedback){
  feedbackHint=`玩家集中提到「${majorFeedback.topic}」。`;
  if(/条件|判定|距离|进度|操作/.test(majorFeedback.topic))actions[0]='把完成条件、操作步骤与当前进度放到任务和互动界面。';
  if(/时间|节奏|截止|解锁/.test(majorFeedback.topic))actions[0]='明确当天内容解锁时间，并按玩家对局间隔安排提醒节奏。';
  if(/奖励/.test(majorFeedback.topic))actions[0]='前置展示下一阶段奖励，缩短两个奖励节点之间的任务距离。';
 }
 const threshold=alert.threshold??(alert.type==='task'?RULES.blocked:RULES[alert.type]);
 const gap=metric?.rate==null?null:Math.abs(metric.rate-threshold)*100;
 const issue=alert.type==='task'
  ?`${task?.id||alert.taskId}「${task?.name||alert.title}」超时率 ${pct(metric?.rate)}，高于预警线 ${gap?.toFixed(1)||'0.0'} 个百分点。`
  :alert.type==='experience'
   ?`${alert.periodLabel||'当前范围'}的有效体验转化率为 ${pct(metric?.rate)}，低于预警线 ${gap?.toFixed(1)||'0.0'} 个百分点。`
   :`首次体验后的 24 小时再次体验率为 ${pct(metric?.rate)}，低于预警线 ${gap?.toFixed(1)||'0.0'} 个百分点。`;
 const sourcePlayers=result.players.filter(player=>problemIds.has(player.id)||feedback.some(row=>row.playerId===player.id));
 const evidence={...visibleEvidence(data,sourcePlayers,asOf),feedback};
 return {task,metric,problems,states,patterns,feedback,signals,cause,actions,feedbackHint,issue,evidence,scope:scoped};
}
