# -*- coding: utf-8 -*-
"""dynamic_competition_skill.py —— 《动态竞争分析 Skill》的可执行协议层。

单入口：
    from dynamic_competition_skill import run
    res = run(inputs)                       # 只校验输入，返回待分析协议
    res = run(inputs, assessments=A)        # 传入编码结果，计算张力/克制/自检
    res = run(inputs, assessments=A, options={"force": True})

设计约定：
  * 零第三方依赖；不联网、不抓数据、不替分析者编造评分。
  * 缺失评分保持 None，自检显式失败；不用 0 冒充"没有"。
  * 派生值全部由固定公式计算，同一输入同一输出。
  * 触发判定与执行解耦，对应模板 four_images_skill.py 的
    TRIGGER_RULES / check_trigger / run / _verify / _summary 结构。

返回 dict 的主要键：
  meta、trigger、inputs、warnings、boundary、interaction、tension、
  multimarket、repertoire、advantage、options、checks、summary
"""

import json
import math
import re
import sys

# ---------------------------------------------------------------- 元信息
SKILL_ID = "dynamic-competition-analysis"
VERSION = "1.0.0"

# ---------------------------------------------------------------- 触发判定
TRIGGER_RULES = {
    "version": 1,
    "subject_required": ("role",),
    "subject_any": {
        "role": ("战略管理者", "创业者", "投资人", "咨询顾问", "管理研究者", "MBA 学员"),
    },
    "env_required": ("task",),
    "env_any": {
        "task": ("竞争分析", "对手分析", "进入决策", "价格/补贴战评估", "案例研究", "理论综述"),
        "context": ("在位者", "新进入者", "双寡头", "平台", "多点经营"),
    },
    "min_score": 2,
}


def check_trigger(subject_tags, env_features, rules=None):
    """判定本 Skill 是否应被激活；只读标签，不碰分析状态。

    三态：
      missing —— 必填键缺失（标签不全，不激活）
      hit     —— 必填齐备且得分 >= min_score
      miss    —— 必填齐备但得分不足
    """
    r = dict(TRIGGER_RULES if rules is None else rules)
    st = dict(subject_tags or {})
    ef = dict(env_features or {})
    missing = [k for k in r["subject_required"] if k not in st]
    missing += [k for k in r["env_required"] if k not in ef]
    if missing:
        return {"hit": False, "status": "missing", "score": 0,
                "missing": missing, "matched": [], "version": r.get("version")}
    matched, score = [], 0
    for k, allowed in r["subject_any"].items():
        if st.get(k) in allowed:
            matched.append("subject.%s" % k)
            score += 1
    for k, allowed in r["env_any"].items():
        if ef.get(k) in allowed:
            matched.append("env.%s" % k)
            score += 1
    ok = score >= r["min_score"]
    return {"hit": ok, "status": "hit" if ok else "miss", "score": score,
            "missing": [], "matched": matched, "version": r.get("version")}


# ---------------------------------------------------------------- 输入契约
REQUIRED = ("focal_firm", "rivals", "question", "horizon", "scope")
OPTIONAL = (
    "goal", "action_log", "resource_profile", "multimarket_map", "constraints",
    "depth", "evidence_level", "lang", "subject_tags", "env_features",
)
GOALS = ("attack", "defend", "enter", "exit", "cooperate", "assess")
DEPTHS = ("quick", "standard", "deep")
EVIDENCE_LEVELS = ("public", "mixed", "internal")
LANGS = ("zh", "en")
RESPONSE_TYPES = ("none", "late", "matching", "displaced")
ATTRS = ("volume", "complexity", "novelty", "visibility", "difficulty", "type")
PROPOSITIONS = tuple("P%d" % i for i in range(1, 11))
CHECKS = tuple("CHK-%02d" % i for i in range(1, 9))

HORIZON_RE = re.compile(r"^(\d{4})-(\d{2})/(\d{4})-(\d{2})$")

PROTOCOL = [
    "S0 触发与输入校验",
    "S1 界定竞争边界",
    "S2 重建攻击—回应链",
    "S3 AMC 与竞争张力",
    "S4 多点竞争与相互克制",
    "S5 竞争行为组合与节奏",
    "S6 优势持续性判定",
    "S7 生成策略选项",
    "S8 自检与汇总",
]

DEFAULT_OPTIONS = {"force": False}

