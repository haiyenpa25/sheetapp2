/**
 * assets/js/performance/live-transport.js — Live Transport Abstraction Layer
 * 
 * Provides an abstract transport boundary:
 * - PollingTransport (V1 with ETag/Revision diffing)
 * - Extensible to SSETransport / WebSocketTransport in future phases
 */
class LiveTransport {
  connect(room, options = {}) { throw new Error('Not implemented'); }
  send(room, hostToken, payload) { throw new Error('Not implemented'); }
  subscribe(callback) { throw new Error('Not implemented'); }
  disconnect() { throw new Error('Not implemented'); }
}

class PollingTransport extends LiveTransport {
  constructor(pollIntervalMs = 350) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.room = '';
    this.hostToken = '';
    this.revision = 0;
    this.timer = null;
    this.subscriber = null;
    this.consecutiveErrors = 0;
    this.isConnected = false;
    this.isPolling = false;
    this.clientId = '';
    this.role = '';
  }

  connect(room, options = {}) {
    this.room = room;
    this.hostToken = options.hostToken || '';
    this.clientId = options.clientId || '';
    this.role = options.role || '';
    this.revision = 0;
    this.consecutiveErrors = 0;
    this.isConnected = true;
    this._startPolling();
  }

  subscribe(callback) {
    this.subscriber = callback;
  }

  setRole(newRole) {
    this.role = newRole;
  }

  async send(room, hostToken, payload) {
    if (!this.isConnected || !room) return;
    try {
      const res = await window.ApiService.liveSync.update(room, hostToken || this.hostToken, payload);
      if (res && res.success && res.revision) {
        this.revision = Math.max(this.revision, res.revision);
      }
      return res;
    } catch (err) {
      console.warn('[LiveTransport] Send error:', err);
      throw err;
    }
  }

  _startPolling() {
    if (this.timer) clearInterval(this.timer);

    const pollStep = async () => {
      if (!this.isConnected || this.isPolling || !this.room) return;
      this.isPolling = true;

      const t1 = Date.now();
      try {
        const res = await window.ApiService.liveSync.poll(this.room, this.revision, this.clientId, this.role);
        const t2 = Date.now();

        if (res && res.serverTime && window.TransportClock) {
          window.TransportClock.calibrate(t1, res.serverTime, t2);
        }

        if (this.consecutiveErrors > 0) {
          this.consecutiveErrors = 0;
          if (this.subscriber) {
            this.subscriber({ type: 'connection', status: 'connected' });
          }
        }

        if (res && res.success) {
          if (res.active === false) {
            if (this.subscriber) {
              this.subscriber({ type: 'closed', message: res.message || 'Phòng đã kết thúc' });
            }
            return;
          }

          if (res.roster && this.subscriber) {
            this.subscriber({ type: 'roster', roster: res.roster });
          }

          if (res.modified && res.data) {
            this.revision = Math.max(this.revision, res.revision || 0);
            if (this.subscriber) {
              this.subscriber({ type: 'state', state: res.data, revision: this.revision, serverTime: res.serverTime, roster: res.roster });
            }
          }
        }
      } catch (err) {
        this.consecutiveErrors++;
        // Sau 3 lần lỗi liên tiếp (~1s), thông báo trạng thái reconnecting
        if (this.consecutiveErrors === 3 && this.subscriber) {
          this.subscriber({ type: 'connection', status: 'reconnecting' });
        } else if (this.consecutiveErrors > 15 && this.subscriber) {
          this.subscriber({ type: 'connection', status: 'offline' });
        }
      } finally {
        this.isPolling = false;
      }
    };

    // Poll ngay lập tức lần đầu
    pollStep();
    this.timer = setInterval(pollStep, this.pollIntervalMs);
  }

  disconnect() {
    this.isConnected = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.room = '';
    this.hostToken = '';
    this.revision = 0;
    this.subscriber = null;
  }
}

window.LiveTransport = LiveTransport;
window.PollingTransport = PollingTransport;
