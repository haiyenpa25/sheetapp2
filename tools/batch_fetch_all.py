#!/usr/bin/env python3
"""
tools/batch_fetch_all.py  — v3
================================
Tải toàn bộ 903 bài Thánh Ca từ thanhca.httlvn.org
Lưu vào: storage/Thanh ca/<NNN> <Tên Bài>.xml

═══ CÁCH DÙNG ═══════════════════════════════════════════

BƯỚC 1: Mở Chrome với CDP:
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

BƯỚC 2: Vào trang httlvn.org trong Chrome:
  https://thanhca.httlvn.org/

BƯỚC 3: Chạy script:
  python tools/batch_fetch_all.py
  python tools/batch_fetch_all.py --resume        (tiếp tục nếu bị ngắt)
  python tools/batch_fetch_all.py --start 50      (bắt đầu từ bài 50)
  python tools/batch_fetch_all.py --status        (xem tiến độ)
"""

import argparse
import json
import os
import re
import sys
import time
import threading
from datetime import date
from pathlib import Path

SCRIPT_DIR    = Path(__file__).parent
ROOT_DIR      = SCRIPT_DIR.parent
SHEETS_DIR    = ROOT_DIR / "storage" / "Thanh ca"   # <<< Folder mới
SONGS_FILE    = ROOT_DIR / "storage" / "data" / "songs.json"
PROGRESS_FILE = SCRIPT_DIR / "batch_progress.json"

SHEETS_DIR.mkdir(parents=True, exist_ok=True)
SONGS_FILE.parent.mkdir(parents=True, exist_ok=True)

TOTAL     = 903
BASE_URL  = "https://thanhca.httlvn.org"
_lock     = threading.Lock()


# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════

def batch_fetch(start: int, end: int, delay: float, port: int, resume: bool):
    print(f"\n{'═'*62}")
    print(f"  SheetApp — Batch Import Thánh Ca HTTLVN")
    print(f"  Bài {start:03d}→{end:03d}  |  delay={delay}s  |  CDP port={port}")
    print(f"{'═'*62}\n")

    try:
        from playwright.sync_api import sync_playwright, Error as PWError
    except ImportError:
        print("❌  pip install playwright && playwright install chromium")
        sys.exit(1)

    prog      = _load_prog()
    done_set  = set(prog.get("done",   []))
    fail_set  = set(prog.get("failed", []))

    to_do = [n for n in range(start, end + 1) if not (resume and n in done_set)]

    print(f"📋  Cần tải: {len(to_do)} bài  (đã có: {len(done_set)}  |  lỗi cũ: {len(fail_set)})")
    if not to_do:
        print("✅  Tất cả đã tải xong!"); return

    print(f"🔌  Kết nối Chrome CDP port {port}...", flush=True)

    with sync_playwright() as pw:
        try:
            browser = pw.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
        except Exception as e:
            print(f"❌  Không kết nối được Chrome: {e}")
            _show_chrome_help(port)
            sys.exit(1)

        print(f"✅  Kết nối thành công!\n", flush=True)

        # Lấy context có sẵn (có cookies) hoặc tạo mới
        ctxs = browser.contexts
        ctx  = ctxs[0] if ctxs else browser.new_context(ignore_https_errors=True)

        # 1 page để navigate — tránh mở tab mới liên tục
        page = ctx.new_page()

        # Đi vào trang httlvn trước để có cookie/session
        try:
            page.goto(f"{BASE_URL}/", timeout=15000, wait_until="domcontentloaded")
        except Exception:
            pass  # Không quan trọng nếu fail

        stats = {"ok": 0, "fail": 0, "skip": 0, "t0": time.time()}
        total_work = len(to_do)

        print(f"{'─'*62}")
        print(f"  BẮT ĐẦU TẢI {total_work} BÀI...")
        print(f"{'─'*62}\n")

        for idx, n in enumerate(to_do, 1):
            # ETA
            elapsed   = time.time() - stats["t0"]
            rate      = idx / elapsed if elapsed > 0 else 0.01
            remaining = (total_work - idx) / rate
            eta       = _fmt_time(remaining)
            pct       = int(100 * idx / total_work)
            bar       = "█" * int(30 * idx / total_work) + "░" * (30 - int(30 * idx / total_work))

            sys.stdout.write(f"\r  [{bar}] {pct:3d}% ({idx}/{total_work}) ETA={eta}  ")
            sys.stdout.flush()

            result = _fetch_one(page, ctx, n, delay)

            if result.get("skip"):
                stats["skip"] += 1
                song = result["song"]
                print(f"\r  ⏭  #{n:03d} {song['title'][:50]}", flush=True)
                done_set.add(n); fail_set.discard(n)

            elif result.get("song"):
                stats["ok"] += 1
                song  = result["song"]
                key_s = f" [{song['defaultKey']}]" if song.get("defaultKey") else ""
                print(f"\r  ✅  #{n:03d} {song['title'][:50]}{key_s}", flush=True)
                done_set.add(n); fail_set.discard(n)

            else:
                stats["fail"] += 1
                err = (result.get("error") or "?")[:60]
                print(f"\r  ❌  #{n:03d} {err}", flush=True)
                fail_set.add(n)
                # Recreate page nếu bị die
                if "context" in err.lower() or "target" in err.lower():
                    try:
                        page.close()
                    except Exception:
                        pass
                    try:
                        page = ctx.new_page()
                    except Exception:
                        # context chết — reconnect
                        try: browser.close()
                        except Exception: pass
                        browser = pw.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
                        ctxs    = browser.contexts
                        ctx     = ctxs[0] if ctxs else browser.new_context()
                        page    = ctx.new_page()
                        print("  🔄  Reconnected Chrome", flush=True)

            # Lưu progress định kỳ
            if idx % 10 == 0:
                _save_prog(sorted(done_set), sorted(fail_set))

            if delay > 0 and idx < total_work:
                time.sleep(delay)

        _save_prog(sorted(done_set), sorted(fail_set))
        try: page.close()
        except Exception: pass

        elapsed_total = time.time() - stats["t0"]
        print(f"\n\n{'═'*62}")
        print(f"  KẾT QUẢ BATCH IMPORT")
        print(f"{'─'*62}")
        print(f"  ✅  Thành công : {stats['ok']:4d} bài")
        print(f"  ❌  Thất bại   : {stats['fail']:4d} bài")
        print(f"  ⏭  Bỏ qua     : {stats['skip']:4d} bài")
        print(f"  ⏱  Thời gian  : {_fmt_time(elapsed_total)}")
        print(f"  📁  Folder     : storage/Thanh ca/")
        print(f"{'─'*62}")
        if fail_set:
            print(f"\n  ⚠️  {len(fail_set)} bài lỗi — chạy lại với --resume để retry")

        songs_count = len(_read_songs())
        print(f"\n  📚  Thư viện: {songs_count} bài trong songs.json")
        print(f"\n  Mở SheetApp: http://localhost/SheetApp/")
        print(f"{'═'*62}\n")


