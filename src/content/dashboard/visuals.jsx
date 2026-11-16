import React from 'react';
import {EvidenceChart,useDataApp} from '../../data-app-public.jsx';
import {pct} from './engine.mjs';
import {n} from './components.jsx';

export function Icon({name,size=20}){
 const paths={grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,experience:<><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 6"/></>,task:<><path d="M6 4v16M6 6h12M6 12h12M6 18h12"/><circle cx="6" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="6" cy="18" r="2"/></>,repeat:<><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/></>,bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,refresh:<><path d="M20 7a9 9 0 1 0 1 8M20 2v5h-5"/></>,help:<><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/></>,filter:<><path d="M3 5h18M6 12h12M9 19h6"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/></>,arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>};
 paths.people=<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></>;paths.menu=<path d="M4 6h16M4 12h16M4 18h16"/>;
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.grid}</svg>;
}

export function RatioChart({id,title,metric,evidence,labels,onSelect,footer}){
 const {visible}=useDataApp();
 const rows=metric.total?[{状态:labels[0],人数:metric.yes},{状态:labels[1],人数:metric.total-metric.yes}]:[];
 const colors={[labels[0]]:'#cb233e',[labels[1]]:'#e8eaee'};
 if(!visible(id))return null;
 return <EvidenceChart id={id} variant="card" className="ff-ratio-card" title={title} queryId="players" queryIds={['players','matches','task_events']} rows={rows} sourceRowsByQuery={evidence}
  spec={{type:'pie',x:'状态',y:'人数',colors,centerLabel:labels[0],showLegend:false,stackable:false,sortOrder:'original'}} height={234} renderPlot={plot=>metric.total?plot:<div className="pf-empty-chart"><b>—</b><span>暂无统计样本</span></div>}
  chartOptions={{getMarkActions:({row})=>[{label:'查看玩家',onSelect:()=>onSelect(row.状态)}]}}>
  <div className="ff-pie-legend">{rows.map((r,i)=><button key={r.状态} onClick={()=>onSelect(r.状态)}><i style={{background:colors[r.状态]}}/><span>{r.状态}</span><b>{n(r.人数)}</b><Icon name="arrow" size={15}/></button>)}</div>
  {footer&&<div className="ff-card-footer">{footer}</div>}
 </EvidenceChart>;
}

export function TrendChart({id,title,rows,evidence,measure,label,thresholdField,threshold,onPoint,height=234}){
 const {visible}=useDataApp();if(!visible(id))return null;
 return <EvidenceChart id={id} variant="card" className="ff-line-card" title={title} queryId="players" queryIds={['players','matches','task_events']} rows={rows} sourceRowsByQuery={evidence}
  spec={{type:'line',x:'date',y:measure,fields:[measure,thresholdField],colors:{[measure]:'#cb233e',[thresholdField]:'#a2a8b0'},dashedFields:[thresholdField],stackable:false,valueDecimals:1,startAtZero:true,legend:{labels:{[measure]:label,[thresholdField]:`预警线 ${pct(threshold).replace('.0%','%')}`}},showXAxisLabel:false}}
  height={height} chartOptions={{getMarkActions:({row})=>row[measure]==null?[]:[{label:'查看玩家',onSelect:()=>onPoint(row)}]}}/>;
}
