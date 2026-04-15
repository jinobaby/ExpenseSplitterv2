"use strict";
/**
 * @file DataPacket.ts
 * @brief Data packet structure for client-server communication.
 * @details All data transferred between Client and Server uses this pre-defined
 *          packet structure (REQ-SYS-020). The packet contains a dynamically
 *          allocated payload buffer (REQ-SYS-030).
 * @author Jino Baby, Yashika
 * @version 1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataPacket = exports.StatusCode = exports.CommandType = void 0;
exports.buildPayload = buildPayload;
exports.parsePayload = parsePayload;
/** Command types for the protocol */
var CommandType;
(function (CommandType) {
    // Authentication (not state transitions)
    CommandType[CommandType["CMD_LOGIN"] = 1] = "CMD_LOGIN";
    CommandType[CommandType["CMD_REGISTER"] = 2] = "CMD_REGISTER";
    CommandType[CommandType["CMD_LOGOUT"] = 3] = "CMD_LOGOUT";
    // Group Management
    CommandType[CommandType["CMD_CREATE_GROUP"] = 16] = "CMD_CREATE_GROUP";
    CommandType[CommandType["CMD_JOIN_GROUP"] = 17] = "CMD_JOIN_GROUP";
    CommandType[CommandType["CMD_LIST_GROUPS"] = 18] = "CMD_LIST_GROUPS";
    CommandType[CommandType["CMD_SELECT_GROUP"] = 19] = "CMD_SELECT_GROUP";
    CommandType[CommandType["CMD_LEAVE_GROUP"] = 20] = "CMD_LEAVE_GROUP";
    CommandType[CommandType["CMD_GROUP_MEMBERS"] = 21] = "CMD_GROUP_MEMBERS";
    // Expense Management
    CommandType[CommandType["CMD_ADD_EXPENSE"] = 32] = "CMD_ADD_EXPENSE";
    CommandType[CommandType["CMD_LIST_EXPENSES"] = 33] = "CMD_LIST_EXPENSES";
    // Balance & Settlement
    CommandType[CommandType["CMD_GET_BALANCES"] = 48] = "CMD_GET_BALANCES";
    CommandType[CommandType["CMD_GET_SETTLEMENTS"] = 49] = "CMD_GET_SETTLEMENTS";
    // File Transfer (REQ-SYS-070)
    CommandType[CommandType["CMD_REQUEST_RECEIPT"] = 64] = "CMD_REQUEST_RECEIPT";
    CommandType[CommandType["CMD_FILE_HEADER"] = 65] = "CMD_FILE_HEADER";
    CommandType[CommandType["CMD_FILE_DATA"] = 66] = "CMD_FILE_DATA";
    CommandType[CommandType["CMD_FILE_COMPLETE"] = 67] = "CMD_FILE_COMPLETE";
    // Admin
    CommandType[CommandType["CMD_ADMIN_STATUS"] = 80] = "CMD_ADMIN_STATUS";
    CommandType[CommandType["CMD_ADMIN_LOGS"] = 81] = "CMD_ADMIN_LOGS";
    CommandType[CommandType["CMD_ADMIN_SESSIONS"] = 82] = "CMD_ADMIN_SESSIONS";
    CommandType[CommandType["CMD_ADMIN_STATES"] = 83] = "CMD_ADMIN_STATES";
    // General
    CommandType[CommandType["CMD_ERROR"] = 255] = "CMD_ERROR";
    CommandType[CommandType["CMD_ACK"] = 254] = "CMD_ACK";
})(CommandType || (exports.CommandType = CommandType = {}));
/** Status codes for responses */
var StatusCode;
(function (StatusCode) {
    StatusCode[StatusCode["OK"] = 200] = "OK";
    StatusCode[StatusCode["CREATED"] = 201] = "CREATED";
    StatusCode[StatusCode["BAD_REQUEST"] = 400] = "BAD_REQUEST";
    StatusCode[StatusCode["UNAUTHORIZED"] = 401] = "UNAUTHORIZED";
    StatusCode[StatusCode["FORBIDDEN"] = 403] = "FORBIDDEN";
    StatusCode[StatusCode["NOT_FOUND"] = 404] = "NOT_FOUND";
    StatusCode[StatusCode["CONFLICT"] = 409] = "CONFLICT";
    StatusCode[StatusCode["ERROR"] = 500] = "ERROR";
})(StatusCode || (exports.StatusCode = StatusCode = {}));
/**
 * @class DataPacket
 * @brief Represents a complete data packet with header and dynamic payload.
 * @details The payload is a dynamically allocated Buffer (REQ-SYS-030),
 *          allowing variable-length data transmission.
 */
