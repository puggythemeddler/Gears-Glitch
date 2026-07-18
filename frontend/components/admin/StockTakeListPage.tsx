import React, { useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { useFetch, Spinner, ErrorMsg } from "./shared";

export default function StockTakeListPage() {
  const { data: sessions, loading, error, refetch } = useFetch(() => api<{ sessions: any[] }>("/api/stock-take"), []);
  const [msg, setMsg] = useState("");

  async function startSession() {
    try {
      const data = await api<any>("/api/stock-take/start", { method: "POST" });
      if (data?.session) {
        window.location.href = `/stock-take/${data.session.id}`;
      }
    } catch (err: any) { setMsg(err.message); }
  }

  async function handleDelete(session: any, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this session? Only possible if no items have been counted.")) return;
    try {
      await api(`/api/stock-take/${session.id}`, { method: "DELETE" });
      refetch();
    } catch (err: any) { setMsg(err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const sessionList = sessions?.sessions || [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Stock Take</h1>
        <RippleButton size="small" onClick={startSession}>+ New Session</RippleButton>
      </div>
      {msg && <div className="panel" style={{ marginBottom: "1rem", background: "#fee2e2", color: "#991b1b" }}>{msg}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Created</th>
              <th>Completed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessionList.length === 0 && <tr><td colSpan={5}><EmptyState icon="stock" title="No stock take sessions" description="Start a new session to count inventory." /></td></tr>}
            {sessionList.map((s: any) => (
              <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/stock-take/${s.id}`}>
                <td>{s.id}</td>
                <td><span className="plan-status" style={{ background: s.status === "completed" ? "#d1fae5" : "#fef3c7", color: s.status === "completed" ? "#065f46" : "#92400e" }}>{s.status}</span></td>
                <td>{new Date(s.createdAt || s.created_at).toLocaleDateString("en-GB")}</td>
                <td>{s.completedAt || s.completed_at ? new Date(s.completedAt || s.completed_at).toLocaleDateString("en-GB") : "—"}</td>
                <td>
                  <RippleButton size="small" variant="danger" onClick={(e) => handleDelete(s, e)}>Delete</RippleButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
