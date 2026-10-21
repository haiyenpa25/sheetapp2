#!/usr/bin/env python3
"""
tools/fetch_sheet.py — v2 (CDP Edition)
==========================================
Kết nối vào Chrome/Edge thật đang chạy của bạn (qua Remote Debugging Protocol),
intercept network request, bắt file MusicXML từ trang OSMD đang mở.

KHÔNG cần Playwright hay Selenium. KHÔNG bị chặn bởi Cloudflare.

─── CÁCH DÙNG ────────────────────────────────────────────────────

1. Mở Chrome với CDP debugging (chạy 1 lần):
     chrome.exe --remote-debugging-port=9222 --no-first-run --no-default-browser-check

   Hoặc dùng shortcut với flag trên.

2. Mở trang bài hát trong Chrome đó (ví dụ: httlvn.org bài hát)

3. Chạy tool này:
     python tools/fetch_sheet.py --cdp
     # Tool tự động tìm trang OSMD đang mở, lấy XML URL từ JS context

─── CÁC MODE ─────────────────────────────────────────────────────

Mode 1: CDP (recommended)
  python tools/fetch_sheet.py --cdp
  python tools/fetch_sheet.py --cdp --port 9222

Mode 2: URL trực tiếp file .xml (không cần scrape)
  python tools/fetch_sheet.py --url "https://example.com/sheet.xml"
  python tools/fetch_sheet.py --url "https://example.com/sheet.xml" --title "Tên bài"

Mode 3: File local
  python tools/fetch_sheet.py --file "D:/Downloads/sheet.xml"
  python tools/fetch_sheet.py --file "D:/Downloads/sheet.xml" --title "Tên bài"

Mode 4: Batch từ file URLs.txt
  python tools/fetch_sheet.py --batch tools/urls.txt

Mode 5: Xem thư viện
  python tools/fetch_sheet.py --list

─── MỞ CHROME VỚI CDP ────────────────────────────────────────────
Chạy lệnh này để mở Chrome với CDP (hoặc thêm shortcut):
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222

"""

import argparse
import json
import os
import re
import sys
import time
import shutil
from datetime import date
from pathlib import Path
from urllib.parse import urlparse, urljoin
from urllib.request import urlopen, Request
from urllib.error import URLError

# ── Paths ─────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
ROOT_DIR     = SCRIPT_DIR.parent
SHEETS_DIR   = ROOT_DIR / "storage" / "sheets"
SONGS_FILE   = ROOT_DIR / "storage" / "data" / "songs.json"
SESSIONS_DIR = ROOT_DIR / "storage" / "data" / "sessions"

for _d in [SHEETS_DIR, SESSIONS_DIR, SONGS_FILE.parent]:
    _d.mkdir(parents=True, exist_ok=True)

# ── Constants ─────────────────────────────────────────
XML_EXTENSIONS = ('.xml', '.mxl', '.musicxml')
CDP_PORT       = 9222
FETCH_TIMEOUT  = 20

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Users\{}\AppData\Local\Google\Chrome\Application\chrome.exe".format(
        os.environ.get("USERNAME", "")
    ),
]


# ═══════════════════════════════════════════════════════
#  MODE 1: CDP — Kết nối Chrome thật đang chạy
# ═══════════════════════════════════════════════════════

