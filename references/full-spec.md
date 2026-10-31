# 动态竞争分析 Skill

**`dynamic-competition-analysis` · v1.0.0**

> 把"谁在何时对谁做了什么、对手如何回应、结果为何"转成可复核的竞争互动诊断与策略选项。

---

## 0. 封装说明：模板字段映射

`four_images_skill.py` 是一份**可执行封装脚本**，不是 Markdown 技能规范。它没有"适用场景/示例"章节；对应信息分布在模块 docstring、`TRIGGER_RULES`、`run()` 签名、`res` 返回结构与 `__main__` 自测中。下表按语义等价提取字段，而非逐字对应。

| 模板字段 | 模板中的实现 | 本 Skill 对应 | 适配说明 |
|---|---|---|---|
| 元信息 | 模块 docstring；`IMAGES`、`DEFAULT` 常量 | §2.1 | 由"脚本用途/约定"改为"技能身份/边界/维护" |
| 触发条件 | `TRIGGER_RULES`、`check_trigger()` | §2.2 | 保留 `version` / `required` / `any` / `min_score` 与 `hit`→`miss`→`missing` 三态 |
| 输入 | `run(params, seed, outdir, verify, ...)` | §2.3 | 保留"白名单 + 未知键报错 + 默认值 + 深度档位" |
| 执行步骤 | `run()` 主循环、`_verify()` | §2.4 | 由"模拟—导出—断言"改为"界定—重建—评估—生成" |
| 输出 | `res` 嵌套字典、`summary` 单行摘要 | §2.6 | 保留嵌套结构 + 摘要 + `checks` |
| 自检 | `_verify()` 六类断言、`HINT` 排查表 | §2.5 | 改为八项内容自检，逐项给失败提示 |
| 示例 | `__main__` 三段调用 | §2.7 | 保留"默认调用 / 参数覆盖 / 触发判定"三类示例 |

**模板中三个可直接复用的设计决策**：

1. **触发与执行解耦**：`check_trigger` 只读标签、不碰状态；本 Skill 同样先判定、后执行。
2. **白名单输入**：未知参数键直接报错并列出可用键，避免静默错配。
3. **自检带排查方向**：断言失败不是抛一句"失败"，而是给出"查哪里"。

---

## 第一部分 理论底座

### 1.1 理论背景：从静态定位到行动互动

20 世纪 80 年代的战略管理由两种静态范式主导：产业组织视角回答"哪个行业赚钱"（Porter, 1980），资源基础观回答"凭什么持续赚钱"（Barney, 1991）。二者共同假设优势可以在一段时间内维持，且企业行为可由结构与资源存量推知。但 1978 年美国航空业放松管制后，票价战、航线进入与快速反击高频发生，企业绩效差异无法再由行业结构或资源存量单独解释——**同样的资源，不同企业打出的行动序列不同，结果也不同**。

动态竞争理论由此把分析单位从"企业/行业"下移到"**行动—回应**"配对，把因变量从"优势是否存在"改为"优势能维持多久"，把时间从横截面改为序列。其核心主张可压缩为一句话：**竞争优势不是资源的静态属性，而是行动与回应互动的临时结果**。

| 维度 | 静态定位范式 | 动态竞争范式 |
|---|---|---|
| 分析单位 | 企业、行业 | 行动—回应配对（dyad） |
| 优势来源 | 资源存量、市场位置 | 行动速度、组合与互动节奏 |
| 时间假设 | 均衡、可维持 | 序列、路径依赖、暂时 |
| 核心问题 | 在哪里竞争 | 如何行动、对手如何回应 |
| 代表工作 | Porter（1980）；Barney（1991） | Chen（1996）；D'Aveni（1994） |

理论内部有两条互补支线。**D'Aveni 的超竞争**（hypercompetition）强调环境速度与优势侵蚀，偏规范、偏战略设计；**Chen 的竞争互动**强调可观测的行动—回应与决策机制，偏实证、偏行为。二者在"优势暂时性"与"互动生成优势"上汇合，构成今日动态竞争的双核。

### 1.2 代表人物与贡献

| 学者 | 核心贡献 | 代表文献 |
|---|---|---|
| Richard A. D'Aveni（达特茅斯学院塔克商学院） | 提出超竞争；划分四竞技场；新 7S 框架；主张企业主动颠覆自身优势 | D'Aveni（1994, 1995） |
| 陈明哲 Ming-Jer Chen（弗吉尼亚大学达顿商学院） | 动态竞争的主要整合者；提出市场共同性、资源相似性、竞争不对称、竞争张力与 AMC 框架 | Chen（1996）；Chen & Miller（1994）；Chen, Su & Tsai（2007） |
| Ken G. Smith、Curtis M. Grimm（马里兰大学） | 建立行动—回应的实证范式；以美国航空业为样本；教材化 | Smith et al.（1991）；Grimm, Lee & Smith（2006） |
| Danny Miller（HEC 蒙特利尔） | 攻击—回应的期望—效价模型；领域综述；多维框架 | Chen & Miller（1994, 2012, 2015） |
| W. J. Ferrier | 竞争侵略性与竞争行为组合的驱动因素与绩效后果 | Ferrier（2001） |
| Greg Young、Daniel Simon 等 | 多点接触与资源差异对竞争行为的联合影响 | Young et al.（2000） |
| Jeremy J. Marcel、Pamela S. Barr、Irene M. Duhaime | 高管认知框架对回应倾向与速度的影响 | Marcel et al.（2011） |
| Anja Tuschke、Viktoria J. Salomon | 领域系统梳理与文献地图 | Tuschke & Salomon（2019） |

### 1.3 核心概念

术语以本表为准；全文统一使用中文名，首次出现附英文，不使用"动态竞争力""竞争动态性"等变体。

