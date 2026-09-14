import { RING_CAP } from '../config.js';

// key -> array of raw ws messages
const buffers = new Map();

export const bkey = (serverId, nodeId, logType) => `${serverId}|${nodeId}|${logType}`;

export function bpush(key, msg) {
  let a = buffers.get(key);
  if (!a) {
    a = [];
    buffers.set(key, a);
  }
  a.push(msg);
  if (a.length > RING_CAP) a.shift();
}

export const bget = (key) => buffers.get(key) || [];

export function bclearMany(keys) {
  keys.forEach((k) => buffers.set(k, []));
}
