// eslint.config.js
// Cấu hình ESLint tối thiểu theo Ticket T04: no-undef, no-redeclare, no-unreachable

module.exports = [
  {
    ignores: [
      'assets/vendor/**',
      'node_modules/**',
      'storage/**',
      '.git/**',
      'dashboard/**',
      '.ua/**',
      '**/*.min.js'
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Trình duyệt tiêu chuẩn
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        location: 'readonly',
        history: 'readonly',
        navigator: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        EventSource: 'readonly',
        WebSocket: 'readonly',
        DOMParser: 'readonly',
        XMLSerializer: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        HTMLElement: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        AbortController: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        Uint8Array: 'readonly',
        ArrayBuffer: 'readonly',
        DataView: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        crypto: 'readonly',
        performance: 'readonly',

        // Node.js / Tooling globals
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',

        // SheetApp2 Domain globals
        EventBus: 'writable',
        ApiService: 'writable',
        OSMDRenderer: 'writable',
        ChordDictionaryCore: 'writable',
        TapTempoCore: 'writable',
        MidiEngineCore: 'writable',
        AudioUnlockerCore: 'writable',
        SongLoaderCore: 'writable',
        AppModes: 'writable',
        FeatureFlags: 'writable',
        LiveSyncTransport: 'writable',
        ModalEngine: 'writable',
        InEarAudioEngine: 'writable',
        StageInkEngine: 'writable',
        SongContext: 'writable',
        AudioWorkletNode: 'readonly',
        opensheetmusicdisplay: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-unreachable': 'error'
    }
  }
];