| 术语（中/英） | 定义 | 与分析单元的关系 |
|---|---|---|
| 动态竞争 competitive dynamics | 以企业间行动与回应为基本单位，研究竞争行为的序列、相互依赖及其绩效后果 | 研究纲领 |
| 竞争互动 competitive interaction | 可观测的行动—回应序列；分析单位是对手对（dyad）；与 interfirm rivalry 互释 | 经验对象 |
| 攻击 competitive attack | 企业为改善相对地位或削弱对手而采取的、可被识别的市场行动 | 序列起点 |
| 回应 competitive response | 对手针对特定攻击采取的反制行动，含概率、速度、类型与匹配度 | 序列节点 |
| 攻击—回应 attack–response | 连接"行动属性—回应决策—绩效"的最小因果单元 | 最小单元 |
| 市场共同性 market commonality | 两企业共同市场的数量与战略重要性加权程度 | 关系强度 |
| 资源相似性 resource similarity | 两企业资源禀赋与能力结构的相似程度 | 回应能力 |
| 竞争不对称 competitive asymmetry | 同一对手关系对双方威胁程度不相等 | 关系结构 |
| 竞争张力 competitive tension | 行动（攻击或回应）发生前由感知、动机、能力共同形成的压力状态，越阈才转为行动 | 行动前因 |
| 感知—动机—能力 awareness–motivation–capability（AMC） | 攻击/回应决策的三项必要条件 | 机制 |
| 多点竞争 multimarket competition | 企业在多个产品、地域或细分市场同时相遇的结构 | 关系场景 |
| 多点接触 multimarket contact | 具体的共同市场数量与重叠程度 | 可测变量 |
| 相互克制 mutual forbearance | 多点接触下为规避多市场报复而降低攻击强度 | 关系结果 |
| 竞争行为组合 competitive repertoire | 一定时期内行动的数量、类型、分布与序列 | 企业层行为 |
| 竞争惯性 competitive inertia | 行为组合的路径依赖与环境变化后的调整迟滞 | 行为约束 |
| 超竞争 hypercompetition | 优势快速侵蚀、竞争持续升级、规则频繁重构的环境状态 | 环境条件 |
| 暂时优势 temporary advantage | 易被模仿或替代、窗口期短的优势 | 结果变量 |
| 竞争侵略性 competitive aggressiveness | 企业采取行动的数量与相对强度倾向 | 行为倾向 |
| 行业速度 industry velocity | 行业内机会与优势出现和消失的速率 | 调节变量 |
| 关系竞争 relational competition | 以利益相关者关系与共生价值为核心的竞争模式 | 扩展模式 |

**概念辨析**（防止四类常见误用）：

| 易混概念 | 区别 | 判断口径 |
|---|---|---|
| 动态竞争 vs 动态能力 | 前者是**对手间**行为序列；后者是**企业内**能力演化 | 分析单位是 dyad 还是 firm |
| 动态竞争 vs 博弈论 | 前者归纳、可观测、重实证；后者演绎、均衡、重策略 | 是否要求可观测行动数据 |
| 动态竞争 vs 产业组织 | 前者企业异质、行动层；后者行业结构、进入壁垒 | 解释变量在行动还是在结构 |
| 竞争 vs 对抗 | 竞争含合作、克制与关系型互动 | 是否存在共同利益与重复博弈 |

### 1.4 核心假设

| 编号 | 假设 | 若被违反 |
|---|---|---|
| A1 | **异质性**：企业在资源、信息处理与认知上存在稳定差异 | 退化为同质企业模型，行动差异无法解释 |
| A2 | **行动本位**：优势来自行动及其节奏，而非仅资源存量 | 回到静态资源基础观 |
| A3 | **认知中介**：管理者注意力与解释中介"环境→行动" | AMC 中的感知项失去意义 |
| A4 | **相互依赖**：一方收益部分取决于对手回应 | 可当作独立决策问题处理 |
| A5 | **序列与路径依赖**：早期行动改变后续回应空间 | 可用静态博弈替代 |
| A6 | **多层次嵌入**：行动嵌入企业、市场组合与制度环境 | 跨市场、跨境结论不可迁移 |
| A7 | **优势暂时性**（条件性）：超竞争条件下任何优势都会被模仿或替代 | 持续优势假设成立，D'Aveni 命题失效 |

### 1.5 分析维度

| 维度 | 核心问题 | 观测指标 | 对应步骤 |
|---|---|---|---|
| 行动 | 做了什么、多快、多难回应 | 数量、复杂性、新颖性、可见性、回应难度、战术/战略属性 | S2 |
| 主体 | 谁有意图、谁有能力 | 资源相似性、竞争不对称、高管认知 | S3 |
| 关系 | 在哪里相遇、是否克制 | 市场共同性、多点接触、相互克制 | S1、S4 |
| 时间 | 节奏与窗口 | 回应时滞、行动节奏、优势窗口 | S5、S6 |
| 环境 | 行业速度与制度 | 行业速度、监管、技术范式 | S6 |

### 1.6 关键命题

以下十条均可转写为可观测假设；"边界"给的是命题失效或需修正的情形。

**P1 市场共同性—攻击/回应。** 两企业市场共同性越高，彼此发动攻击与作出回应的概率越高（Chen, 1996）。
- 可检验含义：共同市场数与重要性加权值正向预测行动频率。
- 边界：单市场企业不适用；共同性需按利润而非仅收入加权。

**P2 资源相似性—竞争对称。** 资源相似性越高，回应能力越对等、竞争越对称；相似性低时攻击更可能"错位"，回应更困难（Chen, 1996）。
- 可检验含义：资源相似度正向预测回应匹配度。
- 边界：资源可重构或跨界借用时，静态相似性测度失真。

**P3 AMC—张力—行动。** 只有当感知、动机、能力同时越过阈值，竞争张力才转化为行动；任一要素缺失，行动被延迟、转向或放弃（Chen, Su & Tsai, 2007）。
- 可检验含义：三要素交互项显著预测行动概率，单独主效应较弱。
- 边界：感知与动机难直接观测，依赖代理变量。

**P4 攻击属性—回应概率。** 攻击可见性越高，对手越可能注意并回应；回应难度越大，回应概率越低。二者方向相反，净效应取决于注意力与能力的相对强度（Chen & Miller, 1994）。
- 可检验含义：可见性正向、回应难度负向预测回应概率；交互项显示高难度可抵消高可见性。
- 边界：高承诺市场（如核心利润区）会压过难度效应；声誉与信号动机可能放大回应。

**P5 多点接触—相互克制。** 多点接触越高，相互克制越强；但市场重要性不对称或资源差异大时，克制减弱（Young et al., 2000）。
- 可检验含义：接触数×重要性对称性正向预测攻击强度下降。
- 边界：平台双边市场可能出现反向机制。

**P6 行为组合—绩效。** 竞争行为组合的规模与复杂性越高，绩效越好，但受行业速度与吸收能力调节（Ferrier, 2001）。
- 可检验含义：组合规模与复杂性正向预测市场份额与 ROA。
- 边界：过度行动带来协调成本与注意力耗散。