ZH = {
    "none": "无瓶颈", "insufficient_evidence": "证据不足",
    "awareness": "感知", "motivation": "动机", "capability": "能力",
    "low": "低", "medium": "中", "high": "高", "n/a": "不适用",
    "temporary": "暂时", "sustained": "持续", "eroding": "侵蚀中", "unknown": "未知",
}


def _zh(value):
    return ZH.get(value, value)


# ---------------------------------------------------------------- 校验
def _horizon_months(horizon):
    m = HORIZON_RE.match(horizon)
    if not m:
        raise ValueError("horizon 需为 YYYY-MM/YYYY-MM，例如 2018-01/2020-12")
    y1, m1, y2, m2 = (int(x) for x in m.groups())
    if not (1 <= m1 <= 12 and 1 <= m2 <= 12):
        raise ValueError("horizon 月份需在 01—12")
    start, end = y1 * 12 + m1, y2 * 12 + m2
    if end < start:
        raise ValueError("horizon 结束早于开始")
    return end - start + 1


def validate_inputs(inputs):
    """白名单校验并归一化；未知字段直接报错并列出可用字段。"""
    if not isinstance(inputs, dict):
        raise TypeError("inputs 必须是 dict")
    allowed = set(REQUIRED) | set(OPTIONAL)
    unknown = sorted(set(inputs) - allowed)
    if unknown:
        raise KeyError("未知字段: %s（可用字段: %s）" % (unknown, sorted(allowed)))
    missing = [k for k in REQUIRED if k not in inputs or inputs[k] in (None, "", [])]
    if missing:
        raise ValueError("缺少必填字段: %s" % missing)

    rivals = inputs["rivals"]
    if not isinstance(rivals, (list, tuple)):
        raise TypeError("rivals 必须是 list")
    seen, clean = set(), []
    for r in rivals:
        r = str(r).strip()
        if r and r not in seen:
            seen.add(r)
            clean.append(r)
    if not 1 <= len(clean) <= 5:
        raise ValueError("rivals 需为 1—5 家，当前 %d 家；请调整对手集" % len(clean))
    rivals = clean

    out = {
        "focal_firm": str(inputs["focal_firm"]).strip(),
        "rivals": rivals,
        "question": str(inputs["question"]).strip(),
        "horizon": str(inputs["horizon"]).strip(),
        "scope": str(inputs["scope"]).strip(),
        "goal": inputs.get("goal", "assess"),
        "action_log": list(inputs.get("action_log") or []),
        "resource_profile": dict(inputs.get("resource_profile") or {}),
        "multimarket_map": dict(inputs.get("multimarket_map") or {}),
        "constraints": list(inputs.get("constraints") or []),
        "depth": inputs.get("depth", "standard"),
        "evidence_level": inputs.get("evidence_level", "public"),
        "lang": inputs.get("lang", "zh"),
        "subject_tags": dict(inputs.get("subject_tags") or {}),
        "env_features": dict(inputs.get("env_features") or {}),
    }

    if out["goal"] not in GOALS:
        raise ValueError("goal 需为 %s" % (GOALS,))
    if out["depth"] not in DEPTHS:
        raise ValueError("depth 需为 %s" % (DEPTHS,))
    if out["evidence_level"] not in EVIDENCE_LEVELS:
        raise ValueError("evidence_level 需为 %s" % (EVIDENCE_LEVELS,))
    if out["lang"] not in LANGS:
        raise ValueError("lang 需为 %s" % (LANGS,))

    warnings = []
    months = _horizon_months(out["horizon"])
    if months < 6:
        warnings.append("观察窗仅 %d 个月（<6），结论稳定性有限" % months)
    return out, warnings


# ---------------------------------------------------------------- 派生计算
def compute_tension(awareness, motivation, capability):
    """竞争张力 = AMC 的几何均值；任一项缺失返回 None，不用 0 代替。"""
    vals = (awareness, motivation, capability)
    if any(v is None for v in vals):
        return None
    for v in vals:
        if not 0 <= v <= 3:
            raise ValueError("AMC 每项需在 0—3")
    if 0 in vals:
        return 0.0
    return round((awareness * motivation * capability) ** (1.0 / 3.0), 2)


def _bottleneck(values):
    missing = [k for k, v in values.items() if v is None]
    if missing:
        return missing[0] if len(missing) == 1 else "insufficient_evidence"
    if min(values.values()) == max(values.values()):
        return "none"
    return min(values, key=values.get)


