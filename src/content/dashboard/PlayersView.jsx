import React,{useEffect,useMemo,useState} from 'react';
import {analyze,clockTime,inPeriod,pct,playerTimeline,scopedPlayers,visibleEvidence} from './engine.mjs';
import {behaviorGroups} from './platform-data.mjs';
import {Block,Dialog,Tag,n} from './components.jsx';
import {GlassTabs} from './platform-ui.jsx';
import {Icon} from './visuals.jsx';
import './players-guide.css';

const SEGMENTS=['新玩家','活跃玩家','回流玩家'];
const segmentName=value=>value==='活跃玩家'?'老玩家':value;
const keyOf=data=>data.activity?.id||'rail-trial';

function evidenceFor(data,players,asOf){
 const ids=new Set(players.map(player=>player.id));
 return {...visibleEvidence(data,players,asOf),reward_events:(data.reward_events||[]).filter(row=>ids.has(row.playerId)&&(row.time??row.claimedAt??row.createdAt)<=asOf)};
}

function keyBehaviorEvents(data,player,asOf,group,taskId){
 if(!player)return [];
 const task=data.tasks.find(item=>item.id===taskId);
 const state=data.task_states.find(row=>row.playerId===player.id&&row.taskId===taskId&&row.unlockedAt<=asOf);
 const example=group?.examples?.find(row=>row.playerId===player.id);
 const all=playerTimeline(data,player,asOf);
 const currentName=`${taskId} · ${task?.name||'任务'}`;
 const rows=[];
 const push=row=>{if(row&&row.time<=asOf&&!rows.some(item=>item.time===row.time&&item.kind===row.kind&&item.text===row.text))rows.push(row);};
 const attempts=(data.task_events||[]).filter(row=>row.playerId===player.id&&row.taskId===taskId&&row.event==='尝试'&&row.time<=asOf).sort((a,b)=>a.time-b.time);
 if(!attempts.length&&state?.attemptedAt!=null&&state.attemptedAt<=asOf)attempts.push({time:state.attemptedAt});
 const reward=(data.reward_events||[]).filter(row=>row.playerId===player.id&&row.claimedAt<=asOf).sort((a,b)=>b.claimedAt-a.claimedAt)[0];
 const otherCompletions=data.task_states.filter(row=>row.playerId===player.id&&row.taskId!==taskId&&row.completedAt!=null&&row.completedAt<=asOf).sort((a,b)=>a.completedAt-b.completedAt);
 const preceding=group?.id==='reward-stop'&&reward?otherCompletions.find(row=>row.taskId===reward.taskId):otherCompletions.filter(row=>row.completedAt<=(attempts[0]?.time??state?.unlockedAt??asOf)).at(-1)||otherCompletions[0];
 if(preceding)push({time:preceding.completedAt,kind:'已完成任务',text:`${preceding.taskId} · ${data.tasks.find(item=>item.id===preceding.taskId)?.name||'任务完成'}`});
 else if(group?.id==='not-started')push({time:player.exposedAt,kind:'活动曝光',text:`首次看到「${data.activity?.name||'活动'}」`});
 if(state)push({time:state.unlockedAt,kind:'目标任务解锁',text:currentName});
 if(attempts[0])push({time:attempts[0].time,kind:'首次尝试目标任务',text:currentName});
 if(attempts.length>1&&attempts.at(-1).time!==attempts[0].time)push({time:attempts.at(-1).time,kind:'再次尝试目标任务',text:currentName});
 if(group?.id==='reward-stop'&&reward)push({time:reward.claimedAt,kind:'领取奖励',text:reward.rewardName});
 const lastActionAt=example?.lastActionAt;
 if(lastActionAt!=null){
  const existing=rows.find(row=>row.time===lastActionAt);
  if(existing)existing.kind+=' · 最后活动';
  else{
   const actual=all.filter(row=>row.time===lastActionAt&&row.kind!=='任务解锁').at(-1);
   const raw=(data.task_events||[]).find(row=>row.playerId===player.id&&row.time===lastActionAt&&row.event!=='解锁');
   const lastMatch=data.matches.find(row=>row.playerId===player.id&&row.settledAt===lastActionAt);
   const actionTaskId=lastMatch?.taskId||raw?.taskId;
   if(actual)push({time:lastActionAt,kind:'最后活动行为',text:`${actionTaskId&&!actual.text.startsWith(`${actionTaskId} ·`)?actionTaskId+' · ':''}${actual.kind} · ${actual.text}`});
   else if(raw)push({time:lastActionAt,kind:'最后活动行为',text:`${raw.taskId} · ${raw.event}`});
  }
 }
 rows.sort((a,b)=>a.time-b.time);
 const hours=Math.max(0,Math.floor((asOf-(group?.id==='reward-stop'&&reward?reward.claimedAt:lastActionAt??asOf))/60));
 const status=group?.id==='not-started'?`${taskId} 解锁已 ${Math.max(0,Math.floor((asOf-(state?.unlockedAt??asOf))/60))} 小时，尚未尝试`:`${taskId} 未完成 · ${group?.id==='reward-stop'?'领奖后未继续':'已停滞'} ${hours} 小时`;
 rows.push({time:asOf,kind:'当前状态',text:status,derived:true});
 return rows;
}

