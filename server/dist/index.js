"use strict";
/**
 * @file index.ts
 * @brief Main server entry point - TCP server + WebSocket bridge.
 * @details Runs a raw TCP server (REQ-COM-010) on port 54000 and a WebSocket
 *          bridge on port 54001 for React client/admin apps. Implements the
 *          state machine (REQ-SYS-060), authentication (REQ-SYS-080), and
 *          all expense splitter functionality.
 * @author Jino Baby, Yashika
 * @version 1.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ws_1 = require("ws");
const DataPacket_1 = require("./DataPacket");
const Logger_1 = require("./services/Logger");
const AuthService_1 = require("./services/AuthService");
const GroupService_1 = require("./services/GroupService");
const ExpenseService_1 = require("./services/ExpenseService");
const SettlementService_1 = require("./services/SettlementService");
// ============================================================================
// State Machine (REQ-SYS-060)
// ============================================================================
var SessionState;
(function (SessionState) {
    SessionState["IDLE"] = "IDLE";
    SessionState["IN_GROUP"] = "IN_GROUP";
    SessionState["PROCESSING_EXPENSE"] = "PROCESSING_EXPENSE";
    SessionState["TRANSFERRING_FILE"] = "TRANSFERRING_FILE";
})(SessionState || (SessionState = {}));
// ============================================================================
// Server
// ============================================================================
const TCP_PORT = 54000;
const WS_PORT = 54001;
const RECEIPT_DIR = path.join(__dirname, '..', 'receipts');
const CHUNK_SIZE = 65536;
// Services (OOP - matches proposal slide 8)
const logger = new Logger_1.Logger('server.log');
const authService = new AuthService_1.AuthService();
const groupService = new GroupService_1.GroupService();
const expenseService = new ExpenseService_1.ExpenseService();
const settlementService = new SettlementService_1.SettlementService(expenseService, authService);
// Session tracking
const sessions = new Map();
let sessionCounter = 0;
// ============================================================================
// State transition helper
// ============================================================================
/**
 * Updates session.state and logs it — used whenever REQ-SYS-060 says we transition.
 * @param session - whose state
 * @param newState - where we're going
 * @param trigger - why (usually command name + details for debugging)
 */
function transitionState(session, newState, trigger) {
    const from = session.state;
    session.state = newState;
    logger.logStateTransition(from, newState, `${trigger} [user=${session.userEmail}]`);
}
// ============================================================================
// Send response helpers
// ============================================================================
/**
 * Low level send — websocket gets JSON string, TCP gets serialized DataPacket.
 * @param data - should have command, status, payload fields (kinda loose)
 */
function sendToSession(session, data) {
    if (session.type === 'ws' && session.wsSocket && session.wsSocket.readyState === ws_1.WebSocket.OPEN) {
        session.wsSocket.send(JSON.stringify(data));
    }
    else if (session.type === 'tcp' && session.tcpSocket) {
        const pkt = new DataPacket_1.DataPacket();
        pkt.header.command = data.command;
        pkt.header.status = data.status || DataPacket_1.StatusCode.OK;
        pkt.header.sender = 'server';
        if (data.payload)
            pkt.setPayload(typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload));
        const buf = pkt.serialize();
        session.tcpSocket.write(buf);
        logger.logTransmit(pkt, session.id);
    }
}
/** Wrapper around sendToSession for success-ish responses */
function sendResponse(session, command, status, payload) {
    sendToSession(session, { command, status, payload });
}
/** Error payload always { error: message } */
function sendError(session, command, status, message) {
    sendResponse(session, command, status, { error: message });
}
// ============================================================================
// Command Handlers
// ============================================================================
/**
 * CMD_LOGIN — checks password, fills session if good. Not a state transition per spec.
 * @param params - email, password from payload
 */
