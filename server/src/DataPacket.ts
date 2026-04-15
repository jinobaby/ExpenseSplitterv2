/**
 * @file DataPacket.ts
 * @brief Data packet structure for client-server communication.
 * @details All data transferred between Client and Server uses this pre-defined
 *          packet structure (REQ-SYS-020). The packet contains a dynamically
 *          allocated payload buffer (REQ-SYS-030).
 * @author Jino Baby, Yashika
 * @version 1.0
 */

/** Command types for the protocol */
export enum CommandType {
    // Authentication (not state transitions)
    CMD_LOGIN = 0x0001,
    CMD_REGISTER = 0x0002,
    CMD_LOGOUT = 0x0003,

    // Group Management
    CMD_CREATE_GROUP = 0x0010,
    CMD_JOIN_GROUP = 0x0011,
    CMD_LIST_GROUPS = 0x0012,
    CMD_SELECT_GROUP = 0x0013,
    CMD_LEAVE_GROUP = 0x0014,
    CMD_GROUP_MEMBERS = 0x0015,

    // Expense Management
    CMD_ADD_EXPENSE = 0x0020,
    CMD_LIST_EXPENSES = 0x0021,

    // Balance & Settlement
    CMD_GET_BALANCES = 0x0030,
    CMD_GET_SETTLEMENTS = 0x0031,

    // File Transfer (REQ-SYS-070)
    CMD_REQUEST_RECEIPT = 0x0040,
    CMD_FILE_HEADER = 0x0041,
    CMD_FILE_DATA = 0x0042,
    CMD_FILE_COMPLETE = 0x0043,

    // Admin
    CMD_ADMIN_STATUS = 0x0050,
    CMD_ADMIN_LOGS = 0x0051,
    CMD_ADMIN_SESSIONS = 0x0052,
    CMD_ADMIN_STATES = 0x0053,

    // General
    CMD_ERROR = 0x00FF,
    CMD_ACK = 0x00FE,
}

/** Status codes for responses */
export enum StatusCode {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    ERROR = 500,
}

/** Fixed-size header structure */
export interface PacketHeader {
    command: CommandType;
    status: StatusCode;
    payloadLength: number;
    sender: string;
    token: string;
}

/**
 * @class DataPacket
 * @brief Represents a complete data packet with header and dynamic payload.
 * @details The payload is a dynamically allocated Buffer (REQ-SYS-030),
 *          allowing variable-length data transmission.
 */
export class DataPacket {
    public header: PacketHeader;
    public payload: Buffer | null; // Dynamically allocated (REQ-SYS-030)

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
    setPayload(data: string): void {
        this.payload = Buffer.from(data, 'utf-8');
        this.header.payloadLength = this.payload.length;
    }

    /** Set the payload from raw binary data */
    setPayloadRaw(data: Buffer): void {
        this.payload = Buffer.alloc(data.length);
        data.copy(this.payload);
        this.header.payloadLength = this.payload.length;
    }

    /** Get payload as string */
    getPayloadString(): string {
        if (this.payload && this.header.payloadLength > 0) {
            return this.payload.toString('utf-8');
        }
        return '';
    }

    /** Serialize to Buffer for TCP transmission */
    serialize(): Buffer {
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
    static deserialize(data: Buffer): DataPacket | null {
        if (data.length < 140) return null;

        const pkt = new DataPacket();
        pkt.header.command = data.readUInt16LE(0);
        pkt.header.status = data.readUInt16LE(2);
        pkt.header.payloadLength = data.readUInt32LE(4);
        pkt.header.sender = data.toString('utf-8', 8, 72).replace(/\0/g, '');
        pkt.header.token = data.toString('utf-8', 72, 136).replace(/\0/g, '');

        if (pkt.header.payloadLength > 0) {
            if (data.length < 140 + pkt.header.payloadLength) return null;
            pkt.payload = Buffer.alloc(pkt.header.payloadLength);
            data.copy(pkt.payload, 0, 140, 140 + pkt.header.payloadLength);
        }

        return pkt;
    }

    /** Convert to JSON for WebSocket transmission */
    toJSON(): object {
        return {
            command: this.header.command,
            status: this.header.status,
            sender: this.header.sender,
            payload: this.getPayloadString(),
        };
    }

    /** Create from JSON (WebSocket message) */
    static fromJSON(json: any): DataPacket {
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
    toLogString(): string {
        const cmdName = CommandType[this.header.command] || `0x${this.header.command.toString(16)}`;
        return `[CMD=${cmdName} STATUS=${this.header.status} LEN=${this.header.payloadLength} FROM=${this.header.sender}]`;
    }
}

/** Build a key=value payload string */
export function buildPayload(pairs: Record<string, string>): string {
    return Object.entries(pairs).map(([k, v]) => `${k}=${v}`).join('&');
}

/** Parse a key=value payload string */
export function parsePayload(payload: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!payload) return result;
    payload.split('&').forEach(pair => {
        const eq = pair.indexOf('=');
        if (eq !== -1) {
            result[pair.substring(0, eq)] = pair.substring(eq + 1);
        }
    });
    return result;
}
