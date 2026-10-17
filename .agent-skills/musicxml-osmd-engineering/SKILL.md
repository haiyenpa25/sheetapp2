---
name: musicxml-osmd-engineering
description: Specialized skill for MusicXML parsing, OpenSheetMusicDisplay (OSMD) SVG rendering, ChordCanvas overlay positioning, and music theory transposition in SheetApp2. Activate whenever touching OSMD, ChordCanvas, TransposeEngine, LyricExtractor, or MusicXML files.
---

# MusicXML, OSMD & Chord Overlay Engineering (SheetApp2)

## 1. Core Invariants (Bất biến Nghiệp vụ — Không được phép phá vỡ)
1. **Core Rule 1 (HD Default):** Khi mở bài hát mới không có query `?set=` hoặc cấu hình từ Setlist, hệ thống BẮT BUỘC ưu tiên nạp bộ hợp âm `HD` (nếu có), sau đó mới fallback về `TLH` (`default`).
2. **Core Rule 2 (Reset Transpose = 0):** Khi chuyển sang bài hát mới từ Thư viện (không phải từ Setlist có gán tông riêng), `currentTranspose` BẮT BUỘC reset về `0` (tông gốc của bản nhạc).
3. **Core Rule 3 (Khóa bộ gốc TLH & HD):** Các bộ hợp âm hệ thống `TLH` (`default`) và `HD` bị khóa ghi đè đối với người dùng thường; chỉ cho phép tạo bản sao cá nhân (`clone`) hoặc chỉnh sửa khi có quyền hợp lệ kèm `baseChecksum`.
4. **Core Rule 4 (Đồng bộ Setlist):** Khi mở bài từ Setlist, phải đồng bộ cả 3 thuộc tính: `chord_profile`, `transpose_key`, và `bpm`.

## 2. OSMD Rendering & SVG Coordinate Mapping
- **Race-Condition Guard (`_loadToken`):** Mọi tác vụ nạp MusicXML bất đồng bộ (`SongLoader`, `ChordCanvas`, `AnnotationCanvas`) phải tăng và kiểm tra `_loadToken` trước khi gắn kết quả vào DOM để tránh bài cũ đè lên bài mới khi người dùng bấm chuyển bài liên tục.
- **Tọa độ Hợp âm (`ChordCanvasDots`):**
  - Không bao giờ gắn tọa độ pixel cứng; luôn ánh xạ theo `(measureIdx, noteIdx)` trên `osmd.GraphicSheet.MeasureList`.
  - Khi thay đổi `zoom` hoặc resize cửa sổ, gọi `ChordCanvas.rebuild()` thông qua `requestAnimationFrame` / debounce `120ms`.

## 3. MusicXML & Transposition Safety
- **Cache DOMParser:** Không parse lại chuỗi XML gốc nhiều lần nếu `xmlString` và `semitones` không đổi.
- **Tonal.js + Fallback:** Luôn dùng `window.Tonal` khi khả dụng, nhưng phải duy trì bảng `NOTES_SHARP` / `NOTES_FLAT` nội bộ để dịch giọng an toàn ngay cả khi CDN lỗi.
- **XSS Encoding:** Mọi nhãn hợp âm (`chord`), lời bài hát (`lyric`), và tiêu đề lấy từ MusicXML phải qua `window.escapeHtml()` trước khi đưa vào `innerHTML`.
