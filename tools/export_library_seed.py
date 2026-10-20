"""Export the public library without modifying the live SQLite database.

Maintainer command: python tools/export_library_seed.py --output=<new.sqlite>
Never commit app.sqlite, login state, logs, or backups from a running server.
"""
import argparse
from contextlib import closing
import hashlib
import json
import re
import sqlite3
import tempfile
from pathlib import Path


def export_library(source: Path, output: Path) -> None:
    manifest = output.with_suffix('.manifest.json')
    if output.exists() or manifest.exists():
        raise ValueError("Output exists; export to a new path and review before replacing it")
    output.parent.mkdir(parents=True, exist_ok=True)
    source_db = sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True)
    source_db.row_factory = sqlite3.Row
    try:
        with tempfile.TemporaryDirectory(prefix='sheetapp-seed-') as directory:
            staged = Path(directory) / 'library.sqlite'
            with closing(sqlite3.connect(staged)) as db:
                source_db.backup(db)
                if db.execute("SELECT COUNT(*) FROM songs WHERE is_public!=1 OR visibility!='public'").fetchone()[0]:
                    raise ValueError('Private songs require a separate reviewed export')
                if db.execute('SELECT COUNT(*) FROM user_chord_sets WHERE is_public!=1').fetchone()[0] or db.execute('SELECT COUNT(*) FROM song_versions WHERE is_public!=1').fetchone()[0]:
                    raise ValueError('Private arrangements require a separate reviewed export')
                users = list(source_db.execute('SELECT * FROM users'))
                keep = {'users', 'songs', 'categories', 'song_sections', 'arrangements',
                        'arrangement_steps', 'song_versions', 'user_chord_sets', 'schema_migrations'}
                # Drop personal activity from every application table, including future ones.
                db.execute('PRAGMA foreign_keys=OFF')
                db.execute('PRAGMA secure_delete=ON')
                for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
                    if name not in keep and not name.startswith('sqlite_') and not name.startswith('songs_fts'):
                        db.execute('DELETE FROM "' + name.replace('"', '""') + '"')
                db.execute('DELETE FROM users')
                for user in users:
                    db.execute('INSERT INTO users (id,username,password_hash,role,display_name,status) VALUES (?,?,?,?,?,?)',
                               (user['id'], 'contributor-' + str(user['id']), '!', 'viewer', 'Library contributor', 'inactive'))
                db.execute('UPDATE users SET created_at=?', ('2000-01-01 00:00:00',))
                db.execute('UPDATE songs SET created_by=NULL')
                replacements = {}
                for user in users:
                    for key in ('username', 'display_name', 'email', 'bio', 'avatar_url'):
                        if user[key]:
                            replacements[user[key]] = 'Library contributor'
                for table, columns in [('user_chord_sets', ['username', 'attribution', 'notes_guide']),
                                       ('song_versions', ['username', 'version_name', 'description'])]:
                    for row in db.execute('SELECT id,' + ','.join(columns) + ' FROM ' + table).fetchall():
                        for index, column in enumerate(columns, 1):
                            value = row[index]
                            if not isinstance(value, str):
                                continue
                            if column == 'username':
                                value = 'library'
                            else:
                                for old in sorted(replacements, key=len, reverse=True):
                                    value = re.sub(re.escape(old), replacements[old], value, flags=re.IGNORECASE)
                            db.execute('UPDATE ' + table + ' SET ' + column + '=? WHERE id=?', (value, row[0]))
                    db.execute('UPDATE ' + table + ' SET approved_by=NULL')
                # Remove deleted strings from SQLite free pages and WAL, not just query results.
                db.commit()
                db.execute('PRAGMA journal_mode=DELETE')
                db.execute('VACUUM')
                if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('Seed integrity/foreign key validation failed')
                counts = {table: db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]
                          for table in ('songs', 'categories', 'user_chord_sets', 'song_versions', 'song_sections')}
                categories = [{'slug': row[0], 'songs': row[1]} for row in db.execute(
                    'SELECT categories.slug,COUNT(songs.id) FROM categories LEFT JOIN songs ON songs.category_id=categories.id GROUP BY categories.id')]
            data = staged.read_bytes()
            for user in users:
                for key in ('password_hash', 'email'):
                    if user[key] and user[key] != '!' and user[key].encode() in data:
                        raise ValueError('Personal credentials remain in seed')
            with output.open('xb') as handle:
                handle.write(data)
            metadata = {'format': 1, 'database_sha256': hashlib.sha256(data).hexdigest(),
                        'counts': counts, 'categories': categories,
                        'privacy': 'Anonymous disabled contributors; no source passwords, emails or activity. Create a new admin on installation.'}
            root = Path(__file__).resolve().parent.parent
            metadata['chord_files'] = {path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()
                                       for path in sorted((root / 'storage/data/chord_sets').rglob('*.json'))}
            with manifest.open('x', encoding='utf-8') as handle:
                handle.write(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
            print(json.dumps(counts))
    finally:
        source_db.close()


if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=root / 'storage/data/app.sqlite')
    parser.add_argument('--output', type=Path, default=root / 'storage/seed/library.sqlite')
    args = parser.parse_args()
    export_library(args.source, args.output)