# ═══════════════════════════════════════════════════════════
#  FETCH 1 BÀI
# ═══════════════════════════════════════════════════════════

def _fetch_one(page, ctx, song_id: int, delay: float) -> dict:
    # Kiểm tra đã có file chưa
    existing = _find_existing_file(song_id)
    if existing:
        song = _song_from_file(song_id, existing)
        return {"skip": True, "song": song}

    download_url = f"{BASE_URL}/Download/SheetMusic/{song_id}"

    for attempt in range(3):
        try:
            # Dùng page.request để tải XML qua Chrome context (có cookies)
            resp = page.request.get(
                download_url,
                headers={
                    "Referer"       : f"{BASE_URL}/",
                    "Accept"        : "application/xml,application/vnd.recordare.musicxml+xml,*/*",
                    "Cache-Control" : "no-cache",
                },
                timeout=25000
            )

            if not resp.ok:
                if resp.status == 404:
                    return {"error": "404 Not Found — bài không tồn tại"}
                if resp.status == 429:
                    time.sleep(5 * (attempt + 1))
                    continue
                if resp.status in (403, 503):
                    time.sleep(3)
                    continue
                return {"error": f"HTTP {resp.status}"}

            content = resp.body()

            if not content or len(content) < 50:
                return {"error": f"Empty/too small ({len(content or b'')} bytes)"}

            # Validate MusicXML
            is_mxl  = content[:2] == b"PK"   # .mxl = ZIP
            sample  = content[:600].decode("utf-8", errors="ignore")

            if not is_mxl and "score-partwise" not in sample and "score-timewise" not in sample:
                if "<html" in sample.lower():
                    return {"error": "Protected — nhận HTML thay vì XML"}
                return {"error": f"Không phải MusicXML: {sample[:80]!r}"}

            # Lấy tên bài từ XML
            title = _title_from_xml(sample, song_id)
            ext   = ".mxl" if is_mxl else ".xml"

            # Tên file: NNN Tên Bài.xml
            filename = _make_filename(song_id, title, ext)
            fpath    = SHEETS_DIR / filename
            fpath.write_bytes(content)

            # Key
            key = _detect_key(sample)

            # Cập nhật songs.json
            rel_path = f"storage/Thanh ca/{filename}"
            song     = _add_to_library(song_id, title, rel_path, key, download_url)
            return {"song": song}

        except Exception as e:
            err = str(e)
            if "Timeout" in err or "timeout" in err:
                if attempt < 2:
                    time.sleep(2)
                    continue
            return {"error": err[:120]}

    return {"error": "Max retries exceeded"}


