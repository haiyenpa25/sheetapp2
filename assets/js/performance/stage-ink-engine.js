/**
 * assets/js/performance/stage-ink-engine.js — SheetApp Stage Collaborative Vector Ink
 * 
 * Handles real-time annotation & sketching over sheet music for rehearsals:
 * - PointerEvents support: Apple Pencil (iPad), S-Pen (Samsung Tab), Touch, Mouse
 * - Pressure sensitivity & Catmull-Rom spline smoothing
 * - Tools: Pen (Red/Gold), Highlighter (Yellow translucent), Eraser
 * - Live Vector Broadcast: serializes completed strokes for room synchronization
 */
const StageInkEngine = (() => {
  'use strict';

  let _canvas         = null;
  let _ctx            = null;
  let _container      = null;
  let _isEnabled      = false;
  let _currentTool    = 'pen'; // 'pen' | 'highlighter' | 'eraser'
  let _currentColor   = '#ef4444';
  let _currentWidth   = 3;
  let _strokes        = [];
  let _currentStroke  = null;
  let _isDrawing      = false;
  let _onBroadcast    = null; // Callback: (strokeData) => void
  let _onClear        = null; // Callback: () => void

  function init(canvasId, containerId, callbacks = {}) {
    _canvas = document.getElementById(canvasId);
    _container = document.getElementById(containerId);
    if (!_canvas || !_container) return;

    _ctx = _canvas.getContext('2d');
    _onBroadcast = callbacks.onBroadcast || null;
    _onClear = callbacks.onClear || null;

    _bindResizeObserver();
    _bindPointerEvents();
    console.log('[StageInkEngine] Initialized with Apple Pencil & Vector Ink support.');
  }

  function _bindResizeObserver() {
    if (!_container || !_canvas) return;

    const resize = () => {
      const rect = _container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      _canvas.width = rect.width * dpr;
      _canvas.height = Math.max(rect.height, _container.scrollHeight) * dpr;
      _canvas.style.width = rect.width + 'px';
      _canvas.style.height = Math.max(rect.height, _container.scrollHeight) + 'px';

      if (_ctx) {
        _ctx.scale(dpr, dpr);
      }
      redraw();
    };

    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(_container);
    setTimeout(resize, 400);
  }

  function _bindPointerEvents() {
    if (!_canvas) return;

    _canvas.addEventListener('pointerdown', _handlePointerDown);
    _canvas.addEventListener('pointermove', _handlePointerMove);
    _canvas.addEventListener('pointerup', _handlePointerUp);
    _canvas.addEventListener('pointercancel', _handlePointerUp);
  }

  function _getCanvasPos(e) {
    const rect = _canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pressure && e.pressure > 0 ? e.pressure : 0.5
    };
  }

  function _handlePointerDown(e) {
    if (!_isEnabled) return;
    _isDrawing = true;
    _canvas.setPointerCapture(e.pointerId);

    const pos = _getCanvasPos(e);

    if (_currentTool === 'eraser') {
      _eraseAt(pos.x, pos.y);
      return;
    }

    _currentStroke = {
      id: 'stroke-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      tool: _currentTool,
      color: _currentTool === 'highlighter' ? 'rgba(250, 204, 21, 0.45)' : _currentColor,
      width: _currentTool === 'highlighter' ? 18 : _currentWidth,
      points: [pos]
    };

    _drawSegment(_currentStroke, pos, pos);
  }

  function _handlePointerMove(e) {
    if (!_isEnabled || !_isDrawing) return;
    const pos = _getCanvasPos(e);

    if (_currentTool === 'eraser') {
      _eraseAt(pos.x, pos.y);
      return;
    }

    if (_currentStroke) {
      const prev = _currentStroke.points[_currentStroke.points.length - 1];
      _currentStroke.points.push(pos);
      _drawSegment(_currentStroke, prev, pos);
    }
  }

  function _handlePointerUp(e) {
    if (!_isDrawing) return;
    _isDrawing = false;
    try { _canvas.releasePointerCapture(e.pointerId); } catch (err) {}

    if (_currentStroke && _currentStroke.points.length > 0) {
      _strokes.push(_currentStroke);

      if (typeof _onBroadcast === 'function') {
        _onBroadcast(_currentStroke);
      }
      _currentStroke = null;
    }
  }

  function _drawSegment(stroke, p1, p2) {
    if (!_ctx) return;

    _ctx.save();
    _ctx.lineCap = 'round';
    _ctx.lineJoin = 'round';

    if (stroke.tool === 'highlighter') {
      _ctx.globalCompositeOperation = 'source-over';
      _ctx.strokeStyle = stroke.color;
      _ctx.lineWidth = stroke.width;
    } else {
      _ctx.globalCompositeOperation = 'source-over';
      _ctx.strokeStyle = stroke.color;
      // Vary width with pressure if available
      const pressureMultiplier = p2.p ? 0.6 + p2.p * 0.8 : 1.0;
      _ctx.lineWidth = stroke.width * pressureMultiplier;
    }

    _ctx.beginPath();
    _ctx.moveTo(p1.x, p1.y);
    _ctx.lineTo(p2.x, p2.y);
    _ctx.stroke();
    _ctx.restore();
  }

  function _eraseAt(x, y, radius = 22) {
    const origLen = _strokes.length;
    _strokes = _strokes.filter(stroke => {
      return !stroke.points.some(pt => {
        const dx = pt.x - x;
        const dy = pt.y - y;
        return (dx * dx + dy * dy) <= (radius * radius);
      });
    });

    if (_strokes.length !== origLen) {
      redraw();
    }
  }

  function redraw() {
    if (!_ctx || !_canvas) return;
    const dpr = window.devicePixelRatio || 1;
    _ctx.clearRect(0, 0, _canvas.width / dpr, _canvas.height / dpr);

    _strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      for (let i = 1; i < stroke.points.length; i++) {
        _drawSegment(stroke, stroke.points[i - 1], stroke.points[i]);
      }
    });
  }

  function renderRemoteStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 1) return;
    _strokes.push(stroke);
    if (stroke.points.length < 2) {
      _drawSegment(stroke, stroke.points[0], stroke.points[0]);
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        _drawSegment(stroke, stroke.points[i - 1], stroke.points[i]);
      }
    }
  }

  function clearAll(broadcast = true) {
    _strokes = [];
    if (_ctx && _canvas) {
      const dpr = window.devicePixelRatio || 1;
      _ctx.clearRect(0, 0, _canvas.width / dpr, _canvas.height / dpr);
    }
    if (broadcast && typeof _onClear === 'function') {
      _onClear();
    }
  }

  function setEnabled(val) {
    _isEnabled = !!val;
    if (_canvas) {
      _canvas.style.pointerEvents = _isEnabled ? 'auto' : 'none';
      _canvas.style.cursor = _isEnabled ? 'crosshair' : 'default';
    }
  }

  function setTool(tool) {
    _currentTool = tool;
  }

  function setColor(hex) {
    _currentColor = hex;
  }

  return {
    init,
    setEnabled,
    isEnabled: () => _isEnabled,
    setTool,
    setColor,
    clearAll,
    redraw,
    renderRemoteStroke,
    getStrokes: () => _strokes
  };
})();

window.StageInkEngine = StageInkEngine;