function ScopeSelect({label,value,options,onChange}){
 return <label className="pg-select"><span>{label}</span><select value={value} aria-label={label} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
}

function PlayerDialog({data,player,asOf,onClose}){
 const events=playerTimeline(data,player,asOf);
 return <Dialog title={`${player.id} · 行为时间线`} onClose={onClose} wide><div className="ff-dialog-body pg-player-dialog"><div className="pg-player-meta"><Tag>{player.region}</Tag><Tag>{segmentName(player.segment)}</Tag><Tag>{player.preference}</Tag><span>{clockTime(asOf)}</span></div><Block id={`observation-player-${keyOf(data)}`} title="活动行为" rows={events} evidence={evidenceFor(data,[player],asOf)}><ol className="pg-event-timeline" data-reviewed-rows>{events.map((event,index)=><li key={`${event.time}-${index}`} className={/未成功|失败|超时/.test(event.kind+' '+event.text)?'pg-event-alert':''}><time>{clockTime(event.time)}</time><span className="pg-event-dot"/><div><b>{event.kind}</b><p>{event.text}</p></div></li>)}</ol>{!events.length&&<div className="pg-empty">暂无活动行为</div>}</Block></div></Dialog>;
}

function MetricBar({label,metric,onClick,negative=false}){
 return <button type="button" className={'pg-metric-row '+(negative?'pg-metric-negative':'')} onClick={onClick}><span className="pg-metric-label"><span>{label}</span><strong>{pct(metric.rate)}</strong></span><span className="pg-bar"><i style={{width:`${Math.max(0,Math.min(100,(metric.rate||0)*100))}%`}}/></span><span className="pg-metric-count">{n(metric.yes)} / {n(metric.total)} 人<Icon name="arrow" size={14}/></span></button>;
}