**P7 惯性—时滞—绩效。** 竞争惯性越强，回应时滞越长，相对绩效越差（Grimm, Lee & Smith, 2006）。
- 可检验含义：行动组合调整幅度负向预测回应时滞。
- 边界：稳定环境中惯性可能是效率来源。

**P8 回应速度—先动收益。** 对手回应速度越快，攻击者收益越低；先动优势取决于可模仿性与回应窗口（Smith et al., 1991）。
- 可检验含义：回应时滞正向预测攻击者异常收益。
- 边界：网络效应强的市场，先动收益可被锁定放大。

**P9 认知—回应倾向。** 高管认知框架越偏"对手中心"，回应倾向越强、速度越快（Marcel et al., 2011）。
- 可检验含义：认知地图/年报文本的对手提及密度正向预测回应速度。
- 边界：认知测量受文本策略性披露污染。

**P10 超竞争—暂时优势。** 超竞争条件下持续优势不可得，企业需以"连续暂时优势 + 规则重构"维持绩效（D'Aveni, 1994, 1995）。
- 可检验含义：优势持续时间分布随行业速度上升而左移；规则重构频率正向调节绩效。
- 边界：规范性强，需以行业速度与吸收能力为调节。

### 1.7 适用边界与局限

| 编号 | 边界/局限 | 越界信号 |
|---|---|---|
| B1 | 实证集中在美国航空、软件、银行与制造，平台、生态与新兴市场需重新校准 | 直接套用航空业结论解释平台补贴战 |
| B2 | 依赖公开公告与报道，私下行动与内部决策不可观测 | 把"未报道"当作"未发生" |
| B3 | 感知与动机多为代理变量，构念效度有限 | 用同一指标同时测 A 与 M |
| B4 | 多为事件史/面板，存在内生性、反向因果与幸存者偏差 | 把相关当因果 |
| B5 | 多点接触在数字化平台可能加剧而非抑制竞争，相互克制非普遍规律 | 见多点接触就判"克制" |
| B6 | 超竞争规范性强，"自我颠覆"缺乏普适经验支持 | 把"必须颠覆"当铁律 |
| B7 | 非市场策略、生态系统、标准竞争与制度差异未充分纳入 | 忽略产业政策对动机项的作用 |
| B8 | 中国等市场的动机项受产业政策、地方保护与政企关系影响，西方量表不可直接移植 | 直接套用美国样本的 AMC 量表 |

### 1.8 学派演进

| 阶段 | 时间 | 核心问题 | 代表工作 | 方法 | 局限 |
|---|---|---|---|---|---|
| 萌芽 | 1980s | 行动能否解释绩效 | Smith et al.（1991）；Chen 博士论文（1988） | 航空业事件研究、内容分析 | 单行业、描述性强 |
| 奠基 | 1990s | 谁是对手、如何回应 | Chen（1996）；D'Aveni（1994）；Chen & Miller（1994） | 概念整合、期望—效价模型 | 静态比较、测量粗 |
| 扩展 | 2000s | 为何回应、在哪些市场回应 | Chen, Su & Tsai（2007）；Ferrier（2001）；Young et al.（2000）；Marcel et al.（2011） | 面板、结构方程、认知测量 | 内生性、代理变量 |
| 重构 | 2010s— | 竞争是否只有对抗 | Chen & Miller（2012, 2015）；平台与算法竞争研究 | 多维框架、跨境比较、文本与实验 | 范式碎片化、因果识别弱 |

**四次转向**：

1. **结构→行为**（1980s—1990s）：解释变量从行业结构移到可观测行动。
2. **单市场→多点/多市场**（1990s—2000s）：从一对一的单一市场，扩展到多市场相互依赖与相互克制。
3. **行为→认知**（2000s—2010s）：从"做了什么"进到"注意到什么、如何解释"。
4. **对抗→关系/生态**（2010s—）：从零和攻击扩展到竞合、关系竞争、生态系统与算法互动。

### 1.9 企业竞争互动案例

选取标准：互动序列公开可查；存在可识别的攻击与回应；覆盖不同竞争结构（双寡头、多点、平台、进入战、补贴战）。案例中的"张力"评分均为**分析者推断**，不是企业实测值。

#### 案例 1｜波音 vs 空客（2000—2020）

全球大型民用飞机双寡头，窄体、宽体、货机多市场并存，双方均受政府补贴与出口信贷支持。

| 时间 | 主体 | 行动 | 属性 | 对手回应 |
|---|---|---|---|---|
| 2000-12 | 空客 | 启动 A380 超大型四发客机 | 战略、高可见、高回应难度 | 波音不正面跟进，转向点对点中型宽体 |
| 2004-04 | 波音 | 启动 787 | 战略、高可见 | 空客以 A350 回应 |
| 2004-10 | 美/欧 | 互向 WTO 起诉（DS316/DS353） | 制度性、高可见 | 长期诉讼与合规争端 |
| 2010-12 | 空客 | 启动 A320neo | 战术—战略混合、可模仿 | 波音 2011-08 启动 737 MAX |

**构念映射**：多点竞争（窄体/宽体/货机）；资源相似性高；竞争不对称（空客窄体强、波音宽体强）；"错位回应"典型（波音不以新超大型机回应 A380）。
**命题对应**：P1、P2、P4、P5。
**来源**：WTO DS316、DS353 争端页；Reuters（2011-12-19）。

#### 案例 2｜可口可乐 vs 百事可乐（1975—1985）

美国碳酸饮料双寡头，品牌、渠道、货架空间多线竞争。

| 时间 | 主体 | 行动 | 属性 | 对手回应 |
|---|---|---|---|---|
| 1975 | 百事 | "百事挑战"盲测营销 | 高可见、低模仿难度、战术 | 可口可乐加大品牌广告，未立即改配方 |
| 1985-04 | 可口可乐 | 推出 New Coke | 高可见、高回应难度、战略 | 百事以"对手认输"叙事反击 |
| 1985-07 | 可口可乐 | 恢复 Classic | 高可见、快速纠错 | 百事继续价格与渠道战 |

**构念映射**：攻击可见性与回应难度（P4）；竞争张力（P3）；品牌资产构成回应能力（C）。
**命题对应**：P3、P4、P8。
**来源**：HISTORY 网站可乐战争专题；《The Other Guy Blinked》（1986）。

#### 案例 3｜京东 vs 当当（2010—2011）

中国图书电商，当当为在位者，京东从 3C 品类切入图书。

