import {DAY,END,DEFAULT_FILTERS,dayOf,inPeriod,scopedPlayers,indexData} from './engine.mjs';

const selectionCache=new WeakMap();
const rowsOf=value=>Array.isArray(value)?value:(value?.rows||[]);
export function selectActivityData(allQueryRows,activityId='rail-trial') {
  let selections=selectionCache.get(allQueryRows);
  if(!selections){selections=new Map();selectionCache.set(allQueryRows,selections);}
  if(selections.has(activityId))return selections.get(activityId);
  const scoped=name=>rowsOf(allQueryRows[name]).filter(row=>(row.activityId||'rail-trial')===activityId);
  const activity=rowsOf(allQueryRows.activities).find(row=>row.id===activityId);
  const data={activity,tasks:scoped('activity_tasks'),players:scoped('players'),matches:scoped('matches'),task_states:scoped('task_states'),task_events:scoped('task_events'),feedback:scoped('feedback'),reward_events:scoped('reward_events')};
  if(!data.tasks.length)delete data.tasks;
  selections.set(activityId,data);return data;
}

// Participation uses settled matches (attributed to start day) or occurred task attempts.
export function participationTrend(data,filters=DEFAULT_FILTERS,asOf=END) {
  const cutoff=Math.min(asOf,END),players=scopedPlayers(data,filters,cutoff),ids=new Set(players.map(p=>p.id));
  const perDay=new Map();
  const add=(id,time)=>{if(!ids.has(id)||time>cutoff||time>=END||!inPeriod(time,filters,cutoff))return;const day=dayOf(time);if(!perDay.has(day))perDay.set(day,new Set());perDay.get(day).add(id);};
  for(const match of data.matches)if(match.settledAt<=cutoff)add(match.playerId,match.startedAt);
  for(const event of data.task_events||[])if(event.event==='尝试')add(event.playerId,event.time);
  const rows=[];
  for(let day=1;day<=Math.min(14,dayOf(cutoff));day++)if(inPeriod((day-1)*DAY,filters,cutoff))rows.push({day,date:`11/${String(day+2).padStart(2,'0')}`,participants:perDay.get(day)?.size||0});
  return rows;
}

export function behaviorGroups(data,filters=DEFAULT_FILTERS,asOf=END,taskId) {
  const cutoff=Math.min(asOf,END),idx=indexData(data),players=scopedPlayers(data,filters,cutoff);
  const definitions=[
    {id:'attempt-stall',title:'中途停滞',labels:[data.activity?.typeKey==='daily'?'完成过其他任务':'完成前序任务','尝试当前任务','48 小时无新行为','任务未完成']},
    {id:'reward-stop',title:'领奖后未继续',labels:['完成阶段任务','领取奖励','48 小时无新行为','仍有未完成任务']},
    {id:'not-started',title:'已解锁未尝试',labels:['看到活动','任务解锁','已满统计时长','尚未尝试']}
  ];
  const groups=definitions.map(d=>({...d,count:0,players:[],taskIds:[],examples:[]}));
  for(const player of players){
    const states=(idx.states.get(player.id)||[]).filter(s=>s.unlockedAt<=cutoff&&s.unlockedAt+s.window<=cutoff&&(!taskId||s.taskId===taskId)&&inPeriod(s.unlockedAt,filters,cutoff)&&(s.completedAt==null||s.completedAt>cutoff));
    if(!states.length)continue;
    const matches=(idx.matches.get(player.id)||[]).filter(m=>m.startedAt<=cutoff);
    const rewards=(idx.rewards.get(player.id)||[]).filter(r=>r.claimedAt<=cutoff);
    const actualEvents=(idx.events.get(player.id)||[]).filter(e=>e.time<=cutoff&&e.event!=='解锁');
    const lastAction=Math.max(player.exposedAt,...matches.map(m=>Math.min(cutoff,m.settledAt)),...actualEvents.map(e=>e.time),...rewards.map(r=>r.claimedAt));
    const stalled=states.find(s=>{
      const attempts=new Set(actualEvents.filter(e=>e.taskId===s.taskId&&e.event==='尝试').map(e=>e.time));
      for(const m of matches)if(m.startedAt>=s.unlockedAt&&((m.taskId&&m.taskId===s.taskId)||(!m.taskId&&m.railAttempt)))attempts.add(m.startedAt+3);
      const completedOther=(idx.states.get(player.id)||[]).some(other=>other.taskId!==s.taskId&&other.completedAt!=null&&other.completedAt<=cutoff&&(data.activity?.typeKey==='daily'||other.completedAt<s.unlockedAt));
      return attempts.size>=1&&completedOther&&cutoff-lastAction>=2*DAY;
    });
    const latestReward=rewards.slice().sort((a,b)=>b.claimedAt-a.claimedAt)[0];
    const rewardStop=latestReward&&cutoff-latestReward.claimedAt>=2*DAY&&lastAction===latestReward.claimedAt;
    const unattempted=states.find(s=>s.attemptedAt==null||s.attemptedAt>cutoff);
    const group=stalled?groups[0]:rewardStop?groups[1]:unattempted?groups[2]:null;
    if(!group)continue;
    const state=stalled||(rewardStop?states[0]:unattempted);
    group.players.push(player);group.taskIds.push(state.taskId);group.examples.push({playerId:player.id,taskId:state.taskId,lastActionAt:lastAction,rewardName:latestReward?.rewardName||null});
  }
  return groups.map(group=>{
    const counts=new Map();for(const id of group.taskIds)counts.set(id,(counts.get(id)||0)+1);
    const frequent=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
    const count=group.players.length;
    const summary=count?`${count} 人${group.id==='attempt-stall'?'尝试后 48 小时无新行为':group.id==='reward-stop'?'领奖后 48 小时未继续':'尚未尝试已解锁任务'}${frequent?`，集中在 ${frequent[0]}`:''}`:'当前范围暂无该类玩家';
    return {id:group.id,title:group.title,count,players:group.players,taskId:taskId||frequent?.[0]||null,steps:group.labels.map(label=>({label,count})),summary,examples:group.examples};
  });
}