export default function PlayersView({data,filters,asOf,onInspect,focusTaskId}){
 const [taskScope,setTaskScope]=useState(focusTaskId||'all');
 const [groupId,setGroupId]=useState('attempt-stall');
 const [showGroupPlayers,setShowGroupPlayers]=useState(false);
 const [groupPage,setGroupPage]=useState(0);
 const [segment,setSegment]=useState('全部玩家');
 const [source,setSource]=useState('全部来源');
 const [sentiment,setSentiment]=useState('全部声音');
 const [voicePage,setVoicePage]=useState(0);
 const [inspectedPlayer,setInspectedPlayer]=useState(null);
 const activityId=keyOf(data);
 useEffect(()=>{setTaskScope(focusTaskId||'all');setShowGroupPlayers(false);setGroupPage(0);setVoicePage(0);setInspectedPlayer(null);},[activityId,focusTaskId]);
 useEffect(()=>{setGroupPage(0);setShowGroupPlayers(false);},[groupId,taskScope,filters]);
 useEffect(()=>setVoicePage(0),[taskScope,source,sentiment,filters]);
 useEffect(()=>setSegment('全部玩家'),[activityId,filters.segment]);

 const groups=useMemo(()=>behaviorGroups(data,filters,asOf,taskScope==='all'?undefined:taskScope),[data,filters,asOf,taskScope]);
 useEffect(()=>setGroupId(groups.find(group=>group.count>0)?.id||groups[0]?.id||'attempt-stall'),[data,filters,taskScope]);
 const activeGroup=groups.find(group=>group.id===groupId)||groups[0];
 const groupPlayers=activeGroup?.players||[];
 useEffect(()=>setGroupPage(page=>Math.min(page,Math.max(0,Math.ceil(groupPlayers.length/8)-1))),[groupPlayers.length]);
 const representativeId=activeGroup?.examples?.find(example=>example.taskId===activeGroup.taskId)?.playerId;
 const representative=groupPlayers.find(player=>player.id===representativeId)||groupPlayers[0];
 const representativeTaskId=activeGroup?.examples?.find(example=>example.playerId===representative?.id)?.taskId||activeGroup?.taskId;
 const representativeEvents=useMemo(()=>keyBehaviorEvents(data,representative,asOf,activeGroup,representativeTaskId),[data,representative,asOf,activeGroup,representativeTaskId]);
 const groupEvidence=useMemo(()=>evidenceFor(data,groupPlayers,asOf),[data,groupPlayers,asOf]);
 const allEvidence=useMemo(()=>evidenceFor(data,scopedPlayers(data,filters,asOf),asOf),[data,filters,asOf]);
 const comparisonTaskId=useMemo(()=>taskScope==='all'?analyze(data,filters,asOf).worst.id:taskScope,[data,filters,asOf,taskScope]);
 const categoryRows=useMemo(()=>SEGMENTS.filter(name=>filters.segment==='全部玩家'||filters.segment===name).map(name=>{
  const result=analyze(data,{...filters,segment:name},asOf);
  const task=result.tasks.find(item=>item.id===comparisonTaskId)||result.worst;
  return {name,result,task};
 }),[data,filters,asOf,comparisonTaskId]);
 const shownCategories=categoryRows.filter(row=>segment==='全部玩家'||row.name===segment);
 const categoryOptions=[{id:'全部玩家',label:'全部玩家'},...categoryRows.map(row=>({id:row.name,label:segmentName(row.name)}))];
 const playersById=useMemo(()=>new Map(data.players.map(player=>[player.id,player])),[data]);
 const voices=useMemo(()=>(data.feedback||[]).filter(row=>{
  const player=playersById.get(row.playerId);
  const time=row.createdAt??row.time;
  return (!player||(!player.excluded&&player.exposedAt<=asOf))&&time<=asOf&&inPeriod(time,filters,asOf)&&(taskScope==='all'||row.taskId===taskScope)&&
   (filters.region==='全部地区'||(player?.region||row.region)===filters.region)&&
   (filters.segment==='全部玩家'||(player?.segment||row.segment)===filters.segment)&&
   (filters.preference==='全部偏好'||player?.preference===filters.preference)&&
   (source==='全部来源'||row.source===source)&&(sentiment==='全部声音'||row.sentiment===sentiment);
 }).sort((a,b)=>(b.createdAt??b.time)-(a.createdAt??a.time)),[data,playersById,asOf,filters,taskScope,source,sentiment]);
 const voiceEvidence=useMemo(()=>({feedback:voices,players:data.players.filter(player=>voices.some(row=>row.playerId===player.id))}),[voices,data]);
 const taskOptions=[{id:'all',label:'全部任务'},...data.tasks.filter(task=>(task.releaseAt??0)<=asOf).map(task=>({id:task.id,label:`${task.id} · ${task.short||task.name}`}))];
 const openMetric=(type,category)=>onInspect?.({type,taskId:type==='task'?category.task.id:null,extra:{segment:category.name},outcome:type==='task'?'超时玩家':type==='experience'?'未有效体验':'未再次体验'});

 return <div className="pg-view">
  <div className="pg-scope-bar"><ScopeSelect label="观察任务" value={taskScope} options={taskOptions} onChange={setTaskScope}/>{taskScope!=='all'&&<button className="pg-text-button" onClick={()=>setTaskScope('all')}>查看全部任务</button>}</div>

  <section className="pg-section pg-behaviors" aria-labelledby="pg-behaviors-title">
   <div className="pg-section-title"><span>01</span><h2 id="pg-behaviors-title">典型玩家路径</h2></div>
   <GlassTabs label="典型玩家分类" value={activeGroup?.id||groupId} onChange={setGroupId} items={groups.map(group=>({id:group.id,label:group.title,badge:group.count}))}/>
   <Block id={`behavior-path-${activityId}`} title={activeGroup?.title||'典型玩家路径'} rows={groups.map(group=>({类型:group.title,人数:group.count}))} evidence={allEvidence} className="pg-behavior-card">
    <div className="pg-path-summary" data-reviewed-rows><div><strong>{n(activeGroup?.count||0)}</strong><span>名玩家</span></div><p>{activeGroup?.summary}</p></div>
    <ol className="pg-path-steps" data-reviewed-rows>{(activeGroup?.steps||[]).map((step,index)=><li key={`${step.label}-${index}`}><span>{index+1}</span><b>{step.label}</b><strong>{n(step.count)}<small> 人</small></strong></li>)}</ol>
    {representative?<><div className="pg-sample-header"><div><h3>代表玩家</h3><span>{representative.id}</span><Tag>{segmentName(representative.segment)}</Tag><Tag tone="red">{representativeTaskId} 未完成</Tag></div><button className="pg-text-button" onClick={()=>setInspectedPlayer(representative)}>完整时间线<Icon name="arrow" size={16}/></button></div><Block id={`behavior-sample-${activityId}`} title="关键行为" rows={representativeEvents} evidence={evidenceFor(data,[representative],asOf)} className="pg-sample-card"><ol className="pg-event-timeline pg-compact-timeline" data-reviewed-rows>{representativeEvents.map((event,index)=><li key={`${event.time}-${index}`} className={(event.derived?'pg-derived-state ':'')+(/未成功|失败|超时/.test(event.kind+' '+event.text)?'pg-event-alert':'')}><time>{event.derived?'当前':clockTime(event.time)}</time><span className="pg-event-dot"/><div><b>{event.kind}</b><p>{event.text}</p></div></li>)}</ol></Block><button className="pg-group-toggle" onClick={()=>setShowGroupPlayers(value=>!value)} aria-expanded={showGroupPlayers}>{showGroupPlayers?'收起同类玩家':`查看同类玩家 · ${n(groupPlayers.length)} 人`}<Icon name="arrow" size={16}/></button></>:<div className="pg-empty">当前范围暂无此类玩家</div>}
   </Block>
   {showGroupPlayers&&<Block id={`behavior-members-${activityId}`} title="同类玩家" rows={groupPlayers} evidence={groupEvidence} className="pg-members-card"><div className="pg-members" data-reviewed-rows>{groupPlayers.slice(groupPage*8,groupPage*8+8).map(player=><button key={player.id} onClick={()=>setInspectedPlayer(player)}><div><b>{player.id}</b><span>{player.region} · {segmentName(player.segment)}</span></div><Icon name="arrow" size={17}/></button>)}</div><div className="pg-pagination"><span>{groupPlayers.length?`${groupPage*8+1}–${Math.min((groupPage+1)*8,groupPlayers.length)} / ${n(groupPlayers.length)}`:'0 人'}</span><button disabled={!groupPage} onClick={()=>setGroupPage(value=>value-1)}>上一页</button><button disabled={(groupPage+1)*8>=groupPlayers.length} onClick={()=>setGroupPage(value=>value+1)}>下一页</button></div></Block>}
  </section>

  <section className="pg-section pg-categories" aria-labelledby="pg-categories-title">
   <div className="pg-section-title"><span>02</span><h2 id="pg-categories-title">分类表现</h2></div>
   {categoryRows.length>1&&<GlassTabs label="分类表现人群" value={segment} onChange={setSegment} items={categoryOptions}/>}
   <Block id={`category-performance-${activityId}`} title="玩家参与表现" rows={shownCategories.map(row=>({玩家类型:segmentName(row.name),有效体验率:row.result.experience.rate,任务:row.task.id,任务超时率:row.task.metric.rate,再次体验率:row.result.repeat.rate}))} evidence={allEvidence} className="pg-category-block">
    <div className="pg-category-grid" data-reviewed-rows>{shownCategories.map(category=><article className="pg-category-card" key={category.name}><div className="pg-category-header"><h3>{segmentName(category.name)}</h3><span>{n(category.result.experience.total)} 人</span></div><MetricBar label="有效体验" metric={category.result.experience} onClick={()=>openMetric('experience',category)}/><MetricBar label={`${category.task.id} 任务超时`} metric={category.task.metric} negative onClick={()=>openMetric('task',category)}/><MetricBar label="再次体验" metric={category.result.repeat} onClick={()=>openMetric('repeat',category)}/></article>)}</div>
   </Block>
  </section>

  <section className="pg-section pg-voices" aria-labelledby="pg-voices-title">
   <div className="pg-section-title"><span>03</span><h2 id="pg-voices-title">玩家声音</h2><Tag>模拟反馈</Tag></div>
   <div className="pg-voice-filters"><ScopeSelect label="反馈来源" value={source} options={['全部来源','游戏内','社区'].map(value=>({id:value,label:value}))} onChange={setSource}/><ScopeSelect label="声音类型" value={sentiment} options={['全部声音','负向','建议','正向'].map(value=>({id:value,label:value}))} onChange={setSentiment}/><span className="pg-voice-count">{n(voices.length)} 条反馈</span></div>
   <Block id={`player-voices-${activityId}`} title="活动反馈" rows={voices} evidence={voiceEvidence} className="pg-feedback-block"><div className="pg-voice-grid" data-reviewed-rows>{voices.slice(voicePage*6,voicePage*6+6).map(voice=>{
    const player=playersById.get(voice.playerId);
    return <article className="pg-voice-card" key={voice.id}><div className="pg-voice-meta"><Tag tone={voice.sentiment==='负向'?'red':''}>{voice.sentiment}</Tag><span>{voice.source}</span><time>{clockTime(voice.createdAt??voice.time)}</time></div><h3>{voice.topic}</h3><blockquote>{voice.text}</blockquote><div className="pg-voice-footer"><span>{voice.taskId} · {segmentName(player?.segment||voice.segment||'玩家')}</span>{player&&<button className="pg-text-button" aria-label={`查看反馈玩家 ${player.id}`} onClick={()=>setInspectedPlayer(player)}>查看行为<Icon name="arrow" size={15}/></button>}</div></article>;
   })}</div>{!voices.length&&<div className="pg-empty">当前范围暂无反馈</div>}{voices.length>6&&<div className="pg-pagination"><span>{voicePage*6+1}–{Math.min((voicePage+1)*6,voices.length)} / {n(voices.length)}</span><button disabled={!voicePage} onClick={()=>setVoicePage(value=>value-1)}>上一页</button><button disabled={(voicePage+1)*6>=voices.length} onClick={()=>setVoicePage(value=>value+1)}>下一页</button></div>}</Block>
  </section>
  {inspectedPlayer&&<PlayerDialog data={data} player={inspectedPlayer} asOf={asOf} onClose={()=>setInspectedPlayer(null)}/>}
 </div>;
}