| 时间 | 主体 | 行动 | 属性 | 对手回应 |
|---|---|---|---|---|
| 2010 年末 | 京东 | 上线图书品类，低价切入 | 战略、高可见 | 当当以价格战与渠道政策回应 |
| 2010-12 | 当当 | 纽交所上市 | 融资型行动 | 京东以全面价格战施压 |
| 2011-03 | 京东 | 微博公开宣战，承诺低价 | 高可见、信号型 | 当当跟进降价，利润承压 |

**构念映射**：进入性攻击；市场共同性由低转高；当当动机（M）高但能力（C，资金）受限；多点接触少，相互克制弱。
**命题对应**：P1、P3、P6。
**来源**：央视网（2011-03-18）。

#### 案例 4｜美团 vs 饿了么（2018—2020）

中国餐饮外卖双寡头，向到店、即时零售、酒旅多点延伸。

| 时间 | 主体 | 行动 | 属性 | 对手回应 |
|---|---|---|---|---|
| 2018-04 | 阿里（饿了么母公司） | 95 亿美元收购饿了么 | 资源注入、高可见 | 美团加速上市与补贴 |
| 2018 夏 | 饿了么 | 30 亿元补贴，目标 50% 份额 | 战术、高可见 | 美团对等补贴 |
| 2018-09 | 美团 | 港交所上市 | 融资型行动 | 饿了么加大本地生活投入 |
| 2020 | 饿了么 | 百亿补贴 | 战术、持续 | 美团以效率与多业务协同回应 |

**构念映射**：多点竞争（外卖/到店/即时零售）；资源相似性中等；能力项受阿里生态支撑；平台高利害下相互克制偏低（B5 的反向机制）。
**命题对应**：P1、P2、P5、P6。
**来源**：新浪财经（2020-09-28）；国研网。

#### 案例 5｜滴滴 vs 快的（2014—2015）

中国网约车双寡头，腾讯与阿里分别支持。

| 时间 | 主体 | 行动 | 属性 | 对手回应 |
|---|---|---|---|---|
| 2014-01 | 滴滴/快的 | 微信支付与支付宝补贴战 | 战术、高可见、高频 | 对等补贴，迅速升级 |
| 2014 | 双方 | 补贴额度轮番加码 | 战术、难以持续 | 资本消耗与监管关注 |
| 2015-02 | 双方 | 宣布合并 | 战略、高可见 | 合并，双寡头转为单一主导 |

**构念映射**：攻击—回应升级；三要素齐备下的高张力；相互克制/消耗逻辑；制度环境（2016 年网约车新规）。
**命题对应**：P3、P5、P8。
**来源**：中国新闻网（2015-02-15）；中国日报（2015-02-15）。

---

## 第二部分 Skill 规范

### 2.1 元信息

| 字段 | 值 |
|---|---|
| `skill_id` | `dynamic-competition-analysis` |
| 中文名 | 动态竞争分析 |
| 版本 | 1.0.0 |
| 类型 | 理论分析 / 诊断 / 策略选项生成 |
| 入口 | `run(inputs, options=None)` |
| 运行依赖 | 无；可选案例库 `case_bank.jsonl` |
| 输入语言 | `zh` / `en` |
| 输出 | 结构化 JSON + Markdown 报告 |
| 适用对象 | 管理学研究者、MBA 学员、企业战略从业者 |
| 理论内核 | Chen（1996, 2007）；Chen & Miller（1994, 2012, 2015）；D'Aveni（1994, 1995） |

**设计约定**：

- **可复核**：每个判断附 `source` 或标 `unknown`，不写无出处的事实。
- **可拒绝**：证据不足时输出 `insufficient_evidence`，不给结论。
- **可复现**：同一输入、同一版本、同一评分规则，输出一致。
- **不越界**：不预测股价，不判断诉讼胜负，不替代法律、财务与合规尽调。

### 2.2 适用场景与触发条件

**适用**：对手行为诊断、进入/反击决策、价格战与补贴战评估、多点竞争与相互克制判断、竞争案例教学、理论综述的结构化整理。

**不适用**：反垄断法律意见、证券估值、内部人事与薪酬设计、需要非公开重大信息的判断。

触发规则以纯数据声明，可整体覆盖（对应模板 `TRIGGER_RULES`）：

| 规则项 | 取值 |
|---|---|
| `version` | 1 |
| `subject_required` | `role` |
| `subject_any.role` | 战略管理者、创业者、投资人、咨询顾问、管理研究者、MBA 学员 |
| `env_required` | `task` |
| `env_any.task` | 竞争分析、对手分析、进入决策、价格/补贴战评估、案例研究、理论综述 |
| `env_any.context` | 在位者、新进入者、双寡头、平台、多点经营 |
| `min_score` | 2 |

计分：`subject` 命中 1 分；`env` 每个命中键 1 分。三态判定：

| 输入 | 结果 |
|---|---|
| `role=战略管理者`，`task=竞争分析`，`context=双寡头` | `hit`，score=3 |
| `role=实习生`，`task=财报解读` | `miss`，score=0 |
| 缺 `role` | `missing`，`missing=["role"]` |

```python
TRIGGER_RULES = {
    "version": 1,
    "subject_required": ("role",),
    "subject_any": {"role": ("战略管理者", "创业者", "投资人", "咨询顾问", "管理研究者", "MBA 学员")},
    "env_required": ("task",),
    "env_any": {
        "task": ("竞争分析", "对手分析", "进入决策", "价格/补贴战评估", "案例研究", "理论综述"),
        "context": ("在位者", "新进入者", "双寡头", "平台", "多点经营"),
    },
    "min_score": 2,
}


def check_trigger(subject_tags, env_features, rules=TRIGGER_RULES):
    missing = [k for k in rules["subject_required"] if k not in subject_tags]
    missing += [k for k in rules["env_required"] if k not in env_features]
    if missing:
        return {"hit": False, "status": "missing", "score": 0,
                "missing": missing, "matched": [], "version": rules["version"]}
    matched, score = [], 0
    for k, allowed in rules["subject_any"].items():
        if subject_tags.get(k) in allowed:
            matched.append(f"subject.{k}")
            score += 1
    for k, allowed in rules["env_any"].items():
        if env_features.get(k) in allowed:
            matched.append(f"env.{k}")
            score += 1
    ok = score >= rules["min_score"]
    return {"hit": ok, "status": "hit" if ok else "miss", "score": score,
            "missing": [], "matched": matched, "version": rules["version"]}
```