def fetch_via_cdp(port: int = CDP_PORT, verbose: bool = True) -> list[dict]:
    """
    Kết nối CDP, liệt kê tất cả tabs đang mở,
    tìm tab có OSMD, chạy JS để extract XML URL.
    """
    def _log(m): print(m, flush=True) if verbose else None

    # Import minimal websocket library
    try:
        import websocket  # websocket-client
    except ImportError:
        _log("⚙️  Cài thêm: pip install websocket-client requests")
        sys.exit(1)

    import threading

    # 1) Liệt kê các tab mở qua Chrome DevTools HTTP API
    try:
        resp = _http_get(f"http://127.0.0.1:{port}/json")
        if resp is None:
            _log(f"❌  Không thể kết nối CDP trên port {port}.")
            _log(f"   👉  Hãy mở Chrome với: --remote-debugging-port={port}")
            _log(f"   Xem hướng dẫn ở đầu file tools/fetch_sheet.py")
            _show_chrome_launch_help(port)
            return []
        tabs = json.loads(resp)
    except Exception as e:
        _log(f"❌  CDP error: {e}")
        return []

    _log(f"\n🔌  Đã kết nối Chrome CDP (port {port})")
    _log(f"   Tìm thấy {len(tabs)} tab(s)")

    # 2) Lọc tab đang ở trang thanhca hoặc trang OSMD
    target_tabs = []
    for tab in tabs:
        url  = tab.get("url", "")
        title = tab.get("title", "")
        if "thanhca" in url or "httlvn" in url or "sheet" in url.lower() or "op=sheet" in url:
            target_tabs.append(tab)
            _log(f"   🎵  Tab: [{tab.get('id')}] {title[:60]} — {url[:80]}")

    if not target_tabs:
        _log("\n⚠️  Không tìm thấy tab nào có trang nhạc.")
        _log("   Hãy mở trang thanhca.httlvn.org?op=sheet trong Chrome trước.")
        _log("\n   Tất cả tabs hiện tại:")
        for tab in tabs[:10]:
            _log(f"     {tab.get('url','')[:80]}")
        return []

    results = []
    for tab in target_tabs:
        ws_url  = tab.get("webSocketDebuggerUrl")
        page_url = tab.get("url", "")
        title    = tab.get("title", "")
        _log(f"\n🔍  Phân tích tab: {title[:60]}")

        xml_url = _cdp_extract_xml_url(ws_url, page_url, verbose)

        if xml_url:
            song = _download_and_save(xml_url, title, page_url, verbose)
            if song:
                results.append(song)
        else:
            _log(f"   ❌  Không tìm được XML URL trong tab này.")

    return results


