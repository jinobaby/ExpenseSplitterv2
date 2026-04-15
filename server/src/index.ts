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

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { DataPacket, CommandType, StatusCode, parsePayload, buildPayload } from './DataPacket';
import { Logger } from './services/Logger';
import { AuthService } from './services/AuthService';
import { GroupService } from './services/GroupService';
import { ExpenseService } from './services/ExpenseService';
import { SettlementService } from './services/SettlementService';

// ============================================================================
// State Machine (REQ-SYS-060)
// ============================================================================

enum SessionState {
    IDLE = 'IDLE',
    IN_GROUP = 'IN_GROUP',
    PROCESSING_EXPENSE = 'PROCESSING_EXPENSE',
    TRANSFERRING_FILE = 'TRANSFERRING_FILE',
}

interface ClientSession {
    id: string;
    authenticated: boolean;
    userEmail: string;
    userName: string;
    token: string;
    state: SessionState;
    currentGroupId: string;
    type: 'tcp' | 'ws';
    tcpSocket?: net.Socket;
    wsSocket?: WebSocket;
    tcpBuffer?: Buffer;
}

// ============================================================================
// Server
// ============================================================================

const TCP_PORT = 54000;
const WS_PORT = 54001;
const RECEIPT_DIR = path.join(__dirname, '..', 'receipts');
const CHUNK_SIZE = 65536;

// Services (OOP - matches proposal slide 8)
const logger = new Logger('server.log');
const authService = new AuthService();
const groupService = new GroupService();
const expenseService = new ExpenseService();
const settlementService = new SettlementService(expenseService, authService);

// Session tracking
const sessions = new Map<string, ClientSession>();
let sessionCounter = 0;

// ============================================================================
// State transition helper
// ============================================================================

function transitionState(session: ClientSession, newState: SessionState, trigger: string): void {
    const from = session.state;
    session.state = newState;
    logger.logStateTransition(from, newState, `${trigger} [user=${session.userEmail}]`);
}

// ============================================================================
// Send response helpers
// ============================================================================

function sendToSession(session: ClientSession, data: any): void {
    if (session.type === 'ws' && session.wsSocket && session.wsSocket.readyState === WebSocket.OPEN) {
        session.wsSocket.send(JSON.stringify(data));
    } else if (session.type === 'tcp' && session.tcpSocket) {
        const pkt = new DataPacket();
        pkt.header.command = data.command;
        pkt.header.status = data.status || StatusCode.OK;
        pkt.header.sender = 'server';
        if (data.payload) pkt.setPayload(typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload));
        const buf = pkt.serialize();
        session.tcpSocket.write(buf);
        logger.logTransmit(pkt, session.id);
    }
}

function sendResponse(session: ClientSession, command: CommandType, status: StatusCode, payload: any): void {
    sendToSession(session, { command, status, payload });
}

function sendError(session: ClientSession, command: CommandType, status: StatusCode, message: string): void {
    sendResponse(session, command, status, { error: message });
}

// ============================================================================
// Command Handlers
// ============================================================================

function handleLogin(session: ClientSession, params: any): void {
    const email = params.email || '';
    const password = params.password || '';
    const result = authService.login(email, password);

    if (!result.success) {
        sendError(session, CommandType.CMD_LOGIN, StatusCode.UNAUTHORIZED, result.message);
        logger.warn(`Failed login: ${email}`);
        return;
    }

    // NOT a state transition (REQ-SYS-060)
    session.authenticated = true;
    session.userEmail = email;
    session.userName = result.name || email;
    session.token = result.token || '';

    logger.info(`User logged in: ${email} (${session.id})`);
    sendResponse(session, CommandType.CMD_LOGIN, StatusCode.OK, {
        token: result.token, name: result.name, message: 'Login successful',
    });
}

function handleRegister(session: ClientSession, params: any): void {
    const result = authService.register(params.email || '', params.password || '', params.name || '');
    if (!result.success) {
        sendError(session, CommandType.CMD_REGISTER, StatusCode.CONFLICT, result.message);
        return;
    }
    logger.info(`User registered: ${params.email}`);
    sendResponse(session, CommandType.CMD_REGISTER, StatusCode.CREATED, { message: result.message });
}

function handleLogout(session: ClientSession): void {
    logger.info(`User logged out: ${session.userEmail}`);
    session.authenticated = false;
    session.userEmail = '';
    session.token = '';
    session.state = SessionState.IDLE;
    session.currentGroupId = '';
    sendResponse(session, CommandType.CMD_LOGOUT, StatusCode.OK, { message: 'Logged out' });
}

