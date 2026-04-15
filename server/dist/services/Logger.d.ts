/**
 * @file Logger.ts
 * @brief Logging service for packet TX/RX and event tracking (REQ-SYS-050).
 * @author Jino Baby, Yashika
 * @version 1.0
 */
import { DataPacket } from '../DataPacket';
export declare class Logger {
    private logFile;
    private recentEntries;
    private maxRecent;
    constructor(filepath?: string, maxRecent?: number);
    private getTimestamp;
    private write;
    /** Log transmitted packet (REQ-SYS-050) */
    logTransmit(pkt: DataPacket, dest?: string): void;
    /** Log received packet (REQ-SYS-050) */
    logReceive(pkt: DataPacket, src?: string): void;
    /** Log state machine transition */
    logStateTransition(from: string, to: string, trigger: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
    getRecentEntries(count?: number): string[];
}
