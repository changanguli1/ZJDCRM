/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

interface ClueDetail {
  id: string;
  title: string;
  company_name: string;
  main_business: string;
  industry_code: string;
  stage_code: string;
  desired_area: number | null;
  acquired_at: string | null;
  expected_landing_at: string | null;
  bottleneck: string | null;
  source_code: string | null;
  internal_referral_flag: number;
  financing_flag: number;
  prior_location: string | null;
  lost_reason: string | null;
  fiscal_completion: string | null;
  expected_output: number | null;
  expected_tax: number | null;
  owner_id: string;
  department_id: string | null;
  actual_area: number | null;
  actual_landing_at: string | null;
  actual_fiscal_completion: string | null;
  created_at: string;
  updated_at: string;
  version: number;

  contacts: any[];
  followups: any[];
  spaces: any[];
  stageHistory: any[];
}

const stageLabels: Record<string, string> = {
  new: "新线索", filed: "已建档", initial_contact: "初步接触",
  needs_confirmed: "需求确认", key_followup: "重点跟进", site_visit: "考察洽谈",
  intent_confirmed: "意向确认", contract_pending: "签约推进", signed: "已签约",
  landed: "已落地", lost: "暂缓/流失",
};

export default function ClueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [clue, setClue] = useState<ClueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { csrfToken } = useAuth();
  const [contactForm, setContactForm] = useState({ name: "", mobile: "", title: "", isPrimaryDecisionMaker: false });
  const [followupForm, setFollowupForm] = useState({ methodCode: "phone", content: "", customerFeedback: "", nextAction: "", nextFollowupAt: "" });
  const [spaceId, setSpaceId] = useState("");
  const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);

  const fetchClue = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<ClueDetail>(`/clues/${id}`);
      setClue(data);
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClue(); }, [fetchClue]);
  useEffect(() => {
    api.get<any>("/spaces", { pageSize: "100" })
      .then((data) => setAvailableSpaces(data.items || []))
      .catch(() => setAvailableSpaces([]));
  }, []);

  const addContact = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await api.post<any>(`/clues/${id}/contacts`, contactForm, csrfToken);
    if (result.duplicate) {
      setError(`手机号已存在：${result.existingName}`);
      return;
    }
    setContactForm({ name: "", mobile: "", title: "", isPrimaryDecisionMaker: false });
    await fetchClue();
  };

  const addFollowup = async (event: React.FormEvent) => {
    event.preventDefault();
    await api.post(`/clues/${id}/followups`, followupForm, csrfToken);
    setFollowupForm({ methodCode: "phone", content: "", customerFeedback: "", nextAction: "", nextFollowupAt: "" });
    await fetchClue();
  };

  const addSpace = async () => {
    if (!spaceId) return;
    await api.post(`/clues/${id}/spaces`, { spaceId }, csrfToken);
    setSpaceId("");
    await fetchClue();
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>加载中...</span></div>;
  if (error) return <div className="page"><div className="form-error">{error}</div><Link to="/clues" className="btn">返回列表</Link></div>;
  if (!clue) return <div className="page"><p>线索不存在</p><Link to="/clues" className="btn">返回列表</Link></div>;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1>{clue.title}</h1>
          <p className="text-muted">{clue.company_name} · {clue.main_business}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to={`/clues/${clue.id}/edit`} className="btn">编辑</Link>
        </div>
      </div>

      {/* Info Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">基本信息</div>
          <div style={{ fontSize: 13 }}><strong>阶段：</strong><span className={`badge ${clue.stage_code === "signed" || clue.stage_code === "landed" ? "badge-success" : "badge-primary"}`}>{stageLabels[clue.stage_code]}</span></div>
          <div style={{ fontSize: 13 }}><strong>渠道：</strong>{clue.source_code || "-"}</div>
          <div style={{ fontSize: 13 }}><strong>需求面积：</strong>{clue.desired_area ? `${clue.desired_area}㎡` : "-"}</div>
          <div style={{ fontSize: 13 }}><strong>预计落位：</strong>{clue.expected_landing_at ? new Date(clue.expected_landing_at).toLocaleDateString("zh-CN") : "-"}</div>
          <div style={{ fontSize: 13 }}><strong>卡点：</strong>{clue.bottleneck || "-"}</div>
        </div>
        <div className="card">
          <div className="card-header">需求与效益</div>
          <div style={{ fontSize: 13 }}><strong>内转：</strong>{clue.internal_referral_flag ? "是" : "否"}</div>
          <div style={{ fontSize: 13 }}><strong>融资需求：</strong>{clue.financing_flag ? "是" : "否"}</div>
          <div style={{ fontSize: 13 }}><strong>原场地：</strong>{clue.prior_location || "-"}</div>
          <div style={{ fontSize: 13 }}><strong>预计产值：</strong>{clue.expected_output ?? "-"}</div>
          <div style={{ fontSize: 13 }}><strong>预计税收：</strong>{clue.expected_tax ?? "-"}</div>
        </div>
        <div className="card">
          <div className="card-header">落地信息</div>
          {clue.stage_code === "landed" ? (
            <>
              <div style={{ fontSize: 13 }}><strong>实际面积：</strong>{clue.actual_area ? `${clue.actual_area}㎡` : "-"}</div>
              <div style={{ fontSize: 13 }}><strong>落地日期：</strong>{clue.actual_landing_at ? new Date(clue.actual_landing_at).toLocaleDateString("zh-CN") : "-"}</div>
              <div style={{ fontSize: 13 }}><strong>财源情况：</strong>{clue.actual_fiscal_completion || "-"}</div>
            </>
          ) : clue.stage_code === "lost" ? (
            <div style={{ fontSize: 13 }}><strong>流失原因：</strong>{clue.lost_reason || "-"}</div>
          ) : (
            <p className="text-muted">尚未落地</p>
          )}
        </div>
      </div>

      {/* Contacts */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">联系人 ({clue.contacts?.length || 0})</div>
        <form onSubmit={addContact} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input aria-label="联系人姓名" placeholder="姓名" required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
          <input aria-label="联系人手机号" placeholder="手机号" required value={contactForm.mobile} onChange={(event) => setContactForm({ ...contactForm, mobile: event.target.value })} />
          <input aria-label="联系人职务" placeholder="职务" value={contactForm.title} onChange={(event) => setContactForm({ ...contactForm, title: event.target.value })} />
          <label><input type="checkbox" checked={contactForm.isPrimaryDecisionMaker} onChange={(event) => setContactForm({ ...contactForm, isPrimaryDecisionMaker: event.target.checked })} /> 决策人</label>
          <button className="btn btn-sm" type="submit">添加联系人</button>
        </form>
        {clue.contacts?.length > 0 ? (
          <table>
            <thead><tr><th>姓名</th><th>手机</th><th>职务</th><th>决策人</th></tr></thead>
            <tbody>
              {clue.contacts.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.mobile}</td>
                  <td>{c.title || "-"}</td>
                  <td>{c.is_primary_decision_maker ? "★" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">暂无联系人</p>
        )}
      </div>

      {/* Matched Spaces */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">备选空间 ({clue.spaces?.length || 0})</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select aria-label="选择备选空间" value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>
            <option value="">选择备选空间</option>
            {availableSpaces.filter((space) => !clue.spaces.some((matched) => matched.id === space.id)).map((space) => <option key={space.id} value={space.id}>{space.park_name} / {space.building_name} / {space.name}</option>)}
          </select>
          <button className="btn btn-sm" disabled={!spaceId} onClick={addSpace}>添加空间</button>
        </div>
        {clue.spaces?.length > 0 ? (
          <table>
            <thead><tr><th>空间</th><th>优先级</th><th>备注</th></tr></thead>
            <tbody>
              {clue.spaces.map((s: any) => (
                <tr key={s.id}>
                  <td><Link to={`/spaces/${s.id}`}>{s.name}</Link></td>
                  <td>{s.match_rank}</td>
                  <td>{s.match_reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (<p className="text-muted">暂无匹配空间</p>)}
      </div>

      {/* Followups / Timeline */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">跟进时间线</div>
        <form onSubmit={addFollowup} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, marginBottom: 12 }}>
          <select aria-label="跟进方式" value={followupForm.methodCode} onChange={(event) => setFollowupForm({ ...followupForm, methodCode: event.target.value })}>
            <option value="phone">电话</option><option value="wechat">微信</option><option value="visit">拜访</option><option value="meeting">会议</option><option value="email">邮件</option>
          </select>
          <textarea aria-label="跟进内容" placeholder="跟进内容" required value={followupForm.content} onChange={(event) => setFollowupForm({ ...followupForm, content: event.target.value })} />
          <input aria-label="客户反馈" placeholder="客户反馈" value={followupForm.customerFeedback} onChange={(event) => setFollowupForm({ ...followupForm, customerFeedback: event.target.value })} />
          <input aria-label="下一步动作" placeholder="下一步动作" value={followupForm.nextAction} onChange={(event) => setFollowupForm({ ...followupForm, nextAction: event.target.value })} />
          <input aria-label="下次跟进时间" type="datetime-local" value={followupForm.nextFollowupAt} onChange={(event) => setFollowupForm({ ...followupForm, nextFollowupAt: event.target.value })} />
          <button className="btn btn-sm" type="submit">添加跟进</button>
        </form>
        {clue.followups?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clue.followups.map((f: any) => (
              <div key={f.id} style={{ padding: 12, border: "1px solid var(--color-border-light)", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>
                  {new Date(f.followup_at).toLocaleString("zh-CN")} · {f.method_code}
                </div>
                <div>{f.content}</div>
                {f.customer_feedback && <div style={{ fontSize: 13, marginTop: 4, color: "var(--color-text-secondary)" }}>客户反馈：{f.customer_feedback}</div>}
                {f.next_action && <div style={{ fontSize: 13, marginTop: 4 }}>下一步：{f.next_action}</div>}
              </div>
            ))}
          </div>
        ) : (<p className="text-muted">暂无跟进记录</p>)}
      </div>

      {/* Stage History */}
      <div className="card">
        <div className="card-header">阶段变更历史</div>
        {clue.stageHistory?.length > 0 ? (
          <table>
            <thead><tr><th>时间</th><th>从</th><th>到</th><th>原因</th></tr></thead>
            <tbody>
              {clue.stageHistory.map((h: any) => (
                <tr key={h.id}>
                  <td>{new Date(h.changed_at).toLocaleString("zh-CN")}</td>
                  <td>{stageLabels[h.from_stage_code] || h.from_stage_code}</td>
                  <td>{stageLabels[h.to_stage_code] || h.to_stage_code}</td>
                  <td>{h.reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (<p className="text-muted">暂无阶段变更</p>)}
      </div>
    </div>
  );
}