function handleLogin(session, params) {
    const email = params.email || '';
    const password = params.password || '';
    const result = authService.login(email, password);
    if (!result.success) {
        sendError(session, DataPacket_1.CommandType.CMD_LOGIN, DataPacket_1.StatusCode.UNAUTHORIZED, result.message);
        logger.warn(`Failed login: ${email}`);
        return;
    }
    // NOT a state transition (REQ-SYS-060)
    session.authenticated = true;
    session.userEmail = email;
    session.userName = result.name || email;
    session.token = result.token || '';
    logger.info(`User logged in: ${email} (${session.id})`);
    sendResponse(session, DataPacket_1.CommandType.CMD_LOGIN, DataPacket_1.StatusCode.OK, {
        token: result.token, name: result.name, message: 'Login successful',
    });
}
/** CMD_REGISTER — new account, params need email password name */
function handleRegister(session, params) {
    const result = authService.register(params.email || '', params.password || '', params.name || '');
    if (!result.success) {
        sendError(session, DataPacket_1.CommandType.CMD_REGISTER, DataPacket_1.StatusCode.CONFLICT, result.message);
        return;
    }
    logger.info(`User registered: ${params.email}`);
    sendResponse(session, DataPacket_1.CommandType.CMD_REGISTER, DataPacket_1.StatusCode.CREATED, { message: result.message });
}
/** CMD_LOGOUT — clears session fields and resets state to IDLE */
function handleLogout(session) {
    logger.info(`User logged out: ${session.userEmail}`);
    session.authenticated = false;
    session.userEmail = '';
    session.token = '';
    session.state = SessionState.IDLE;
    session.currentGroupId = '';
    sendResponse(session, DataPacket_1.CommandType.CMD_LOGOUT, DataPacket_1.StatusCode.OK, { message: 'Logged out' });
}
/** CMD_CREATE_GROUP — params.name required */
function handleCreateGroup(session, params) {
    if (!params.name) {
        sendError(session, DataPacket_1.CommandType.CMD_CREATE_GROUP, DataPacket_1.StatusCode.BAD_REQUEST, 'Missing group name');
        return;
    }
    const group = groupService.createGroup(params.name, session.userEmail);
    logger.info(`Group created: ${group.name} (${group.id}) by ${session.userEmail}`);
    sendResponse(session, DataPacket_1.CommandType.CMD_CREATE_GROUP, DataPacket_1.StatusCode.CREATED, {
        groupId: group.id, name: group.name, message: 'Group created',
    });
}
/** CMD_JOIN_GROUP — params.groupId */
function handleJoinGroup(session, params) {
    const result = groupService.joinGroup(params.groupId || '', session.userEmail);
    if (!result.success) {
        sendError(session, DataPacket_1.CommandType.CMD_JOIN_GROUP, DataPacket_1.StatusCode.NOT_FOUND, result.message);
        return;
    }
    logger.info(`${session.userEmail} joined ${result.group.name}`);
    sendResponse(session, DataPacket_1.CommandType.CMD_JOIN_GROUP, DataPacket_1.StatusCode.OK, {
        groupId: result.group.id, name: result.group.name, message: 'Joined group',
    });
}
/** CMD_LIST_GROUPS — groups current user belongs to */
function handleListGroups(session) {
    const groups = groupService.getUserGroups(session.userEmail);
    sendResponse(session, DataPacket_1.CommandType.CMD_LIST_GROUPS, DataPacket_1.StatusCode.OK, {
        count: groups.length,
        groups: groups.map(g => ({ id: g.id, name: g.name, memberCount: g.members.size })),
    });
}
/**
 * CMD_SELECT_GROUP — sets currentGroupId + transitions to IN_GROUP if member.
 */
