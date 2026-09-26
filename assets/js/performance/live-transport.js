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

class SSETransport extends LiveTransport {
  constructor(fallbackPollingMs = 400) {
    super();
    this.fallbackPollingMs = fallbackPollingMs;
    this.room = '';
    this.hostToken = '';
    this.clientId = '';
    this.role = '';
    this.revision = 0;
    this.subscriber = null;
    this.eventSource = null;
    this.fallbackTransport = null;
    this.isConnected = false;
    this.consecutiveErrors = 0;
  }

  connect(room, options = {}) {
    this.room = room;
    this.hostToken = options.hostToken || '';
    this.clientId = options.clientId || '';
    this.role = options.role || '';
    this.revision = 0;
    this.consecutiveErrors = 0;
    this.isConnected = true;

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      this._startSSE();
    } else {
      this._startFallback();
    }
  }

  subscribe(callback) {
    this.subscriber = callback;
    if (this.fallbackTransport) {
      this.fallbackTransport.subscribe(callback);
    }
  }

  setRole(newRole) {
    this.role = newRole;
    if (this.fallbackTransport) this.fallbackTransport.setRole(newRole);
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
      console.warn('[SSETransport] Send error:', err);
      throw err;
    }
  }

  _startSSE() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const relativeUrl = `api/index.php?route=live_sync&action=events&room=${encodeURIComponent(this.room)}&rev=${this.revision}&clientId=${encodeURIComponent(this.clientId)}&role=${encodeURIComponent(this.role)}`;
    const url = (typeof window !== 'undefined' && window.ApiService && typeof window.ApiService.resolveUrl === 'function')
      ? window.ApiService.resolveUrl(relativeUrl)
      : relativeUrl;
    
    try {
      this.eventSource = new EventSource(url);
    } catch (e) {
      this._startFallback();
      return;
    }

    this.eventSource.addEventListener('state', (e) => {
      this.consecutiveErrors = 0;
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.success) {
          if (payload.revision) {
            this.revision = Math.max(this.revision, payload.revision);
          }
          if (payload.serverTime && window.TransportClock) {
            const now = Date.now();
            window.TransportClock.calibrate(now, payload.serverTime, now);
          }
          if (this.subscriber) {
            this.subscriber({
              type: 'state',
              state: payload.data,
              revision: this.revision,
              lastEventId: payload.lastEventId,
              replayEvents: payload.replayEvents || [],
              serverTime: payload.serverTime,
              roster: payload.roster
            });
          }
        }
      } catch (err) {
        console.warn('[SSETransport] JSON parse error:', err);
      }
    });

    this.eventSource.addEventListener('closed', () => {
      if (this.subscriber) {
        this.subscriber({ type: 'closed', message: 'Phòng đã kết thúc' });
      }
      this.disconnect();
    });

    this.eventSource.addEventListener('ping', () => {
      this.consecutiveErrors = 0;
    });

    this.eventSource.onopen = () => {
      this.consecutiveErrors = 0;
      if (this.subscriber) {
        this.subscriber({ type: 'connection', status: 'connected' });
      }
    };

    this.eventSource.onerror = () => {
      if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
        console.warn('[SSETransport] EventSource connection closed, falling back to PollingTransport');
        this._startFallback();
        return;
      }

      this.consecutiveErrors++;
      if (this.consecutiveErrors === 2 && this.subscriber) {
        this.subscriber({ type: 'connection', status: 'reconnecting' });
      }
      if (this.consecutiveErrors >= 3) {
        console.warn('[SSETransport] SSE stream failed, falling back to PollingTransport');
        this._startFallback();
      }
    };
  }

  _startFallback() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (!this.fallbackTransport) {
      this.fallbackTransport = new PollingTransport(this.fallbackPollingMs);
      if (this.subscriber) this.fallbackTransport.subscribe(this.subscriber);
      this.fallbackTransport.connect(this.room, {
        hostToken: this.hostToken,
        clientId: this.clientId,
        role: this.role
      });
      this.fallbackTransport.revision = this.revision;
    }
  }

  disconnect() {
    this.isConnected = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.fallbackTransport) {
      this.fallbackTransport.disconnect();
      this.fallbackTransport = null;
    }
    this.room = '';
    this.hostToken = '';
    this.revision = 0;
    this.subscriber = null;
  }
}

window.LiveTransport = LiveTransport;
window.PollingTransport = PollingTransport;
window.SSETransport = SSETransport;