class DataPacket {
    constructor() {
        this.header = {
            command: CommandType.CMD_ERROR,
            status: StatusCode.OK,
            payloadLength: 0,
            sender: '',
            token: '',
        };
        this.payload = null;
    }
    /** Set the payload from a string - allocates new Buffer dynamically */
    setPayload(data) {
        this.payload = Buffer.from(data, 'utf-8');
        this.header.payloadLength = this.payload.length;
    }
    /** Set the payload from raw binary data */
    setPayloadRaw(data) {
        this.payload = Buffer.alloc(data.length);
        data.copy(this.payload);
        this.header.payloadLength = this.payload.length;
    }
    /** Get payload as string */
    getPayloadString() {
        if (this.payload && this.header.payloadLength > 0) {
            return this.payload.toString('utf-8');
        }
        return '';
    }
    /** Serialize to Buffer for TCP transmission */
    serialize() {
        const headerBuf = Buffer.alloc(140);
        headerBuf.writeUInt16LE(this.header.command, 0);
        headerBuf.writeUInt16LE(this.header.status, 2);
        headerBuf.writeUInt32LE(this.header.payloadLength, 4);
        headerBuf.write(this.header.sender.substring(0, 63), 8, 64, 'utf-8');
        headerBuf.write(this.header.token.substring(0, 63), 72, 64, 'utf-8');
        if (this.payload && this.header.payloadLength > 0) {
            return Buffer.concat([headerBuf, this.payload]);
        }
        return headerBuf;
    }
    /** Deserialize from raw Buffer */
    static deserialize(data) {
        if (data.length < 140)
            return null;
        const pkt = new DataPacket();
        pkt.header.command = data.readUInt16LE(0);
        pkt.header.status = data.readUInt16LE(2);
        pkt.header.payloadLength = data.readUInt32LE(4);
        pkt.header.sender = data.toString('utf-8', 8, 72).replace(/\0/g, '');
        pkt.header.token = data.toString('utf-8', 72, 136).replace(/\0/g, '');
        if (pkt.header.payloadLength > 0) {
            if (data.length < 140 + pkt.header.payloadLength)
                return null;
            pkt.payload = Buffer.alloc(pkt.header.payloadLength);
            data.copy(pkt.payload, 0, 140, 140 + pkt.header.payloadLength);
        }
        return pkt;
    }
    /** Convert to JSON for WebSocket transmission */
    toJSON() {
        return {
            command: this.header.command,
            status: this.header.status,
            sender: this.header.sender,
            payload: this.getPayloadString(),
        };
    }
    /** Create from JSON (WebSocket message) */
    static fromJSON(json) {
        const pkt = new DataPacket();
        pkt.header.command = json.command;
        pkt.header.status = json.status || StatusCode.OK;
        pkt.header.sender = json.sender || '';
        pkt.header.token = json.token || '';
        if (json.payload) {
            pkt.setPayload(json.payload);
        }
        return pkt;
    }
    /** Get human-readable log string */
    toLogString() {
        const cmdName = CommandType[this.header.command] || `0x${this.header.command.toString(16)}`;
        return `[CMD=${cmdName} STATUS=${this.header.status} LEN=${this.header.payloadLength} FROM=${this.header.sender}]`;
    }
}
exports.DataPacket = DataPacket;
/** Build a key=value payload string */
function buildPayload(pairs) {
    return Object.entries(pairs).map(([k, v]) => `${k}=${v}`).join('&');
}
/** Parse a key=value payload string */
function parsePayload(payload) {
    const result = {};
    if (!payload)
        return result;
    payload.split('&').forEach(pair => {
        const eq = pair.indexOf('=');
        if (eq !== -1) {
            result[pair.substring(0, eq)] = pair.substring(eq + 1);
        }
    });
    return result;
}