**判定与执行解耦**：`status != hit` 时默认不执行 S1—S8，只返回触发结果与待补字段。调用方可显式 `force=true` 强制执行，但输出 `meta.forced=true` 并在摘要注明"非典型场景，结论降级"。

### 2.3 输入要求

| 字段 | 类型 | 必填 | 默认 | 说明与校验 |
|---|---|---|---|---|
| `focal_firm` | str | 是 | — | 焦点企业，不得为空 |
| `rivals` | list[str] | 是 | — | 1—5 家；超过 5 家要求分组或聚焦 |
| `question` | str | 是 | — | 单一决策问题；多个问题拆成多次调用 |
| `horizon` | str | 是 | — | 观察窗，`YYYY-MM/YYYY-MM`，不短于 6 个月 |
| `scope` | str | 是 | — | 产品×地域×客户；禁止"全行业"式模糊 |
| `subject_tags` | dict | 否 | `{}` | 触发标签，如 `{"role":"战略管理者"}` |
| `env_features` | dict | 否 | `{}` | 触发标签，如 `{"task":"竞争分析","context":"双寡头"}` |
| `goal` | enum | 否 | `assess` | `attack` / `defend` / `enter` / `exit` / `cooperate` / `assess` |
| `action_log` | list | 否 | `[]` | 事件表；缺失则从公开来源重建 |
| `resource_profile` | dict | 否 | `{}` | 资源与能力清单 |
| `multimarket_map` | dict | 否 | `{}` | 市场×对手矩阵 |
| `constraints` | list | 否 | `[]` | 资源、监管、时间约束 |
| `depth` | enum | 否 | `standard` | `quick` / `standard` / `deep` |
| `evidence_level` | enum | 否 | `public` | `public` / `mixed` / `internal` |
| `lang` | enum | 否 | `zh` | `zh` / `en` |

**白名单规则**：未知字段直接报错并列出可用字段——`KeyError: 未知字段 ['rival']（可用字段: [...]）`，与模板 `run()` 对未知参数键的处理一致。`depth`、`evidence_level`、`lang` 放在 `inputs` 中；`options` 仅支持 `force`。

**深度档位**：

| 档位 | 耗时 | 执行范围 |
|---|---|---|
| `quick` | 0.5—1 小时 | S1—S3 简化，S4—S7 只给方向 |
| `standard` | 2—4 小时 | 全流程，证据逐条标注 |
| `deep` | 1—2 天 | 增加反事实、多轮互动推演与敏感性分析 |

**证据规则**：

- `public`：每个事件需 `source`（URL/年报/公告）；无来源标 `unverified`。
- `mixed`：访谈与内部数据需脱敏，标 `internal`。
- `internal`：仅用脱敏聚合信息，不得写入可识别个人的内容。
- 禁止使用未公开重大信息；不提供法律或投资建议。

### 2.4 分步执行流程

**S0 触发与输入校验**

- 操作：调用 `check_trigger`；白名单校验；必填缺失标 `missing`。
- 判据：`status=hit` 且无未知字段；否则终止并返回补字段清单。
- 输出：`meta`、`trigger`、`inputs`。
- 排查：未知字段→对照 §2.3；`rivals>5`→分组或聚焦前 5 家。

**S1 界定竞争边界**

- 操作：用"产品×地域×客户"三轴定义焦点市场；列对手并分直接/间接/潜在三类；构建市场共同性矩阵（0=无重叠、1=边缘、2=部分、3=高度重叠，按利润加权）；评资源相似性（0—3）。
- 判据：每个对手至少一个 ≥2 的共同市场，否则归为"潜在进入者"；市场定义不可过宽或过窄。
- 输出：`boundary.market_commonality`、`boundary.resource_similarity`、`boundary.asymmetry`。
- 排查：共同市场为空→检查替代品/互补品是否误分类；对手过多→按威胁度排序取前 5。

**S2 重建攻击—回应链**

- 操作：按时间排序事件；每事件编码六属性（1—5）；回应标注为 `none` / `late` / `matching` / `displaced`；计算攻击量、回应率、回应时滞中位数。
- 判据：事件≥3 才推断模式；每个事件有主体、日期、来源，缺来源标 `unverified`。
- 输出：`interaction.events[]`、`interaction.response_rate`、`interaction.response_lag`。
- 排查：事件<3→降级为"单次行动评估"，不出模式结论；日期冲突→并列来源标 `disputed`。

**S3 AMC 与竞争张力**

- 操作：对每个对手分别评感知、动机、能力（0—3），每项至少一条证据（攻击与回应共用框架，证据分别采集）；张力 `score=(A×M×C)^(1/3)`，阈值 2.0；识别瓶颈要素。
- 判据：三要素各有独立证据；不得用同一代理变量测两项。
- 输出：`tension.{awareness, motivation, capability, score, bottleneck}`。
- 排查：三要素高度共线→更换测量；感知缺失→用注意力配置或高管访谈代理，标 `proxy`。

**S4 多点竞争与相互克制**

- 操作：统计接触市场数；评估各市场对双方的重要性（收入占比/战略优先级）；按规则判克制概率：接触≥3 且重要性对称且资源相似性≥2→高；接触≤1 或重要性高度不对称→低；其余→中。
- 判据：接触矩阵对称性校验通过；重要性不对称时不得直接套用克制结论。
- 输出：`multimarket.{contacts, asymmetry, forbearance_likelihood, exceptions}`。
- 排查：平台/双边市场→启用"反向机制"标记并下调一档；接触数=1→多点逻辑不适用。

**S5 竞争行为组合与节奏**

- 操作：统计行动数量、类型分布、异质性与节奏（单位时间行动数）；评估竞争惯性（近三年行动类型分布变化<20% 判高）。
- 判据：观察窗≥12 个月；否则标 `window_too_short`。
- 输出：`repertoire.{breadth, aggressiveness, inertia, tempo}`。
- 排查：类型缺失→用公开报道补；季节性干扰→去季节化。

**S6 优势持续性判定**

- 操作：把焦点优势映射到 D'Aveni 四竞技场（成本/质量、时机/专有知识、强点/壁垒、深口袋）；评估模仿壁垒、替代威胁、规则重构可能；判定"持续/暂时/侵蚀中"；给出侵蚀路径与窗口。
- 判据：必须给出侵蚀路径，不得只给标签。
- 输出：`advantage.{arena, sustainability, erosion_path, window}`。
- 排查：四竞技场不匹配→标"混合型"并分别判定。