function handleCreateGroup(session: ClientSession, params: any): void {
    if (!params.name) { sendError(session, CommandType.CMD_CREATE_GROUP, StatusCode.BAD_REQUEST, 'Missing group name'); return; }
    const group = groupService.createGroup(params.name, session.userEmail);
    logger.info(`Group created: ${group.name} (${group.id}) by ${session.userEmail}`);
    sendResponse(session, CommandType.CMD_CREATE_GROUP, StatusCode.CREATED, {
        groupId: group.id, name: group.name, message: 'Group created',
    });
}

function handleJoinGroup(session: ClientSession, params: any): void {
    const result = groupService.joinGroup(params.groupId || '', session.userEmail);
    if (!result.success) { sendError(session, CommandType.CMD_JOIN_GROUP, StatusCode.NOT_FOUND, result.message); return; }
    logger.info(`${session.userEmail} joined ${result.group!.name}`);
    sendResponse(session, CommandType.CMD_JOIN_GROUP, StatusCode.OK, {
        groupId: result.group!.id, name: result.group!.name, message: 'Joined group',
    });
}

function handleListGroups(session: ClientSession): void {
    const groups = groupService.getUserGroups(session.userEmail);
    sendResponse(session, CommandType.CMD_LIST_GROUPS, StatusCode.OK, {
        count: groups.length,
        groups: groups.map(g => ({ id: g.id, name: g.name, memberCount: g.members.size })),
    });
}

function handleSelectGroup(session: ClientSession, params: any): void {
    const groupId = params.groupId || '';
    if (!groupService.isMember(groupId, session.userEmail)) {
        sendError(session, CommandType.CMD_SELECT_GROUP, StatusCode.FORBIDDEN, 'Not a member of this group');
        return;
    }
    const group = groupService.getGroup(groupId)!;
    session.currentGroupId = groupId;
    // STATE TRANSITION: IDLE -> IN_GROUP
    transitionState(session, SessionState.IN_GROUP, `CMD_SELECT_GROUP groupId=${groupId}`);
    sendResponse(session, CommandType.CMD_SELECT_GROUP, StatusCode.OK, {
        groupId, name: group.name, message: 'Group selected',
    });
}

function handleLeaveGroup(session: ClientSession): void {
    if (session.state !== SessionState.IN_GROUP && session.state !== SessionState.PROCESSING_EXPENSE) {
        sendError(session, CommandType.CMD_LEAVE_GROUP, StatusCode.BAD_REQUEST, 'Not in a group context');
        return;
    }
    const prev = session.currentGroupId;
    session.currentGroupId = '';
    // STATE TRANSITION: -> IDLE
    transitionState(session, SessionState.IDLE, `CMD_LEAVE_GROUP from ${prev}`);
    sendResponse(session, CommandType.CMD_LEAVE_GROUP, StatusCode.OK, { message: 'Left group context' });
}

function handleGroupMembers(session: ClientSession): void {
    if (!session.currentGroupId) { sendError(session, CommandType.CMD_GROUP_MEMBERS, StatusCode.BAD_REQUEST, 'No group selected'); return; }
    const group = groupService.getGroup(session.currentGroupId);
    if (!group) { sendError(session, CommandType.CMD_GROUP_MEMBERS, StatusCode.NOT_FOUND, 'Group not found'); return; }
    const members = Array.from(group.members).map(email => {
        const user = authService.getUser(email);
        return { email, name: user?.name || email };
    });
    sendResponse(session, CommandType.CMD_GROUP_MEMBERS, StatusCode.OK, { count: members.length, members });
}

function handleAddExpense(session: ClientSession, params: any): void {
    if (!session.currentGroupId) { sendError(session, CommandType.CMD_ADD_EXPENSE, StatusCode.BAD_REQUEST, 'No group selected'); return; }

    // STATE TRANSITION: -> PROCESSING_EXPENSE
    transitionState(session, SessionState.PROCESSING_EXPENSE, 'CMD_ADD_EXPENSE');

    const amount = parseFloat(params.amount || '0');
    const description = params.description || '';
    if (!amount || !description) {
        transitionState(session, SessionState.IN_GROUP, 'ADD_EXPENSE_FAILED');
        sendError(session, CommandType.CMD_ADD_EXPENSE, StatusCode.BAD_REQUEST, 'Missing amount or description');
        return;
    }

    const cents = Math.round(amount * 100);
    let splitWith: string[] = [];
    if (params.splitWith && typeof params.splitWith === 'string' && params.splitWith.length > 0) {
        splitWith = params.splitWith.split(',').filter((s: string) => s.length > 0);
    }
    if (splitWith.length === 0) {
        const group = groupService.getGroup(session.currentGroupId);
        if (group) splitWith = Array.from(group.members);
    }

    const expense = expenseService.addExpense(session.currentGroupId, session.userEmail, cents, description, splitWith);
    logger.info(`Expense added: $${(cents / 100).toFixed(2)} by ${session.userEmail} in ${session.currentGroupId}`);

    // STATE TRANSITION: -> back to IN_GROUP
    transitionState(session, SessionState.IN_GROUP, `ADD_EXPENSE_COMPLETE id=${expense.id}`);
    sendResponse(session, CommandType.CMD_ADD_EXPENSE, StatusCode.CREATED, {
        expenseId: expense.id, message: 'Expense added successfully',
    });
}

