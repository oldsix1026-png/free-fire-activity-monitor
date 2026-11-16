# 活动平台模拟数据字典

本文件用于开发与复核，不显示在看板页面。

## 数据性质与活动

全部玩家、对局、活动规则、奖励和反馈均为固定种子的 AI 模拟数据，非 Garena 生产数据。反馈没有调用社区或游戏接口抓取。每个活动均覆盖 2026-11-03 至 2026-11-16，时区 UTC+8。

| activityId | 活动 | 类型 | 任务 | 活动有效体验条件 |
|---|---|---|---|---|
| rail-trial | 滑轨试炼 | 任务链 | T1–T6 | Solara BR 成功滑行至少 50 米，正常结算 |
| squad-assault | 协同突击 | 任务链 | T1–T6 | 组队 BR 生存至少 300 秒，正常结算 |
| map-calendar | 地图探索日历 | 按天解锁 | D1–D14 | Solara BR 单局探索至少 2 个区域，正常结算 |
| cs-daily | CS 每日热身 | 按天解锁 | D1–D14 | CS 单局完成至少 3 个回合，正常结算 |
| supply-calendar | 战术补给日历 | 按天解锁 | D1–D14 | BR 单局拾取至少 3 类补给，正常结算 |

正常淘汰属于正常结算。活动有效体验条件与单个任务完成条件分别判断；例如地图 D3/D6/D9/D12 需要 3 个区域，CS 与补给每第 3 天分别需要 4 回合、4 类补给。协同突击 T4 需要至少 2 次助攻，T5 需要至少 2 次淘汰。

任务链完成上一任务后解锁下一任务。日历任务在对应活动日零点开放，无前置任务；晚加入玩家在首次曝光时解锁此前开放的内容，已开放任务可补做。

## 查询与字段

数据入口为 `src/data.json` 的 `queries`，每个查询含 `rows` 和 `source`。来源声明、粒度和模拟性质保存在 `source` 中。

| 查询 | 粒度 / 主键 | 主要字段 |
|---|---|---|
| activities | 每活动一行；`id` | `name`, `type`, `typeKey`, `mode`, `map`, `effectiveRule`, `startAt`, `endAt`, `duration` |
| activity_tasks | 每活动任务一行；`activityId + id` | `name`, `short`, `requirement`, `window`, `unlockDay`, `releaseAt`, `order`, `prerequisite`, 日历任务的 `required` |
| players | 每活动玩家一行；`id` | `activityId`, `region`, `segment`, `preference`, `exposedAt`, `excluded` |
| matches | 每玩家对局一行；`id` | `activityId`, `playerId`, `taskId`（新增活动）, `startedAt`, `settledAt`, `mode`, `map`, `normalSettlement`, 动作计数 |
| task_states | 每玩家任务一行；`activityId + playerId + taskId` | `unlockedAt`, `window`, `attemptedAt`, `completedAt` |
| task_events | 每次任务事件一行 | `activityId`, `playerId`, `taskId`, `event`（解锁/尝试/完成）, `time` |
| reward_events | 每次领取一行；`id` | `activityId`, `playerId`, `taskId`, `rewardName`, `claimedAt` |
| feedback | 每条模拟反馈一行；`id` | `activityId`, `playerId`, `taskId`, `day`, `source`（社区/游戏内）, `topic`, `sentiment`, `text`, `createdAt`, `segment`, `region` |

对局动作字段包括 `railAttempt`, `railSuccess`, `railDistance`, `teammates`, `survivalSeconds`, `assists`, `kills`, `exploredZones`, `completedRounds`, `supplyTypes`。单任务完成必须有相应玩家、相应任务的达标对局及结算时点，不能仅使用活动通用的有效体验判断。

时间字段为距活动开始的整数分钟；`DAY=1440`、`END=20160`，有效事件时间范围 `[0, END)`。未发生的尝试或完成为 `null`。模拟原始库包含完整 14 天记录，页面按 `asOf` 截断后展示。

当前玩家 ID 在各活动之间独立。正式接入若需要跨活动账号去重，应另设账号级匿名标识。`segment` 原始值为新玩家/活跃玩家/回流玩家；界面“老玩家”是“活跃玩家”的显示和筛选别名。`excluded=true` 的测试账号不计入指标。

## 指标公式