**S7 生成策略选项**

- 操作：至少生成 3 个选项（攻击/防御/回避/关系型）；每项给预期回应、回应时滞、风险、适配条件、反事实与对应命题编号。
- 判据：每个选项至少对应一条命题；拒绝无条件建议。
- 输出：`options[]`。
- 排查：选项同质→加入"不行动/延迟"与"改变竞争维度"。

**S8 自检与汇总**

- 操作：跑 CHK-01—CHK-08；生成 `summary`；渲染 Markdown 报告。
- 判据：全部通过，或列出失败项与补救；`summary`≤120 字。
- 输出：`checks`、`summary`、`report_md`。
- 排查：失败项按 §2.5 提示修补，不得隐藏。

### 2.5 自检清单

| 编号 | 检查项 | 通过判据 | 失败提示 |
|---|---|---|---|
| CHK-01 | 边界闭合 | 焦点市场与对手集覆盖所有主要接触点 | 补市场，或明确标"潜在进入者" |
| CHK-02 | 事件可追溯 | 每个事件有日期、主体、来源或 `unverified` | 补来源；不可补则降级 |
| CHK-03 | 攻击属性齐备 | 六属性均有 1—5 评分 | 补编码，缺项标 `na` |
| CHK-04 | 回应判定有据 | 回应标为观测或推断 | 标 `inferred`，不得伪装为观测 |
| CHK-05 | AMC 独立 | 三要素各有独立证据 | 更换代理变量，避免共线 |
| CHK-06 | 多点对称 | 接触矩阵对称性已校验 | 重核对市场重要性权重 |
| CHK-07 | 侵蚀路径 | 优势判断含路径与窗口 | 补"如何被侵蚀"与"多久" |
| CHK-08 | 选项有据 | 每个选项对应命题与边界 | 补命题编号，删无据选项 |

**文档级自检**：术语统一（§1.3 表）、中英首次对照、无未定义缩写、案例日期与来源一致。

### 2.6 输出模板

```json
{
  "meta": {"skill": "dynamic-competition-analysis", "version": "1.0.0",
           "status": "ok",
           "depth": "standard", "evidence_level": "public", "lang": "zh", "forced": false},
  "trigger": {"hit": true, "status": "hit", "score": 3,
              "missing": [], "matched": ["subject.role", "env.task"], "version": 1},
  "inputs": {"focal_firm": "", "rivals": [], "question": "", "horizon": "", "scope": ""},
  "warnings": [],
  "boundary": {
    "focal_market": "",
    "rival_set": [],
    "market_commonality": {},
    "resource_similarity": {},
    "asymmetry": ""
  },
  "interaction": {
    "events": [
      {"t": "", "actor": "", "action": "",
       "attrs": {"volume": 0, "complexity": 0, "novelty": 0,
                 "visibility": 0, "difficulty": 0, "type": ""},
       "response": {"actor": "", "type": "", "lag": "", "match": ""},
       "source": ""}
    ],
    "response_rate": 0.0,
    "response_lag": "",
    "attack_volume": 0,
    "status": "ok"
  },
  "tension": {"awareness": 0, "motivation": 0, "capability": 0,
              "score": 0.0, "bottleneck": "", "evidence": [], "by_rival": {}},
  "multimarket": {"contacts": 0, "importance_symmetric": null,
                  "forbearance_likelihood": "low", "exceptions": []},
  "repertoire": {"breadth": 0, "aggressiveness": "", "inertia": "", "tempo": ""},
  "advantage": {"arena": "", "sustainability": "", "erosion_path": "", "window": ""},
  "options": [
    {"name": "", "move": "", "expected_response": "", "risk": "",
     "fit": "", "boundary": "", "basis": "P4"}
  ],
  "checks": {"CHK-01": true},
  "summary": "",
  "report_md": ""
}
```

**字段说明**：

| 字段 | 含义 | 取值/单位 |
|---|---|---|
| `meta.status` | 执行状态 | `ok`/`degraded`/`pending_assessment`/`not_triggered` |
| `warnings` | 输入告警 | list[str] |
| `market_commonality` | 对手→共同市场加权分 | 0—3 |
| `resource_similarity` | 对手→资源相似度 | 0—3 |
| `attrs.*` | 攻击六属性 | 1—5 |
| `response.type` | 回应类型 | `none`/`late`/`matching`/`displaced` |
| `interaction.status` | 事件链状态 | `ok`/`single_event`/`no_event` |
| `tension.score` | AMC 几何均值 | 0—3，阈值 2.0 |
| `tension.by_rival` | 对手→AMC 明细与张力 | dict |
| `multimarket.importance_symmetric` | 市场重要性是否对称 | bool / null |
| `forbearance_likelihood` | 相互克制概率 | `low`/`medium`/`high` |
| `sustainability` | 优势状态 | `sustained`/`temporary`/`eroding` |
| `basis` | 选项依据的命题 | P1—P10，可多选如 `P6、P10` |

**报告模板**：

```markdown
# 动态竞争诊断：{focal_firm} vs {rivals}

## 结论摘要
{summary}

## 1 竞争边界与对手集
- 焦点市场：
- 对手分类：直接 / 间接 / 潜在
- 市场共同性与资源相似性：

## 2 攻击—回应链
| 时间 | 主体 | 行动 | 可见性 | 回应难度 | 回应 | 时滞 |
|---|---|---|---|---|---|---|

## 3 AMC 与竞争张力
- 感知：/3　动机：/3　能力：/3
- 张力：/3　瓶颈：
- 证据：

## 4 多点竞争与相互克制
- 接触市场：　重要性对称性：　克制概率：
- 例外与反向机制：

## 5 行为组合与节奏
- 规模/复杂性/惯性/节奏：

## 6 优势持续性
- 竞技场：　判定：　侵蚀路径：　窗口：

## 7 策略选项
| 选项 | 动作 | 预期回应 | 风险 | 适配条件 | 依据 |
|---|---|---|---|---|---|

## 8 证据与未决项
- `unverified`：
- `insufficient_evidence`：
- 待补数据：
```

### 2.7 调用示例

#### 示例 A（标准档：美团 vs 饿了么）

输入：

