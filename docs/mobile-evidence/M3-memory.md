# M3-4 — Đo bộ nhớ trước và sau M3-1..3 (`performance.memory`)

- **Bài hát đo:** `?song=thanh-ca-516` (`storage/xml/516_CHUA_PHUC_SINH.xml` — 204222 bytes, bài XML lớn nhất trong kho).
- **Môi trường:** Playwright Chromium (`Pixel 7`, `412×915`, `--enable-precise-memory-info --js-flags=--expose-gc`), ép `window.gc()` trước khi đọc `performance.memory`.
- **Kịch bản:** Mở bài chờ SVG gắn vào `#osmd-container`, đo `openMem`; xoay khung nhìn 3 lần (`915×412` → `412×915` → `915×412`), đo `afterRotateMem`.

## 1. Số liệu nguyên bản (bytes, không làm tròn)

| Giao diện | Thời điểm | Trước M3 (`usedJSHeapSize`) | Sau M3 (`usedJSHeapSize`) | Trước M3 (`totalJSHeapSize`) | Sau M3 (`totalJSHeapSize`) | `svgCount` (Trước / Sau) | `svgNodes` (Trước / Sau) |
|---|---|---:|---:|---:|---:|---:|---:|
| Modern (`/`) | Sau khi mở bài (`openMem`) | 51607016 | 13602136 | 71959776 | 33684968 | 1 / 1 | 3171 / 3171 |
| Modern (`/`) | Sau 3 lần xoay (`afterRotateMem`) | 13609122 | 14431698 | 32633618 | 47579174 | 1 / 1 | 3171 / 2853 |
| Classic (`/old/`) | Sau khi mở bài (`openMem`) | 51572915 | 12593024 | 88116087 | 33155452 | 1 / 1 | 3179 / 3357 |
| Classic (`/old/`) | Sau 3 lần xoay (`afterRotateMem`) | 87490948 | 13801433 | 141557684 | 49934021 | 1 / 1 | 2917 / 3023 |

## 2. JSON đầu ra nguyên bản

- **Trước M3-1..3:**
  ```json
  {"modern":{"openMem":{"usedJSHeapSize":51607016,"totalJSHeapSize":71959776,"jsHeapSizeLimit":4395630592,"svgCount":1,"svgNodes":3171},"afterRotateMem":{"usedJSHeapSize":13609122,"totalJSHeapSize":32633618,"jsHeapSizeLimit":4395630592,"svgCount":1,"svgNodes":3171}},"classic":{"openMem":{"usedJSHeapSize":51572915,"totalJSHeapSize":88116087,"jsHeapSizeLimit":4395630592,"svgCount":1,"svgNodes":3179},"afterRotateMem":{"usedJSHeapSize":87490948,"totalJSHeapSize":141557684,"jsHeapSizeLimit":4395630592,"svgCount":1,"svgNodes":2917}}}
  ```
- **Sau M3-1..3:**
  ```json
  {"modern":{"openMem":{"usedJSHeapSize":13602136,"totalJSHeapSize":33684968,"jsHeapSizeLimit":4395630592,"svgCount":1,"svgNodes":3171},"afterRotateMem":{"usedJSHeapSize":14431698,"totalJSHeapSize":47579174,"jsHeapSizeLimit":4395630592,"svgCount":1,"svgNodes":2853}},"classic":{"openMem":{"usedJSHeapSize":12593024,"totalJSHeapSize":33155452,"jsHeapSizeLimit":4395630592,"svgCount":1,"svgNodes":3357},"afterRotateMem":{"usedJSHeapSize":13801433,"totalJSHeapSize":49934021,"jsHeapSizeLimit":4395630592,"svgCount":1,"svgNodes":3023}}}
  ```
