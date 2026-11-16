export const DAY = 1440;
export const END = 14 * DAY;
export const BASE_TIME = 13 * DAY + 720;
export const REFRESH_MS = 300000;
export const START = Date.parse('2026-11-03T00:00:00+08:00');
export const TASKS = [
  { id: 'T1', name: '完成一局 BR', short: '进入战场', window: 120, requirement: '完成一局 Solara 地图的 BR 对局，正常淘汰也计入。' },
  { id: 'T2', name: '成功使用滑轨', short: '初次体验', window: 360, requirement: '在一局 Solara BR 中成功滑行至少 50 米，并正常结算。' },
  { id: 'T3', name: '在另一局再次使用滑轨', short: '再次体验', window: 720, requirement: '进入另一场 Solara BR，再次成功滑行至少 50 米并结算。' },
  { id: 'T4', name: '滑轨对局中生存 5 分钟', short: '生存挑战', window: 1440, requirement: '成功体验滑轨的同一局，生存至少 5 分钟并正常结算。' },
  { id: 'T5', name: '与队友同局体验滑轨', short: '组队体验', window: 1440, requirement: '在组队 BR 对局中成功体验滑轨，并正常结算。' },
  { id: 'T6', name: '再完成一局滑轨对局', short: '完成主线', window: 1440, requirement: '再完成一局包含有效滑轨体验的 Solara BR 对局。' },
];
export const DEFAULT_FILTERS = { region: '全部地区', segment: '全部玩家', preference: '全部偏好', period: '全部 14 天' };
export const RULES = { experience: .65, blocked: .25, repeat: .5, minSample: 30, checks: 3 };
export const pct = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
export const dayOf = t => Math.floor(t / DAY) + 1;
export const clockTime = t => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(START + t * 60000));
export const simulationTime = (wallNow, anchor) => Math.min(END, BASE_TIME + Math.max(0, Math.floor((wallNow - anchor) / REFRESH_MS)) * 5);
export function isEffective(m, data) {
  if (!m.normalSettlement) return false;
  const activityId=data?.activity?.id || m.activityId || 'rail-trial';
  if(activityId==='squad-assault')return m.mode==='BR'&&m.teammates>=1&&m.survivalSeconds>=300;
  if(activityId==='map-calendar')return m.mode==='BR'&&m.map==='Solara'&&m.exploredZones>=2;
  if(activityId==='cs-daily')return m.mode==='CS'&&m.completedRounds>=3;
  if(activityId==='supply-calendar')return m.mode==='BR'&&m.supplyTypes>=3;
  return m.mode === 'BR' && m.map === 'Solara' && m.railSuccess && m.railDistance >= 50;
}
export const ratio = (yes, total, pending = 0) => ({ yes, total, pending, rate: total ? yes / total : null });
const indexCache = new WeakMap();
export function indexData(data) {
  if (indexCache.has(data)) return indexCache.get(data);
  const matches = new Map(), states = new Map(), events=new Map(), rewards=new Map();
  for (const m of data.matches) { if (!matches.has(m.playerId)) matches.set(m.playerId, []); matches.get(m.playerId).push(m); }
  for (const s of data.task_states) { if (!states.has(s.playerId)) states.set(s.playerId, []); states.get(s.playerId).push(s); }
  for (const e of data.task_events||[]) {if(!events.has(e.playerId))events.set(e.playerId,[]);events.get(e.playerId).push(e);}
  for (const r of data.reward_events||[]) {if(!rewards.has(r.playerId))rewards.set(r.playerId,[]);rewards.get(r.playerId).push(r);}
  for (const rows of matches.values()) rows.sort((a,b)=>a.settledAt-b.settledAt);
  const value = { matches, states, events, rewards }; indexCache.set(data, value); return value;
}
export function inPeriod(t, filters, asOf) {
  const day = dayOf(t), current = Math.min(14, dayOf(asOf));
  if (day<1||day>current) return false;
  if (filters.day && day !== Number(filters.day)) return false;
  if (filters.fromDay && day < Number(filters.fromDay)) return false;
  if (filters.toDay && day > Number(filters.toDay)) return false;
  return filters.period === '最近 3 天' ? day >= current - 2 : filters.period === '前 7 天' ? day <= 7 : filters.period === '后 7 天' ? day >= 8 : true;
}
export function scopedPlayers(data, filters, asOf) {
  return data.players.filter(p => !p.excluded && p.exposedAt <= asOf &&
    (filters.region === '全部地区' || p.region === filters.region) &&
    (filters.segment === '全部玩家' || p.segment === filters.segment || (filters.segment==='老玩家'&&p.segment==='活跃玩家')) &&
    (filters.preference === '全部偏好' || p.preference === filters.preference));
}
export function taskStatus(s, asOf) {
  if (s.unlockedAt + s.window > Math.min(asOf, END)) return '观察中';
  if (s.completedAt != null && s.completedAt <= s.unlockedAt + s.window) return '按时完成';
  if (s.completedAt != null && s.completedAt <= asOf) return '超时后完成';
  return s.attemptedAt != null && s.attemptedAt <= asOf ? '已尝试未完成' : '未尝试';
}
export function analyze(data, filters, asOf) {
  const cutoff = Math.min(asOf, END), idx = indexData(data);
  const players = scopedPlayers(data, filters, cutoff), experiences = [], repeats = [];
  const tasks = (data.tasks||TASKS).map(t => ({ ...t, rows: [] }));
  for (const p of players) {
    const matches = (idx.matches.get(p.id) || []).filter(m => m.settledAt <= cutoff);
    const valid = matches.filter(m=>isEffective(m,data)), first = valid[0];
    if (inPeriod(p.exposedAt, filters, cutoff)) {
      const mature = p.exposedAt + DAY <= cutoff;
      const success = !!first && first.settledAt <= p.exposedAt + DAY;
      experiences.push({ ...p, mature, success, firstAt: first?.settledAt ?? null,
        status: !mature ? '观察中' : success ? '已有效体验' : matches.some(m=>m.railAttempt||m.activityAttempt) ? '尝试未达成' : matches.some(m=>m.mode===(data.activity?.mode||'BR')&&(!data.activity?.map||m.map===data.activity.map)) ? '进入地图未尝试' : '未进入目标地图' });
    }
    if (first && inPeriod(first.settledAt, filters, cutoff)) {
      const mature = first.settledAt + DAY <= cutoff;
      const success = valid.some(m=>m.id !== first.id && m.settledAt > first.settledAt && m.settledAt <= first.settledAt + DAY);
      repeats.push({ ...p, mature, success, firstAt: first.settledAt, status: !mature ? '观察中' : success ? '已再次体验' : '未再次体验' });
    }
    for (const s of idx.states.get(p.id) || []) {
      if (s.unlockedAt > cutoff || !inPeriod(s.unlockedAt, filters, cutoff)) continue;
      const status = taskStatus(s, cutoff);
      const task=tasks.find(t=>t.id===s.taskId);
      if(task)task.rows.push({ ...p, ...s, id: p.id, mature: status !== '观察中', status, success: status === '按时完成' });
    }
  }
  const summarize = rows => ratio(rows.filter(r=>r.mature&&r.success).length, rows.filter(r=>r.mature).length, rows.filter(r=>!r.mature).length);
  for (const t of tasks) { t.metric = summarize(t.rows); t.metric.yes = t.metric.total - t.metric.yes; t.metric.rate = t.metric.total ? t.metric.yes / t.metric.total : null; t.completion=ratio(t.rows.filter(r=>r.completedAt!=null&&r.completedAt<=cutoff).length,t.rows.length); }
  const ranked = tasks.filter(t=>t.metric.total >= RULES.minSample).sort((a,b)=>b.metric.rate-a.metric.rate);
  return { players, experiences, repeats, experience: summarize(experiences), repeat: summarize(repeats), tasks, worst: ranked[0] || tasks.find(t=>t.metric.total) || tasks[0], cutoff };
}
export function breach(metric, threshold, high) { return metric.total >= RULES.minSample && metric.rate != null && (high ? metric.rate > threshold : metric.rate < threshold); }
export function alertCandidates(data, filters, asOf) {
  const snapshots = [asOf - 10, asOf - 5, asOf].map(t=>analyze(data, filters, Math.max(0,t)));
  const latest = snapshots[2], alerts = [];
  if (snapshots.every(x=>breach(x.experience, RULES.experience, false))) alerts.push({ key: 'experience', type: 'experience', title: '有效体验低于预警线', metric: latest.experience, threshold: RULES.experience });
  for (const task of latest.tasks) if (snapshots.every(x=>breach(x.tasks.find(t=>t.id===task.id).metric, RULES.blocked, true))) alerts.push({ key: task.id, type: 'task', taskId: task.id, title: `${task.id} ${task.short}受阻`, metric: task.metric, threshold: RULES.blocked });
  if (snapshots.every(x=>breach(x.repeat, RULES.repeat, false))) alerts.push({ key: 'repeat', type: 'repeat', title: '再次体验低于预警线', metric: latest.repeat, threshold: RULES.repeat });
  return alerts;
}
export function trendRows(data, filters, asOf) {
  const rows = [];
  for(let day=1;day<=14;day++) {
    if (!inPeriod((day-1)*DAY, filters, asOf)) continue;
    const a = analyze(data, {...filters, day}, asOf);
    rows.push({ day, date: `11/${String(day+2).padStart(2,'0')}`, experienceRate: a.experience.rate, repeatRate: a.repeat.rate, experienceUsers: a.experience.total, repeatUsers: a.repeat.total, observation: a.experience.pending, experienceThresholdRate: RULES.experience, repeatThresholdRate: RULES.repeat });
  }
  return rows;
}
export function visibleEvidence(data, players, asOf) {
  const ids = new Set(players.map(p=>p.id));
  return { players: data.players.filter(p=>ids.has(p.id)), matches: data.matches.filter(m=>ids.has(m.playerId)&&m.settledAt<=asOf), task_events: (data.task_events||[]).filter(s=>ids.has(s.playerId)&&s.time<=asOf) };
}
export function taskTrendRows(data,filters,asOf,taskId) {
  const rows=[];
  for(let day=1;day<=14;day++){
    if(!inPeriod((day-1)*DAY,filters,asOf))continue;
    const task=analyze(data,{...filters,day},asOf).tasks.find(t=>t.id===taskId);
    rows.push({day,date:`11/${String(day+2).padStart(2,'0')}`,taskId,blockedRate:task.metric.rate,blockedThresholdRate:RULES.blocked,超时人数:task.metric.yes,统计人数:task.metric.total});
  }
  return rows;
}
export function playerTimeline(data, player, asOf) {
  const idx = indexData(data), definitions=data.tasks||TASKS, events = [{ time: player.exposedAt, kind:'活动曝光', text:`首次看到「${data.activity?.name||'滑轨试炼'}」活动入口` }];
  for (const s of idx.states.get(player.id)||[]) {
    events.push({time:s.unlockedAt,kind:'任务解锁',text:`${s.taskId} · ${definitions.find(t=>t.id===s.taskId)?.name||s.taskId}`});
    if (s.completedAt!=null) events.push({time:s.completedAt,kind:'任务完成',text:`${s.taskId} · ${s.completedAt>s.unlockedAt+s.window?'超时后完成':'按时完成'}`});
  }
  for (const m of idx.matches.get(player.id)||[]) {
    events.push({ time:m.startedAt, kind:'进入对局', text:`${m.id} · ${m.mode} / ${m.map}` });
    if(m.railAttempt) events.push({ time:m.startedAt+3, kind:m.railSuccess?'滑轨成功':'滑轨未成功', text:m.railSuccess?`实际滑行 ${m.railDistance} 米`:'触发互动但未完成滑行' });
    if(m.activityAttempt&&!m.railAttempt) events.push({time:m.startedAt+3,kind:'任务尝试',text:m.actionText||`${m.taskId} · ${data.activity?.effectiveLabel||'活动目标'}`});
    events.push({ time:m.settledAt, kind:'对局结算', text: !m.normalSettlement?'异常中断':isEffective(m,data)?`正常${m.result==='eliminated'?'淘汰':'结算'} · 达成有效体验`:'正常结算 · 未达体验条件' });
  }
  for(const reward of data.reward_events||[])if(reward.playerId===player.id)events.push({time:reward.claimedAt,kind:'领取奖励',text:reward.rewardName});
  return events.filter(e=>e.time<=asOf).sort((a,b)=>a.time-b.time);
}
