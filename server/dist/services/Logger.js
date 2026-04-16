"use strict";
/**
 * @file Logger.ts
 * @brief Logging service for packet TX/RX and event tracking (REQ-SYS-050).
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
exports.Logger = void 0;
const fs = __importStar(require("fs"));
const DataPacket_1 = require("../DataPacket");
class Logger {
    /**
     * Sets up writing to a log file (append mode) and also keeps last N lines in RAM
     * so the admin panel can show recent stuff without reading whole file.
     * @param filepath - where to write, default server.log in cwd
     * @param maxRecent - how many lines to remember in memory (ring buffer-ish)
     */
    constructor(filepath = 'server.log', maxRecent = 200) {
        this.recentEntries = [];
        this.logFile = fs.createWriteStream(filepath, { flags: 'a' });
        this.maxRecent = maxRecent;
    }
    /** Little helper — ISO-ish date without the T and Z stuff for readability */
    getTimestamp() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    /**
     * Writes one line to file + console, and pushes to recentEntries (capped).
     * @param entry - full line to log
     */
    write(entry) {
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
    logTransmit(pkt, dest = '') {
        const cmdName = DataPacket_1.CommandType[pkt.header.command] || 'UNKNOWN';
        const payload = pkt.header.payloadLength < 200 ? pkt.getPayloadString() : `<${pkt.header.payloadLength} bytes>`;
        this.write(`[${this.getTimestamp()}] [TX] CMD=${cmdName} STATUS=${pkt.header.status} LEN=${pkt.header.payloadLength} TO=${dest} DATA=${payload}`);
    }
    /**
     * Log when we RECEIVE a packet (RX). Same truncation idea as transmit.
     * @param src - who sent it (session id etc)
     */
    logReceive(pkt, src = '') {
        const cmdName = DataPacket_1.CommandType[pkt.header.command] || 'UNKNOWN';
        const payload = pkt.header.payloadLength < 200 ? pkt.getPayloadString() : `<${pkt.header.payloadLength} bytes>`;
        this.write(`[${this.getTimestamp()}] [RX] CMD=${cmdName} STATUS=${pkt.header.status} LEN=${pkt.header.payloadLength} FROM=${src} DATA=${payload}`);
    }
    /**
     * For the state machine — logs IDLE -> IN_GROUP type transitions.
     * @param from - old state
     * @param to - new state
     * @param trigger - what command caused it (string for debugging)
     */
    logStateTransition(from, to, trigger) {
        this.write(`[${this.getTimestamp()}] [STATE] ${from} -> ${to} (trigger: ${trigger})`);
    }
    /** Generic info line */
    info(msg) { this.write(`[${this.getTimestamp()}] [INFO] ${msg}`); }
    /** Warnings — not fatal but worth noticing */
    warn(msg) { this.write(`[${this.getTimestamp()}] [WARN] ${msg}`); }
    /** Errors — something broke */
    error(msg) { this.write(`[${this.getTimestamp()}] [ERROR] ${msg}`); }
    /**
     * Returns last `count` lines we kept in memory (not necessarily from disk tail).
     * @param count - default 50
     */
    getRecentEntries(count = 50) {
        const start = Math.max(0, this.recentEntries.length - count);
        return this.recentEntries.slice(start);
    }
}
exports.Logger = Logger;