function handleSelectGroup(session, params) {
    const groupId = params.groupId || '';
    if (!groupService.isMember(groupId, session.userEmail)) {
        sendError(session, DataPacket_1.CommandType.CMD_SELECT_GROUP, DataPacket_1.StatusCode.FORBIDDEN, 'Not a member of this group');
        return;
    }
    const group = groupService.getGroup(groupId);
    session.currentGroupId = groupId;
    // STATE TRANSITION: IDLE -> IN_GROUP
    transitionState(session, SessionState.IN_GROUP, `CMD_SELECT_GROUP groupId=${groupId}`);
    sendResponse(session, DataPacket_1.CommandType.CMD_SELECT_GROUP, DataPacket_1.StatusCode.OK, {
        groupId, name: group.name, message: 'Group selected',
    });
}
/** CMD_LEAVE_GROUP — remove user from group membership; clear session; back to IDLE */
function handleLeaveGroup(session) {
    if (!session.currentGroupId) {
        sendError(session, DataPacket_1.CommandType.CMD_LEAVE_GROUP, DataPacket_1.StatusCode.BAD_REQUEST, 'No group selected');
        return;
    }
    const prev = session.currentGroupId;
    const result = groupService.quitGroup(prev, session.userEmail);
    if (!result.success) {
        sendError(session, DataPacket_1.CommandType.CMD_LEAVE_GROUP, DataPacket_1.StatusCode.BAD_REQUEST, result.message);
        return;
    }
    session.currentGroupId = '';
    transitionState(session, SessionState.IDLE, `CMD_LEAVE_GROUP quit ${prev}`);
    sendResponse(session, DataPacket_1.CommandType.CMD_LEAVE_GROUP, DataPacket_1.StatusCode.OK, { message: result.message });
}
/** CMD_GROUP_MEMBERS — needs a group selected first */
function handleGroupMembers(session) {
    if (!session.currentGroupId) {
        sendError(session, DataPacket_1.CommandType.CMD_GROUP_MEMBERS, DataPacket_1.StatusCode.BAD_REQUEST, 'No group selected');
        return;
    }
    const group = groupService.getGroup(session.currentGroupId);
    if (!group) {
        sendError(session, DataPacket_1.CommandType.CMD_GROUP_MEMBERS, DataPacket_1.StatusCode.NOT_FOUND, 'Group not found');
        return;
    }
    const members = Array.from(group.members).map(email => {
        const user = authService.getUser(email);
        return { email, name: user?.name || email };
    });
    sendResponse(session, DataPacket_1.CommandType.CMD_GROUP_MEMBERS, DataPacket_1.StatusCode.OK, { count: members.length, members });
}
/**
 * CMD_ADD_EXPENSE — amount, description, optional splitWith comma list.
 * Goes PROCESSING_EXPENSE then back to IN_GROUP.
 */
function handleAddExpense(session, params) {
    if (!session.currentGroupId) {
        sendError(session, DataPacket_1.CommandType.CMD_ADD_EXPENSE, DataPacket_1.StatusCode.BAD_REQUEST, 'No group selected');
        return;
    }
    // STATE TRANSITION: -> PROCESSING_EXPENSE
    transitionState(session, SessionState.PROCESSING_EXPENSE, 'CMD_ADD_EXPENSE');
    const amount = parseFloat(params.amount || '0');
    const description = params.description || '';
    if (!amount || !description) {
        transitionState(session, SessionState.IN_GROUP, 'ADD_EXPENSE_FAILED');
        sendError(session, DataPacket_1.CommandType.CMD_ADD_EXPENSE, DataPacket_1.StatusCode.BAD_REQUEST, 'Missing amount or description');
        return;
    }
    const cents = Math.round(amount * 100);
    let splitWith = [];
    if (params.splitWith && typeof params.splitWith === 'string' && params.splitWith.length > 0) {
        splitWith = params.splitWith.split(',').filter((s) => s.length > 0);
    }
    if (splitWith.length === 0) {
        const group = groupService.getGroup(session.currentGroupId);
        if (group)
            splitWith = Array.from(group.members);
    }
    const expense = expenseService.addExpense(session.currentGroupId, session.userEmail, cents, description, splitWith);
    logger.info(`Expense added: $${(cents / 100).toFixed(2)} by ${session.userEmail} in ${session.currentGroupId}`);
    // STATE TRANSITION: -> back to IN_GROUP
    transitionState(session, SessionState.IN_GROUP, `ADD_EXPENSE_COMPLETE id=${expense.id}`);
    sendResponse(session, DataPacket_1.CommandType.CMD_ADD_EXPENSE, DataPacket_1.StatusCode.CREATED, {
        expenseId: expense.id, message: 'Expense added successfully',
    });
}
/** CMD_LIST_EXPENSES — formatted list for current group */
function handleListExpenses(session) {
    if (!session.currentGroupId) {
        sendError(session, DataPacket_1.CommandType.CMD_LIST_EXPENSES, DataPacket_1.StatusCode.BAD_REQUEST, 'No group selected');
        return;
    }
    const expenses = expenseService.getGroupExpenses(session.currentGroupId);
    const formatted = expenses.map(e => {
        const user = authService.getUser(e.payer);
        return {
            id: e.id,
            payer: user?.name || e.payer,
            payerEmail: e.payer,
            amountCents: e.amountCents,
            amount: `$${(e.amountCents / 100).toFixed(2)}`,
            description: e.description,
        };
    });
    sendResponse(session, DataPacket_1.CommandType.CMD_LIST_EXPENSES, DataPacket_1.StatusCode.OK, { count: formatted.length, expenses: formatted });
}
/** CMD_GET_BALANCES — uses SettlementService formatting */
function handleGetBalances(session) {
    if (!session.currentGroupId) {
        sendError(session, DataPacket_1.CommandType.CMD_GET_BALANCES, DataPacket_1.StatusCode.BAD_REQUEST, 'No group selected');
        return;
    }
    const group = groupService.getGroup(session.currentGroupId);
    const balances = settlementService.getFormattedBalances(session.currentGroupId, group.members);
    sendResponse(session, DataPacket_1.CommandType.CMD_GET_BALANCES, DataPacket_1.StatusCode.OK, { count: balances.length, balances });
}
/** CMD_GET_SETTLEMENTS — who pays who simplified */
function handleGetSettlements(session) {
    if (!session.currentGroupId) {
        sendError(session, DataPacket_1.CommandType.CMD_GET_SETTLEMENTS, DataPacket_1.StatusCode.BAD_REQUEST, 'No group selected');
        return;
    }
    const group = groupService.getGroup(session.currentGroupId);
    const settlements = settlementService.getSettlementPlan(session.currentGroupId, group.members);
    sendResponse(session, DataPacket_1.CommandType.CMD_GET_SETTLEMENTS, DataPacket_1.StatusCode.OK, { count: settlements.length, settlements });
}
/**
 * CMD_REQUEST_RECEIPT — reads file from receipts folder, streams chunks as CMD_FILE_DATA.
 * Kinda blocks the event loop bc sync fs (would fix in real app).
 */