# ═══════════════════════════════════════════════════════════
#  FILE NAMING — NNN Tên Bài.xml
# ═══════════════════════════════════════════════════════════

def _make_filename(song_id: int, title: str, ext: str) -> str:
    """Tạo tên file: '001 Cúi Xin Vua Thánh Ngự Lại.xml'"""
    # Làm sạch title dùng cho tên file (giữ nguyên dấu tiếng Việt)
    safe_title = _safe_filename(title)
    return f"{song_id:03d} {safe_title}{ext}"


def _safe_filename(text: str) -> str:
    """Xóa ký tự không hợp lệ trong tên file Windows, giữ tiếng Việt."""
    # Ký tự cấm trong Windows filename
    text = re.sub(r'[\\/:*?"<>|]', '', text)
    text = text.strip('. ')
    return text[:100] or "Bai Hat"


def _find_existing_file(song_id: int):
    """Tìm file đã tải với prefix số bài."""
    prefix = f"{song_id:03d} "
    for f in SHEETS_DIR.iterdir():
        if f.name.startswith(prefix):
            return f
    return None


def _song_from_file(song_id: int, fpath: Path) -> dict:
    """Tạo dict song từ file đã có."""
    songs = _read_songs()
    for s in songs:
        if s.get("httlvnId") == song_id:
            return s
    # File có nhưng chưa trong songs.json → thêm vào
    title = fpath.stem.split(" ", 1)[1] if " " in fpath.stem else fpath.stem
    rel   = f"storage/Thanh ca/{fpath.name}"
    try:
        content = fpath.read_bytes()
        key = _detect_key(content.decode("utf-8", errors="ignore"))
    except Exception:
        key = ""
    return _add_to_library(song_id, title, rel, key, "local")


# ═══════════════════════════════════════════════════════════
#  XML PARSERS
# ═══════════════════════════════════════════════════════════

def _title_from_xml(sample: str, song_id: int) -> str:
    """Lấy tên bài từ XML. Ưu tiên movement-title > work-title."""
    for tag in ("movement-title", "work-title", "piece", "title"):
        m = re.search(fr"<{tag}>\s*([^<]+?)\s*</{tag}>", sample, re.IGNORECASE)
        if m:
            t = m.group(1).strip()
            # Bỏ prefix số nếu có: "001. Tên bài" → "Tên bài"
            t = re.sub(r"^\d+[\.\-\s]+", "", t).strip()
            if t and t.lower() not in ("untitled", "", "unknown"):
                return t
    return f"Thánh Ca {song_id:03d}"


def _detect_key(xml_text: str) -> str:
    m = re.search(r"<fifths>(-?\d+)</fifths>", xml_text)
    if not m: return ""
    fifths = int(m.group(1))
    keys   = ["Cb","Gb","Db","Ab","Eb","Bb","F","C","G","D","A","E","B","F#","C#"]
    idx    = fifths + 7
    return keys[idx] if 0 <= idx < len(keys) else ""


# ═══════════════════════════════════════════════════════════
#  SONGS.JSON
# ═══════════════════════════════════════════════════════════

