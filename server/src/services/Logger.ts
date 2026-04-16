/**
 * @file Logger.ts
 * @brief Logging service for packet TX/RX and event tracking (REQ-SYS-050).
 * @author Jino Baby, Yashika
 * @version 1.0
 */

import * as fs from 'fs';
import { DataPacket, CommandType } from '../DataPacket';

export class Logger {
    private logFile: fs.WriteStream;
    private recentEntries: string[] = [];
    private maxRecent: number;

    /**
     * Sets up writing to a log file (append mode) and also keeps last N lines in RAM
     * so the admin panel can show recent stuff without reading whole file.
     * @param filepath - where to write, default server.log in cwd
     * @param maxRecent - how many lines to remember in memory (ring buffer-ish)
     */
    constructor(filepath: string = 'server.log', maxRecent: number = 200) {
        this.logFile = fs.createWriteStream(filepath, { flags: 'a' });
        this.maxRecent = maxRecent;
    }

    /** Little helper — ISO-ish date without the T and Z stuff for readability */
    private getTimestamp(): string {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    /**
     * Writes one line to file + console, and pushes to recentEntries (capped).
     * @param entry - full line to log
     */
    private write(entry: string): void {
        this.logFile.write(entry + '\n');
        console.log(entry);
        this.recentEntries.push(entry);
        if (this.recentEntries.length > this.maxRecent) {
            this.recentEntries.shift();
        }
    }

    /**
     * Log when we SEND a packet (TX). REQ-SYS-050. Truncates payload if huge.
     * @param pkt - what we sent
     * @param dest - optional session id or whatever for "to who"
     */
    logTransmit(pkt: DataPacket, dest: string = ''): void {
        const cmdName = CommandType[pkt.header.command] || 'UNKNOWN';
        const payload = pkt.header.payloadLength < 200 ? pkt.getPayloadString() : `<${pkt.header.payloadLength} bytes>`;
        this.write(`[${this.getTimestamp()}] [TX] CMD=${cmdName} STATUS=${pkt.header.status} LEN=${pkt.header.payloadLength} TO=${dest} DATA=${payload}`);
    }

    /**
     * Log when we RECEIVE a packet (RX). Same truncation idea as transmit.
     * @param src - who sent it (session id etc)
     */
    logReceive(pkt: DataPacket, src: string = ''): void {
        const cmdName = CommandType[pkt.header.command] || 'UNKNOWN';
        const payload = pkt.header.payloadLength < 200 ? pkt.getPayloadString() : `<${pkt.header.payloadLength} bytes>`;
        this.write(`[${this.getTimestamp()}] [RX] CMD=${cmdName} STATUS=${pkt.header.status} LEN=${pkt.header.payloadLength} FROM=${src} DATA=${payload}`);
    }

    /**
     * For the state machine — logs IDLE -> IN_GROUP type transitions.
     * @param from - old state
     * @param to - new state
     * @param trigger - what command caused it (string for debugging)
     */
    logStateTransition(from: string, to: string, trigger: string): void {
        this.write(`[${this.getTimestamp()}] [STATE] ${from} -> ${to} (trigger: ${trigger})`);
    }

    /** Generic info line */
    info(msg: string): void { this.write(`[${this.getTimestamp()}] [INFO] ${msg}`); }
    /** Warnings — not fatal but worth noticing */
    warn(msg: string): void { this.write(`[${this.getTimestamp()}] [WARN] ${msg}`); }
    /** Errors — something broke */
    error(msg: string): void { this.write(`[${this.getTimestamp()}] [ERROR] ${msg}`); }

    /**
     * Returns last `count` lines we kept in memory (not necessarily from disk tail).
     * @param count - default 50
     */
    getRecentEntries(count: number = 50): string[] {
        const start = Math.max(0, this.recentEntries.length - count);
        return this.recentEntries.slice(start);
    }
}