```json
{
  "focal_firm": "美团",
  "rivals": ["饿了么"],
  "question": "2018—2020 年外卖补贴战中，美团应继续对等补贴，还是转向效率与多业务协同？",
  "horizon": "2018-01/2020-12",
  "scope": "中国境内餐饮外卖；关联市场为到店酒旅与即时零售",
  "goal": "defend",
  "evidence_level": "public",
  "depth": "standard",
  "subject_tags": {"role": "战略管理者"},
  "env_features": {"task": "价格/补贴战评估", "context": "平台"}
}
```

输出（节选）：

```json
{
  "trigger": {"hit": true, "status": "hit", "score": 3},
  "boundary": {
    "market_commonality": {"饿了么": 3},
    "resource_similarity": {"饿了么": 2},
    "asymmetry": "美团在配送密度与商户覆盖上占优；饿了么在支付入口与阿里生态资源上占优"
  },
  "interaction": {
    "events": [
      {"t": "2018-04", "actor": "阿里（饿了么母公司）", "action": "95 亿美元收购饿了么",
       "attrs": {"volume": 3, "complexity": 3, "novelty": 2, "visibility": 5, "difficulty": 5, "type": "strategic"},
       "response": {"actor": "美团", "type": "matching", "lag": "1—2 月", "match": "加速上市与补贴"},
       "source": "公开报道"},
      {"t": "2018 夏", "actor": "饿了么", "action": "30 亿元补贴，目标 50% 份额",
       "attrs": {"volume": 4, "complexity": 2, "novelty": 1, "visibility": 5, "difficulty": 2, "type": "tactical"},
       "response": {"actor": "美团", "type": "matching", "lag": "数周", "match": "对等补贴"},
       "source": "公开报道"},
      {"t": "2020", "actor": "饿了么", "action": "百亿补贴",
       "attrs": {"volume": 4, "complexity": 2, "novelty": 2, "visibility": 5, "difficulty": 3, "type": "tactical"},
       "response": {"actor": "美团", "type": "displaced", "lag": "持续", "match": "效率与多业务协同"},
       "source": "公开报道"}
    ],
    "response_rate": 1.0,
    "response_lag": "1—2 月（战略级）/ 数周（战术级）",
    "attack_volume": 3
  },
  "tension": {"awareness": 3, "motivation": 3, "capability": 3,
              "score": 3.0, "bottleneck": "none", "evidence": ["高频对等回应", "双方持续投入", "阿里生态支撑"]},
  "multimarket": {"contacts": 3, "asymmetry": "外卖高度对称，到店与即时零售不对称",
                  "forbearance_likelihood": "low",
                  "exceptions": ["平台双边市场，高利害压低克制"]},
  "repertoire": {"breadth": 4, "aggressiveness": "high", "inertia": "medium", "tempo": "季度级"},
  "advantage": {"arena": "成本/质量（配送密度与单位经济）", "sustainability": "temporary",
                "erosion_path": "补贴→骑手成本→监管合规→利润承压", "window": "12—24 个月"},
  "options": [
    {"name": "对等补贴", "move": "维持补贴强度", "expected_response": "对手跟进，陷入消耗",
     "risk": "单位经济恶化", "fit": "份额优先", "boundary": "资本充足且监管容忍", "basis": "P6"},
    {"name": "效率+协同", "move": "转向配送效率与到店/即时零售协同",
     "expected_response": "对手在单一外卖市场加码", "risk": "份额短期流失",
     "fit": "利润优先", "boundary": "多业务协同真实存在", "basis": "P6、P10"},
    {"name": "选择性克制", "move": "聚焦高密度城市，低密度市场不跟进",
     "expected_response": "对手在低密度市场扩张", "risk": "区域份额被蚕食",
     "fit": "区域优势明显", "boundary": "市场可分割且用户黏性高", "basis": "P5"}
  ],
  "checks": {"CHK-01": true, "CHK-02": true, "CHK-03": true, "CHK-04": true,
             "CHK-05": true, "CHK-06": true, "CHK-07": true, "CHK-08": true},
  "summary": "[OK] 对手=1 张力=3.0(无瓶颈) 多点接触=3 克制=低 优势=暂时(12—24m) 选项=3 checks=8/8"
}
```

**读法**：这是一场"高张力、低克制、战术对等"的平台补贴战。三个选项分别对应"消耗、效率、分割"三种逻辑；`basis` 标明每个选项依赖的命题，便于审阅者反驳。`tension=3.0` 是分析者按公开证据打分，不是企业实测。

#### 示例 B（快速档：证据不足路径）

输入（某区域连锁药店 A 对全国折扣药房 B，示例为假设情境）：

```json
{
  "focal_firm": "A 区域连锁药店",
  "rivals": ["B 全国折扣药房"],
  "question": "B 进入本地市场后，A 是否应跟进降价？",
  "horizon": "2025-01/2025-12",
  "scope": "华东某三线城市社区药房",
  "goal": "defend",
  "depth": "quick",
  "evidence_level": "public",
  "subject_tags": {"role": "战略管理者"},
  "env_features": {"task": "对手分析", "context": "新进入者"}
}
```

输出（节选）：

```json
{
  "trigger": {"hit": true, "status": "hit", "score": 3},
  "interaction": {"events": [
      {"t": "2025-03", "actor": "B", "action": "本地开店并低价促销",
       "attrs": {"volume": 2, "complexity": 2,
                 "visibility": 4, "type": "tactical"},
       "response": {"actor": "A", "type": "none", "lag": "", "match": ""},
       "source": "公开报道"}
    ], "response_rate": null, "response_lag": null,
    "attack_volume": 1, "status": "single_event"},
  "tension": {"awareness": 2, "motivation": 3, "capability": null,
              "score": null, "bottleneck": "capability", "evidence": ["降价意愿明确", "资金与供应链证据缺失"]},
  "checks": {"CHK-01": true, "CHK-02": true, "CHK-03": false, "CHK-04": true,
             "CHK-05": false, "CHK-06": true, "CHK-07": false, "CHK-08": true},
  "summary": "[DEGRADED] 事件=1(<3)，无法推断模式；张力不完整(能力缺失)；建议补 3 类证据后再决策"
}
```

**读法**：Skill 没有为了"给答案"而补零。`capability=null` 与 `score=null` 是刻意设计：能力项缺证据时，张力不可计算；`CHK-03/05/07` 失败，输出降级为"待补证据"，并列出补证方向（门店现金流、供应链账期、B 的本地定价记录）。

### 2.8 概念—步骤—示例对应矩阵

