import React,{useEffect,useRef} from 'react';
import {DataComponent,useDataApp} from '../../data-app-public.jsx';
export const n=v=>v.toLocaleString('zh-CN');
export const kindNames={experience:'有效体验转化率',task:'任务超时未完成率',repeat:'24 小时再次体验率'};
export const statusLabel=value=>value==='观察中'?'未满时长':value==='活跃玩家'?'老玩家':value;
export function stored(key,fallback){try{return JSON.parse(localStorage.getItem('ff-activity-v1:'+key))??fallback;}catch{return fallback;}}
export function save(key,value){try{localStorage.setItem('ff-activity-v1:'+key,JSON.stringify(value));}catch{}}
export function Tag({children,tone=''}){return <span className={'ff-tag '+tone}>{children}</span>;}
export function Select({label,value,options,onChange}){return <label className={'ff-select '+(!value.startsWith('全部')?'has-value':'')}><span>{label}</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x} value={x}>{statusLabel(x)}</option>)}</select></label>;}
export function Block({id,title,rows,evidence,children,className=''}){const {visible}=useDataApp();const keys=Object.keys(evidence||{});return visible(id)?<DataComponent id={id} title={title} queryId={keys[0]||'players'} queryIds={keys.length?keys:['players']} kind="custom" variant="card" displayRows={rows} sourceRowsByQuery={evidence} className={'ff-block '+className}>{children}</DataComponent>:null;}
export function Dialog({title,onClose,children,wide=false}){
 const ref=useRef(null);
 useEffect(()=>{const previous=document.activeElement;ref.current?.focus();const handler=e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const items=ref.current?.querySelectorAll('button, select, input, textarea, summary, [tabindex="0"]');if(!items?.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus?.();};},[]);
 return <div className="ff-overlay" onClick={onClose}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={'ff-dialog '+(wide?'wide':'')} onClick={e=>e.stopPropagation()}><header><h2>{title}</h2><button className="ff-close" aria-label="关闭面板" onClick={onClose}>×</button></header>{children}</section></div>;
}
export function Explanation({onClose}){return <Dialog title="指标说明" onClose={onClose}><div className="ff-dialog-body ff-explanations"><Tag>模拟数据 · UTC+8</Tag>
 <details open><summary>有效体验转化率</summary><dl><dt>计算</dt><dd>曝光后 24 小时内有效体验人数 ÷ 曝光已满 24 小时人数</dd><dt>达成条件</dt><dd>Solara BR 成功滑行 ≥50 米，并正常结算；正常淘汰计入。</dd><dt>时间归属</dt><dd>首次活动曝光日</dd><dt>数据</dt><dd>入口曝光、滑轨互动、对局结算</dd></dl></details>
 <details><summary>任务超时未完成率</summary><dl><dt>计算</dt><dd>解锁后超时未完成人数 ÷ 解锁已满统计时长人数</dd><dt>统计时长</dt><dd>T1：2 小时；T2：6 小时；T3：12 小时；T4–T6：24 小时。</dd><dt>超时补做</dt><dd>计入超时人数</dd><dt>时间归属</dt><dd>任务解锁日</dd><dt>数据</dt><dd>任务配置、解锁、尝试与完成事件</dd></dl></details>
 <details><summary>24 小时再次体验率</summary><dl><dt>计算</dt><dd>首次体验后 24 小时内，在另一局再次有效体验人数 ÷ 首次体验已满 24 小时人数</dd><dt>时间归属</dt><dd>首次有效体验日</dd><dt>数据</dt><dd>匿名玩家 ID、对局 ID、互动与结算时间</dd></dl></details>
 <details><summary>预警规则</summary><dl><dt>有效体验</dt><dd>低于 65%</dd><dt>任务超时</dt><dd>高于 25%</dd><dt>再次体验</dt><dd>低于 50%</dd><dt>触发条件</dt><dd>统计人数 ≥30，连续 3 个五分钟数据时点越线。</dd></dl></details>
 <details><summary>活动数据</summary><dl><dt>活动</dt><dd>滑轨试炼 · 11 月 3 日—16 日</dd><dt>来源</dt><dd>AI 生成的 14 天玩家与事件记录</dd><dt>刷新</dt><dd>每 5 分钟更新一次模拟进度</dd><dt>统计范围</dt><dd>已满各指标统计时长的玩家</dd></dl></details>
 </div></Dialog>;}