function handleRequestReceipt(session, params) {
    const filename = params.filename || '';
    if (!filename) {
        sendError(session, DataPacket_1.CommandType.CMD_REQUEST_RECEIPT, DataPacket_1.StatusCode.BAD_REQUEST, 'Missing filename');
        return;
    }
    const filepath = path.join(RECEIPT_DIR, filename);
    if (!fs.existsSync(filepath)) {
        sendError(session, DataPacket_1.CommandType.CMD_REQUEST_RECEIPT, DataPacket_1.StatusCode.NOT_FOUND, `File not found: ${filename}`);
        return;
    }
    // STATE TRANSITION: -> TRANSFERRING_FILE
    transitionState(session, SessionState.TRANSFERRING_FILE, `CMD_REQUEST_RECEIPT file=${filename}`);
    const stats = fs.statSync(filepath);
    const fileSize = stats.size;
    logger.info(`Starting file transfer: ${filename} (${fileSize} bytes) to ${session.userEmail}`);
    // For WebSocket clients, send file as base64 chunks
    sendResponse(session, DataPacket_1.CommandType.CMD_FILE_HEADER, DataPacket_1.StatusCode.OK, { filename, size: fileSize });
    const fileBuffer = fs.readFileSync(filepath);
    let offset = 0;
    while (offset < fileSize) {
        const end = Math.min(offset + CHUNK_SIZE, fileSize);
        const chunk = fileBuffer.slice(offset, end);
        sendToSession(session, {
            command: DataPacket_1.CommandType.CMD_FILE_DATA,
            status: DataPacket_1.StatusCode.OK,
            payload: { data: chunk.toString('base64'), offset, size: chunk.length },
        });
        offset = end;
    }
    sendResponse(session, DataPacket_1.CommandType.CMD_FILE_COMPLETE, DataPacket_1.StatusCode.OK, { filename, size: fileSize, message: 'Transfer complete' });
    logger.info(`File transfer complete: ${filename} (${fileSize} bytes)`);
    // STATE TRANSITION: -> back
    if (session.currentGroupId) {
        transitionState(session, SessionState.IN_GROUP, 'FILE_TRANSFER_COMPLETE');
    }
    else {
        transitionState(session, SessionState.IDLE, 'FILE_TRANSFER_COMPLETE');
    }
}
/** CMD_ADMIN_STATUS — counts for dashboard */
function handleAdminStatus(session) {
    sendResponse(session, DataPacket_1.CommandType.CMD_ADMIN_STATUS, DataPacket_1.StatusCode.OK, {
        clients: sessions.size,
        users: authService.getUserCount(),
        groups: groupService.getGroupCount(),
        expenses: expenseService.getExpenseCount(),
    });
}
/** CMD_ADMIN_LOGS — tail of in-memory log lines */
function handleAdminLogs(session) {
    const entries = logger.getRecentEntries(30);
    sendResponse(session, DataPacket_1.CommandType.CMD_ADMIN_LOGS, DataPacket_1.StatusCode.OK, { logs: entries });
}
/** CMD_ADMIN_SESSIONS — list connected clients snapshot */
function handleAdminSessions(session) {
    const sessionList = Array.from(sessions.values()).map(s => ({
        id: s.id,
        user: s.authenticated ? s.userEmail : 'unauthenticated',
        name: s.userName || 'anonymous',
        state: s.state,
        group: s.currentGroupId || 'none',
        type: s.type,
    }));
    sendResponse(session, DataPacket_1.CommandType.CMD_ADMIN_SESSIONS, DataPacket_1.StatusCode.OK, { count: sessionList.length, sessions: sessionList });
}
/** CMD_ADMIN_STATES — session state per user for debugging */
function handleAdminStates(session) {
    const states = Array.from(sessions.values()).map(s => ({
        user: s.authenticated ? (s.userName || s.userEmail) : 'anonymous',
        state: s.state,
    }));
    sendResponse(session, DataPacket_1.CommandType.CMD_ADMIN_STATES, DataPacket_1.StatusCode.OK, { count: states.length, states });
}
// ============================================================================
// Command Router
// ============================================================================
/**
 * Main dispatch — checks auth except login/register, then switch on command type.
 * @param params - parsed payload (key=value or from json)
 */
