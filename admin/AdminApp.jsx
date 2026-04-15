import { useState, useEffect, useRef } from "react";

const WS_URL = "ws://localhost:54001";

const CMD = {
  LOGIN: 0x0001, ADMIN_STATUS: 0x0050, ADMIN_LOGS: 0x0051,
  ADMIN_SESSIONS: 0x0052, ADMIN_STATES: 0x0053,
};

export default function AdminApp() {
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "jino@test.com", password: "pass123" });
  const [status, setStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [states, setStates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const wsRef = useRef(null);

  const send = (command, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command, payload }));
    }
  };

  const refreshAll = () => {
    send(CMD.ADMIN_STATUS);
    send(CMD.ADMIN_SESSIONS);
    send(CMD.ADMIN_STATES);
    send(CMD.ADMIN_LOGS);
  };

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => { setConnected(false); setAuthenticated(false); };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.command) {
        case CMD.LOGIN:
          if (msg.status === 200) { setAuthenticated(true); setTimeout(refreshAll, 200); }
          break;
        case CMD.ADMIN_STATUS: setStatus(msg.payload); break;
        case CMD.ADMIN_SESSIONS: setSessions(msg.payload.sessions || []); break;
        case CMD.ADMIN_STATES: setStates(msg.payload.states || []); break;
        case CMD.ADMIN_LOGS: setLogs(msg.payload.logs || []); break;
      }
    };

    return () => socket.close();
  }, []);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    if (!authenticated || !autoRefresh) return;
    const interval = setInterval(refreshAll, 3000);
    return () => clearInterval(interval);
  }, [authenticated, autoRefresh]);

  const doLogin = () => send(CMD.LOGIN, loginForm);

  const stateColor = (state) => {
    switch (state) {
      case "IDLE": return "#22c55e";
      case "IN_GROUP": return "#3b82f6";
      case "PROCESSING_EXPENSE": return "#f59e0b";
      case "TRANSFERRING_FILE": return "#8b5cf6";
      default: return "#6b7280";
    }
  };

  // ============================================================
  // LOGIN SCREEN
  // ============================================================
  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: "#080810", color: "#e8e6e3", fontFamily: "'Courier New', monospace", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b", letterSpacing: 2 }}>ADMIN CONSOLE</h1>
            <p style={{ color: "#4b5563", fontSize: 12 }}>Expense Splitter Server Monitor</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444" }} />
              <span style={{ fontSize: 11, color: "#6b7280" }}>{connected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="Admin Email" style={adminInput} />
            <input value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} type="password" placeholder="Password" style={adminInput} onKeyDown={e => e.key === "Enter" && doLogin()} />
            <button onClick={doLogin} style={{ padding: 12, border: "1px solid #f59e0b", background: "transparent", color: "#f59e0b", fontFamily: "'Courier New'", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 2 }}>AUTHENTICATE</button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#e8e6e3", fontFamily: "'Courier New', monospace" }}>
      {/* Header */}
      <header style={{ padding: "12px 24px", borderBottom: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ color: "#f59e0b", fontWeight: 700, letterSpacing: 2, fontSize: 14 }}>ADMIN CONSOLE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7280", cursor: "pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          <button onClick={refreshAll} style={{ padding: "4px 12px", border: "1px solid #374151", background: "transparent", color: "#9ca3af", cursor: "pointer", fontFamily: "'Courier New'", fontSize: 11 }}>REFRESH</button>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
        </div>
      </header>

      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        {/* Status Cards */}
        {status && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "CLIENTS", value: status.clients, color: "#3b82f6" },
              { label: "USERS", value: status.users, color: "#22c55e" },
              { label: "GROUPS", value: status.groups, color: "#8b5cf6" },
              { label: "EXPENSES", value: status.expenses, color: "#f59e0b" },
            ].map((card, i) => (
              <div key={i} style={{ padding: 20, border: `1px solid ${card.color}33`, background: `${card.color}08`, borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: 2, marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Sessions */}
          <div style={panelStyle}>
            <div style={panelHeader}>ACTIVE SESSIONS ({sessions.length})</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1a1a2e" }}>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>USER</th>
                  <th style={thStyle}>STATE</th>
                  <th style={thStyle}>TYPE</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0f0f1a" }}>
                    <td style={tdStyle}>{s.id?.substring(0, 12)}</td>
                    <td style={tdStyle}>{s.name || s.user}</td>
                    <td style={tdStyle}><span style={{ color: stateColor(s.state), fontWeight: 700 }}>{s.state}</span></td>
                    <td style={tdStyle}><span style={{ color: s.type === "ws" ? "#8b5cf6" : "#3b82f6" }}>{s.type?.toUpperCase()}</span></td>
                  </tr>
                ))}
                {sessions.length === 0 && <tr><td colSpan={4} style={{ ...tdStyle, color: "#4b5563", textAlign: "center" }}>No active sessions</td></tr>}
              </tbody>
            </table>
          </div>

          {/* State Machine */}
          <div style={panelStyle}>
            <div style={panelHeader}>STATE MACHINE</div>
            <div style={{ padding: 16 }}>
              {states.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #0f0f1a" }}>
                  <span style={{ fontSize: 13 }}>{s.user}</span>
                  <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: stateColor(s.state), background: `${stateColor(s.state)}15`, border: `1px solid ${stateColor(s.state)}33` }}>
                    {s.state}
                  </span>
                </div>
              ))}
              {states.length === 0 && <p style={{ color: "#4b5563", fontSize: 12, textAlign: "center" }}>No clients connected</p>}
            </div>
          </div>
        </div>

        {/* Logs */}
        <div style={panelStyle}>
          <div style={panelHeader}>SERVER LOGS (recent)</div>
          <div style={{ padding: 12, maxHeight: 350, overflowY: "auto", fontSize: 11, lineHeight: 1.8 }}>
            {logs.map((log, i) => (
              <div key={i} style={{
                color: log.includes("[ERROR]") ? "#ef4444" : log.includes("[WARN]") ? "#f59e0b" :
                  log.includes("[STATE]") ? "#8b5cf6" : log.includes("[TX]") ? "#3b82f6" :
                    log.includes("[RX]") ? "#22c55e" : "#6b7280",
                fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap", wordBreak: "break-all"
              }}>
                {log}
              </div>
            ))}
            {logs.length === 0 && <p style={{ color: "#4b5563", textAlign: "center" }}>No log entries</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

const adminInput = {
  padding: 10, border: "1px solid #374151", background: "#0a0a14", color: "#e8e6e3",
  fontFamily: "'Courier New'", fontSize: 13, outline: "none",
};

const panelStyle = { border: "1px solid #1a1a2e", background: "#0a0a14", borderRadius: 4 };
const panelHeader = { padding: "10px 16px", borderBottom: "1px solid #1a1a2e", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#f59e0b" };
const thStyle = { padding: "8px 12px", textAlign: "left", color: "#6b7280", fontWeight: 400 };
const tdStyle = { padding: "8px 12px" };
