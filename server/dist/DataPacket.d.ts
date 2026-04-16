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
 * DataPacket — wraps our fixed header + variable payload for the wire format.
 * Basically REQ-SYS-020/030 from the spec, nothing fancy.
 */
export declare class DataPacket {
    header: PacketHeader;
    payload: Buffer | null;
    /**
     * Default ctor — empty payload, header starts as CMD_ERROR until we set real stuff.
     */
    constructor();
    /**
     * Put string data in the payload (utf8). Updates payloadLength in header.
     * @param data - usually key=value pairs for our protocol
     */
    setPayload(data: string): void;
    /**
     * Same as setPayload but if you already have a Buffer (binary).
     * Copies bytes so we dont alias the original buffer.
     * @param data - raw chunk
     */
    setPayloadRaw(data: Buffer): void;
    /**
     * Read payload back as text. Returns "" if no payload / length 0.
     */
    getPayloadString(): string;
    /**
     * Pack everything for TCP: 140 byte header + payload if any.
     */
    serialize(): Buffer;
    /**
     * Unpack from socket bytes. Returns null if not enough data yet or corrupt.
     * @param data - buffer from tcp read()
     */
    static deserialize(data: Buffer): DataPacket | null;
    /**
     * For JSON / websocket — not identical to binary format but good enough for logs.
     */
    toJSON(): object;
    /**
     * Build packet from parsed JSON (websocket side). Uses any bc client msg varies slightly.
     * @param json - object from JSON.parse
     */
    static fromJSON(json: any): DataPacket;
    /**
     * Debug string for logger — shows command name + status + len etc.
     */
    toLogString(): string;
}
/**
 * Turn an object into key=value&key2=value2 string for TCP payload.
 * @param pairs - plain string map
 */
export declare function buildPayload(pairs: Record<string, string>): string;
/**
 * Split key=value&... back into object. Empty string -> {}.
 * Not real URL decoding, just splits on & and first =.
 * @param payload - the payload part of the packet
 */
export declare function parsePayload(payload: string): Record<string, string>;