- **有效体验转化率**：首次曝光后 24 小时内达到本活动有效体验条件的去重人数 / 首次曝光已满 24 小时人数。按首次曝光日归属。
- **任务超时未完成率**：解锁后统计时长内未完成的人数 / 已满该任务统计时长人数。超时后补做仍保留在超时分子，未解锁与未满时长玩家不进入分母。按任务解锁日归属。
- **24 小时再次体验率**：首次有效体验后 24 小时内，在另一场对局再次有效体验的人数 / 首次有效体验已满 24 小时人数。按首次有效体验日归属。
- **任务完成率**：截至快照已经完成的人数 / 截至快照已经解锁的人数。包含补做与刚解锁玩家，区别于超时率的成熟样本分母。
- **每日参与人数**：截至快照已结算的活动对局（按进入对局日期归属）或已发生任务尝试的每日去重玩家数。尚未结算且尚未产生尝试事件的对局暂不纳入，以确保每个计数都能在当前可见来源中找到证据；曝光和自动解锁不计参与。同一玩家可在多个日期参与。

任务链 T1–T6 的统计时长分别为 2/6/12/24/24/24 小时；日历任务均为解锁后 24 小时。活动结束不会强行将未满时长玩家列为失败。空分母返回 `rate=null`。

地区、玩家类型、模式偏好先限定活动玩家；时间范围作用于各指标的归属时间。`period`、`day`、`fromDay`、`toDay` 按交集计算。对比近期参与时采用最近三个完整日和之前三个完整日，不把当日部分时长与完整日比较。

## 行为分群

`behaviorGroups` 在当前筛选范围内寻找已满任务统计时长、截至快照仍未完成的任务，按以下优先级互斥归类：

1. **中途停滞**（`attempt-stall`）：任务链完成过前序任务；日历完成过其他任务；尝试当前未完成任务，最后活动行为距快照至少 48 小时。
2. **领奖后未继续**（`reward-stop`）：领取过奖励，领取后至少 48 小时没有新活动行为，仍有未完成任务。
3. **已解锁未尝试**（`not-started`）：任务已满统计时长，仍没有尝试记录。

最后活动行为包含对局、实际任务尝试/完成、奖励领取；不包含自动解锁。因此，日历内容的自动开放不会重置玩家的无行为时长。这些分群描述活动内行为，不输出退游或付费结论。

## 开发 API

- `selectActivityData(allQueryRows, activityId)`：返回活动及其任务、玩家、对局、任务状态、事件、奖励和反馈；保留原始行对象引用。
- `analyze(data, filters, asOf)`：返回三个指标、任务明细、每任务 `metric`（超时率）与 `completion`（完成率）。
- `participationTrend(data, filters, asOf)`：返回 `{day,date,participants}`。
- `behaviorGroups(data, filters, asOf, taskId?)`：返回 `{id,title,count,players,steps,summary,taskId,examples}`。
- `visibleEvidence` / `playerTimeline`：只返回当前快照已经发生的事件证据或时间线。

五分钟刷新由模拟时钟实现：从第 14 天 12:00 开始，每实际五分钟推进五分钟，重开页面补足经过的时间，最终停在活动结束。它没有执行外部数据库或社区 API 查询。

## 复现与测试

在项目目录运行：

```powershell
node ./generate-platform.mjs
node ./verify.mjs
```

生成器读取当前快照中的原滑轨数据，使用固定种子 `2026111701` 生成另外四个活动与模拟反馈，保留稳定看板 ID，设置 `buildStatus=updating`。正常平台修订只运行此生成器；旧 `src/content/dashboard/generate.mjs` 只用于单活动底库生成。生成后需要按项目 `AGENTS.md` 重新构建，并在完成检验后设置 `buildStatus=complete`。

本轮保留原滑轨行为数据，仅修正一条越过活动结束时间的无效尝试：FF-02511 / T3 的 20166 分钟尝试改为空，移除对应流水。原基准指标不变。另修正 CS D14 模拟反馈的候选与时间，使反馈发生在该玩家实际解锁 D14 之后。

当前规模：5,880 玩家、40,310 对局、54 个任务、49,508 玩家任务状态、117,970 任务事件、11,831 奖励领取、50 条反馈。`verify.mjs` 的 25 项检验覆盖活动隔离、逐任务动作条件、日历独立解锁、时间因果关系、成熟窗口、指标对账、分群证据、模拟反馈引用及进行中对局的可见来源边界。
