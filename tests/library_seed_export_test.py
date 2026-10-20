"""Exercise export privacy on temporary databases only."""
from contextlib import redirect_stdout
from io import StringIO
import hashlib
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('export_seed', ROOT / 'tools/export_library_seed.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class LibrarySeedExportTest(unittest.TestCase):
    def test_export_removes_personal_bytes_and_never_changes_source(self):
        with tempfile.TemporaryDirectory(prefix='sheetapp-export-test-') as folder:
            source = Path(folder) / 'source.sqlite'
            source.write_bytes((ROOT / 'storage/seed/library.sqlite').read_bytes())
            db = sqlite3.connect(source)
            marker = 'PRIVATE-DATA-unique-export-regression'
            db.execute('UPDATE users SET password_hash=?,email=?,display_name=? WHERE id=(SELECT MIN(id) FROM users)', (marker, marker + '@invalid.test', marker))
            db.execute('CREATE TABLE future_personal_data (secret TEXT)')
            db.execute('INSERT INTO future_personal_data VALUES (?)', (marker,))
            db.commit()
            db.close()
            before = hashlib.sha256(source.read_bytes()).hexdigest()
            output = Path(folder) / 'release.sqlite'
            with redirect_stdout(StringIO()):
                exporter.export_library(source, output)
            self.assertEqual(before, hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertNotIn(marker.encode(), output.read_bytes())
            self.assertTrue(output.with_suffix('.manifest.json').is_file())
            with self.assertRaises(ValueError):
                exporter.export_library(source, output)
            db = sqlite3.connect(output)
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
            self.assertEqual(db.execute('SELECT COUNT(*) FROM future_personal_data').fetchone()[0], 0)
            db.close()

    def test_export_refuses_to_publish_private_songs(self):
        with tempfile.TemporaryDirectory(prefix='sheetapp-export-test-') as folder:
            source = Path(folder) / 'source.sqlite'
            source.write_bytes((ROOT / 'storage/seed/library.sqlite').read_bytes())
            db = sqlite3.connect(source)
            db.execute("UPDATE songs SET is_public=0 WHERE id=(SELECT MIN(id) FROM songs)")
            db.commit()
            db.close()
            output = Path(folder) / 'release.sqlite'
            with self.assertRaisesRegex(ValueError, 'Private songs'):
                exporter.export_library(source, output)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