function handleListExpenses(session: ClientSession): void {
    if (!session.currentGroupId) { sendError(session, CommandType.CMD_LIST_EXPENSES, StatusCode.BAD_REQUEST, 'No group selected'); return; }
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
    sendResponse(session, CommandType.CMD_LIST_EXPENSES, StatusCode.OK, { count: formatted.length, expenses: formatted });
}

function handleGetBalances(session: ClientSession): void {
    if (!session.currentGroupId) { sendError(session, CommandType.CMD_GET_BALANCES, StatusCode.BAD_REQUEST, 'No group selected'); return; }
    const group = groupService.getGroup(session.currentGroupId)!;
    const balances = settlementService.getFormattedBalances(session.currentGroupId, group.members);
    sendResponse(session, CommandType.CMD_GET_BALANCES, StatusCode.OK, { count: balances.length, balances });
}

function handleGetSettlements(session: ClientSession): void {
    if (!session.currentGroupId) { sendError(session, CommandType.CMD_GET_SETTLEMENTS, StatusCode.BAD_REQUEST, 'No group selected'); return; }
    const group = groupService.getGroup(session.currentGroupId)!;
    const settlements = settlementService.getSettlementPlan(session.currentGroupId, group.members);
    sendResponse(session, CommandType.CMD_GET_SETTLEMENTS, StatusCode.OK, { count: settlements.length, settlements });
}

function handleRequestReceipt(session: ClientSession, params: any): void {
    const filename = params.filename || '';
    if (!filename) { sendError(session, CommandType.CMD_REQUEST_RECEIPT, StatusCode.BAD_REQUEST, 'Missing filename'); return; }

    const filepath = path.join(RECEIPT_DIR, filename);
    if (!fs.existsSync(filepath)) {
        sendError(session, CommandType.CMD_REQUEST_RECEIPT, StatusCode.NOT_FOUND, `File not found: ${filename}`);
        return;
    }

    // STATE TRANSITION: -> TRANSFERRING_FILE
    transitionState(session, SessionState.TRANSFERRING_FILE, `CMD_REQUEST_RECEIPT file=${filename}`);

    const stats = fs.statSync(filepath);
    const fileSize = stats.size;
    logger.info(`Starting file transfer: ${filename} (${fileSize} bytes) to ${session.userEmail}`);

    // For WebSocket clients, send file as base64 chunks
    sendResponse(session, CommandType.CMD_FILE_HEADER, StatusCode.OK, { filename, size: fileSize });

    const fileBuffer = fs.readFileSync(filepath);
    let offset = 0;
    while (offset < fileSize) {
        const end = Math.min(offset + CHUNK_SIZE, fileSize);
        const chunk = fileBuffer.slice(offset, end);
        sendToSession(session, {
            command: CommandType.CMD_FILE_DATA,
            status: StatusCode.OK,
            payload: { data: chunk.toString('base64'), offset, size: chunk.length },
        });
        offset = end;
    }

    sendResponse(session, CommandType.CMD_FILE_COMPLETE, StatusCode.OK, { filename, size: fileSize, message: 'Transfer complete' });
    logger.info(`File transfer complete: ${filename} (${fileSize} bytes)`);

    // STATE TRANSITION: -> back
    if (session.currentGroupId) {
        transitionState(session, SessionState.IN_GROUP, 'FILE_TRANSFER_COMPLETE');
    } else {
        transitionState(session, SessionState.IDLE, 'FILE_TRANSFER_COMPLETE');
    }
}

function handleAdminStatus(session: ClientSession): void {
    sendResponse(session, CommandType.CMD_ADMIN_STATUS, StatusCode.OK, {
        clients: sessions.size,
        users: authService.getUserCount(),
        groups: groupService.getGroupCount(),
        expenses: expenseService.getExpenseCount(),
    });
}

function handleAdminLogs(session: ClientSession): void {
    const entries = logger.getRecentEntries(30);
    sendResponse(session, CommandType.CMD_ADMIN_LOGS, StatusCode.OK, { logs: entries });
}

function handleAdminSessions(session: ClientSession): void {
    const sessionList = Array.from(sessions.values()).map(s => ({
        id: s.id,
        user: s.authenticated ? s.userEmail : 'unauthenticated',
        name: s.userName || 'anonymous',
        state: s.state,
        group: s.currentGroupId || 'none',
        type: s.type,
    }));
    sendResponse(session, CommandType.CMD_ADMIN_SESSIONS, StatusCode.OK, { count: sessionList.length, sessions: sessionList });
}