def _cdp_extract_xml_url(ws_url: str, page_url: str, verbose: bool) -> str | None:
    """Dùng CDP WebSocket để chạy JS trong tab và extract XML URL."""

    def _log(m): print(m, flush=True) if verbose else None

    try:
        import websocket
        import threading

        result_holder = [None]
        ws_done = threading.Event()

        def on_message(ws, message):
            try:
                data = json.loads(message)
                if data.get("id") == 1:
                    val = data.get("result", {}).get("result", {}).get("value")
                    if val and isinstance(val, str) and len(val) > 3:
                        result_holder[0] = val
                    ws_done.set()
                    ws.close()
            except Exception:
                pass

        def on_error(ws, error):
            _log(f"   WS error: {error}")
            ws_done.set()

        def on_open(ws):
            # JS để extract XML URL từ page context
            js_code = r"""
(function() {
    // 1. Tìm trong Performance resource entries (network requests đã xảy ra)
    var entries = performance.getEntriesByType('resource');
    for (var i = 0; i < entries.length; i++) {
        var url = entries[i].name;
        if (!url) continue;
        // MusicXML file extensions
        if (url.endsWith('.xml') || url.endsWith('.mxl') || url.endsWith('.musicxml')) {
            return url;
        }
        // httlvn.org Download endpoint (Content-Type: application/vnd.recordare.musicxml+xml)
        if (url.includes('/Download/SheetMusic/') || url.includes('/download/sheetmusic/')) {
            return url;
        }
        // Các endpoint nhạc phổ biến
        if (url.includes('/musicxml') || url.includes('/music-xml') || url.includes('/getxml')) {
            return url;
        }
    }

    // 2. Tìm qua window/global variables
    var keys = ['xmlUrl','sheetUrl','musicXmlUrl','osmdUrl','fileUrl','sheetFile',
                'xmlPath','musicxml','sheetPath','mxlUrl','currentXml','scoreUrl'];
    for (var j = 0; j < keys.length; j++) {
        try {
            var v = window[keys[j]];
            if (typeof v === 'string' && v.length > 3 &&
                (v.includes('.xml') || v.includes('.mxl') || v.includes('Download') || v.includes('musicxml'))) {
                return v;
            }
        } catch(e) {}
    }

    // 3. Tìm trong Drupal settings (Drupal CMS)
    try {
        var drupal = window.drupalSettings || (window.Drupal && window.Drupal.settings) || {};
        var ds = JSON.stringify(drupal);
        var dm = ds.match(/"((?:https?:\/\/[^"]*)?(?:\/Download\/[^"]+|[^"]*\.(?:xml|mxl|musicxml)))"/);
        if (dm) return dm[1];
    } catch(e) {}

    // 4. Quét tất cả script tag contents
    var scripts = document.querySelectorAll('script');
    var xmlPattern = /["'`]([^"'`]*(?:\.xml|\.mxl|\.musicxml|\/Download\/SheetMusic\/\d+)[^"'`]*)["'`]/gi;
    for (var k = 0; k < scripts.length; k++) {
        var text = scripts[k].textContent || '';
        var match;
        while ((match = xmlPattern.exec(text)) !== null) {
            var candidate = match[1];
            if (candidate.length > 3) return candidate;
        }
    }

    return null;
})()
"""
            msg = json.dumps({
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": js_code,
                    "returnByValue": True,
                    "timeout": 5000
                }
            })
            ws.send(msg)

        ws_app = websocket.WebSocketApp(
            ws_url,
            on_message=on_message,
            on_error=on_error,
            on_open=on_open
        )

        t = threading.Thread(target=ws_app.run_forever, daemon=True)
        t.start()
        ws_done.wait(timeout=10)
        t.join(timeout=2)

        xml_url = result_holder[0]

        if xml_url:
            # Resolve relative URL
            if not xml_url.startswith("http"):
                parsed = urlparse(page_url)
                if xml_url.startswith("/"):
                    xml_url = f"{parsed.scheme}://{parsed.netloc}{xml_url}"
                else:
                    xml_url = urljoin(page_url, xml_url)
            _log(f"   ✅  Tìm thấy XML URL: {xml_url}")
            return xml_url

        _log("   ℹ️  Không tìm thấy URL XML trực tiếp — thử Performance API...")
        return None

    except ImportError:
        print("❌  pip install websocket-client")
        sys.exit(1)
    except Exception as e:
        _log(f"   CDP JS error: {e}")
        return None


# ═══════════════════════════════════════════════════════
#  MODE 2: Direct URL
# ═══════════════════════════════════════════════════════

def fetch_via_url(xml_url: str, title: str = "", verbose: bool = True) -> dict | None:
    def _log(m): print(m, flush=True) if verbose else None

    _log(f"\n📥  Tải file từ URL: {xml_url}")

    content = _http_get_bytes(xml_url)
    if not content:
        _log("❌  Không thể tải file.")
        return None

    if not _is_musicxml(content):
        _log("❌  File không phải MusicXML hợp lệ (thiếu score-partwise/<?xml)")
        return None

    ext = ".mxl" if content[:2] == b'PK' else ".xml"
    if not title:
        title = Path(urlparse(xml_url).path).stem or "sheet-import"
        title = title.replace('-', ' ').replace('_', ' ').title()

    return _save_song(content, title, ext, xml_url, verbose)


# ═══════════════════════════════════════════════════════
#  MODE 3: Local File
# ═══════════════════════════════════════════════════════

def fetch_from_file(file_path: str, title: str = "", verbose: bool = True) -> dict | None:
    def _log(m): print(m, flush=True) if verbose else None

    fpath = Path(file_path)
    if not fpath.exists():
        _log(f"❌  File không tồn tại: {file_path}")
        return None

    ext = fpath.suffix.lower()
    if ext not in XML_EXTENSIONS:
        _log(f"❌  Không hỗ trợ định dạng: {ext}")
        return None

    content = fpath.read_bytes()
    if not _is_musicxml(content):
        _log("❌  File không phải MusicXML hợp lệ")
        return None

    if not title:
        title = fpath.stem.replace('-', ' ').replace('_', ' ').title()

    _log(f"\n📂  Import từ file: {fpath.name}")

    return _save_song(content, title, ext, str(fpath), verbose)


