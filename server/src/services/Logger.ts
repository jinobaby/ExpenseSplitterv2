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

    constructor(filepath: string = 'server.log', maxRecent: number = 200) {
        this.logFile = fs.createWriteStream(filepath, { flags: 'a' });
        this.maxRecent = maxRecent;
    }

    private getTimestamp(): string {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    private write(entry: string): void {
        this.logFile.write(entry + '\n');
        console.log(entry);
        this.recentEntries.push(entry);
        if (this.recentEntries.length > this.maxRecent) {
            this.recentEntries.shift();
        }
    }

    /** Log transmitted packet (REQ-SYS-050) */
    logTransmit(pkt: DataPacket, dest: string = ''): void {
        const cmdName = CommandType[pkt.header.command] || 'UNKNOWN';
        const payload = pkt.header.payloadLength < 200 ? pkt.getPayloadString() : `<${pkt.header.payloadLength} bytes>`;
        this.write(`[${this.getTimestamp()}] [TX] CMD=${cmdName} STATUS=${pkt.header.status} LEN=${pkt.header.payloadLength} TO=${dest} DATA=${payload}`);
    }

    /** Log received packet (REQ-SYS-050) */
    logReceive(pkt: DataPacket, src: string = ''): void {
        const cmdName = CommandType[pkt.header.command] || 'UNKNOWN';
        const payload = pkt.header.payloadLength < 200 ? pkt.getPayloadString() : `<${pkt.header.payloadLength} bytes>`;
        this.write(`[${this.getTimestamp()}] [RX] CMD=${cmdName} STATUS=${pkt.header.status} LEN=${pkt.header.payloadLength} FROM=${src} DATA=${payload}`);
    }

    /** Log state machine transition */
    logStateTransition(from: string, to: string, trigger: string): void {
        this.write(`[${this.getTimestamp()}] [STATE] ${from} -> ${to} (trigger: ${trigger})`);
    }

    info(msg: string): void { this.write(`[${this.getTimestamp()}] [INFO] ${msg}`); }
    warn(msg: string): void { this.write(`[${this.getTimestamp()}] [WARN] ${msg}`); }
    error(msg: string): void { this.write(`[${this.getTimestamp()}] [ERROR] ${msg}`); }

    getRecentEntries(count: number = 50): string[] {
        const start = Math.max(0, this.recentEntries.length - count);
        return this.recentEntries.slice(start);
    }
}
