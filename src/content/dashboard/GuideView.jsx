import React,{useState} from 'react';
import {Block,Tag} from './components.jsx';
import {GlassTabs} from './platform-ui.jsx';
import {Icon} from './visuals.jsx';
import './players-guide.css';

const features=[
 {id:'overview',title:'活动概览',step:'选活动',text:'按活动类型筛选，比较各活动近期参与走势。点击活动卡片进入该活动的数据表现。'},
 {id:'performance',title:'数据表现',step:'看变化',text:'用 01、02、03 指标导航定位图表。选择时间、地区和玩家类型，点击折线上的日期查看对应玩家。'},
 {id:'tasks',title:'任务追踪',step:'找节点',text:'任务链沿前置顺序查看；按天解锁活动按日期查看。点击节点查看完成率、任务要求与玩家明细。'},
 {id:'players',title:'玩家观测',step:'查行为',text:'切换典型路径，展开同类玩家并查看时间线。对比新、老、回流玩家，再结合关联任务的玩家反馈定位问题。'},
 {id:'alerts',title:'预警提示',step:'留记录',text:'选择预警，查看异常任务或日期、AI 原因判断与建议。进入玩家观测核对行为，填写处理记录并保存。'},
 {id:'guide',title:'使用指南',step:'查说明',text:'查看操作路径、指标算法、任务解锁规则和数据刷新方式。'},
];

function GuideHeading({number,title}){return <div className="pg-section-title"><span>{number}</span><h2>{title}</h2></div>;}

