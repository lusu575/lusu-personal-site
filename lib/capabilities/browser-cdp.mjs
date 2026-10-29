const timeoutMs = 15000;
export class CDP {
  constructor(url) { this.url = url; this.id = 1; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((ok, fail) => { this.socket.addEventListener("open", ok, { once: true }); this.socket.addEventListener("error", () => fail(new Error("CDP connection failed")), { once: true }); });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
        return;
      }
      const job = this.pending.get(message.id);
      if (!job) return; this.pending.delete(message.id); clearTimeout(job.timer);
      if (message.error) job.fail(new Error(`${job.method}: ${message.error.message}`)); else job.ok(message.result || {});
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => { this.pending.delete(id); fail(new Error(`${method} timed out`)); }, timeoutMs);
      this.pending.set(id, { method, ok, fail, timer }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) || new Set();
    listeners.add(listener); this.listeners.set(method, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(method); };
  }
  close() { for (const job of this.pending.values()) { clearTimeout(job.timer); job.fail(new Error("CDP closed")); } this.pending.clear(); this.socket?.close(); }
}
