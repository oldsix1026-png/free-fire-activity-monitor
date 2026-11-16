import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useDataApp} from '../../data-app-public.jsx';
import {END,REFRESH_MS,DEFAULT_FILTERS,clockTime,simulationTime,analyze} from './engine.mjs';
import {selectActivityData} from './platform-data.mjs';
import {buildPlatformAlerts} from './alert-analysis.mjs';
import {Tag,Select,stored,save} from './components.jsx';
import {Icon} from './visuals.jsx';
import {GlassTabs} from './platform-ui.jsx';
import OverviewView from './OverviewView.jsx';
import PerformanceView from './PerformanceView.jsx';
import TaskView from './TaskView.jsx';
import PlayersView from './PlayersView.jsx';
import AlertsView from './AlertsView.jsx';
import GuideView from './GuideView.jsx';
import Investigation from './Investigation.jsx';
import './activity.css';
import './platform.css';

const NAV=[{id:'overview',label:'活动概览',icon:'grid'},{id:'performance',label:'数据表现',icon:'experience'},{id:'tasks',label:'任务追踪',icon:'task'},{id:'players',label:'玩家观测',icon:'people'},{id:'alerts',label:'预警提示',icon:'bell'},{id:'guide',label:'使用指南',icon:'help'}];

export function DashboardContent(){
 const {queries}=useDataApp();
 const allRows=useMemo(()=>Object.fromEntries(Object.entries(queries).map(([key,query])=>[key,query?.rows||[]])),[queries]);
 const activities=allRows.activities||[];
 const [activityId,setActivityId]=useState('rail-trial'),[page,setPage]=useState('overview'),[filters,setFilters]=useState({...DEFAULT_FILTERS}),[typeFilter,setTypeFilter]=useState('全部类型');
 const [selectedTaskId,setSelectedTaskId]=useState(null),[focusTaskId,setFocusTaskId]=useState(null),[view,setView]=useState(null),[toast,setToast]=useState(''),[menuOpen,setMenuOpen]=useState(false),[selectedAlertKey,setSelectedAlertKey]=useState(null),[observationScope,setObservationScope]=useState({});
 const [records,setRecords]=useState(()=>stored('records',{})),[anchor]=useState(()=>{const previous=stored('anchor',null);if(previous)return previous;const value=Date.now();save('anchor',value);return value;}),[now,setNow]=useState(Date.now());
 const topRef=useRef(null),asOf=simulationTime(now,anchor);
 const data=useMemo(()=>selectActivityData(allRows,activityId),[allRows,activityId]);
 const result=useMemo(()=>analyze(data,filters,asOf),[data,filters,asOf]);
 const alerts=useMemo(()=>buildPlatformAlerts(data,filters,asOf),[data,filters,asOf]);
 const scopeKey=(activityId==='rail-trial'?'':activityId+'|')+JSON.stringify(filters);
 const remaining=Math.max(0,Math.ceil((REFRESH_MS-(now-anchor)%REFRESH_MS)/1000));
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);const resume=()=>setNow(Date.now());document.addEventListener('visibilitychange',resume);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume);};},[]);
 useEffect(()=>{setRecords(old=>{const next={...old};let changed=false;for(const alert of alerts){const key=scopeKey+'|'+alert.key;if(!next[key]||next[key].status==='已恢复'){next[key]={...alert,activityId,filters,scopeKey,status:'待关注',note:next[key]?.note||'',firstSeen:asOf};changed=true;}}for(const [key,record] of Object.entries(next)){if(record.scopeKey!==scopeKey||record.status==='已恢复'||alerts.some(a=>key===scopeKey+'|'+a.key))continue;if(record.type==='experience'&&alerts.some(a=>a.type==='experience'))continue;next[key]={...record,status:'已恢复',recoveredAt:asOf};changed=true;}if(changed){save('records',next);return next;}return old;});},[alerts,scopeKey,asOf,activityId]);
 const navigate=id=>{setPage(id);setMenuOpen(false);history.replaceState(null,'','#ff-'+id);requestAnimationFrame(()=>topRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));};
 const updateRecord=(key,value)=>setRecords(old=>{const next={...old,[key]:{...old[key],...value,activityId,scopeKey:value.scopeKey||old[key]?.scopeKey||scopeKey}};save('records',next);return next;});
 const displayFilters=page==='players'?{...filters,...observationScope}:filters;
 const onInspect=args=>{const extra=args.extraFilters||args.extra||{};const alert=args.key?args:page!=='players'&&!Object.keys(extra).length?alerts.find(a=>a.type===args.type&&(args.type!=='task'||a.taskId===args.taskId)):null;setView({type:args.type||'task',taskId:args.taskId||null,filters:{...displayFilters,...extra},asOf,alert:!!alert,recordKey:scopeKey+'|'+(alert?.key||args.type),scopeKey,outcome:args.outcome||null,mode:args.mode||null,playerId:args.playerId||null});};
 const observe=({taskId=null,extraFilters={}}={})=>{setFocusTaskId(taskId);setObservationScope(extraFilters);navigate('players');};
 const chooseActivity=(id,nextPage=page,extra={})=>{setActivityId(id);setSelectedTaskId(null);setFocusTaskId(null);setObservationScope({});setSelectedAlertKey(null);setView(null);setFilters(old=>{const {day,fromDay,toDay,...common}=old;return{...common,...extra};});navigate(nextPage);};
 const adjust=(field,value)=>{if(field==='period')setObservationScope({});setFilters(old=>{const next={...old,[field]:value};if(field==='period'){delete next.day;delete next.fromDay;delete next.toDay;}return next;});};
 const clearDates=()=>{setObservationScope({});setFilters(old=>{const {day,fromDay,toDay,...next}=old;return next;});};
 const reset=()=>{setFilters({...DEFAULT_FILTERS});setTypeFilter('全部类型');setSelectedTaskId(null);setFocusTaskId(null);setObservationScope({});setSelectedAlertKey(null);};
 const refresh=()=>{setNow(Date.now());setToast('数据已更新');setTimeout(()=>setToast(''),2200);};
 const selectedTask=result.tasks.find(t=>t.id===selectedTaskId)||result.worst;
 const currentTitle=NAV.find(n=>n.id===page)?.label||'活动概览';
 if(!data.activity)return <div className="ff-app ff-empty">正在载入活动数据…</div>;
 return <div className={'ff-app ff-workspace ff-platform '+(menuOpen?'menu-open':'')} data-dashboard-layout="full-width">
  <aside className="ff-sidebar pf-sidebar"><button className="pf-brand" onClick={()=>navigate('overview')} aria-label="返回活动概览"><span>FF</span><b>活动内容监控</b></button><GlassTabs vertical label="功能目录" items={NAV.map(item=>({...item,badge:item.id==='alerts'?alerts.length:0}))} value={page} onChange={navigate} className="pf-main-nav"/><div className="pf-sidebar-bottom"><div className="pf-sidebar-status"><i/><span>每 5 分钟刷新</span></div><Tag>14 天 · 模拟数据</Tag></div></aside>
  {menuOpen&&<button className="pf-menu-backdrop" aria-label="收起目录" onClick={()=>setMenuOpen(false)}/>}
  <div className="ff-content pf-content"><div ref={topRef} className="pf-page-anchor"/><header className="ff-page-header pf-page-header"><div className="pf-page-title"><button className="pf-mobile-menu" aria-label="展开功能目录" onClick={()=>setMenuOpen(!menuOpen)}><Icon name="menu"/></button><div><h1>{currentTitle}</h1><div className="ff-page-meta"><span>Free Fire · 11.03—11.16</span><Tag>模拟数据</Tag></div></div></div><div className="ff-header-tools"><button aria-label="刷新数据" title="刷新数据" onClick={refresh}><Icon name="refresh"/></button><button aria-label="查看预警" title="查看预警" onClick={()=>navigate('alerts')}><Icon name="bell"/>{alerts.length>0&&<i/>}</button><button aria-label="打开使用指南" title="使用指南" onClick={()=>navigate('guide')}><Icon name="help"/></button></div></header>
  {page!=='overview'&&<div className="pf-activity-context"><label><span>当前活动</span><select aria-label="当前活动" value={activityId} onChange={e=>chooseActivity(e.target.value)}>{activities.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><Tag tone={data.activity.typeKey==='daily'?'violet':'red'}>{data.activity.type}</Tag><span className="pf-current-tasks">{data.tasks.length} 个任务</span></div>}
  {page!=='guide'&&<section className="ff-filters pf-filters" aria-label="全局筛选"><div className="ff-filter-heading"><h2><Icon name="filter" size={18}/>筛选范围</h2><button className="ff-link" onClick={reset}>重置筛选</button></div><div className={'ff-filter-fields '+(page==='overview'?'has-type':'')}>{page==='overview'&&<Select label="活动类型" value={typeFilter} options={['全部类型','任务链','按天解锁']} onChange={setTypeFilter}/>}<Select label="统计时间" value={filters.period} options={['全部 14 天','前 7 天','后 7 天','最近 3 天']} onChange={v=>adjust('period',v)}/><Select label="地区" value={filters.region} options={['全部地区','巴西','印度尼西亚','泰国']} onChange={v=>adjust('region',v)}/><Select label="玩家类型" value={filters.segment==='活跃玩家'?'老玩家':filters.segment} options={['全部玩家','新玩家','老玩家','回流玩家']} onChange={v=>adjust('segment',v)}/><Select label="模式偏好" value={filters.preference} options={['全部偏好','偏好 BR','偏好 CS']} onChange={v=>adjust('preference',v)}/></div>{(displayFilters.day||displayFilters.fromDay||displayFilters.toDay)&&<div className="pf-date-scope"><Tag tone="red">{displayFilters.day?`第 ${displayFilters.day} 天`:`第 ${displayFilters.fromDay||1}—${displayFilters.toDay||14} 天`}</Tag><button onClick={clearDates} className="ff-link">清除日期段 ×</button></div>}</section>}
  <div className="ff-data-status pf-data-status"><span><Icon name="clock" size={15}/>{clockTime(asOf)} 更新</span><span>{asOf===END?'活动已结束':`下次刷新 ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`}</span></div>
  <div className="pf-active-page" role="tabpanel" aria-label={currentTitle} key={page+'-'+activityId}>
   {page==='overview'&&<OverviewView allRows={allRows} activities={activities} filters={filters} asOf={asOf} typeFilter={typeFilter} selectedActivityId={activityId} onSelect={chooseActivity}/>}
   {page==='performance'&&<PerformanceView data={data} filters={filters} asOf={asOf} selectedTaskId={selectedTask.id} onTask={setSelectedTaskId} onInspect={onInspect}/>}
   {page==='tasks'&&<TaskView data={data} filters={filters} asOf={asOf} selectedTaskId={selectedTask.id} onTask={setSelectedTaskId} onInspect={onInspect} onObserve={observe}/>}
   {page==='players'&&<PlayersView data={data} filters={displayFilters} asOf={asOf} focusTaskId={focusTaskId} onInspect={onInspect}/>}
   {page==='alerts'&&<AlertsView data={data} filters={filters} asOf={asOf} alerts={alerts} records={records} scopeKey={scopeKey} selectedAlertKey={selectedAlertKey} onSelectAlert={setSelectedAlertKey} onInspect={onInspect} onObserve={observe} onRecord={updateRecord}/>}
   {page==='guide'&&<GuideView data={data} onNavigate={navigate}/>}
  </div></div><div className="ff-toast" role="status">{toast}</div>
  {view&&<Investigation key={`${activityId}-${view.type}-${view.taskId}-${view.asOf}-${JSON.stringify(view.filters)}-${view.outcome}-${view.mode}`} data={data} view={view} latestTime={asOf} onClose={()=>setView(null)} onUpdate={()=>setView(old=>({...old,asOf}))} records={records} onRecord={updateRecord}/>}
 </div>;
}