export default function GuideView({data,onNavigate}){
 const [chapter,setChapter]=useState('start');
 const chapters=[{id:'start',label:'操作手册'},{id:'metrics',label:'指标算法'},{id:'rules',label:'数据与规则'}];
 const effective=data.activity?.effectiveRule||data.activity?.effectiveLabel||'在指定活动玩法中达到任务要求并正常结算。';
 return <div className="pg-view pg-guide">
  <GlassTabs label="使用指南章节" items={chapters} value={chapter} onChange={setChapter}/>
  {chapter==='start'&&<>
   <section className="pg-section pg-guide-journey"><GuideHeading number="01" title="一次完整排查"/><ol className="pg-guide-route">{features.slice(0,5).map((feature,index)=><li key={feature.id}><span>{index+1}</span><b>{feature.step}</b><button onClick={()=>onNavigate?.(feature.id)}>{feature.title}<Icon name="arrow" size={14}/></button></li>)}</ol><div className="pg-guide-example"><h3>从 T2 受阻开始</h3><p>在「活动概览」选择滑轨试炼 → 打开「预警提示」中的 T2 受阻 → 查看受影响人群 → 进入「玩家观测」选择对应的典型路径 → 打开代表玩家时间线和相关反馈 → 返回预警保存处理动作。</p></div></section>
   <section className="pg-section"><GuideHeading number="02" title="六个功能怎么用"/><div className="pg-guide-features">{features.map((feature,index)=><article key={feature.id}><span className="pg-guide-index">{String(index+1).padStart(2,'0')}</span><div><h3>{feature.title}</h3><p>{feature.text}</p></div>{feature.id!=='guide'&&<button className="pg-text-button" aria-label={`打开${feature.title}`} onClick={()=>onNavigate?.(feature.id)}><Icon name="arrow" size={18}/></button>}</article>)}</div></section>
   <section className="pg-section"><GuideHeading number="03" title="筛选与下钻"/><div className="pg-guide-pair"><article><h3>筛选</h3><p>全局筛选改变当前活动的统计范围。数据表现默认显示全部玩家；选中玩家类型后，才展示该类玩家的数据。</p><p>玩家观测中的观察任务、典型路径和反馈筛选只作用于该功能内的对应模块。</p></article><article><h3>下钻</h3><p>点击图表、任务节点或玩家，打开相应明细。关闭面板即可回到原位置。</p><p>排查面板保留打开时的数据时点。出现「查看最新数据」后，点击即可切换到最新快照。</p></article></div></section>
  </>}
  {chapter==='metrics'&&<>
   <section className="pg-section"><GuideHeading number="01" title="三个核心指标"/><div className="pg-formulas"><article><div><span>01</span><h3>有效体验转化率</h3></div><p className="pg-formula">曝光后 24 小时内有效体验人数 ÷ 曝光已满 24 小时人数</p><dl><dt>看什么</dt><dd>活动是否让玩家体验到目标玩法。</dd><dt>时间归属</dt><dd>首次活动曝光日。</dd><dt>当前达成条件</dt><dd>{effective}</dd><dt>真实数据</dt><dd>活动入口曝光、玩法行为、对局结算。</dd></dl></article><article><div><span>02</span><h3>任务超时未完成率</h3></div><p className="pg-formula">未在规定时长内完成的人数 ÷ 解锁已满规定时长的人数</p><dl><dt>看什么</dt><dd>哪个任务、哪天解锁的玩家更容易受阻。</dd><dt>时间归属</dt><dd>任务解锁日。</dd><dt>超时补做</dt><dd>保留在超时人数中。</dd><dt>真实数据</dt><dd>任务配置、解锁、尝试与完成事件。</dd></dl></article><article><div><span>03</span><h3>24 小时再次体验率</h3></div><p className="pg-formula">首次体验后 24 小时内跨局再次有效体验人数 ÷ 首次体验已满 24 小时人数</p><dl><dt>看什么</dt><dd>玩家是否再次进入目标玩法。</dd><dt>时间归属</dt><dd>首次有效体验日。</dd><dt>跨局要求</dt><dd>另一场对局中再次达到有效体验条件。</dd><dt>真实数据</dt><dd>匿名玩家 ID、对局 ID、玩法行为及结算时间。</dd></dl></article></div></section>
   <section className="pg-section"><GuideHeading number="02" title="任务完成率"/><div className="pg-guide-example"><p className="pg-formula">截至当前已完成人数 ÷ 当前已解锁人数</p><p>任务追踪显示当前进度，超时后完成也计入已完成。数据表现的任务超时率使用完整统计时长的样本。</p></div><Block id={`guide-task-rules-${data.activity?.id||'rail-trial'}`} title="当前活动任务时长" rows={data.tasks} evidence={{activity_tasks:data.tasks}} className="pg-guide-task-rules"><div className="pg-guide-task-grid" data-reviewed-rows>{data.tasks.map(task=><div key={task.id}><span>{task.id}</span><b>{task.short||task.name}</b><strong>{task.window/60} 小时</strong></div>)}</div></Block></section>
  </>}
  {chapter==='rules'&&<>
   <section className="pg-section"><GuideHeading number="01" title="两种解锁方式"/><div className="pg-guide-pair"><article><Tag>任务链</Tag><h3>完成前一任务，解锁下一任务</h3><p>按任务轴顺序推进。未解锁玩家不进入该任务的统计范围。</p></article><article><Tag>按天解锁</Tag><h3>到达指定日期，开放当天任务</h3><p>各天任务独立开放，前一天未完成也能进入后续日期任务。晚加入玩家从实际解锁时刻开始计时。</p></article></div></section>
   <section className="pg-section"><GuideHeading number="02" title="预警与典型路径"/><div className="pg-guide-pair"><article><h3>预警触发</h3><dl><dt>有效体验</dt><dd>低于 65%</dd><dt>任务超时</dt><dd>高于 25%</dd><dt>再次体验</dt><dd>低于 50%</dd><dt>样本与持续时长</dt><dd>至少 30 人，连续 3 个独立五分钟时点越线。</dd></dl><p>阈值为本原型演示配置。日期异常沿用相同触发规则。</p></article><article><h3>典型玩家分类</h3><dl><dt>中途停滞</dt><dd>已完成过前序任务，尝试当前任务后未完成，至少 48 小时没有后续活动行为。按天解锁活动以完成过其他任务计。</dd><dt>领奖后未继续</dt><dd>存在未完成任务，领取奖励后至少 48 小时没有后续活动行为。</dd><dt>已解锁未尝试</dt><dd>任务已满统计时长，尚未尝试。</dd></dl><p>分类按上述顺序匹配，每位玩家归入一个典型分组。</p></article></div></section>
   <section className="pg-section"><GuideHeading number="03" title="刷新与数据来源"/><div className="pg-guide-pair"><article><h3>五分钟自动刷新</h3><p>页面每 5 分钟推进一次模拟玩家进度。重新打开会接续进度，活动结束后显示最终数据。</p><p>右上角刷新图标可立即读取当前进度。处理记录保存在当前浏览器。</p></article><article><h3>模拟玩家与反馈</h3><p>参与人数：同一天已结算活动对局或发生任务尝试的去重玩家，按进入对局或尝试的日期归属。</p><p>当前为 14 天模拟活动，玩家行为、奖励记录与玩家声音均为模拟数据。</p><p>正式版可接入游戏内反馈、授权社区 API 和游戏事件流水；反馈关联活动、任务与时间，玩家身份使用匿名 ID。</p></article></div></section>
  </>}
 </div>;
}
