import { createContext, use, useState, type ReactNode } from 'react'

export type Lang = 'zh' | 'en'

/** Read by nothing else; the html lang attribute follows it. */
export const LANG_KEY = 'story-timeline-lang'

/**
 * Interface text in both languages. Story content (titles, names, places, acts) is never
 * translated; only the chrome around it is.
 */
const zh = {
  // Header
  project: '项目', pickProject: '选择项目', events: '事件', people: '人物', core: '核心', world: '世界', timeline: '时间线', relations: '人物关系', graphView: '关系图', chordView: '环形图',
  light: '浅色', dark: '深色', system: '跟随系统', theme: '主题', language: '语言', switchLanguage: '切换语言', switchProject: '切换项目', view: '视图', mainNav: '主导航',
  refresh: '重新读取数据', refreshing: '正在读取数据 …', refreshFailed: '读取失败，显示的是上次读到的数据',
  stats: (events: number, people: number) => `${events} 事件 · ${people} 人物`,
  relationStats: (people: number, links: number) => `${people} 人物 · ${links} 关系`,
  // Filters
  filters: '筛选', search: '搜索', searchPh: '标题、正文、#事件键', order: '排列', byTime: '时间顺序', byAct: '按部', kinds: '类型',
  coreOnly: '只看核心事件', hideWorld: '隐藏世界事件', jump: '跳转', showing: '显示', stepHint: '上下切换', closeHint: '关闭详情',
  matchAll: '同时出现', matchAny: '任一出现', clearFilter: '清除筛选', clear: '清除', done: '完成', filterSub: '人物、类型和排列方式',
  more: (n: number) => `更多 ${n} 人 …`, less: '收起',
  resizeSide: '调整筛选栏宽度', resizeDetail: '调整详情栏宽度',
  // Timeline
  lanes: '泳道', laneNav: '人物泳道', worldEvents: '世界事件', showWorld: '显示世界事件', hideWorldEvents: '隐藏世界事件',
  noMatch: '没有符合筛选条件的事件', noMatchHint: '换一个关键词，或减少人物和类型筛选。', count: (n: number) => `${n} 条`, untimed: '未标时间', storySection: '故事', noAct: '未分部', worldLane: '世',
  // Details
  detail: '详情', detailSub: '所选事件或人物的详细信息', detailClosed: '详情（已关闭）', noneSelected: '未选择', selectHint: '选择一个事件或人物，在这里查看详情。',
  prev: '上一条', next: '下一条', close: '关闭', scene: '场景', worldEvent: '世界事件', coreBadge: '核心',
  act: '部', place: '地点', inPlace: '位于', time: '时间', aliases: '别名', listSep: '、', group: '集体', customColor: '指定颜色', person: '人物',
  peopleSec: '关联人物', learnsSec: '得知', placeSec: '地点资料', linksSec: '关联事件', sourcesSec: '来源', sidesSec: '所属阵营', relSec: '人物关系',
  knowledgeSec: '知识', arcSec: '弧光阶段', eventsSec: '相关事件', onlyThis: '在时间线里只看此人',
  category: { faction: '阵营', main: '主要人物', minor: '次要人物', historical: '历史人物', family: '亲属', supporting: '配角' } as Record<string, string>,
  realm: { physical: '现实', mind: '意识', dream: '梦境', spirit: '灵界' } as Record<string, string>,
  presence: { body: '身体在场', mind: '意识在场', spirit: '灵体在场', mentioned: '被提及', related: '相关人物' } as Record<string, string>,
  exit: { dies: '死亡', leaves: '离场' } as Record<string, string>,
  knowledgeKind: { knowledge: '知识', realization: '领悟', idea: '想法' } as Record<string, string>,
  mutual: '双向', member: '成员', since: '开始于', until: '结束于', learnedAt: '得知于', forgotAt: '遗忘于', knownAtStart: '开篇已知', kept: '持续保留',
  learned: '得知', forgot: '遗忘', noEvent: (key: string) => `无对应事件：${key}`, unmarkedEvent: '未标事件', likely: '较可信', unsure: '待核实',
  isOf: (a: string, b: string, label: string) => `${a}是${b}的${label}`, eventPeople: '事件人物',
  linkBoth: '双向关联', linkFrom: '来自此事件', linkTo: '指向此事件',
  // Relations view
  relationsN: '关系', factions: '阵营', searchPeople: '搜索人物', searchPeoplePh: '姓名、别名', searchPeopleHint: '图中会突出匹配的人物；按回车把视图移到第一个匹配', labelsOnFocus: '人物较多时，只在悬停或选中人物时显示其关系名', relKinds: '关系类型', display: '显示',
  chordHint: '悬停或选择人物，查看其关系', former: '曾属', layoutForces: '布局力度', forceRepel: '节点间距', forceDistance: '连线长度', forceCluster: '阵营聚拢', forceDefaults: '恢复默认',
  showMinor: '显示次要人物', showLabels: '显示关系名', highlightFaction: '高亮阵营', fit: '适应画面', resetLayout: '重排布局', graphAria: '人物关系图',
  graphCount: (people: number, links: number) => `${people} 人 · ${links} 条`, zoomIn: '放大', zoomOut: '缩小',
  legMain: '主要人物（泳道色）', legOther: '其他人物', legOneWay: '单向关系', legMutual: '相互关系', legHostile: '敌对', legFaction: '阵营色环',
  legChanged: '关系曾改变', legEnded: '关系已结束', relHistory: '关系变化', fromStart: '开篇', ongoing: '至今',
  list: '列表', graph: '关系图', mainPeople: '主要人物', otherPeople: '其他人物', all: '全部', canvas: '关系图画布',
  zoomHint: (pct: number) => `${pct}% · 双指缩放 · 拖动平移`, noRelations: '没有可显示的关系', noRelationsHint: '勾选更多关系类型，或显示次要人物。',
  tone: { family: '亲属', love: '伴侣', friend: '朋友', work: '师徒·随从', hostile: '敌对', neutral: '其他' } as Record<string, string>,
  // Causality view
  causalView: '因果', causalAria: '事件因果图', linkKinds: '关联类型', linkedN: '关联事件', linksN: '关联', longestChain: '最长链',
  consequential: '影响最大的事件', causalCount: (events: number, links: number) => `${events} 事件 · ${links} 条`,
  causalHint: '选择事件，查看前因后果', reach: (n: number) => `引出 ${n} 个事件`, noLinks: '没有可显示的事件关联', noLinksHint: '勾选更多关联类型。',
  legCore: '核心事件', legCauses: '前因', legEffects: '后果',
  linkKind: { cause: '导致', setup: '伏笔', reveal: '揭示', echo: '呼应 · 同时', other: '其他' } as Record<string, string>,
  // Story cursor
  cursor: '故事进度', wholeStory: '整个故事', cursorBack: '上一事件', cursorOn: '下一事件', cursorClear: '回到整个故事', cursorSlider: '故事进度',
  viewAsOf: '从此处看故事', cursorHere: '当前进度', asOf: '截至', nowLabel: '此时', stageNow: '当前阶段',
  status: { unseen: '尚未登场', present: '在场', dead: '已死亡', left: '已离场' } as Record<string, string>,
  relNow: '此时的关系', relNotNow: '已结束或尚未开始', phase: { future: '尚未开始', ended: '已结束', active: '进行中' } as Record<string, string>,
  notKnown: (n: number) => `另有 ${n} 条此时尚未得知或已遗忘`,
  // Insights view
  insightsView: '洞察', insightsAria: '故事洞察', findingsN: '发现', gapsN: '数据缺口', insightCategory: '类别', findings: '故事发现', gaps: '数据缺口',
  insightPerson: '人物', anyone: '所有人', showInCausal: '在因果图中查看', showInGraph: '在关系图中查看', showAll: (n: number) => `全部 ${n} 项`, showAllRows: (n: number) => `显示全部（${n}）`, showFewer: '收起',
  noInsights: '没有可显示的洞察', noInsightsHint: '换一个人物，或切换类别。', insightCount: (findings: number, gaps: number) => `${findings} 发现 · ${gaps} 缺口`,
  insightGroup: { causal: '因果', irony: '知情', relations: '关系', presence: '出场', exits: '退场' } as Record<string, string>,
  insightKind: {
    chain: ['最长因果链', '沿导致、伏笔和揭示首尾相连的最长一串事件'],
    root: ['根源事件', '没有前因，却引出最多后果'],
    turningPoint: ['转折点', '承接前因，又引出最多后果'],
    setup: ['伏笔与回收', '伏笔到回收相隔的事件数'],
    irony: ['知情差', '有人已经知道，同场的人却还不知道'],
    turn: ['关系转折', '关系改变或结束的人物'],
    neverMeet: ['从未同场', '写明了关系，却从不在同一事件中出场'],
    unstated: ['未写明的关系', '主要人物经常同场，却没有写明关系'],
    dominant: ['各部主角', '每一部出场最多的人物，至少占一半事件'],
    absence: ['长久缺席', '消失很久之后又回来的人物'],
    exitsByAct: ['各部退场', '每一部的死亡与离场'],
    exitPeak: ['集中退场', '多人同时死亡或离场的事件'],
    noParticipants: ['没有人物的事件', '给事件加上参与人物'],
    isolated: ['孤立事件', '与其他事件没有任何关联'],
    noEvents: ['未出场的人物', '不在任何事件中'],
    noArc: ['没有弧光的主要人物', '没有任何弧光阶段'],
    arcNoSince: ['没有起点的弧光阶段', '故事进度无法定位这些阶段'],
    otherLinks: ['未分类的关联', '关联文字无法归入导致、伏笔、揭示或呼应'],
    relationNoSince: ['没有起点的关系', '视为开篇即有；亲属关系不计'],
    knowledgeNoSince: ['没有起点的知识', '视为开篇已知'],
    unresolved: ['无法解析的引用', '引用的人物、事件、地点或部不存在'],
    memberNotGroup: ['成员关系指向非集体', '成员关系的另一方必须是集体'],
    endBeforeStart: ['结束早于开始', '按故事顺序，结束事件在开始事件之前'],
    doubleDeath: ['多次死亡', '同一人物在不止一个事件中死亡'],
    placeCycle: ['地点层级成环', '沿上级地点走下去又回到自己'],
    duplicateRelation: ['重复的关系', '同一条关系存了两次'],
    duplicateLink: ['重复的事件关联', '同一条关联存了两次'],
  } as Record<string, [string, string]>,
  problems: '数据文件问题', problemsHint: '检查整个数据文件，不随故事进度变化。数据库不强制这些规则。',
  problemNote: { repeat: '重复', reversed: '两端各存一次', relation: '关系', knowledge: '知识', arcStage: '弧光阶段' } as Record<string, string>,
  reachN: (n: number) => `引出 ${n}`, apart: (n: number) => `相隔 ${n}`,
  ironyLine: (text: string) => `“${text}”`, ironyLate: '直到', ironyLearns: '才得知', ironyWith: '· 已知者', ironyScenes: (n: number) => `同场 ${n} 次`,
  together: (n: number) => `同场 ${n} 次`,
  ofAct: (n: number, m: number) => `${n} / ${m} 个事件`, goneFor: (n: number) => `缺席 ${n} 个事件`, goneAfter: '最后出现', backAt: '回到', exitsN: (n: number) => `${n} 人退场`,
  // Briefs: the button, and the fixed headings of the Markdown it copies
  copyBrief: '复制简报', copyStoryBrief: '复制故事简报', copyBriefAsOf: (label: string, title?: string) => (title ? `${label}（截至「${title}」）` : label),
  copied: '已复制', copyFailed: '无法复制：浏览器不允许写入剪贴板。请改用下载。',
  downloadBrief: '下载简报（.md）', downloadStoryBrief: '下载故事简报（.md）', downloaded: '已下载',
  brief: {
    storyTitle: (name: string) => `${name} · 故事简报`, kind: '类型', status: '状态', factions: '阵营', members: '成员', formerly: '曾属',
    relEnded: '已结束的关系', endedAt: '结束于', knowsNow: '此时知道', othersKnow: '别人已知、此人尚不知道', knownTo: '已知者', learnsAt: '得知于',
    events: '经历的事件（未注明即身体在场）', people: '人物（未注明即身体在场）', causes: '前因（按故事顺序）', effects: '后果（按故事顺序）', sideLinks: '呼应与其他关联', learns: '得知与遗忘',
    acts: '各部', cast: '人物', unseen: '尚未登场', outside: '阵营之外', openSetups: '未回收的伏笔', findings: '故事发现',
  },
  // Errors and loading
  listError: '项目列表无法读取', noProjects: '数据目录里没有项目', listErrorHint: '确认 API 已启动，并且数据目录里有 .sqlite 文件。',
  loadError: '读取失败', loadErrorHint: '检查 API 日志和数据库文件。', loading: (name: string) => `正在读取 ${name} …`,
  projectNotFound: '项目不存在', projectFallback: (asked: string, shown: string) => `没有找到项目「${asked}」，现在显示「${shown}」。`, dismiss: '关闭提示',
}

