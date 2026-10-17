---
name: webaudio-midi-satb
description: Specialized skill for Web Audio API, Tone.js, Metronome lookahead scheduling, SATB 4-part choir playback, Web MIDI, and microphone pitch detection in SheetApp2. Activate when working on metronome.js, audio-player.js, count-in-engine.js, editor-audio.js, or learn/ modules.
---

# WebAudio, MIDI & SATB Choir Engineering (SheetApp2)

## 1. AudioContext Lifecycle & Hardware Limits
- **Singleton / Reuse:** Trình duyệt giới hạn tối đa ~6 `AudioContext` phần cứng. Luôn tái sử dụng `audioCtx` hiện có, kiểm tra `audioCtx.state !== 'closed'` trước khi tạo mới.
- **iOS Safari Unlock:** Trên iOS/iPadOS, `AudioContext` khởi tạo ở trạng thái `'suspended'`. Mọi hàm phát âm thanh (`Metronome.start`, `CountInEngine.start`, `AudioPlayer.play`) BẮT BUỘC có chốt bảo vệ:
  ```js
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  ```
- **Lookahead Scheduling:** Không bao giờ dùng `setInterval` đơn thuần để phát tiếng gõ nhịp trực tiếp. Phải dùng kiến trúc Lookahead (`setInterval` 25ms đẩy nốt vào hàng đợi `audioCtx.currentTime + scheduleAheadTime` 100ms) để độ trễ nhịp < 2ms.

## 2. SATB 4-Part Choir Separation (`/learn/` & `audio-player.js`)
- **Phân tách 4 bè:**
  - **Soprano (Nữ Cao):** Staff 1, Voice 1 (hoặc nốt cao nhất khóa Sol).
  - **Alto (Nữ Trầm):** Staff 1, Voice 2 (hoặc nốt dưới khóa Sol).
  - **Tenor (Nam Cao):** Staff 2, Voice 1 (hoặc nốt trên khóa Fa).
  - **Bass (Nam Trầm):** Staff 2, Voice 2 (hoặc nốt trầm nhất khóa Fa).
- **Chế độ Tập Bè (Voice Isolation):** Khi chọn 1 bè (VD: `alto`), tăng gain bè đó lên `1.0` và hạ 3 bè còn lại xuống mức nền (`0.18`–`0.25`) thay vì tắt hẳn để ca viên vẫn nghe được hòa âm chuẩn.

## 3. Practice Session & Pitch Detection
- **Batch Checkpoints:** Không bao giờ gửi request HTTP cho từng nốt nhạc đơn lẻ khi tập đàn/hát. Gom nhóm theo ô nhịp (`PracticeService::checkpoint`) và gửi kèm `navigator.sendBeacon` / `pagehide` khi đóng trang (`PracticeService::finishSession`).
