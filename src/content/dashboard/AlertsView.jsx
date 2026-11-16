import React,{useMemo,useState} from 'react';
import {Block,Tag,n,kindNames} from './components.jsx';
import {Icon} from './visuals.jsx';
import {GlassTabs} from './platform-ui.jsx';
import {clockTime,pct} from './engine.mjs';
import {alertInsight} from './alert-analysis.mjs';
import './alerts-view.css';

function AlertDetail({data,filters,asOf,alert,record,recordKey,onInspect,onObserve,onRecord,recovered=false}){
 const insight=useMemo(()=>alertInsight(data,filters,asOf,alert),[data,filters,asOf,alert]);
 const [note,setNote]=useState(record?.note||''),[saved,setSaved]=useState(false);
 const status=record?.status||'待关注';
 const saveNote=()=>{onRecord(recordKey,{...alert,scopeKey:recordKey.slice(0,recordKey.lastIndexOf('|')),filters,status:recovered?'已恢复':'处理中',note,updatedAt:asOf});setSaved(true);};
 if(recovered)return <section className="av-detail av-recovered"><header><Tag>已恢复</Tag><h2>{alert.title}</h2></header><div className="av-recovery-dates"><span>首次发现 <b>{clockTime(record.firstSeen||0)}</b></span><span>恢复时间 <b>{clockTime(record.recoveredAt||asOf)}</b></span></div><div className="av-note"><label htmlFor="av-recovered-note">处理记录</label><textarea id="av-recovered-note" value={note} onChange={event=>{setNote(event.target.value);setSaved(false);}} placeholder="记录处理动作和复核结果"/><div><button className="ff-button primary" onClick={saveNote}>保存记录</button><span role="status">{saved?'已保存':''}</span></div></div></section>;
 return <section className="av-detail"><header className="av-detail-heading"><div><Tag tone="red">{alert.kindLabel||'预警'}</Tag><h2>{alert.title}</h2></div><Tag tone="red">{status}</Tag></header>
  <Block id={`alert-impact-${data.activity.id}-${alert.key}`} title="问题范围" rows={[{问题:alert.title,指标:kindNames[alert.type],比率:insight.metric?.rate,人数:insight.metric?.yes,统计人数:insight.metric?.total,受影响人数:insight.problems.length}]} evidence={insight.evidence} className="av-impact-card"><div className="av-impact" data-reviewed-rows><div><b>{pct(insight.metric?.rate)}</b><span>{kindNames[alert.type]}</span></div><div><b>{n(insight.problems.length)}</b><span>受影响玩家</span></div></div><p className="av-issue">{insight.issue}</p></Block>
  <Block id={`alert-analysis-${data.activity.id}-${alert.key}`} title="AI 原因判断" rows={insight.signals.map(signal=>({信号:signal.label,数量:signal.value,单位:signal.unit}))} evidence={insight.evidence} className="av-analysis-card"><div className="av-analysis-tag"><Tag>模拟分析</Tag></div><div className="av-signals" data-reviewed-rows>{insight.signals.map(signal=><div key={signal.label}><b>{n(signal.value)}<span>{signal.unit}</span></b><p>{signal.label}</p></div>)}</div><div className="av-cause"><h3>可能原因</h3><p>{insight.cause}</p></div><div className="av-actions"><h3>建议调整</h3><ol>{insight.actions.map(action=><li key={action}>{action}</li>)}</ol></div>{insight.feedback.length>0&&<div className="av-feedback"><h3>相关玩家声音</h3>{insight.feedback.slice(0,2).map(row=><blockquote key={row.id}><p>“{row.text}”</p><footer><span>{row.source} · 模拟反馈 · {row.topic}</span><time>{clockTime(row.createdAt)}</time></footer></blockquote>)}</div>}</Block>
  <div className="av-drill-actions"><button className="ff-button primary" onClick={()=>onInspect(alert)}>查看受影响玩家<Icon name="arrow" size={17}/></button><button className="ff-button" onClick={()=>onObserve({taskId:alert.taskId,extraFilters:alert.extraFilters})}>查看玩家观测<Icon name="arrow" size={17}/></button></div>
  <div className="av-note"><div className="av-note-heading"><label htmlFor="av-handling-note">处理记录</label><Tag tone={status==='待关注'?'red':''}>{status}</Tag></div><textarea id="av-handling-note" value={note} onChange={event=>{setNote(event.target.value);setSaved(false);}} placeholder="记录排查结果、调整动作和复核时间"/><div><button className="ff-button primary" onClick={saveNote}>保存处理记录</button><span role="status">{saved?'已保存':''}</span></div></div>
 </section>;
}

export default function AlertsView({data,filters,asOf,alerts,records,scopeKey,onInspect,onObserve,onRecord,selectedAlertKey,onSelectAlert}){
 const [mode,setMode]=useState('current'),[selectedKey,setSelectedKey]=useState(null);
 const selectAlert=key=>{setSelectedKey(key);onSelectAlert?.(key);};
 const history=Object.entries(records).filter(([,record])=>record.scopeKey===scopeKey&&record.status==='已恢复').map(([recordKey,record])=>({...record,recordKey})).sort((a,b)=>b.recoveredAt-a.recoveredAt);
 const entries=mode==='current'?alerts:history;
 const selected=entries.find(alert=>alert.key===(selectedAlertKey!==undefined?selectedAlertKey:selectedKey))||entries[0];
 const recordKey=selected?(selected.recordKey||scopeKey+'|'+selected.key):null;
 const record=records[recordKey]||selected;
 return <div className="av-view"><div className="av-toolbar"><div><h2>预警提示</h2><span>{mode==='current'?`${alerts.length} 项当前预警`:`${history.length} 项恢复记录`}</span></div><GlassTabs items={[{id:'current',label:'当前预警',badge:alerts.length},{id:'history',label:'恢复记录',badge:history.length}]} value={mode} onChange={value=>{setMode(value);selectAlert(null);}} label="预警记录类型"/></div>
  {entries.length?<div className="av-layout"><div className="av-queue" aria-label="预警列表">{entries.map(alert=><button key={alert.key} className={selected?.key===alert.key?'selected':''} onClick={()=>selectAlert(alert.key)} aria-pressed={selected?.key===alert.key}><div><Tag tone={mode==='current'?'red':''}>{mode==='current'?(records[scopeKey+'|'+alert.key]?.status||'待关注'):'已恢复'}</Tag><span>{alert.taskId||alert.periodLabel||'活动整体'}</span></div><b>{alert.title}</b><footer><strong>{pct(alert.metric?.rate)}</strong><Icon name="arrow" size={17}/></footer></button>)}</div><AlertDetail key={recordKey+'|'+mode} data={data} filters={filters} asOf={asOf} alert={selected} record={record} recordKey={recordKey} onInspect={onInspect} onObserve={onObserve} onRecord={onRecord} recovered={mode==='history'}/></div>:<div className="av-empty"><Icon name="bell" size={28}/><h3>{mode==='current'?'暂无预警':'暂无恢复记录'}</h3></div>}
 </div>;
}
