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
    /**
     * Sets up writing to a log file (append mode) and also keeps last N lines in RAM
     * so the admin panel can show recent stuff without reading whole file.
     * @param filepath - where to write, default server.log in cwd
     * @param maxRecent - how many lines to remember in memory (ring buffer-ish)
     */
    constructor(filepath?: string, maxRecent?: number);
    /** Little helper — ISO-ish date without the T and Z stuff for readability */
    private getTimestamp;
    /**
     * Writes one line to file + console, and pushes to recentEntries (capped).
     * @param entry - full line to log
     */
    private write;
    /**
     * Log when we SEND a packet (TX). REQ-SYS-050. Truncates payload if huge.
     * @param pkt - what we sent
     * @param dest - optional session id or whatever for "to who"
     */
    logTransmit(pkt: DataPacket, dest?: string): void;
    /**
     * Log when we RECEIVE a packet (RX). Same truncation idea as transmit.
     * @param src - who sent it (session id etc)
     */
    logReceive(pkt: DataPacket, src?: string): void;
    /**
     * For the state machine — logs IDLE -> IN_GROUP type transitions.
     * @param from - old state
     * @param to - new state
     * @param trigger - what command caused it (string for debugging)
     */
    logStateTransition(from: string, to: string, trigger: string): void;
    /** Generic info line */
    info(msg: string): void;
    /** Warnings — not fatal but worth noticing */
    warn(msg: string): void;
    /** Errors — something broke */
    error(msg: string): void;
    /**
     * Returns last `count` lines we kept in memory (not necessarily from disk tail).
     * @param count - default 50
     */
    getRecentEntries(count?: number): string[];
}