# ═══════════════════════════════════════════════════════
#  MODE 4: Batch từ file
# ═══════════════════════════════════════════════════════

def fetch_batch(urls_file: str, verbose: bool = True, delay: float = 1.5) -> list:
    path = Path(urls_file)
    if not path.exists():
        print(f"❌  File không tồn tại: {urls_file}")
        return []

    tasks = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split('\t', 1)
        url   = parts[0].strip()
        title = parts[1].strip() if len(parts) > 1 else ""
        tasks.append((url, title))

    print(f"📋  {len(tasks)} bài hát sẽ được tải")
    results = []

    for i, (url, title) in enumerate(tasks, 1):
        print(f"\n[{i}/{len(tasks)}] {'─'*50}", flush=True)

        url_lower = url.lower()
        try:
            if any(url_lower.endswith(ext) for ext in XML_EXTENSIONS):
                song = fetch_via_url(url, title, verbose)
            elif url_lower.startswith("file://") or os.path.exists(url):
                song = fetch_from_file(url, title, verbose)
            else:
                # Phải dùng CDP — không thể batch auto
                print(f"⚠️  URL trang web '{url}' cần dùng --cdp mode để import.")
                print(f"   Hãy mở trang này trong Chrome rồi chạy --cdp")
                song = None

            if song:
                results.append(song)
                print(f"✅  OK: {song['title']}", flush=True)
            else:
                print(f"❌  Thất bại: {url}", flush=True)
        except Exception as e:
            print(f"❌  Lỗi: {e}", flush=True)

        if i < len(tasks):
            time.sleep(delay)

    print(f"\n{'═'*55}")
    print(f"✅  Kết quả: {len(results)}/{len(tasks)} bài import thành công")
    return results


# ═══════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════

def _download_and_save(xml_url: str, title: str, page_url: str, verbose: bool) -> dict | None:
    def _log(m): print(m, flush=True) if verbose else None

    _log(f"   ⬇️  Tải XML: {xml_url}")
    content = _http_get_bytes(xml_url)

    if not content:
        _log("   ❌  Không tải được file")
        return None

    if not _is_musicxml(content):
        _log(f"   ❌  File không phải MusicXML (size={len(content)} bytes)")
        return None

    ext = ".mxl" if content[:2] == b'PK' else ".xml"

    # Clean title
    title = re.sub(r'^Sheet\s+Thánh\s+Ca\s+\d+\s+', '', title, flags=re.I)
    title = re.sub(r'\s*[-–|].*$', '', title).strip()
    if not title:
        title = Path(urlparse(xml_url).path).stem.replace('-', ' ').title()

    return _save_song(content, title, ext, page_url, verbose)


def _save_song(content: bytes, title: str, ext: str, source: str, verbose: bool) -> dict | None:
    def _log(m): print(m, flush=True) if verbose else None

    fname  = _unique_filename(title, ext)
    fpath  = SHEETS_DIR / fname
    fpath.write_bytes(content)
    _log(f"   💾  Đã lưu: {fpath} ({len(content)//1024} KB)")

    key  = _detect_key(content.decode("utf-8", errors="ignore"))
    song = _add_to_library(title, f"storage/sheets/{fname}", key, source)
    _log(f"   📚  Thêm vào thư viện: [{song['id']}] {title}"
         + (f" [{key}]" if key else ""))
    return song


def _is_musicxml(content: bytes) -> bool:
    if not content or len(content) < 10:
        return False
    if content[:2] == b'PK':
        return True  # MXL ZIP
    sample = content[:1000].decode("utf-8", errors="ignore")
    return (
        "score-partwise" in sample or
        "score-timewise" in sample or
        "<?xml" in sample
    )


