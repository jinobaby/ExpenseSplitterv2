import { useState, useEffect, useCallback, useRef } from "react";

const WS_URL = "ws://localhost:54001";

// Command types matching server
const CMD = {
  LOGIN: 0x0001, REGISTER: 0x0002, LOGOUT: 0x0003,
  CREATE_GROUP: 0x0010, JOIN_GROUP: 0x0011, LIST_GROUPS: 0x0012,
  SELECT_GROUP: 0x0013, LEAVE_GROUP: 0x0014, GROUP_MEMBERS: 0x0015,
  ADD_EXPENSE: 0x0020, LIST_EXPENSES: 0x0021,
  GET_BALANCES: 0x0030, GET_SETTLEMENTS: 0x0031,
  REQUEST_RECEIPT: 0x0040, FILE_HEADER: 0x0041, FILE_DATA: 0x0042, FILE_COMPLETE: 0x0043,
  ERROR: 0x00ff,
};

export default function App() {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [members, setMembers] = useState([]);
  const [view, setView] = useState("login");
  const [toast, setToast] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "", name: "" });
  const [expenseForm, setExpenseForm] = useState({ amount: "", description: "", splitWith: "" });
  const [groupForm, setGroupForm] = useState({ name: "" });
  const [joinForm, setJoinForm] = useState({ groupId: "" });
  const [receiptFilename, setReceiptFilename] = useState("sample_receipt.jpg");
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [receivedChunks, setReceivedChunks] = useState([]);
  const wsRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const send = useCallback((command, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command, payload }));
    }
  }, []);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.onopen = () => { setConnected(true); setWs(socket); };
    socket.onclose = () => { setConnected(false); setWs(null); };
    socket.onerror = () => showToast("Connection failed", "error");

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const payload = msg.payload;
      const status = msg.status;

      switch (msg.command) {
        case CMD.LOGIN:
          if (status === 200) {
            setUser({ email: loginForm.email, name: payload.name, token: payload.token });
            setView("groups");
            showToast(`Welcome, ${payload.name}!`);
            setTimeout(() => send(CMD.LIST_GROUPS), 100);
          } else { showToast(payload?.error || "Login failed", "error"); }
          break;
        case CMD.REGISTER:
          if (status === 201) { showToast("Registered! Please login."); setView("login"); }
          else { showToast(payload?.error || "Registration failed", "error"); }
          break;
        case CMD.LOGOUT:
          setUser(null); setCurrentGroup(null); setView("login"); showToast("Logged out"); break;
        case CMD.CREATE_GROUP:
          if (status === 201) { showToast(`Group "${payload.name}" created (${payload.groupId})`); send(CMD.LIST_GROUPS); }
          else { showToast(payload?.error, "error"); }
          break;
        case CMD.JOIN_GROUP:
          if (status === 200) { showToast(`Joined "${payload.name}"`); send(CMD.LIST_GROUPS); }
          else { showToast(payload?.error, "error"); }
          break;
        case CMD.LIST_GROUPS:
          setGroups(payload.groups || []); break;
        case CMD.SELECT_GROUP:
          if (status === 200) {
            setCurrentGroup({ id: payload.groupId, name: payload.name });
            setView("group");
            send(CMD.LIST_EXPENSES);
            send(CMD.GET_BALANCES);
            send(CMD.GET_SETTLEMENTS);
            send(CMD.GROUP_MEMBERS);
          } else { showToast(payload?.error, "error"); }
          break;
        case CMD.LEAVE_GROUP:
          if (Number(status) === 200) {
            showToast(payload?.message || "You left the group");
            setCurrentGroup(null);
            setView("groups");
            setMembers([]);
            send(CMD.LIST_GROUPS);
          } else {
            showToast(payload?.error || "Could not leave group", "error");
          }
          break;
        case CMD.GROUP_MEMBERS:
          setMembers(payload.members || []); break;
        case CMD.ADD_EXPENSE:
          if (status === 201) {
            showToast("Expense added!");
            setExpenseForm({ amount: "", description: "", splitWith: "" });
            send(CMD.LIST_EXPENSES); send(CMD.GET_BALANCES); send(CMD.GET_SETTLEMENTS);
          } else { showToast(payload?.error, "error"); }
          break;
        case CMD.LIST_EXPENSES:
          setExpenses(payload.expenses || []); break;
        case CMD.GET_BALANCES:
          setBalances(payload.balances || []); break;
        case CMD.GET_SETTLEMENTS:
          setSettlements(payload.settlements || []); break;
        case CMD.REQUEST_RECEIPT:
          if (status !== 200 && payload?.error) {
            showToast(payload.error, "error");
            setDownloadProgress(null);
            setReceivedChunks([]);
          }
          break;
        case CMD.FILE_HEADER:
          setDownloadProgress({
            filename: payload.filename,
            total: payload.size,
            received: 0,
          });
          setReceivedChunks([]);
          break;
        case CMD.FILE_DATA:
          setReceivedChunks((prev) => [...prev, payload.data]);
          setDownloadProgress((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              received: prev.received + (payload.size || 0),
            };
          });
          break;
        case CMD.FILE_COMPLETE: {
          const fname = payload.filename || "receipt";
          setReceivedChunks((chunks) => {
            const parts = chunks.map((b64) => {
              const bin = atob(b64);
              return Uint8Array.from(bin, (c) => c.charCodeAt(0));
            });
            const blob = new Blob(parts);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(`Downloaded ${fname}`);
            setTimeout(() => setDownloadProgress(null), 3000);
            return [];
          });
          break;
        }
        case CMD.ERROR:
          showToast(payload?.error || "Server error", "error"); break;
      }
    };

    return () => socket.close();
  }, []);

  const doLogin = () => send(CMD.LOGIN, loginForm);
  const doRegister = () => send(CMD.REGISTER, registerForm);
  const doCreateGroup = () => { send(CMD.CREATE_GROUP, groupForm); setGroupForm({ name: "" }); };
  const doJoinGroup = () => { send(CMD.JOIN_GROUP, joinForm); setJoinForm({ groupId: "" }); };
  const doSelectGroup = (id) => send(CMD.SELECT_GROUP, { groupId: id });
  /** Removes you from the group; you must join again to come back */
  const doQuitGroup = () => send(CMD.LEAVE_GROUP);
  const doLogout = () => send(CMD.LOGOUT);
  const doAddExpense = () => send(CMD.ADD_EXPENSE, expenseForm);

  const doDownloadReceipt = () => {
    const name = receiptFilename.trim();
    if (!name) {
      showToast("Enter a filename", "error");
      return;
    }
    send(CMD.REQUEST_RECEIPT, { filename: name });
  };

  const formatCents = (cents) => {
    const abs = Math.abs(cents);
    return `$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e6e3", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, padding: "12px 24px", borderRadius: 8, zIndex: 999,
          background: toast.type === "error" ? "#dc2626" : "#059669", color: "white",
          fontSize: 14, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          animation: "slideIn 0.3s ease"
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={{
        padding: "16px 32px", borderBottom: "1px solid #1e1e2e",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(180deg, #12121a 0%, #0a0a0f 100%)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>$</div>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>ExpenseSplitter</span>
          {currentGroup && <span style={{ color: "#6366f1", fontSize: 14 }}>/ {currentGroup.name}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444" }} />
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, color: "#9ca3af" }}>{user.name}</span>
              <button onClick={doLogout} style={{ ...btnStyle, background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "6px 16px", fontSize: 13 }}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* LOGIN */}
        {view === "login" && (
          <div style={{ maxWidth: 400, margin: "80px auto" }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Welcome back</h1>
            <p style={{ color: "#6b7280", marginBottom: 32 }}>Sign in to manage your shared expenses</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input placeholder="Email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} style={inputStyle} />
              <input placeholder="Password" type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} style={inputStyle} onKeyDown={e => e.key === "Enter" && doLogin()} />
              <button onClick={doLogin} style={{ ...btnStyle, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", width: "100%", padding: "12px" }}>Sign In</button>
              <button onClick={() => setView("register")} style={{ ...btnStyle, background: "transparent", border: "1px solid #374151", color: "#9ca3af", width: "100%" }}>Create Account</button>
            </div>
            <p style={{ color: "#4b5563", fontSize: 12, marginTop: 16, textAlign: "center" }}>Demo: jino@test.com / pass123</p>
          </div>
        )}

        {/* REGISTER */}
        {view === "register" && (
          <div style={{ maxWidth: 400, margin: "80px auto" }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Create Account</h1>
            <p style={{ color: "#6b7280", marginBottom: 32 }}>Join and start splitting expenses</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input placeholder="Full Name" value={registerForm.name} onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })} style={inputStyle} />
              <input placeholder="Email" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} style={inputStyle} />
              <input placeholder="Password" type="password" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} style={inputStyle} />
              <button onClick={doRegister} style={{ ...btnStyle, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", width: "100%" }}>Register</button>
              <button onClick={() => setView("login")} style={{ ...btnStyle, background: "transparent", border: "1px solid #374151", color: "#9ca3af", width: "100%" }}>Back to Login</button>
            </div>
          </div>
        )}

        {/* GROUPS */}
        {view === "groups" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700 }}>Your Groups</h1>
            </div>

            {/* Create / Join */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>Create New Group</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <input placeholder="Group name" value={groupForm.name} onChange={e => setGroupForm({ name: e.target.value })} style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && doCreateGroup()} />
                  <button onClick={doCreateGroup} style={{ ...btnStyle, background: "#6366f1" }}>Create</button>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>Join Existing Group</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <input placeholder="Group ID (e.g. grp_1)" value={joinForm.groupId} onChange={e => setJoinForm({ groupId: e.target.value })} style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && doJoinGroup()} />
                  <button onClick={doJoinGroup} style={{ ...btnStyle, background: "#6366f1" }}>Join</button>
                </div>
              </div>
            </div>

            {/* Group list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.length === 0 && <p style={{ color: "#4b5563", textAlign: "center", padding: 40 }}>No groups yet. Create or join one above.</p>}
              {groups.map((g) => (
                <div key={g.id} onClick={() => doSelectGroup(g.id)} style={{
                  ...cardStyle, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  transition: "border-color 0.2s", borderColor: "#1e1e2e",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{g.id} · {g.memberCount} members</div>
                  </div>
                  <div style={{ color: "#6366f1", fontSize: 20 }}>→</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GROUP DETAIL */}
        {view === "group" && currentGroup && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <button type="button" onClick={doQuitGroup} style={{ ...btnStyle, background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "6px 14px", fontSize: 13, marginBottom: 8 }}>Quit group</button>
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>{currentGroup.name}</h1>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {members.map(m => (
                  <div key={m.email} style={{ padding: "4px 12px", borderRadius: 20, background: "#1e1e2e", fontSize: 12, color: "#9ca3af" }}>{m.name}</div>
                ))}
              </div>
            </div>

            {/* Add Expense */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>Add Expense</h3>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 8 }}>
                <input placeholder="$0.00" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} style={inputStyle} />
                <input placeholder="What was it for?" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} style={inputStyle} onKeyDown={e => e.key === "Enter" && doAddExpense()} />
                <button onClick={doAddExpense} style={{ ...btnStyle, background: "#6366f1" }}>Add</button>
              </div>
            </div>

            {/* Receipts */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>Receipts</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    placeholder="Receipt filename (e.g. sample_receipt.jpg)"
                    value={receiptFilename}
                    onChange={(e) => setReceiptFilename(e.target.value)}
                    style={{ ...inputStyle, flex: "1 1 200px", minWidth: 0 }}
                    onKeyDown={(e) => e.key === "Enter" && doDownloadReceipt()}
                  />
                  <button type="button" onClick={doDownloadReceipt} style={{ ...btnStyle, background: "#6366f1" }}>
                    Download
                  </button>
                </div>
                {downloadProgress && (
                  <div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
                      {downloadProgress.filename} — {downloadProgress.received} / {downloadProgress.total} bytes
                    </div>
                    <div style={{ height: 8, background: "#1e1e2e", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${downloadProgress.total ? Math.min(100, (downloadProgress.received / downloadProgress.total) * 100) : 0}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                          transition: "width 0.15s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Balances & Settlements */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>Balances</h3>
                {balances.length === 0 && <p style={{ color: "#4b5563", fontSize: 13 }}>No expenses yet</p>}
                {balances.map((b, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e1e2e" }}>
                    <span style={{ fontSize: 14 }}>{b.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: b.balanceCents > 0 ? "#22c55e" : b.balanceCents < 0 ? "#ef4444" : "#6b7280" }}>
                      {b.display}
                    </span>
                  </div>
                ))}
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>Settlements</h3>
                {settlements.length === 0 && <p style={{ color: "#22c55e", fontSize: 13 }}>Everyone is settled up!</p>}
                {settlements.map((s, i) => (
                  <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #1e1e2e", fontSize: 14 }}>
                    <span style={{ color: "#ef4444" }}>{s.from}</span>
                    <span style={{ color: "#6b7280" }}> pays </span>
                    <span style={{ color: "#22c55e" }}>{s.to}</span>
                    <span style={{ fontWeight: 700, marginLeft: 8 }}>{s.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses List */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>Expenses ({expenses.length})</h3>
              {expenses.length === 0 && <p style={{ color: "#4b5563", fontSize: 13 }}>No expenses recorded yet</p>}
              {expenses.map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e1e2e" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{e.description}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Paid by {e.payer}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{e.amount}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        input:focus { outline: none; border-color: #6366f1 !important; }
        button:hover { opacity: 0.9; }
        div[style*="cursor: pointer"]:hover { border-color: #6366f1 !important; }
      `}</style>
    </div>
  );
}

const inputStyle = {
  padding: "10px 14px", borderRadius: 8, border: "1px solid #374151",
  background: "#12121a", color: "#e8e6e3", fontSize: 14, outline: "none",
};

const btnStyle = {
  padding: "10px 20px", borderRadius: 8, border: "none", color: "white",
  fontSize: 14, fontWeight: 600, cursor: "pointer",
};

const cardStyle = {
  padding: 20, borderRadius: 12, border: "1px solid #1e1e2e",
  background: "#12121a",
};