function handleAdminStates(session: ClientSession): void {
    const states = Array.from(sessions.values()).map(s => ({
        user: s.authenticated ? (s.userName || s.userEmail) : 'anonymous',
        state: s.state,
    }));
    sendResponse(session, CommandType.CMD_ADMIN_STATES, StatusCode.OK, { count: states.length, states });
}

// ============================================================================
// Command Router
// ============================================================================

function processCommand(session: ClientSession, command: CommandType, params: any): void {
    // Auth check (REQ-SYS-080) — only LOGIN and REGISTER allowed without auth
    if (!session.authenticated && command !== CommandType.CMD_LOGIN && command !== CommandType.CMD_REGISTER) {
        sendError(session, command, StatusCode.UNAUTHORIZED, 'Authentication required');
        return;
    }

    switch (command) {
        case CommandType.CMD_LOGIN: handleLogin(session, params); break;
        case CommandType.CMD_REGISTER: handleRegister(session, params); break;
        case CommandType.CMD_LOGOUT: handleLogout(session); break;
        case CommandType.CMD_CREATE_GROUP: handleCreateGroup(session, params); break;
        case CommandType.CMD_JOIN_GROUP: handleJoinGroup(session, params); break;
        case CommandType.CMD_LIST_GROUPS: handleListGroups(session); break;
        case CommandType.CMD_SELECT_GROUP: handleSelectGroup(session, params); break;
        case CommandType.CMD_LEAVE_GROUP: handleLeaveGroup(session); break;
        case CommandType.CMD_GROUP_MEMBERS: handleGroupMembers(session); break;
        case CommandType.CMD_ADD_EXPENSE: handleAddExpense(session, params); break;
        case CommandType.CMD_LIST_EXPENSES: handleListExpenses(session); break;
        case CommandType.CMD_GET_BALANCES: handleGetBalances(session); break;
        case CommandType.CMD_GET_SETTLEMENTS: handleGetSettlements(session); break;
        case CommandType.CMD_REQUEST_RECEIPT: handleRequestReceipt(session, params); break;
        case CommandType.CMD_ADMIN_STATUS: handleAdminStatus(session); break;
        case CommandType.CMD_ADMIN_LOGS: handleAdminLogs(session); break;
        case CommandType.CMD_ADMIN_SESSIONS: handleAdminSessions(session); break;
        case CommandType.CMD_ADMIN_STATES: handleAdminStates(session); break;
        default: sendError(session, CommandType.CMD_ERROR, StatusCode.BAD_REQUEST, 'Unknown command'); break;
    }
}

// ============================================================================
// TCP Server (REQ-COM-010)
// ============================================================================

const tcpServer = net.createServer((socket) => {
    const sessionId = `tcp_${++sessionCounter}_${socket.remoteAddress}:${socket.remotePort}`;
    const session: ClientSession = {
        id: sessionId, authenticated: false, userEmail: '', userName: '', token: '',
        state: SessionState.IDLE, currentGroupId: '', type: 'tcp', tcpSocket: socket,
        tcpBuffer: Buffer.alloc(0),
    };
    sessions.set(sessionId, session);
    logger.info(`TCP client connected: ${sessionId}`);

    socket.on('data', (data: Buffer) => {
        session.tcpBuffer = Buffer.concat([session.tcpBuffer!, data]);

        // Process complete packets
        while (session.tcpBuffer!.length >= 140) {
            const payloadLen = session.tcpBuffer!.readUInt32LE(4);
            const totalLen = 140 + payloadLen;
            if (session.tcpBuffer!.length < totalLen) break;

            const pktData = session.tcpBuffer!.slice(0, totalLen);
            session.tcpBuffer = session.tcpBuffer!.slice(totalLen);

            const pkt = DataPacket.deserialize(pktData);
            if (pkt) {
                logger.logReceive(pkt, sessionId);
                const params = parsePayload(pkt.getPayloadString());
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

const wsServer = new WebSocketServer({ port: WS_PORT });

wsServer.on('connection', (ws: WebSocket) => {
    const sessionId = `ws_${++sessionCounter}`;
    const session: ClientSession = {
        id: sessionId, authenticated: false, userEmail: '', userName: '', token: '',
        state: SessionState.IDLE, currentGroupId: '', type: 'ws', wsSocket: ws,
    };
    sessions.set(sessionId, session);
    logger.info(`WebSocket client connected: ${sessionId}`);

    ws.on('message', (raw: Buffer | string) => {
        try {
            const msg = JSON.parse(raw.toString());
            processCommand(session, msg.command, msg.payload || msg);
        } catch (err) {
            sendError(session, CommandType.CMD_ERROR, StatusCode.BAD_REQUEST, 'Invalid message format');
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

// Create receipts directory
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
