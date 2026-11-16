import React,{useMemo} from 'react';
import {EvidenceChart,useDataApp} from '../../data-app-public.jsx';
import {DAY,END,visibleEvidence,scopedPlayers} from './engine.mjs';
import {selectActivityData,participationTrend} from './platform-data.mjs';
import {Tag,n} from './components.jsx';
import {Icon} from './visuals.jsx';

export function participationSummary(rows,asOf){
 const complete=rows.filter(r=>r.day<=Math.floor(Math.min(END,asOf)/DAY)),recent=complete.slice(-3),previous=complete.slice(-6,-3);
 if(!recent.length)return '活动参与记录开始累积';
 const latest=recent.at(-1);if(previous.length<3||recent.length<3)return `${latest.date} 有 ${n(latest.participants)} 人参与`;
 const a=recent.reduce((s,r)=>s+r.participants,0)/3,b=previous.reduce((s,r)=>s+r.participants,0)/3;
 if(!b)return `近 3 日日均 ${n(Math.round(a))} 人参与`;
 const change=(a-b)/b;if(Math.abs(change)<.03)return `近 3 日日均 ${n(Math.round(a))} 人参与，参与规模稳定`;
 return `近 3 日日均参与较前 3 日${change>0?'增长':'下降'} ${Math.abs(change*100).toFixed(1)}%`;
}

function ActivityCard({allRows,activity,filters,asOf,onSelect,selected}){
 const {visible}=useDataApp(),data=useMemo(()=>selectActivityData(allRows,activity.id),[allRows,activity.id]);
 const rows=useMemo(()=>participationTrend(data,filters,asOf),[data,filters,asOf]);
 const evidence=useMemo(()=>({...visibleEvidence(data,scopedPlayers(data,filters,asOf),asOf),activities:[activity]}),[data,filters,asOf,activity]);
 const last=rows.filter(r=>r.day<=Math.floor(Math.min(END,asOf)/DAY)).at(-1);
 const cardId='platform-activity-'+activity.id;if(!visible(cardId))return null;
 return <EvidenceChart id={cardId} variant="card" title={activity.name} className={`pf-activity-card ${activity.typeKey} ${selected?'is-selected':''}`} queryId="players" queryIds={Object.keys(evidence)} rows={rows} sourceRowsByQuery={evidence}
  spec={{type:'line',x:'date',y:'participants',colors:{participants:'#c9233f'},showLegend:false,showXAxisLabel:false,startAtZero:true,valueDecimals:0,legend:{labels:{participants:'参与人数'}}}} height={156}
  renderPlot={plot=><><div className="pf-card-tags"><Tag tone={activity.typeKey==='chain'?'red':'violet'}>{activity.type}</Tag><span>{data.tasks.length} 个任务</span></div><p className="pf-activity-verdict" data-reviewed-rows>{participationSummary(rows,asOf)}</p>{plot}</>}
  chartOptions={{getMarkActions:({row})=>[{label:'查看当日数据',onSelect:()=>onSelect(activity.id,'performance',{period:'全部 14 天',day:row.day})}]}}>
  <div className="pf-activity-footer"><span data-reviewed-rows>{last?<><b>{n(last.participants)}</b> 人 · {last.date}</>:'暂无参与记录'}</span><button className="pf-button" aria-label={`打开${activity.name}数据表现`} onClick={()=>onSelect(activity.id,'performance')}>查看数据<Icon name="arrow" size={16}/></button></div>
 </EvidenceChart>;
}

export default function OverviewView({allRows,activities,filters,asOf,typeFilter,selectedActivityId,onSelect}){
 const shown=activities.filter(a=>typeFilter==='全部类型'||a.type===typeFilter);
 return <section className="pf-overview"><div className="pf-view-caption"><h2>全部活动 <span>{shown.length}</span></h2><div><Tag>任务链</Tag><Tag tone="violet">按天解锁</Tag></div></div><div className="pf-activity-grid">{shown.map(a=><ActivityCard key={a.id} allRows={allRows} activity={a} filters={filters} asOf={asOf} onSelect={onSelect} selected={selectedActivityId===a.id}/>)}</div>{!shown.length&&<div className="ff-empty">暂无匹配活动</div>}</section>;
}
