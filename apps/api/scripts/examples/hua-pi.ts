import type { Example } from './types.js';

/**
 * 《画皮》, from 蒲松龄《聊斋志异》. The tale is public domain. Every text below is a fresh summary
 * in modern Chinese; nothing is copied from the original or from a modern edition.
 * The tale is told in story order, so acts and `sortOrder` agree.
 */
const A1 = '一 · 惑';
const A2 = '二 · 画皮';
const A3 = '三 · 除妖';
const A4 = '四 · 回生';
const TEXT = 'liaozhai';
const COMMENT = 'yishishi';

export const huaPi: Example = {
  file: '画皮.sqlite',
  acts: [
    { name: A1, span: '某日清晨至数日后', description: '王生在路上遇见美女，带回书斋藏起来，不听妻子和道士的话。' },
    { name: A2, span: '数日后的一天，至当夜', description: '王生看见女子的真面目，向道士求救，夜里仍被掏去了心。' },
    { name: A3, span: '次日', description: '道士追到南院，斩鬼，收走人皮。' },
    { name: A4, span: '次日至第三日天明', description: '陈氏为救丈夫受乞丐羞辱，吐出一颗人心，丈夫复活。' },
  ],
  places: [
    { key: 'taiyuan', name: '太原', description: '王生的家乡。' },
    { key: 'road', name: '城外道上', parent: 'taiyuan', description: '王生清早出门时走的路。' },
    { key: 'wang-home', name: '王生宅', parent: 'taiyuan', description: '王生一家的宅院。' },
    { key: 'study', name: '书斋', parent: 'wang-home', description: '王生读书的屋子，平时没有家人住。女子藏在这里的密室里。' },
    { key: 'inner-room', name: '内室', parent: 'wang-home', description: '王生和陈氏的卧房。' },
    { key: 'south-court', name: '南院', parent: 'taiyuan', description: '二郎一家的住处。' },
    { key: 'market', name: '集市', parent: 'taiyuan', description: '道士和疯乞丐都在这里出现。' },
    { key: 'wilds', name: '野外', parent: 'taiyuan', description: '王生追上道士、跪地求救的地方。' },
    { key: 'qingdi-temple', name: '青帝庙', parent: 'taiyuan', description: '道士约王生相会的庙。' },
  ],
  sources: [
    {
      key: TEXT, title: '蒲松龄《聊斋志异·画皮》', lang: 'lzh', location: 'https://zh.wikisource.org/w/index.php?search=%E7%95%AB%E7%9A%AE',
      note: '清代文言短篇，公有领域。本项目的文字都是现代汉语概述，没有抄录原文或今人译注。段号按本项目的分段：1 遇女至劝遣，2 市遇道士至约会青帝庙，3 悬拂至掏心，4 报信至收皮，5 陈氏求救，6 乞人与吞唾，7 吐心回生，8 异史氏曰。',
    },
    {
      key: COMMENT, title: '《画皮》篇末“异史氏曰”', lang: 'lzh', location: 'https://zh.wikisource.org/w/index.php?search=%E7%95%AB%E7%9A%AE',
      note: '作者的评语：世人把妖当作美人，把忠告当作妄言；贪恋别人美色的人，他的妻子也要吞下别人的唾沫。评语不是情节，只作为第二出处引用。',
    },
  ],
  characters: [
    {
      key: 'wang', name: '王生', category: 'main', color: 'oklch(0.55 0.13 250)', description: '太原的书生。贪恋美色，把妖当成美人，被掏心而死，又被妻子救活。',
      stages: [
        { stage: '迷色', since: 'yu-nv', description: '把女子当作落难的美人，不听妻子和道士的话。' },
        { stage: '惊惧', since: 'kui-pi', description: '亲眼看见画皮，转而向道士求救。' },
        { stage: '死去', since: 'lie-xin', description: '被掏去心，死在内室。' },
        { stage: '复生', since: 'hui-sheng', description: '醒来只觉得像做了一场梦，伤口结痂痊愈。' },
      ],
      relations: [{ to: 'wang-family', relation: '成员', member: true }],
    },
    {
      key: 'demon', name: '狞鬼', category: 'main', color: 'oklch(0.55 0.16 150)', description: '青面獠牙、牙齿像锯子一样的恶鬼。在人皮上作画，披上人皮就变成美女。',
      names: [
        { name: '女郎', lang: 'zh', note: '初见时的化身：十六七岁的美女' },
        { name: '妪', lang: 'lzh', note: '逃到南院后的化身：老妇人' },
        { name: '孽魅', lang: 'lzh', note: '道士对它的称呼' },
        { name: '厉鬼', lang: 'zh', note: '人皮脱落后的样子' },
      ],
      relations: [
        { to: 'wang', relation: '假意相好', tone: 'love', since: 'xie-gui', until: 'kui-pi' },
        { to: 'wang', relation: '仇人', since: 'xuan-fu' },
      ],
    },
    {
      key: 'chen', name: '陈氏', category: 'main', color: 'oklch(0.58 0.15 20)', description: '王生的妻子。劝丈夫送走女子不成；丈夫死后忍受乞丐的羞辱，救活了他。',
      stages: [
        { stage: '劝夫', since: 'quan-qian', description: '怀疑女子来历，劝丈夫送走她。' },
        { stage: '丧夫', since: 'lie-xin', description: '眼看丈夫被掏心而死，不敢出声。' },
        { stage: '忍辱', since: 'qi-ren', description: '为救丈夫向疯乞丐跪求，挨打、吞唾。' },
        { stage: '救夫', since: 'tu-xin', description: '吐出人心，亲手合腔，救活丈夫。' },
      ],
      relations: [
        { to: 'wang', relation: '妻子' },
        { to: 'wang-family', relation: '成员', member: true },
      ],
    },
    {
      key: 'daoshi', name: '道士', category: 'main', color: 'oklch(0.62 0.12 80)', description: '在集市上看出王生身上有邪气的道士。先是不忍伤鬼，王生被害后斩鬼收皮。',
      stages: [
        { stage: '怜鬼', since: 'ye-qiu', description: '觉得这东西也很苦，只给蝇拂，不伤它性命。' },
        { stage: '除鬼', since: 'ben-gao', description: '怒它害人，追到南院斩首收皮。' },
      ],
      relations: [
        { to: 'wang', relation: '指点者', tone: 'work', since: 'shi-yu' },
        { to: 'demon', relation: '怜悯者', tone: 'other', since: 'ye-qiu', until: 'ben-gao' },
        { to: 'demon', relation: '敌人', since: 'ben-gao' },
      ],
    },
    {
      key: 'beggar', name: '乞人', category: 'main', description: '集市上的疯乞丐，常躺在粪土里。他羞辱陈氏，又让她吞下的痰化成了王生的心。',
      names: [{ name: '疯者', lang: 'lzh', note: '道士对他的称呼' }],
      relations: [{ to: 'chen', relation: '戏辱者', tone: 'other', since: 'qi-ren', until: 'qiang-dan' }],
    },
    {
      key: 'erlang', name: '二郎', category: 'minor', description: '王生的弟弟，住在南院。替嫂嫂去请道士，又陪她去找乞丐。',
      relations: [
        { to: 'wang', relation: '弟弟' },
        { to: 'wang-family', relation: '成员', member: true },
      ],
    },
    {
      key: 'erlang-wife', name: '二郎之妻', category: 'minor', description: '二郎的妻子。早上收留了来求做仆人的老妇人。',
      relations: [
        { to: 'erlang', relation: '妻子' },
        { to: 'wang-family', relation: '成员', member: true },
      ],
    },
    {
      key: 'maid', name: '婢女', category: 'minor', description: '王家的婢女。王生被害后举灯进屋。',
      relations: [
        { to: 'chen', relation: '婢女', tone: 'work' },
        { to: 'wang-family', relation: '成员', member: true },
      ],
    },
    { key: 'wang-family', name: '王家', kind: 'group', category: 'faction', description: '王生一家：王生、陈氏、二郎夫妇和婢女。' },
    { key: 'crowd', name: '市人', kind: 'group', category: 'faction', description: '集市上围观乞丐羞辱陈氏的人群。' },
  ],
  events: [
    {
      key: 'yu-nv', title: '道上遇女', act: A1, sortOrder: 10, time: '某日清晨', place: 'road', core: true,
      description: '王生清早出门，看见一个女子抱着包袱独自赶路，走得很吃力。追上去一看，是十六七岁的美女。女子说父母贪财，把她卖给富家作妾；正妻嫉妒，早晚打骂，她受不了，要逃到远处去。王生说自家书斋不远，请她同去，女子高兴地答应了。',
      cast: [['wang', 'body'], ['demon', 'body']],
      links: [{ to: 'xie-gui', relation: '导致' }],
      cite: [{ source: TEXT, ref: '第 1 段' }],
    },
    {
      key: 'xie-gui', title: '藏于书斋', act: A1, sortOrder: 20, time: '同日', place: 'study',
      description: '王生替她拿着包袱，带回书斋。女子见屋里没有家人，要王生替她保守秘密。两人同宿。王生把她藏在密室里，过了几天，外人都不知道。',
      cast: [['wang', 'body'], ['demon', 'body']],
      cite: [{ source: TEXT, ref: '第 1 段' }],
    },
    {
      key: 'quan-qian', title: '陈氏劝遣', act: A1, sortOrder: 30, time: '数日后', place: 'wang-home',
      description: '王生把这件事悄悄告诉了妻子陈氏。陈氏怀疑女子是大户人家的媵妾，怕惹出祸来，劝他把人送走。王生不听。',
      cast: [['wang', 'body'], ['chen', 'body'], ['demon', 'mentioned']],
      cite: [{ source: TEXT, ref: '第 1 段' }],
    },
    {
      key: 'shi-yu', title: '市遇道士', act: A1, sortOrder: 40, time: '数日后', place: 'market', core: true,
      description: '王生偶然到集市，一个道士看见他就吃了一惊，问他遇到了什么。王生说没有。道士说他身上邪气缠绕，叹息世上竟有死到临头还不醒悟的人。王生起了疑心，转念又想那明明是个美人，认定道士是借驱邪来骗饭吃。',
      cast: [['wang', 'body'], ['daoshi', 'body']],
      links: [
        { to: 'kui-pi', relation: '起疑', kind: 'cause', note: '道士的话让王生回家时多了个心眼。' },
        { to: 'lie-xin', relation: '应验', kind: 'setup', note: '“死将临而不悟”，当夜就应验了。' },
      ],
      cite: [{ source: TEXT, ref: '第 2 段' }],
    },
    {
      key: 'kui-pi', title: '窗窥画皮', act: A2, sortOrder: 50, time: '同日', place: 'study', core: true,
      description: '王生回到书斋，院门从里面闩着，只好翻过残墙。房门也关着。他轻步走到窗下偷看：屋里一个青面恶鬼，牙齿尖利如锯，把一张人皮铺在床上，拿彩笔描画；画完扔下笔，提起人皮，像抖衣服一样披到身上，立刻变成那个女子。王生吓坏了，像野兽一样伏在地上爬了出去。',
      cast: [['wang', 'body'], ['demon', 'body']],
      links: [{ to: 'ye-qiu', relation: '导致' }],
      cite: [{ source: TEXT, ref: '第 2 段' }],
    },
    {
      key: 'ye-qiu', title: '野外求救', act: A2, sortOrder: 60, time: '同日', place: 'wilds',
      description: '王生急忙去追道士，不知他去了哪里，四处寻找，终于在野外遇见，跪下求救。道士说可以替他把它赶走；又说这东西也很苦，好不容易才找到替身，自己不忍心伤它性命。道士把一柄蝇拂交给王生，叫他挂在卧室门上，临别约定在青帝庙相会。',
      cast: [['wang', 'body'], ['daoshi', 'body']],
      links: [
        { to: 'xuan-fu', relation: '铺垫', note: '蝇拂。' },
        { to: 'ben-gao', relation: '伏笔', note: '约在青帝庙相会，第二天二郎才知道去哪里找道士。' },
      ],
      cite: [{ source: TEXT, ref: '第 2 段' }],
    },
    {
      key: 'xuan-fu', title: '悬拂拒鬼', act: A2, sortOrder: 70, time: '当夜一更', place: 'inner-room',
      description: '王生不敢进书斋，睡在内室，把蝇拂挂在门上。一更时分，门外有细碎的声响。他自己不敢看，叫陈氏去看。只见那女子走来，望见蝇拂不敢进门，站着咬牙切齿，很久才离开。',
      cast: [['wang', 'body'], ['chen', 'body'], ['demon', 'body']],
      links: [{ to: 'lie-xin', relation: '导致' }],
      cite: [{ source: TEXT, ref: '第 3 段' }],
    },
    {
      key: 'lie-xin', title: '碎拂掏心', act: A2, sortOrder: 80, time: '当夜', place: 'inner-room', core: true,
      description: '不久女子又来了，骂道士吓唬她，说到了嘴里的东西绝不会再吐出来。她扯下蝇拂撕碎，撞破房门闯进来，径直上了王生的床，撕开他的肚子，掏出心就走了。陈氏大哭。婢女拿灯进来照看，王生已经死了，腔子里满是血。陈氏又怕又哭，不敢出声。',
      cast: [['demon', 'body'], ['wang', 'body', 'leaves'], ['chen', 'body'], ['maid', 'body']],
      links: [{ to: 'ben-gao', relation: '导致' }],
      cite: [{ source: TEXT, ref: '第 3 段' }],
    },
    {
      key: 'ben-gao', title: '二郎报信', act: A3, sortOrder: 90, time: '次日', place: 'qingdi-temple', confidence: 'likely',
      description: '第二天，陈氏让王生的弟弟二郎跑去告诉道士。道士大怒，说自己本来可怜它，这鬼东西竟敢如此，当即跟着二郎赶来。',
      cast: [['erlang', 'body'], ['daoshi', 'body'], ['chen', 'related']],
      links: [{ to: 'xun-zong', relation: '导致' }],
      cite: [{ source: TEXT, ref: '第 4 段' }],
    },
    {
      key: 'xun-zong', title: '南院寻踪', act: A3, sortOrder: 100, time: '次日', place: 'wang-home',
      description: '女子已经不见了。道士抬头四面望了望，说它逃得不远，问南院是谁家。二郎说是自己的住处。道士说那东西就在你家。二郎很吃惊。道士问有没有不认识的人来过；二郎说自己一早去了青帝庙，不知道，回去问了才回来说：早上来了一个老妇人，想给他家做仆人，妻子留下了她，人还在。道士说就是它。',
      cast: [['daoshi', 'body'], ['erlang', 'body'], ['erlang-wife', 'related'], ['demon', 'mentioned']],
      links: [{ to: 'zhan-gui', relation: '导致' }],
      cite: [{ source: TEXT, ref: '第 4 段' }],
    },
    {
      key: 'zhan-gui', title: '木剑斩鬼', act: A3, sortOrder: 110, time: '次日', place: 'south-court', core: true,
      description: '道士拿着木剑站在院子中央，喝令孽鬼赔他的蝇拂。老妇人在屋里惊慌失色，出门想逃。道士追上去砍她，她倒在地上，人皮哗地脱落，变成恶鬼，躺着像猪一样嚎叫。道士用木剑砍下它的头，它的身子化成浓烟，在地上聚成一堆。道士拿出一个葫芦，拔开塞子放在烟里，葫芦像嘴吸气一样把烟吸尽，塞好口放进袋里。大家看那张人皮，眉眼手脚样样齐全。道士把它卷起来，声音就像卷画轴，也装进袋里，准备告辞。',
      cast: [['daoshi', 'body'], ['demon', 'body', 'dies'], ['erlang', 'body']],
      links: [{ to: 'kui-pi', relation: '呼应', mutual: true, note: '窗下看见鬼把人皮画好披上；院中看见道士把人皮像画轴一样卷起。' }],
      cite: [{ source: TEXT, ref: '第 4 段' }],
    },
    {
      key: 'qiu-sheng', title: '陈氏求救', act: A4, sortOrder: 120, time: '次日', place: 'wang-home',
      description: '陈氏在门口跪拜迎接道士，哭着求救活丈夫的办法。道士说自己法术浅，不能起死回生，但可以指一个人：集市上有个疯子，常躺在粪土里，去向他磕头哀求；他如果发疯侮辱夫人，夫人千万不要生气。二郎也认识这个人。叔嫂二人辞别道士，去找他。',
      cast: [['chen', 'body'], ['daoshi', 'body', 'leaves'], ['erlang', 'body']],
      links: [{ to: 'qi-ren', relation: '导致' }],
      cite: [{ source: TEXT, ref: '第 5 段' }],
    },
    {
      key: 'qi-ren', title: '市上乞人', act: A4, sortOrder: 130, time: '次日', place: 'market', core: true,
      description: '乞丐在路上疯疯癫癫地唱歌，鼻涕拖得老长，脏得没法靠近。陈氏跪着爬到他面前。乞丐笑问美人是不是爱他。陈氏说明缘故，他又大笑，说人人都可以做丈夫，何必救活他。陈氏苦苦哀求，他说人死了来求我救活，我又不是阎王，发怒用棍子打她。陈氏忍痛承受。集市上的人越聚越多，围得像一堵墙。',
      cast: [['chen', 'body'], ['beggar', 'body'], ['erlang', 'body'], ['crowd', 'body']],
      links: [{ to: 'qiang-dan', relation: '导致' }],
      cite: [{ source: TEXT, ref: '第 6 段' }],
    },
    {
      key: 'qiang-dan', title: '强吞痰唾', act: A4, sortOrder: 140, time: '次日', place: 'market', core: true,
      description: '乞丐咳出满满一把痰，举到陈氏嘴边，叫她吃下去。陈氏满脸通红，很为难；想起道士的嘱咐，还是硬吞了下去。那东西进了喉咙，硬得像一团棉絮，一点点往下走，停在胸口。乞丐大笑，起身就走，头也不回。他们跟着他进了一座庙，再追进去求他，却找不到了，前后搜遍也没有踪迹，只好又羞又恨地回家。',
      cast: [['chen', 'body'], ['beggar', 'body', 'leaves'], ['erlang', 'body'], ['crowd', 'body']],
      cite: [{ source: TEXT, ref: '第 6 段' }, { source: COMMENT, ref: '“妻亦将食人之唾而甘之矣”' }],
    },
    {
      key: 'tu-xin', title: '抱尸吐心', act: A4, sortOrder: 150, time: '当日', place: 'inner-room', core: true,
      description: '陈氏既痛丈夫死得惨，又悔吞唾受辱，哭得只想去死。她要擦去血迹收殓尸体，家人都站着看，没有人敢靠近。她抱着尸体把肠子收回去，一边整理一边哭。哭到声音嘶哑，忽然想吐，胸中那团东西猛地冲出来，来不及回头，已经落进尸体的腔子里。她吃惊地一看，竟是一颗人心，在腔里突突跳动，热气像烟一样升腾。',
      cast: [['chen', 'body'], ['wang', 'related'], ['wang-family', 'body']],
      links: [
        { to: 'qiang-dan', relation: '揭示', note: '那口痰原来是一颗心。' },
        { to: 'lie-xin', relation: '呼应', mutual: true, note: '鬼掏走的心，由妻子吐回。' },
        { to: 'hui-sheng', relation: '导致' },
      ],
      cite: [{ source: TEXT, ref: '第 7 段' }],
    },
    {
      key: 'hui-sheng', title: '王生复活', act: A4, sortOrder: 160, time: '当夜至第三日天明', place: 'inner-room', core: true,
      description: '陈氏急忙用两手合拢腔子，用力抱紧；稍一松手，就有热气从缝里冒出来，于是撕下绸布紧紧扎好。她抚摸尸体，渐渐有了温度，便盖上被子。半夜打开看，已经有了鼻息。天亮时，王生竟然活了过来。他说自己恍恍惚惚像做梦，只觉得肚子隐隐作痛。伤口结了一块铜钱大的痂，不久就好了。',
      cast: [['wang', 'body'], ['chen', 'body']],
      cite: [{ source: TEXT, ref: '第 7 段' }, { source: COMMENT, ref: '全段' }],
    },
  ],
  learnings: [
    {
      key: 'runaway-concubine', text: '那女子是从富家逃出来的小妾，要找地方藏身。', kind: 'idea', description: '女子自己编的身世，是假话。',
      knownBy: [
        { who: 'wang', since: 'yu-nv', until: 'kui-pi' },
        { who: 'chen', since: 'quan-qian', until: 'xuan-fu', note: '她只疑心是大户人家的媵妾，劝丈夫送走。' },
      ],
    },
    {
      key: 'cheating-priest', text: '道士是借驱邪骗饭吃的人。', kind: 'idea',
      knownBy: [{ who: 'wang', since: 'shi-yu', until: 'kui-pi' }],
    },
    {
      key: 'painted-skin', text: '那个美女是披着画皮的狞鬼。', kind: 'knowledge',
      knownBy: [
        { who: 'demon', note: '它自己的真相。' },
        { who: 'wang', since: 'kui-pi' },
        { who: 'daoshi', since: 'ye-qiu', note: '在集市上只看出邪气；王生跪地求救时才知道是什么。' },
        { who: 'chen', since: 'xuan-fu', note: '原文没写王生告诉她；她亲眼看见女子望着蝇拂不敢进门。' },
      ],
    },
    {
      key: 'whisk-guards', text: '门上挂着蝇拂，妖物就进不来。', kind: 'idea',
      knownBy: [
        { who: 'wang', since: 'ye-qiu', until: 'lie-xin' },
        { who: 'chen', since: 'xuan-fu', until: 'lie-xin' },
      ],
    },
    {
      key: 'hides-in-south-court', text: '妖物逃到南院，扮成老妇人在二郎家帮佣。', kind: 'knowledge',
      knownBy: [
        { who: 'daoshi', since: 'xun-zong' },
        { who: 'erlang', since: 'xun-zong' },
      ],
    },
    {
      key: 'madman-can-help', text: '集市上的疯乞丐或许能让死人复活。', kind: 'knowledge',
      knownBy: [
        { who: 'daoshi', note: '道士早就知道这个人。' },
        { who: 'chen', since: 'qiu-sheng' },
        { who: 'erlang', since: 'qiu-sheng', note: '二郎早就认识这个疯子，到这时才知道他能救人。' },
      ],
    },
    {
      key: 'spittle-was-heart', text: '乞丐逼她吞下的那口痰，就是丈夫的心。', kind: 'realization',
      knownBy: [{ who: 'chen', since: 'tu-xin' }],
    },
  ],
};
