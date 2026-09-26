  <!-- ══════════════ 3. ROLE-SPECIFIC HEADS-UP DISPLAY (HUD) ══════════════ -->
  <div id="stage-role-hud" class="stage-role-hud">
    <!-- Guitar HUD -->
    <div id="hud-guitar" class="hud-panel hud-guitar hidden">
      <div class="hud-guitar-capo" id="guitar-capo-display">
        <span class="capo-badge">🎸 GỢI Ý CAPO</span>
        <span id="guitar-capo-text" class="capo-text">Tone C → Không cần kẹp Capo (Bấm thế C tiêu chuẩn)</span>
      </div>
      <div class="hud-guitar-chords" id="guitar-key-chords">
        <!-- Chords in current key -->
      </div>
    </div>

    <!-- Bass HUD (Root Notes, Slash Chords, Scale Degree Roots) -->
    <div id="hud-bass" class="hud-panel hud-bass hidden">
      <div class="bass-hud-left">
        <span class="bass-hud-badge">🎸 BASS MASTER</span>
        <div class="bass-active-box">
          <span class="bass-label">NỐT GỐC (ROOT):</span>
          <span id="bass-root-note" class="bass-root-note">C</span>
          <span id="bass-slash-hint" class="bass-slash-hint">Nốt gốc cơ bản</span>
        </div>
      </div>
      <div class="bass-hud-center">
        <span class="bass-scale-label">BỘ NỐT BASS THEO TÔNG:</span>
        <div id="bass-scale-chips" class="bass-scale-chips">
          <!-- Điền tự động theo tông: C - D - E - F - G - A - B -->
        </div>
      </div>
      <div class="bass-hud-right">
        <span class="bass-tuning-label">DÂY BASS:</span>
        <div class="bass-strings-guide">
          <span class="bass-str">4: <strong>E</strong></span>
          <span class="bass-str">3: <strong>A</strong></span>
          <span class="bass-str">2: <strong>D</strong></span>
          <span class="bass-str">1: <strong>G</strong></span>
        </div>
      </div>
    </div>

    <!-- Keyboard / Piano HUD (Harmonic Progression, Voicings, Ambient Pad) -->
    <div id="hud-piano" class="hud-panel hud-piano hidden">
      <div class="piano-hud-left">
        <span class="piano-hud-badge">🎹 PIANO / KEYBOARD</span>
        <div class="piano-active-key-box">
          <span class="piano-label">VÒNG HÒA THANH:</span>
          <span id="piano-progression-text" class="piano-progression-text">I - IV - V - vi</span>
        </div>
      </div>
      <div class="piano-hud-center">
        <span class="piano-voicings-label">HỢP ÂM MỞ RỘNG (VOICINGS):</span>
        <div id="piano-voicing-chips" class="piano-voicing-chips">
          <!-- Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7b5 -->
        </div>
      </div>
      <div class="piano-hud-right">
        <span class="piano-pad-status-label">AMBIENT PAD SYNC:</span>
        <span id="piano-pad-sync-badge" class="piano-pad-sync-badge">🎹 Pad: Tắt</span>
      </div>
    </div>

    <!-- Drummer / Metronome HUD -->
    <div id="hud-drummer" class="hud-panel hud-drummer hidden">
      <div class="drummer-flasher-wrap">
        <span class="drummer-label">PHÁCH NHỊP:</span>
        <div class="beat-led-group" id="drummer-beat-leds">
          <div class="beat-led" data-beat="1">1</div>
          <div class="beat-led" data-beat="2">2</div>
          <div class="beat-led" data-beat="3">3</div>
          <div class="beat-led" data-beat="4">4</div>
        </div>
        <div class="drummer-bpm-display" id="drummer-bpm-display">80 BPM</div>
      </div>
    </div>

    <!-- Vocal HUD Switcher & SATB Part RehearsalMix -->
    <div id="hud-vocal" class="hud-panel hud-vocal hidden">
      <div class="vocal-controls-wrap">
        <span class="vocal-status-text">🎤 Ca Đoàn:</span>
        <button id="btn-vocal-toggle-view" class="btn-vocal-toggle active" data-view="lyrics">
          📄 Chuyển Xem: Lời Lớn (Teleprompter)
        </button>
        <div class="vocal-font-scaler">
          <button id="btn-vocal-font-dec" class="font-scale-btn" title="Giảm cỡ chữ">A−</button>
          <button id="btn-vocal-font-inc" class="font-scale-btn" title="Tăng cỡ chữ">A+</button>
        </div>
      </div>
      <div class="vocal-satb-selector">
        <span class="satb-label">🎧 Tách Bè Solo:</span>
        <div class="satb-btn-group" id="satb-btn-group">
          <button class="btn-satb-part active" data-part="all" title="Nghe đầy đủ 4 bè">👑 Tất Cả (Tutti)</button>
          <button class="btn-satb-part" data-part="soprano" title="Tô sáng và tăng âm lượng bè Soprano">Soprano (Nữ Cao)</button>
          <button class="btn-satb-part" data-part="alto" title="Tô sáng và tăng âm lượng bè Alto">Alto (Nữ Trầm)</button>
          <button class="btn-satb-part" data-part="tenor" title="Tô sáng và tăng âm lượng bè Tenor">Tenor (Nam Cao)</button>
          <button class="btn-satb-part" data-part="bass" title="Tô sáng và tăng âm lượng bè Bass">Bass (Nam Trầm)</button>
        </div>
      </div>
    </div>
  </div>