def _http_get(url: str, timeout: int = FETCH_TIMEOUT) -> bytes | None:
    try:
        req = Request(url, headers={"User-Agent": "SheetApp-Fetcher/2.0"})
        with urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None


def _http_get_bytes(url: str, timeout: int = FETCH_TIMEOUT) -> bytes | None:
    try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
            "Accept": "*/*",
        })
        with urlopen(req, timeout=timeout) as r:
            return r.read()
    except URLError as e:
        print(f"   ⚠️  URLError: {e}", flush=True)
        return None
    except Exception as e:
        print(f"   ⚠️  Error: {e}", flush=True)
        return None


def _read_songs() -> list:
    if not SONGS_FILE.exists():
        return []
    try:
        data = json.loads(SONGS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _write_songs(songs: list):
    SONGS_FILE.write_text(json.dumps(songs, ensure_ascii=False, indent=2), encoding="utf-8")


def _add_to_library(title: str, xml_path: str, key: str, source: str) -> dict:
    songs    = _read_songs()
    base_id  = _slugify(title) or f"song-{int(time.time())}"
    song_id  = base_id
    existing = {s["id"] for s in songs}
    counter  = 1
    while song_id in existing:
        song_id = f"{base_id}-{counter}"
        counter += 1

    song = {
        "id":         song_id,
        "title":      title,
        "xmlPath":    xml_path,
        "defaultKey": key,
        "source":     source,
        "dateAdded":  date.today().isoformat(),
    }
    songs.insert(0, song)
    _write_songs(songs)
    return song


def _detect_key(xml_text: str) -> str:
    m = re.search(r'<fifths>(-?\d+)</fifths>', xml_text)
    if not m:
        return ""
    fifths = int(m.group(1))
    keys   = ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#']
    idx    = fifths + 7
    return keys[idx] if 0 <= idx < len(keys) else ""


def _slugify(text: str) -> str:
    vn = str.maketrans(
        "àáảãạăắặằẳẵâấậầẩẫđèéẻẽẹêếệềểễìíỉĩịòóỏõọôốộồổỗơớợờởỡùúủũụưứựừửữỳýỷỹỵ"
        "ÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪĐÈÉẺẼẸÊẾỆỀỂỄÌÍỈĨỊÒÓỎÕỌÔỐỘỒỔỖƠỚỢỜỞỠÙÚỦŨỤƯỨỰỪỬỮỲÝỶỸỴ",
        "aaaaaaaaaaaaaaaaaadeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyy"
        "aaaaaaaaaaaaaaaaaadeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyy"
    )
    text = text.lower().translate(vn)
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text).strip('-')
    return text[:80]


def _unique_filename(title: str, ext: str) -> str:
    base  = _slugify(title) or f"sheet-{int(time.time())}"
    fname = base + ext
    i = 1
    while (SHEETS_DIR / fname).exists():
        fname = f"{base}-{i}{ext}"
        i += 1
    return fname


def _show_chrome_launch_help(port: int):
    chrome_exe = next((p for p in CHROME_PATHS if Path(p).exists()), None)
    print(f"\n{'─'*55}", flush=True)
    print("📋  CÁCH MỞ CHROME VỚI CDP:", flush=True)
    if chrome_exe:
        print(f'\n   "{chrome_exe}" --remote-debugging-port={port}', flush=True)
    else:
        print(f'\n   chrome.exe --remote-debugging-port={port}', flush=True)
    print(f'\n   Sau đó mở trang nhạc trong Chrome, rồi chạy lại:', flush=True)
    print(f'   python tools/fetch_sheet.py --cdp', flush=True)
    print(f"{'─'*55}\n", flush=True)