| 概念 | 定义 | 执行步骤 | 示例体现 |
|---|---|---|---|
| 市场共同性 | §1.3 | S1 | 例 A：外卖 3、到店与即时零售为关联市场 |
| 资源相似性 | §1.3 | S1 | 例 A：饿了么 2（生态强、配送弱） |
| 竞争不对称 | §1.3 | S1、S3 | 例 A：美团密度占优、饿了么支付入口占优 |
| 攻击—回应 | §1.3 | S2 | 例 A：收购→补贴→上市→再补贴 |
| 攻击属性 | §1.3 | S2 | 例 A：收购可见性 5、回应难度 5 |
| AMC 与竞争张力 | §1.3 | S3 | 例 A：3/3/3=3.0；例 B：能力缺失→null |
| 多点竞争 | §1.3 | S4 | 例 A：3 个接触市场，克制低 |
| 相互克制 | §1.3 | S4 | 例 A：平台高利害的反向机制 |
| 竞争行为组合 | §1.3 | S5 | 例 A：高频补贴 + 多业务协同 |
| 竞争惯性 | §1.3 | S5 | 例 A：medium；例 B：证据不足未测 |
| 暂时优势 | §1.3 | S6 | 例 A：配送优势窗口 12—24 个月 |
| 超竞争 | §1.3 | S6 | 例 A：补贴战下的优势侵蚀路径 |

### 2.9 参考来源与维护

**理论文献**（GB/T 7714）：

[1] CHEN M-J. Competitor analysis and interfirm rivalry: Toward a theoretical integration[J]. Academy of Management Review, 1996, 21(1): 100-134. DOI: 10.2307/258631.

[2] CHEN M-J, MILLER D. Competitive attack, retaliation and performance: An expectancy-valence framework[J]. Strategic Management Journal, 1994, 15(2): 85-102. DOI: 10.1002/smj.4250150202.

[3] CHEN M-J, SU K-H, TSAI W. Competitive tension: The awareness-motivation-capability perspective[J]. Academy of Management Journal, 2007, 50(1): 101-118. DOI: 10.5465/amj.2007.24162081.

[4] CHEN M-J, MILLER D. Competitive dynamics: Themes, trends, and a prospective research platform[J]. Academy of Management Annals, 2012, 6(1): 135-210. DOI: 10.5465/19416520.2012.660762.

[5] CHEN M-J, MILLER D. Reconceptualizing competitive dynamics: A multidimensional framework[J]. Strategic Management Journal, 2015, 36(5): 758-775. DOI: 10.1002/smj.2245.

[6] D'AVENI R A. Hypercompetition: Managing the dynamics of strategic maneuvering[M]. New York: Free Press, 1994.

[7] D'AVENI R A. Coping with hypercompetition: Utilizing the new 7S's framework[J]. Academy of Management Perspectives, 1995, 9(3): 45-57. DOI: 10.5465/ame.1995.9509210281.

[8] SMITH K G, GRIMM C M, GANNON M J, et al. Organizational information processing, competitive responses, and performance in the U.S. domestic airline industry[J]. Academy of Management Journal, 1991, 34(1): 60-85. DOI: 10.2307/256302.

[9] GRIMM C M, LEE H, SMITH K G. Strategy as action: Competitive dynamics and competitive advantage[M]. New York: Oxford University Press, 2006.

[10] FERRIER W J. Navigating the competitive landscape: The drivers and consequences of competitive aggressiveness[J]. Academy of Management Journal, 2001, 44(4): 858-877. DOI: 10.2307/3069419.

[11] YOUNG G, SMITH K G, GRIMM C M, et al. Multimarket contact and resource dissimilarity: A competitive dynamics perspective[J]. Journal of Management, 2000, 26(6): 1217-1236. DOI: 10.1177/014920630002600608.

[12] MARCEL J J, BARR P S, DUHAIME I M. The influence of executive cognition on competitive dynamics[J]. Strategic Management Journal, 2011, 32(2): 115-138. DOI: 10.1002/smj.870.

[13] TUSCHKE A, SALOMON V J. Competitive dynamics[M]//Oxford Bibliographies in Management. New York: Oxford University Press, 2019. DOI: 10.1093/obo/9780199846740-0171.

[14] PORTER M E. Competitive strategy: Techniques for analyzing industries and competitors[M]. New York: Free Press, 1980. ISBN 0-02-925360-8.

[15] BARNEY J. Firm resources and sustained competitive advantage[J]. Journal of Management, 1991, 17(1): 99-120. DOI: 10.1177/014920639101700108.

> 注：[14] 为专著（Free Press 1980 年版，ISBN 0-02-925360-8），无 DOI；Crossref 仅收录 1982 年书评（Industrial Marketing Management），自动核验会误配到该条书评，非著录错误。

**案例来源**：

- WTO, DS316（United States — Measures Affecting Trade in Large Civil Aircraft）：https://www.wto.org/english/tratop_e/dispu_e/cases_e/ds316_e.htm
- WTO, DS353（European Communities — Measures Affecting Trade in Large Civil Aircraft）：https://www.wto.org/english/tratop_e/dispu_e/cases_e/ds353_e.htm
- Reuters, "Race is on for sales of Boeing's MAX vs Airbus neo", 2011-12-19：https://www.reuters.com/article/2011/12/19/uk-manufacturing-summit-idUSLNE7BI00I20111219/
- HISTORY, "How the 'Blood Feud' Between Coke and Pepsi Escalated During the 1980s Cola Wars"：https://www.history.com/articles/cola-wars-pepsi-new-coke-failure
- 央视网，《京东当当图书价格战升级 刘强东微博上放狠话》，2011-03-18：https://big5.cctv.com/gate/big5/jingji.cntv.cn/20110318/102973.shtml
- 新浪财经，《饿了么市场份额下滑 百亿补贴"换马甲"可否收复失地》，2020-09-28：https://finance.sina.cn/2020-09-28/detail-iivhvpwy9322439.d.html
- 中国新闻网，《滴滴快的"在一起"只花了22天》，2015-02-15：https://www.chinanews.com/cj/2015/02-15/7066154.shtml

**维护**：

| 版本 | 日期 | 变更 |
|---|---|---|
| 1.0.0 | 2026-10-21 | 首版：理论底座、9 步流程（S0—S8）、5 个案例、2 个调用示例 |

变更规则：新增命题或修改评分规则须升次版本号；新增案例或术语须升修订号；每次变更同步更新 §2.8 对应矩阵。
