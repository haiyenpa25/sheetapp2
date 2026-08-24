/**
 * assets/js/live-sync.js — Backward Compatibility Adapter for LiveSession (Performance Engine V2)
 */
const LiveSync = (() => {
  'use strict';

  return {
    init: () => {},
    showModal: () => window.LiveSession?.showModal?.(),
    hideModal: () => window.LiveSession?.hideModal?.(),
    startHost: (room) => window.LiveSession?.startHost?.(room),
    joinRoom: (room) => window.LiveSession?.joinRoom?.(room),
    leaveRoom: () => window.LiveSession?.leaveRoom?.(),
    broadcastState: (data) => window.LiveSession?.broadcastState?.(data)
  };
})();

window.LiveSync = LiveSync;