export type Dictionary = typeof zh

const en: Dictionary = {
  project: 'Project', pickProject: 'Pick a project', events: 'Events', people: 'People', core: 'Core', world: 'World', timeline: 'Timeline', relations: 'Relations', graphView: 'Graph', chordView: 'Chord',
  light: 'Light', dark: 'Dark', system: 'System', theme: 'Theme', language: 'Language', switchLanguage: 'Switch language', switchProject: 'Switch project', view: 'View', mainNav: 'Main navigation',
  refresh: 'Reload data', refreshing: 'Loading data …', refreshFailed: 'Load failed; showing the data last loaded',
  stats: (events, people) => `${events} events · ${people} people`,
  relationStats: (people, links) => `${people} people · ${links} links`,
  filters: 'Filters', search: 'Search', searchPh: 'Title, text, #event key', order: 'Order', byTime: 'By time', byAct: 'By act', kinds: 'Type',
  coreOnly: 'Core events only', hideWorld: 'Hide world events', jump: 'Jump to', showing: 'Showing', stepHint: 'Prev / next', closeHint: 'Close details',
  matchAll: 'All selected', matchAny: 'Any selected', clearFilter: 'Clear filters', clear: 'Clear', done: 'Done', filterSub: 'People, type and order',
  more: n => `${n} more …`, less: 'Show less',
  resizeSide: 'Resize filter panel', resizeDetail: 'Resize detail panel',
  lanes: 'Lanes', laneNav: 'Character lanes', worldEvents: 'World events', showWorld: 'Show world events', hideWorldEvents: 'Hide world events',
  noMatch: 'No event matches the filters', noMatchHint: 'Try another keyword, or remove some people or type filters.', count: n => `${n} events`, untimed: 'Untimed', storySection: 'Story', noAct: 'No act', worldLane: 'W',
  detail: 'Details', detailSub: 'Details of the selected event or character', detailClosed: 'Details (closed)', noneSelected: 'Nothing selected', selectHint: 'Select an event or a character to see its details here.',
  prev: 'Previous', next: 'Next', close: 'Close', scene: 'Scene', worldEvent: 'World event', coreBadge: 'Core',
  act: 'Act', place: 'Place', inPlace: 'Inside', time: 'Time', aliases: 'Aliases', listSep: ', ', group: 'Group', customColor: 'Custom color', person: 'Character',
  peopleSec: 'People', learnsSec: 'Learned', placeSec: 'Place details', linksSec: 'Linked events', sourcesSec: 'Sources', sidesSec: 'Factions', relSec: 'Relations',
  knowledgeSec: 'Knowledge', arcSec: 'Arc stages', eventsSec: 'Related events', onlyThis: 'Only this person on the timeline',
  category: { faction: 'Faction', main: 'Main character', minor: 'Minor character', historical: 'Historical figure', family: 'Family', supporting: 'Supporting' },
  realm: { physical: 'Physical', mind: 'Mind', dream: 'Dream', spirit: 'Spirit' },
  presence: { body: 'In person', mind: 'In mind', spirit: 'In spirit', mentioned: 'Mentioned', related: 'Related' },
  exit: { dies: 'Dies', leaves: 'Leaves' },
  knowledgeKind: { knowledge: 'Knowledge', realization: 'Realization', idea: 'Idea' },
  mutual: 'Mutual', member: 'Member', since: 'Since', until: 'Until', learnedAt: 'Learned at', forgotAt: 'Forgotten at', knownAtStart: 'Known from the start', kept: 'Kept',
  learned: 'Learned', forgot: 'Forgot', noEvent: key => `No such event: ${key}`, unmarkedEvent: 'No event', likely: 'Likely', unsure: 'Unsure',
  isOf: (a, b, label) => `${a} is ${b}'s ${label}`, eventPeople: 'Event people',
  linkBoth: 'Linked both ways', linkFrom: 'From this event', linkTo: 'To this event',
  relationsN: 'Links', factions: 'Factions', searchPeople: 'Search people', searchPeoplePh: 'Name, alias', searchPeopleHint: 'Matches stand out in the graph; press Enter to centre the view on the first one', labelsOnFocus: 'On a large graph, names show for the hovered or selected person only', relKinds: 'Relation type', display: 'Display',
  chordHint: 'Hover or select a character to see their relations', former: 'formerly', layoutForces: 'Layout forces', forceRepel: 'Spacing', forceDistance: 'Link length', forceCluster: 'Faction pull', forceDefaults: 'Defaults',
  showMinor: 'Show minor characters', showLabels: 'Show relation names', highlightFaction: 'Highlight faction', fit: 'Fit to view', resetLayout: 'Reset layout', graphAria: 'Relationship graph',
  graphCount: (people, links) => `${people} people · ${links} links`, zoomIn: 'Zoom in', zoomOut: 'Zoom out',
  legMain: 'Main character (lane color)', legOther: 'Other character', legOneWay: 'One-way', legMutual: 'Mutual', legHostile: 'Hostile', legFaction: 'Faction ring',
  legChanged: 'Changed', legEnded: 'Ended', relHistory: 'Relation history', fromStart: 'Start', ongoing: 'Ongoing',
  list: 'List', graph: 'Graph', mainPeople: 'Main characters', otherPeople: 'Other characters', all: 'All', canvas: 'Graph canvas',
  zoomHint: pct => `${pct}% · pinch to zoom · drag to pan`, noRelations: 'No relations to show', noRelationsHint: 'Tick more relation types, or show minor characters.',
  tone: { family: 'Family', love: 'Partner', friend: 'Friend', work: 'Mentor · follower', hostile: 'Hostile', neutral: 'Other' },
  causalView: 'Causality', causalAria: 'Event causality graph', linkKinds: 'Link type', linkedN: 'Linked events', linksN: 'Links', longestChain: 'Longest chain',
  consequential: 'Most consequential events', causalCount: (events, links) => `${events} events · ${links} links`,
  causalHint: 'Select an event to see its causes and effects', reach: n => `Leads to ${n} events`, noLinks: 'No event links to show', noLinksHint: 'Tick more link types.',
  legCore: 'Core event', legCauses: 'Leads to it', legEffects: 'Follows from it',
  linkKind: { cause: 'Causes', setup: 'Foreshadows', reveal: 'Reveals', echo: 'Echo · same time', other: 'Other' },
  cursor: 'Story at', wholeStory: 'Whole story', cursorBack: 'Previous event', cursorOn: 'Next event', cursorClear: 'Back to the whole story', cursorSlider: 'Story position',
  viewAsOf: 'View story as of here', cursorHere: 'Story position', asOf: 'As of', nowLabel: 'Now', stageNow: 'Arc stage',
  status: { unseen: 'Not yet introduced', present: 'Present', dead: 'Died', left: 'Left' },
  relNow: 'Relations now', relNotNow: 'Ended or not yet started', phase: { future: 'Not yet', ended: 'Ended', active: 'Active' },
  notKnown: n => `${n} more not known yet, or forgotten`,
  insightsView: 'Insights', insightsAria: 'Story insights', findingsN: 'Findings', gapsN: 'Data gaps', insightCategory: 'Category', findings: 'Findings', gaps: 'Data gaps',
  insightPerson: 'Character', anyone: 'Anyone', showInCausal: 'Show in causality view', showInGraph: 'Show in graph', showAll: n => `All ${n}`, showAllRows: n => `Show all (${n})`, showFewer: 'Show fewer',
  noInsights: 'No insight to show', noInsightsHint: 'Pick another character, or switch the category.', insightCount: (findings, gaps) => `${findings} findings · ${gaps} gaps`,
  insightGroup: { causal: 'Causality', irony: 'Knowledge', relations: 'Relations', presence: 'Presence', exits: 'Exits' },
  insightKind: {
    chain: ['Longest causal chain', 'The longest run of events joined by causes, setups and reveals'],
    root: ['Root causes', 'Nothing leads to them, yet they lead to the most'],
    turningPoint: ['Turning points', 'Caused by earlier events, and lead to the most'],
    setup: ['Setup and payoff', 'How many events lie between a setup and its payoff'],
    irony: ['Dramatic irony', 'Someone already knows; a character in the same scene does not yet'],
    turn: ['Relation turns', 'Pairs whose relation changes or ends'],
    neverMeet: ['Never meet', 'A relation is stated, but they are never in the same event'],
    unstated: ['Unstated relations', 'Main characters often together, with no relation stated'],
    dominant: ['Lead of each act', 'Who is in the most events of an act, half of them or more'],
    absence: ['Long absences', 'Gone for a long stretch, then back'],
    exitsByAct: ['Exits per act', 'Deaths and leavings in each act'],
    exitPeak: ['Mass exits', 'Events where several characters die or leave'],
    noParticipants: ['Events with no character', 'Add the characters who take part'],
    isolated: ['Unlinked events', 'No link to or from any other event'],
    noEvents: ['Characters in no event', 'Not in any event'],
    noArc: ['Main characters with no arc', 'No arc stage at all'],
    arcNoSince: ['Arc stages with no start', 'The story cursor cannot place these stages'],
    otherLinks: ['Unclassified links', 'The link text is not a cause, setup, reveal or echo'],
    relationNoSince: ['Relations with no start', 'Read as holding from the start; family ties are left out'],
    knowledgeNoSince: ['Knowledge with no start', 'Read as known from the start'],
    unresolved: ['Unresolved references', 'A key names no character, event, place or act'],
    memberNotGroup: ['Membership of a non-group', 'A member relation must point to a group'],
    endBeforeStart: ['Ends before it starts', 'In story order, the end event comes before the start event'],
    doubleDeath: ['More than one death', 'A character dies in more than one event'],
    placeCycle: ['Place parents in a cycle', 'Following the parent places leads back to the place'],
    duplicateRelation: ['Duplicate relations', 'The same relation is stored twice'],
    duplicateLink: ['Duplicate event links', 'The same link is stored twice'],
  },
  problems: 'Data file problems', problemsHint: 'Checks of the whole data file; the story cursor does not change them. The database does not enforce these rules.',
  problemNote: { repeat: 'Repeated', reversed: 'Stored at both ends', relation: 'Relation', knowledge: 'Knowledge', arcStage: 'Arc stage' },
  reachN: n => `leads to ${n}`, apart: n => `${n} apart`,
  ironyLine: text => `“${text}”`, ironyLate: 'learns only at', ironyLearns: '', ironyWith: '· already known to', ironyScenes: n => `${n} shared scenes`,
  together: n => `${n} events together`,
  ofAct: (n, m) => `${n} / ${m} events`, goneFor: n => `gone for ${n} events`, goneAfter: 'Last seen', backAt: 'back at', exitsN: n => `${n} exits`,
  copyBrief: 'Copy brief', copyStoryBrief: 'Copy story brief', copyBriefAsOf: (label, title) => (title ? `${label} as of “${title}”` : label),
  copied: 'Copied', copyFailed: 'Cannot copy: the browser blocks the clipboard. Download the brief instead.',
  downloadBrief: 'Download brief (.md)', downloadStoryBrief: 'Download story brief (.md)', downloaded: 'Downloaded',
  brief: {
    storyTitle: name => `${name} · story brief`, kind: 'Kind', status: 'Status', factions: 'Factions', members: 'Members', formerly: 'formerly',
    relEnded: 'Ended relations', endedAt: 'ended at', knowsNow: 'Knows now', othersKnow: 'Others know, this character does not yet', knownTo: 'known to', learnsAt: 'learns at',
    events: 'Events (in person unless noted)', people: 'People (in person unless noted)', causes: 'Causes, in story order', effects: 'Effects, in story order', sideLinks: 'Echoes and other links', learns: 'Learned and forgotten',
    acts: 'Acts', cast: 'Cast', unseen: 'Not yet introduced', outside: 'Outside the factions', openSetups: 'Open setups', findings: 'Findings',
  },
  listError: 'The project list cannot be read', noProjects: 'The data folder has no project', listErrorHint: 'Make sure the API runs and the data folder has .sqlite files.',
  loadError: 'Load failed', loadErrorHint: 'Check the API log and the database file.', loading: name => `Loading ${name} …`,
  projectNotFound: 'Project not found', projectFallback: (asked, shown) => `There is no project “${asked}”; showing “${shown}”.`, dismiss: 'Dismiss',
}

export const DICT: Record<Lang, Dictionary> = { zh, en }

interface LangState {
  lang: Lang
  t: Dictionary
  setLang: (lang: Lang) => void
}

/** Without a provider (tests, static markup) the interface reads Chinese. */
const LangContext = createContext<LangState>({ lang: 'zh', t: zh, setLang: () => {} })

function storedLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang)
  const setLang = (next: Lang) => {
    setLangState(next)
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN'
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  }
  return <LangContext value={{ lang, t: DICT[lang], setLang }}>{children}</LangContext>
}

export function useLang(): LangState {
  return use(LangContext)
}

/** The dictionary of the current language. */
export function useT(): Dictionary {
  return use(LangContext).t
}