def _read_songs() -> list:
    if not SONGS_FILE.exists(): return []
    try:
        data = json.loads(SONGS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception: return []


def _write_songs(songs: list):
    SONGS_FILE.write_text(
        json.dumps(songs, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def _add_to_library(song_id: int, title: str, xml_path: str, key: str, source: str) -> dict:
    with _lock:
        songs = _read_songs()
        # Kiểm tra đã có chưa
        for s in songs:
            if s.get("httlvnId") == song_id:
                return s
        song = {
            "id"         : f"thanh-ca-{song_id:03d}",
            "httlvnId"   : song_id,
            "title"      : title,
            "xmlPath"    : xml_path,
            "defaultKey" : key,
            "source"     : source,
            "dateAdded"  : date.today().isoformat(),
        }
        songs.append(song)
        songs.sort(key=lambda s: s.get("httlvnId") or 0)
        _write_songs(songs)
        return song


# ═══════════════════════════════════════════════════════════
#  PROGRESS
# ═══════════════════════════════════════════════════════════

def _load_prog() -> dict:
    if not PROGRESS_FILE.exists(): return {"done": [], "failed": []}
    try: return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    except Exception: return {"done": [], "failed": []}


def _save_prog(done: list, failed: list):
    PROGRESS_FILE.write_text(
        json.dumps({"done": done, "failed": failed, "ts": time.strftime("%Y-%m-%d %H:%M:%S")},
                   ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


# ═══════════════════════════════════════════════════════════
#  UTILS
# ═══════════════════════════════════════════════════════════

def _fmt_time(secs: float) -> str:
    if secs < 60:  return f"{int(secs)}s"
    m, s = divmod(int(secs), 60)
    if m < 60: return f"{m}m{s:02d}s"
    h, m = divmod(m, 60); return f"{h}h{m:02d}m"


def _show_chrome_help(port: int):
    paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        fr"C:\Users\{os.environ.get('USERNAME','')}\AppData\Local\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    chrome = next((p for p in paths if Path(p).exists()), "chrome.exe")
    print(f"\n{'─'*62}")
    print(f"  Mở Chrome với CDP debugging:\n")
    print(f'  "{chrome}" --remote-debugging-port={port} --no-first-run')
    print(f"\n  Sau đó mở https://thanhca.httlvn.org/ trong Chrome đó")
    print(f"  rồi chạy lại script này.")
    print(f"{'─'*62}\n")


def _print_status():
    prog  = _load_prog()
    done  = prog.get("done",   [])
    failed= prog.get("failed", [])
    songs = _read_songs()
    files = list(SHEETS_DIR.glob("*.xml")) + list(SHEETS_DIR.glob("*.mxl"))
    print(f"\n📊  Trạng thái:")
    print(f"  ✅  Đã tải  : {len(done)}/{TOTAL} bài")
    print(f"  ❌  Lỗi    : {len(failed)} bài")
    print(f"  📚  songs.json: {len(songs)} entries")
    print(f"  💾  Files  : {len(files)} files trong 'storage/Thanh ca/'")
    if failed:
        sample = sorted(failed)[:20]
        print(f"  Bài lỗi   : {sample}{'...' if len(failed)>20 else ''}")
    if done:
        print(f"  Cập nhật  : {prog.get('ts','?')}")


# ═══════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(
        prog="batch_fetch_all.py",
        description="🎵  Tải toàn bộ 903 bài Thánh Ca HTTLVN → storage/Thanh ca/",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python tools/batch_fetch_all.py                  # tải tất cả
  python tools/batch_fetch_all.py --resume         # tiếp tục (bỏ qua bài đã có)
  python tools/batch_fetch_all.py --start 100      # bắt đầu từ bài 100
  python tools/batch_fetch_all.py --start 1 --end 50  # bài 1-50
  python tools/batch_fetch_all.py --delay 0.3      # delay ngắn hơn (nhanh hơn)
  python tools/batch_fetch_all.py --status         # xem tiến độ
        """
    )
    ap.add_argument("--start",   type=int, default=1,     help="Bài bắt đầu (default: 1)")
    ap.add_argument("--end",     type=int, default=TOTAL, help=f"Bài kết thúc (default: {TOTAL})")
    ap.add_argument("--delay",   type=float, default=0.3, help="Delay giữa mỗi bài giây (default: 0.3)")
    ap.add_argument("--port",    type=int, default=9222,  help="Chrome CDP port (default: 9222)")
    ap.add_argument("--resume",  action="store_true",     help="Bỏ qua bài đã tải")
    ap.add_argument("--status",  action="store_true",     help="Xem tiến độ")
    ap.add_argument("--reset",   action="store_true",     help="Xóa progress, bắt đầu lại")

    args = ap.parse_args()

    if args.status:
        _print_status(); return

    if args.reset:
        if input("Reset toàn bộ progress? (yes/no): ").strip().lower() == "yes":
            PROGRESS_FILE.unlink(missing_ok=True)
            print("✅  Đã reset."); return
        print("Hủy."); return

    if not (1 <= args.start <= args.end <= 903):
        print("❌  --start và --end phải trong 1-903 và start <= end"); sys.exit(1)

    batch_fetch(args.start, args.end, args.delay, args.port, args.resume)


if __name__ == "__main__":
    main()
