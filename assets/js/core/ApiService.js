/**
 * core/ApiService.js — Centralized API Client
 * Tất cả fetch() calls tập trung tại đây.
 * Modules gọi ApiService thay vì fetch trực tiếp → dễ mock, dễ thay URL.
 */
const ApiService = (() => {
  'use strict';

  async function _request(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function _json(method, url, body) {
    return _request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  const songs = {
    list:   ()            => _request('api/index.php?route=songs'),
    search: (q)           => _request(`api/index.php?route=songs&lyric_search=${encodeURIComponent(q)}`),
    add:    (data)        => _json('POST',   'api/index.php?route=songs', data),
    update: (id, data)    => _json('PUT',    `api/index.php?route=songs&id=${encodeURIComponent(id)}`, data),
    updateMetadata: (id, patch) => _json('PUT', `api/index.php?route=songs&action=update_metadata&id=${encodeURIComponent(id)}`, patch),
    delete: (id)          => _request(`api/index.php?route=songs&id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };

  const chordSets = {
    list:   (songId)             => _request(`api/index.php?route=chord_sets&action=list&songId=${encodeURIComponent(songId)}`),
    load:   (songId, name)       => _request(`api/index.php?route=chord_sets&action=load&songId=${encodeURIComponent(songId)}&name=${encodeURIComponent(name)}`),
    save:   (songId, name, chords) => _json('POST', 'api/index.php?route=chord_sets', { action:'save', songId, name, chords }),
    delete: (songId, name)       => _json('POST', 'api/index.php?route=chord_sets', { action:'delete', songId, name }),
  };

  const sessions = {
    load:             (songId)           => _request(`api/index.php?route=sessions&songId=${encodeURIComponent(songId)}`),
    saveUserSettings: (songId, settings) => _json('POST', 'api/index.php?route=sessions', { songId, userSettings: settings }),
    savePerfNotes:    (songId, notes)    => _json('POST', 'api/index.php?route=sessions', { songId, perfNotes: notes }),
  };

  const annotations = {
    load: (songId)          => _request(`api/index.php?route=annotations&action=load&songId=${encodeURIComponent(songId)}`),
    save: (songId, list)    => _json('POST', 'api/index.php?route=annotations', { action:'save', songId, annotations: list }),
  };

  const setlists = {
    list:       ()              => _request('api/index.php?route=setlists'),
    get:        (id)            => _request(`api/index.php?route=setlists&id=${id}`),
    create:     (data)          => _json('POST',   'api/index.php?route=setlists', data),
    delete:     (id)            => _request(`api/index.php?route=setlists&id=${id}`, { method: 'DELETE' }),
    addItem:    (data)          => _json('POST', 'api/index.php?route=setlists&action=add_item', data),
    updateItem: (id, data)      => _json('POST', `api/index.php?route=setlists&action=update_item&id=${id}`, data),
    removeItem: (id)            => _request(`api/index.php?route=setlists&action=remove_item&id=${id}`, { method: 'DELETE' }),
  };

  const saveXml = (filepath, xml) => _json('POST', 'api/index.php?route=songs&action=save_xml', { filepath, xml });

  const categories = {
    list:   ()         => _request('api/index.php?route=categories'),
    create: (data)     => _json('POST',   'api/index.php?route=categories', data),
    update: (id, data) => _json('PUT',    `api/index.php?route=categories&id=${id}`, data),
    delete: (id)       => _request(`api/index.php?route=categories&id=${id}`, { method: 'DELETE' }),
  };

  const users = {
    list:   ()         => _request('api/index.php?route=users'),
    create: (data)     => _json('POST',   'api/index.php?route=users', data),
    update: (id, data) => _json('PUT',    `api/index.php?route=users&id=${id}`, data),
    delete: (id)       => _request(`api/index.php?route=users&id=${id}`, { method: 'DELETE' }),
  };

  const auth = {
    me:     ()         => _request('api/index.php?route=auth&action=me'),
    login:  (data)     => _json('POST', 'api/index.php?route=auth&action=login', data),
    logout: ()         => _request('api/index.php?route=auth&action=logout'),
  };

  const omr = {
    list:   ()       => _request('api/index.php?route=omr').then(r => r.jobs ?? []),
    create: (fd)     => _request('api/index.php?route=omr', { method: 'POST', body: fd }), // fd is FormData, don't use _json
    delete: (id)     => _request(`api/index.php?route=omr&id=${id}`, { method: 'DELETE' }),
  };

  const importer = {
    search: (url)    => _json('POST', 'api/import.php', { type: 'search', url }),
    fetch:  (url)    => _json('POST', 'api/import.php', { type: 'fetch', url }),
    upload: (fd)     => _request('api/import.php?type=upload', { method: 'POST', body: fd }),
    save:   (data)   => _json('POST', 'api/import.php', { type: 'save', ...data })
  };

  const arrangements = {
    getSections:       (songId)                  => _request(`api/index.php?route=arrangements&action=sections&songId=${encodeURIComponent(songId)}`),
    saveSection:       (songId, section)         => _json('POST', `api/index.php?route=arrangements&action=save_section&songId=${encodeURIComponent(songId)}`, section),
    saveAllSections:   (songId, sections)        => _json('POST', `api/index.php?route=arrangements&action=save_sections`, { songId, sections }),
    deleteSection:     (id)                      => _request(`api/index.php?route=arrangements&action=delete_section&id=${id}`, { method: 'DELETE' }),
    list:              (songId)                  => _request(`api/index.php?route=arrangements&action=arrangements&songId=${encodeURIComponent(songId)}`),
    getSteps:          (arrangementId)           => _request(`api/index.php?route=arrangements&action=steps&arrangementId=${arrangementId}`),
    saveArrangement:   (songId, arr, steps = []) => _json('POST', `api/index.php?route=arrangements&action=save_arrangement`, { songId, arrangement: arr, steps }),
    deleteArrangement: (id)                      => _request(`api/index.php?route=arrangements&action=delete_arrangement&id=${id}`, { method: 'DELETE' }),
  };

  const liveSync = {
    create: (room, data = {})         => _json('POST', 'api/index.php?route=live_sync&action=create', { room, ...data }),
    poll:   (room, rev = 0)           => _request(`api/index.php?route=live_sync&room=${encodeURIComponent(room)}&rev=${rev}`),
    update: (room, hostToken, data)   => _json('POST', 'api/index.php?route=live_sync', { room, hostToken, ...data }),
    close:  (room, hostToken)         => _json('POST', 'api/index.php?route=live_sync&action=close', { room, hostToken }),
  };

  return { songs, chordSets, sessions, annotations, setlists, categories, saveXml, omr, importer, users, auth, liveSync, arrangements };
})();

window.ApiService = ApiService;
