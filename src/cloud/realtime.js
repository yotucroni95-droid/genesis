// Tiny Supabase Realtime client (broadcast + presence over one WebSocket),
// without the supabase-js library. Used only for positions in the Fuga: fast
// and free, but never trusted for anything decisive (that goes through SQL).

import { CLOUD } from './config.js';

export class Channel {
  constructor(topic, { key = '' } = {}) {
    this.topic = `realtime:${topic}`;
    this.key = key;
    this.handlers = {};
    this.ref = 0;
    this.closed = false;
    this.ready = false;
    this.retry = 1000;
    this.onStatus = () => {};
    this.open();
  }

  open() {
    if (this.closed) return;
    const url = `${CLOUD.url.replace(/^http/, 'ws').replace(/\/$/, '')}/realtime/v1/websocket?apikey=${encodeURIComponent(CLOUD.key)}&vsn=1.0.0`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.joinRef = String(++this.ref);
      this.raw('phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: this.key }, private: false } }, this.joinRef);
      this.beat = setInterval(() => this.send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++this.ref) }), 25000);
    };
    ws.onmessage = (m) => {
      let msg; try { msg = JSON.parse(m.data); } catch { return; }
      if (msg.topic !== this.topic) return;
      if (msg.event === 'phx_reply' && msg.ref === this.joinRef) {
        this.ready = msg.payload && msg.payload.status === 'ok';
        this.retry = 1000;
        this.onStatus(this.ready ? 'on' : 'error');
        if (this.ready && this.presence) this.track(this.presence);
      }
      if (msg.event === 'broadcast' && msg.payload) (this.handlers[msg.payload.event] || []).forEach((f) => f(msg.payload.payload));
      if (msg.event === 'presence_state' || msg.event === 'presence_diff') (this.handlers.presence || []).forEach((f) => f(msg.event, msg.payload));
    };
    ws.onclose = () => {
      clearInterval(this.beat);
      this.ready = false;
      if (this.closed) return;
      this.onStatus('off');
      setTimeout(() => this.open(), this.retry); // reconnect with back-off
      this.retry = Math.min(15000, this.retry * 2);
    };
    ws.onerror = () => {};
  }

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  raw(event, payload, ref = String(++this.ref)) { this.send({ topic: this.topic, event, payload, ref, join_ref: this.joinRef }); }
  on(event, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); return this; }
  broadcast(event, payload) { if (this.ready) this.raw('broadcast', { type: 'broadcast', event, payload }); }
  track(meta) { this.presence = meta; if (this.ready) this.raw('presence', { type: 'presence', event: 'track', payload: meta }); }

  close() {
    this.closed = true;
    clearInterval(this.beat);
    if (this.ws && this.ws.readyState === 1) this.raw('phx_leave', {});
    try { this.ws && this.ws.close(); } catch { /* already closed */ }
  }
}
