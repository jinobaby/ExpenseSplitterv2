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
export declare enum CommandType {
    CMD_LOGIN = 1,
    CMD_REGISTER = 2,
    CMD_LOGOUT = 3,
    CMD_CREATE_GROUP = 16,
    CMD_JOIN_GROUP = 17,
    CMD_LIST_GROUPS = 18,
    CMD_SELECT_GROUP = 19,
    CMD_LEAVE_GROUP = 20,
    CMD_GROUP_MEMBERS = 21,
    CMD_ADD_EXPENSE = 32,
    CMD_LIST_EXPENSES = 33,
    CMD_GET_BALANCES = 48,
    CMD_GET_SETTLEMENTS = 49,
    CMD_REQUEST_RECEIPT = 64,
    CMD_FILE_HEADER = 65,
    CMD_FILE_DATA = 66,
    CMD_FILE_COMPLETE = 67,
    CMD_ADMIN_STATUS = 80,
    CMD_ADMIN_LOGS = 81,
    CMD_ADMIN_SESSIONS = 82,
    CMD_ADMIN_STATES = 83,
    CMD_ERROR = 255,
    CMD_ACK = 254
}
/** Status codes for responses */
export declare enum StatusCode {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    ERROR = 500
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
export declare class DataPacket {
    header: PacketHeader;
    payload: Buffer | null;
    constructor();
    /** Set the payload from a string - allocates new Buffer dynamically */
    setPayload(data: string): void;
    /** Set the payload from raw binary data */
    setPayloadRaw(data: Buffer): void;
    /** Get payload as string */
    getPayloadString(): string;
    /** Serialize to Buffer for TCP transmission */
    serialize(): Buffer;
    /** Deserialize from raw Buffer */
    static deserialize(data: Buffer): DataPacket | null;
    /** Convert to JSON for WebSocket transmission */
    toJSON(): object;
    /** Create from JSON (WebSocket message) */
    static fromJSON(json: any): DataPacket;
    /** Get human-readable log string */
    toLogString(): string;
}
/** Build a key=value payload string */
export declare function buildPayload(pairs: Record<string, string>): string;
/** Parse a key=value payload string */
export declare function parsePayload(payload: string): Record<string, string>;