function processCommand(session, command, params) {
    // Auth check (REQ-SYS-080) — only LOGIN and REGISTER allowed without auth
    if (!session.authenticated && command !== DataPacket_1.CommandType.CMD_LOGIN && command !== DataPacket_1.CommandType.CMD_REGISTER) {
        sendError(session, command, DataPacket_1.StatusCode.UNAUTHORIZED, 'Authentication required');
        return;
    }
    switch (command) {
        case DataPacket_1.CommandType.CMD_LOGIN:
            handleLogin(session, params);
            break;
        case DataPacket_1.CommandType.CMD_REGISTER:
            handleRegister(session, params);
            break;
        case DataPacket_1.CommandType.CMD_LOGOUT:
            handleLogout(session);
            break;
        case DataPacket_1.CommandType.CMD_CREATE_GROUP:
            handleCreateGroup(session, params);
            break;
        case DataPacket_1.CommandType.CMD_JOIN_GROUP:
            handleJoinGroup(session, params);
            break;
        case DataPacket_1.CommandType.CMD_LIST_GROUPS:
            handleListGroups(session);
            break;
        case DataPacket_1.CommandType.CMD_SELECT_GROUP:
            handleSelectGroup(session, params);
            break;
        case DataPacket_1.CommandType.CMD_LEAVE_GROUP:
            handleLeaveGroup(session);
            break;
        case DataPacket_1.CommandType.CMD_GROUP_MEMBERS:
            handleGroupMembers(session);
            break;
        case DataPacket_1.CommandType.CMD_ADD_EXPENSE:
            handleAddExpense(session, params);
            break;
        case DataPacket_1.CommandType.CMD_LIST_EXPENSES:
            handleListExpenses(session);
            break;
        case DataPacket_1.CommandType.CMD_GET_BALANCES:
            handleGetBalances(session);
            break;
        case DataPacket_1.CommandType.CMD_GET_SETTLEMENTS:
            handleGetSettlements(session);
            break;
        case DataPacket_1.CommandType.CMD_REQUEST_RECEIPT:
            handleRequestReceipt(session, params);
            break;
        case DataPacket_1.CommandType.CMD_ADMIN_STATUS:
            handleAdminStatus(session);
            break;
        case DataPacket_1.CommandType.CMD_ADMIN_LOGS:
            handleAdminLogs(session);
            break;
        case DataPacket_1.CommandType.CMD_ADMIN_SESSIONS:
            handleAdminSessions(session);
            break;
        case DataPacket_1.CommandType.CMD_ADMIN_STATES:
            handleAdminStates(session);
            break;
        default:
            sendError(session, DataPacket_1.CommandType.CMD_ERROR, DataPacket_1.StatusCode.BAD_REQUEST, 'Unknown command');
            break;
    }
}
// ============================================================================
// TCP Server (REQ-COM-010)
// ============================================================================
/**
 * Raw TCP server — buffers until full packets (140 + payload), then deserialize + processCommand.
 * Each socket gets its own ClientSession in the sessions map.
 */