def forbearance_level(contacts, importance_symmetric, resource_similarity, platform=False):
    """相互克制的启发式判定；不是因果估计，平台场景按反向机制下调。"""
    if contacts is None or contacts <= 1:
        return "n/a"
    rs = resource_similarity if resource_similarity is not None else 0
    if importance_symmetric and contacts >= 3 and rs >= 2:
        level = "high"
    elif (not importance_symmetric) or contacts <= 1:
        level = "low"
    else:
        level = "medium"
    if platform:
        level = {"high": "medium", "medium": "low", "low": "low"}.get(level, level)
    return level


def _median(nums):
    if not nums:
        return None
    s = sorted(nums)
    n = len(s)
    return s[n // 2] if n % 2 else round((s[n // 2 - 1] + s[n // 2]) / 2.0, 1)


def _norm_events(raw):
    events = []
    for e in raw or []:
        e = dict(e or {})
        e["attrs"] = dict(e.get("attrs") or {})
        e["response"] = dict(e.get("response") or {"type": "none"})
        e.setdefault("source", "unverified")
        events.append(e)
    return events


def _build(inp, a):
    rivals = inp["rivals"]
    mc = dict(a.get("market_commonality") or {})
    rs = dict(a.get("resource_similarity") or {})
    events = _norm_events(a.get("events") or inp.get("action_log"))

    by_rival = {}
    for r in rivals:
        x = dict((a.get("amc") or {}).get(r) or {})
        vals = {
            "awareness": x.get("awareness"),
            "motivation": x.get("motivation"),
            "capability": x.get("capability"),
        }
        by_rival[r] = dict(
            vals,
            score=compute_tension(vals["awareness"], vals["motivation"], vals["capability"]),
            bottleneck=_bottleneck(vals),
            evidence=list(x.get("evidence") or []),
        )
    primary = rivals[0]
    tension = dict(by_rival[primary], by_rival=by_rival)

    responded = sum(1 for e in events if e["response"].get("type") not in (None, "none"))
    lag_days = [e["response"]["lag_days"] for e in events
                if isinstance(e["response"].get("lag_days"), (int, float))]
    lag_label = a.get("response_lag")
    if lag_label is None and lag_days:
        lag_label = "%g 天（中位）" % _median(lag_days)
    status = "ok" if len(events) >= 3 else ("single_event" if events else "no_event")

    contacts = a.get("contacts")
    symmetric = a.get("importance_symmetric")
    rs_vals = [v for v in rs.values() if isinstance(v, (int, float))]
    level = forbearance_level(contacts, symmetric, max(rs_vals) if rs_vals else None,
                              bool(a.get("platform")))
    exceptions = []
    if a.get("platform"):
        exceptions.append("平台/双边市场：按反向机制下调一档")

    adv = dict(a.get("advantage") or {})
    res = {
        "boundary": {
            "focal_market": inp["scope"],
            "rival_set": rivals,
            "market_commonality": mc,
            "resource_similarity": rs,
            "asymmetry": a.get("asymmetry", ""),
        },
        "interaction": {
            "events": events,
            "response_rate": round(responded / len(events), 3) if events else None,
            "response_lag": lag_label,
            "attack_volume": len(events),
            "status": status,
        },
        "tension": tension,
        "multimarket": {
            "contacts": contacts,
            "importance_symmetric": symmetric,
            "forbearance_likelihood": level,
            "exceptions": exceptions,
        },
        "repertoire": dict(a.get("repertoire") or {
            "breadth": None, "aggressiveness": None, "inertia": None, "tempo": None,
        }),
        "advantage": {
            "arena": adv.get("arena", ""),
            "sustainability": adv.get("sustainability", "unknown"),
            "erosion_path": adv.get("erosion_path", ""),
            "window": adv.get("window", ""),
        },
        "options": list(a.get("options") or []),
    }
    return res


def _basis_ok(basis):
    """选项依据可写单条或多条命题，如 P6 或 P6、P10。"""
    if not basis:
        return False
    parts = [p for p in re.split(r"[、,，/\s]+", str(basis).strip()) if p]
    return bool(parts) and all(p in PROPOSITIONS for p in parts)


def _verify(res):
    b, it, t = res["boundary"], res["interaction"], res["tension"]
    mm, adv, opts = res["multimarket"], res["advantage"], res["options"]
    roles = res["inputs"]["rivals"]
    events = it["events"]
    c = {}
    c["CHK-01"] = bool(b["market_commonality"]) and all(r in b["market_commonality"] for r in roles)
    c["CHK-02"] = bool(events) and all(e.get("t") and e.get("actor") and e.get("source") for e in events)
    c["CHK-03"] = bool(events) and all(
        all(e["attrs"].get(k) is not None for k in ATTRS)
        and e["attrs"].get("type") in ("tactical", "strategic")
        for e in events
    )
    c["CHK-04"] = bool(events) and all(
        e["response"].get("type") in RESPONSE_TYPES for e in events)
    c["CHK-05"] = bool(t["by_rival"]) and all(
        v["awareness"] is not None and v["motivation"] is not None
        and v["capability"] is not None and bool(v["evidence"])
        for v in t["by_rival"].values()
    )
    c["CHK-06"] = mm["contacts"] is not None and (
        mm["contacts"] <= 1 or isinstance(mm["importance_symmetric"], bool))
    c["CHK-07"] = bool(adv.get("erosion_path")) and bool(adv.get("window"))
    c["CHK-08"] = all(_basis_ok(o.get("basis")) and bool(o.get("boundary")) for o in opts)
    return c


def _degraded_reasons(res):
    reasons = []
    n = len(res["interaction"]["events"])
    if res["interaction"]["status"] != "ok":
        reasons.append("事件=%d(<3)，无法推断模式" % n)
    if res["tension"]["score"] is None:
        miss = [ _zh(k) for k in ("awareness", "motivation", "capability")
                 if res["tension"].get(k) is None ]
        if miss:
            reasons.append("张力不完整（%s缺失）" % "、".join(miss))
        else:
            reasons.append("张力不完整（AMC 证据不足）")
    if not res["advantage"]["erosion_path"]:
        reasons.append("优势侵蚀路径缺失")
    bad = [k for k, v in res["checks"].items() if not v]
    if bad:
        reasons.append("自检未全通过: " + ",".join(bad))
    return reasons


def _summary(res):
    status = res["meta"]["status"]
    if status == "pending_assessment":
        return "[PENDING] 输入已校验；待补 assessments（AMC/事件/多点/优势/选项）"
    if status == "not_triggered":
        return "[SKIP] 触发未命中(status=%s, score=%s)；如确需执行请传 force=true" % (
            res["trigger"]["status"], res["trigger"]["score"])
    if status == "degraded":
        return "[DEGRADED] " + "；".join(_degraded_reasons(res)[:3]) + "；建议补证后再决策"
    t = res["tension"]
    zh = res["meta"]["lang"] == "zh"
    nm = sum(1 for v in res["checks"].values() if v)
    return ("[OK] 对手=%d 张力=%.1f(%s) 多点接触=%s 克制=%s 优势=%s(%s) 选项=%d checks=%d/%d"
            % (len(res["inputs"]["rivals"]), t["score"],
               _zh(t["bottleneck"]) if zh else t["bottleneck"],
               res["multimarket"]["contacts"],
               _zh(res["multimarket"]["forbearance_likelihood"]) if zh
               else res["multimarket"]["forbearance_likelihood"],
               _zh(res["advantage"]["sustainability"]) if zh
               else res["advantage"]["sustainability"],
               res["advantage"]["window"], len(res["options"]), nm, len(res["checks"])))


# ---------------------------------------------------------------- 入口
def run(inputs, assessments=None, options=None):
    """执行输入校验、触发判定、派生计算与自检。

    inputs       : 必填 focal_firm/rivals/question/horizon/scope；其余见 OPTIONAL
    assessments  : 分析者编码结果（AMC、事件、多点、优势、选项）；缺省则返回待分析协议
    options      : 仅支持 force（触发未命中时强制执行）
    """
    opts = dict(DEFAULT_OPTIONS)
    if options:
        unknown = sorted(set(options) - set(DEFAULT_OPTIONS))
        if unknown:
            raise KeyError("未知选项: %s（可用: %s）" % (unknown, sorted(DEFAULT_OPTIONS)))
        opts.update(options)

    inp, warnings = validate_inputs(inputs)
    has_events = bool((assessments or {}).get("events") or inp["action_log"])
    if inp["evidence_level"] == "public" and not has_events:
        warnings.append("evidence_level=public 但事件链为空；S2 需从公开来源重建")
    trig = check_trigger(inp["subject_tags"], inp["env_features"])
    meta = {
        "skill": SKILL_ID, "version": VERSION, "status": "ok",
        "depth": inp["depth"], "evidence_level": inp["evidence_level"],
        "lang": inp["lang"], "forced": False,
    }
    res = {"meta": meta, "trigger": trig, "inputs": inp, "warnings": warnings}

    if not trig["hit"] and not opts["force"]:
        meta["status"] = "not_triggered"
        res["summary"] = _summary(res)
        return res
    if opts["force"]:
        meta["forced"] = True

    if not assessments:
        meta["status"] = "pending_assessment"
        res["protocol"] = list(PROTOCOL)
        res["summary"] = _summary(res)
        return res

    res.update(_build(inp, assessments))
    res["checks"] = _verify(res)
    if res["interaction"]["status"] != "ok" or any(not v for v in res["checks"].values()):
        meta["status"] = "degraded"
    else:
        meta["status"] = "ok"
    res["summary"] = _summary(res)
    return res


# ---------------------------------------------------------------- 演示与自测
IN_A = {
    "focal_firm": "美团",
    "rivals": ["饿了么"],
    "question": "2018—2020 年外卖补贴战中，美团应继续对等补贴，还是转向效率与多业务协同？",
    "horizon": "2018-01/2020-12",
    "scope": "中国境内餐饮外卖；关联市场为到店酒旅与即时零售",
    "goal": "defend",
    "depth": "standard",
    "evidence_level": "public",
    "subject_tags": {"role": "战略管理者"},
    "env_features": {"task": "价格/补贴战评估", "context": "平台"},
}

DEMO_A = {
    "market_commonality": {"饿了么": 3},
    "resource_similarity": {"饿了么": 2},
    "asymmetry": "美团在配送密度与商户覆盖上占优；饿了么在支付入口与阿里生态资源上占优",
    "response_lag": "1—2 月（战略级）/ 数周（战术级）",
    "events": [
        {"t": "2018-04", "actor": "阿里（饿了么母公司）", "action": "95 亿美元收购饿了么",
         "attrs": {"volume": 3, "complexity": 3, "novelty": 2, "visibility": 5,
                   "difficulty": 5, "type": "strategic"},
         "response": {"actor": "美团", "type": "matching", "lag": "1—2 月",
                      "lag_days": 45, "match": "加速上市与补贴"},
         "source": "公开报道"},
        {"t": "2018 夏", "actor": "饿了么", "action": "30 亿元补贴，目标 50% 份额",
         "attrs": {"volume": 4, "complexity": 2, "novelty": 1, "visibility": 5,
                   "difficulty": 2, "type": "tactical"},
         "response": {"actor": "美团", "type": "matching", "lag": "数周",
                      "lag_days": 21, "match": "对等补贴"},
         "source": "公开报道"},
        {"t": "2020", "actor": "饿了么", "action": "百亿补贴",
         "attrs": {"volume": 4, "complexity": 2, "novelty": 2, "visibility": 5,
                   "difficulty": 3, "type": "tactical"},
         "response": {"actor": "美团", "type": "displaced", "lag": "持续",
                      "lag_days": 180, "match": "效率与多业务协同"},
         "source": "公开报道"},
    ],
    "amc": {"饿了么": {"awareness": 3, "motivation": 3, "capability": 3,
                       "evidence": ["高频对等回应", "双方持续投入", "阿里生态支撑"]}},
    "contacts": 3,
    "importance_symmetric": False,
    "platform": True,
    "repertoire": {"breadth": 4, "aggressiveness": "high",
                   "inertia": "medium", "tempo": "季度级"},
    "advantage": {"arena": "成本/质量（配送密度与单位经济）",
                  "sustainability": "temporary",
                  "erosion_path": "补贴→骑手成本→监管合规→利润承压",
                  "window": "12—24 个月"},
    "options": [
        {"name": "对等补贴", "move": "维持补贴强度",
         "expected_response": "对手跟进，陷入消耗", "risk": "单位经济恶化",
         "fit": "份额优先", "boundary": "资本充足且监管容忍", "basis": "P6"},
        {"name": "效率+协同", "move": "转向配送效率与到店/即时零售协同",
         "expected_response": "对手在单一外卖市场加码", "risk": "份额短期流失",
         "fit": "利润优先", "boundary": "多业务协同真实存在", "basis": "P6、P10"},
        {"name": "选择性克制", "move": "聚焦高密度城市，低密度市场不跟进",
         "expected_response": "对手在低密度市场扩张", "risk": "区域份额被蚕食",
         "fit": "区域优势明显", "boundary": "市场可分割且用户黏性高", "basis": "P5"},
    ],
}

IN_B = {
    "focal_firm": "A 区域连锁药店",
    "rivals": ["B 全国折扣药房"],
    "question": "B 进入本地市场后，A 是否应跟进降价？",
    "horizon": "2025-01/2025-12",
    "scope": "华东某三线城市社区药房",
    "goal": "defend",
    "depth": "quick",
    "evidence_level": "public",
    "subject_tags": {"role": "战略管理者"},
    "env_features": {"task": "对手分析", "context": "新进入者"},
}

DEMO_B = {
    "market_commonality": {"B 全国折扣药房": 3},
    "resource_similarity": {"B 全国折扣药房": 2},
    "events": [
        {"t": "2025-03", "actor": "B 全国折扣药房", "action": "本地开店并低价促销",
         "attrs": {"volume": 2, "complexity": 2, "visibility": 4, "type": "tactical"},
         "response": {"actor": "A 区域连锁药店", "type": "none", "lag": "", "match": ""},
         "source": "公开报道"},
    ],
    "amc": {"B 全国折扣药房": {"awareness": 2, "motivation": 3, "capability": None,
                              "evidence": ["降价意愿明确", "资金与供应链证据缺失"]}},
    "contacts": 1,
    "importance_symmetric": None,
}


def reproduce():
    """默认复现示例 A，等价于 run(IN_A, DEMO_A)。"""
    return run(IN_A, DEMO_A)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    if "--example" in sys.argv:
        i = sys.argv.index("--example")
        which = sys.argv[i + 1] if i + 1 < len(sys.argv) else ""
        if which == "a":
            print(json.dumps(run(IN_A, DEMO_A), ensure_ascii=False, indent=2))
        elif which == "b":
            print(json.dumps(run(IN_B, DEMO_B), ensure_ascii=False, indent=2))
        else:
            raise SystemExit("用法: python dynamic_competition_skill.py --example a|b")
        raise SystemExit(0)

    # 1) 触发判定三态 + 外部覆盖
    hit = check_trigger({"role": "战略管理者", "level": "中层"},
                        {"task": "竞争分析", "context": "双寡头"})
    miss = check_trigger({"role": "实习生"}, {"task": "财报解读"})
    lack = check_trigger({"level": "中层"}, {"task": "竞争分析"})
    custom = dict(TRIGGER_RULES, subject_any={}, min_score=1,
                  env_any={"task": ("竞争分析",)})
    over = check_trigger({"role": "实习生"}, {"task": "竞争分析"}, rules=custom)
    assert hit["hit"] and hit["score"] == 3
    assert (not miss["hit"]) and miss["status"] == "miss"
    assert (not lack["hit"]) and lack["status"] == "missing" and "role" in lack["missing"]
    assert over["hit"]

    # 2) 示例 A：全通过
    r1 = run(IN_A, DEMO_A)
    assert r1["meta"]["status"] == "ok", r1["summary"]
    assert r1["tension"]["score"] == 3.0
    assert r1["multimarket"]["forbearance_likelihood"] == "low"
    assert r1["interaction"]["response_rate"] == 1.0
    assert all(r1["checks"].values()), r1["checks"]
    print(r1["summary"])

    # 3) 示例 B：证据不足，降级且不补零
    r2 = run(IN_B, DEMO_B)
    assert r2["meta"]["status"] == "degraded"
    assert r2["tension"]["score"] is None
    assert r2["checks"]["CHK-03"] is False
    assert r2["checks"]["CHK-05"] is False
    assert r2["checks"]["CHK-07"] is False
    assert r2["checks"]["CHK-08"] is True
    print(r2["summary"])

    # 4) 待分析协议 / 未触发 / 强制
    assert run(IN_A)["meta"]["status"] == "pending_assessment"
    assert run(dict(IN_A, subject_tags={"role": "实习生"},
                    env_features={"task": "财报解读"}))["meta"]["status"] == "not_triggered"
    forced = run(dict(IN_A, subject_tags={"role": "实习生"},
                      env_features={"task": "财报解读"}), DEMO_A, {"force": True})
    assert forced["meta"]["forced"] is True and forced["meta"]["status"] == "ok"

    # 5) 白名单与可复现
    try:
        run(dict(IN_A, rival=[]), DEMO_A)
        raise AssertionError("未知字段应报错")
    except KeyError:
        pass
    assert run(IN_A, DEMO_A)["tension"] == run(IN_A, DEMO_A)["tension"]
    assert compute_tension(2, 3, 2) == 2.29
    print("all self-tests passed")