# ═══════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        prog="fetch_sheet.py",
        description="🎵  SheetApp — Tải MusicXML từ trang nhạc (OSMD/httlvn.org)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  # Import qua Chrome CDP (recommended cho httlvn.org):
  python tools/fetch_sheet.py --cdp

  # Import từ URL trực tiếp file .xml:
  python tools/fetch_sheet.py --url "https://example.com/sheet.xml"
  python tools/fetch_sheet.py --url "https://example.com/sheet.xml" --title "Tên bài"

  # Import từ file local:
  python tools/fetch_sheet.py --file "D:/Downloads/sheet.xml" --title "Tên bài"

  # Import nhiều file (XEm urls.txt):
  python tools/fetch_sheet.py --batch tools/urls.txt

  # Xem thư viện:
  python tools/fetch_sheet.py --list
        """
    )

    parser.add_argument("--cdp",    action="store_true", help="Kết nối Chrome đang chạy qua CDP (cần --remote-debugging-port)")
    parser.add_argument("--port",   type=int, default=CDP_PORT, help=f"CDP port (default: {CDP_PORT})")
    parser.add_argument("--url",    help="URL trực tiếp đến file .xml/.mxl")
    parser.add_argument("--file",   help="Đường dẫn file .xml/.mxl trên máy")
    parser.add_argument("--batch",  metavar="FILE", help="Import nhiều bài từ file text")
    parser.add_argument("--title",  "-t", default="", help="Tên bài hát (tuỳ chọn)")
    parser.add_argument("--delay",  "-d", type=float, default=1.5, help="Delay giữa các bài khi batch")
    parser.add_argument("--quiet",  "-q", action="store_true", help="Ít log hơn")
    parser.add_argument("--list",   "-l", action="store_true", help="Liệt kê thư viện")

    args = parser.parse_args()
    verbose = not args.quiet

    # ── List ───────────────────────────────────
    if args.list:
        songs = _read_songs()
        if not songs:
            print("📚  Thư viện trống.")
            return
        print(f"📚  Thư viện ({len(songs)} bài):\n")
        for i, s in enumerate(songs, 1):
            key = f" [{s['defaultKey']}]" if s.get("defaultKey") else ""
            print(f"  {i:3}. {s['title']}{key}")
            print(f"       {s.get('dateAdded','?')} | {s['id']}")
        return

    # ── Batch ──────────────────────────────────
    if args.batch:
        fetch_batch(args.batch, verbose=verbose, delay=args.delay)
        return

    # ── CDP ────────────────────────────────────
    if args.cdp:
        try:
            import websocket
        except ImportError:
            print("❌  Cần cài thêm: pip install websocket-client")
            sys.exit(1)

        results = fetch_via_cdp(port=args.port, verbose=verbose)
        if results:
            print(f"\n🎉  Import thành công {len(results)} bài!")
            for s in results:
                print(f"   ✅  {s['title']} [{s.get('defaultKey','')}]")
            print(f"\n   Mở SheetApp: http://localhost/SheetApp/")
        else:
            print("\n❌  Không import được bài nào.")
            print("   Đảm bảo Chrome đang mở trang bài hát và có CDP port.")
        return

    # ── Direct URL ─────────────────────────────
    if args.url:
        song = fetch_via_url(args.url, args.title, verbose=verbose)
        if song:
            print(f"\n🎉  Thành công: {song['title']}")
            print(f"   Key: {song.get('defaultKey','?')} | File: {song['xmlPath']}")
            print(f"   Mở SheetApp: http://localhost/SheetApp/")
        else:
            sys.exit(1)
        return

    # ── Local file ─────────────────────────────
    if args.file:
        song = fetch_from_file(args.file, args.title, verbose=verbose)
        if song:
            print(f"\n🎉  Thành công: {song['title']}")
            print(f"   Mở SheetApp: http://localhost/SheetApp/")
        else:
            sys.exit(1)
        return

    # ── No args → show help ───────────────────
    parser.print_help()
    print("\n" + "─"*55)
    print("💡  Gợi ý nhanh:")
    print("   1. Mở Chrome với: --remote-debugging-port=9222")
    print("   2. Vào trang thanhca.httlvn.org?op=sheet")
    print("   3. Chạy: python tools/fetch_sheet.py --cdp")


if __name__ == "__main__":
    main()