const tcpServer = net.createServer((socket) => {
    const sessionId = `tcp_${++sessionCounter}_${socket.remoteAddress}:${socket.remotePort}`;
    const session = {
        id: sessionId, authenticated: false, userEmail: '', userName: '', token: '',
        state: SessionState.IDLE, currentGroupId: '', type: 'tcp', tcpSocket: socket,
        tcpBuffer: Buffer.alloc(0),
    };
    sessions.set(sessionId, session);
    logger.info(`TCP client connected: ${sessionId}`);
    socket.on('data', (data) => {
        session.tcpBuffer = Buffer.concat([session.tcpBuffer, data]);
        // Process complete packets
        while (session.tcpBuffer.length >= 140) {
            const payloadLen = session.tcpBuffer.readUInt32LE(4);
            const totalLen = 140 + payloadLen;
            if (session.tcpBuffer.length < totalLen)
                break;
            const pktData = session.tcpBuffer.slice(0, totalLen);
            session.tcpBuffer = session.tcpBuffer.slice(totalLen);
            const pkt = DataPacket_1.DataPacket.deserialize(pktData);
            if (pkt) {
                logger.logReceive(pkt, sessionId);
                const params = (0, DataPacket_1.parsePayload)(pkt.getPayloadString());
                processCommand(session, pkt.header.command, params);
            }
        }
    });
    socket.on('close', () => {
        logger.info(`TCP client disconnected: ${sessionId} (${session.userEmail})`);
        sessions.delete(sessionId);
    });
    socket.on('error', (err) => {
        logger.error(`TCP error ${sessionId}: ${err.message}`);
        sessions.delete(sessionId);
    });
});
// ============================================================================
// WebSocket Bridge (for React clients)
// ============================================================================
/**
 * WS on 54001 — messages are JSON with { command, payload }. Easier for React than binary TCP.
 */
const wsServer = new ws_1.WebSocketServer({ port: WS_PORT });
wsServer.on('connection', (ws) => {
    const sessionId = `ws_${++sessionCounter}`;
    const session = {
        id: sessionId, authenticated: false, userEmail: '', userName: '', token: '',
        state: SessionState.IDLE, currentGroupId: '', type: 'ws', wsSocket: ws,
    };
    sessions.set(sessionId, session);
    logger.info(`WebSocket client connected: ${sessionId}`);
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            processCommand(session, msg.command, msg.payload || msg);
        }
        catch (err) {
            sendError(session, DataPacket_1.CommandType.CMD_ERROR, DataPacket_1.StatusCode.BAD_REQUEST, 'Invalid message format');
        }
    });
    ws.on('close', () => {
        logger.info(`WebSocket client disconnected: ${sessionId} (${session.userEmail})`);
        sessions.delete(sessionId);
    });
    ws.on('error', (err) => {
        logger.error(`WebSocket error ${sessionId}: ${err.message}`);
        sessions.delete(sessionId);
    });
});
// ============================================================================
// Start
// ============================================================================
// Make sure receipt upload folder exists on startup
if (!fs.existsSync(RECEIPT_DIR)) {
    fs.mkdirSync(RECEIPT_DIR, { recursive: true });
}
tcpServer.listen(TCP_PORT, () => {
    logger.info(`=== Expense Splitter Server ===`);
    logger.info(`TCP server listening on port ${TCP_PORT}`);
    logger.info(`WebSocket bridge listening on port ${WS_PORT}`);
    logger.info(`Receipt directory: ${RECEIPT_DIR}`);
    logger.info(`Demo users: jino@test.com, yashika@test.com, alice@test.com, bob@test.com (pass: pass123)`);
    console.log('\n========================================');
    console.log('  EXPENSE SPLITTER SERVER');
    console.log(`  TCP Port: ${TCP_PORT}`);
    console.log(`  WebSocket Port: ${WS_PORT}`);
    console.log('  Demo users: jino/yashika/alice/bob @test.com');
    console.log('  Password: pass123');
    console.log('========================================\n');
});
