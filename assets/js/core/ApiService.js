/**
 * core/ApiService.js — Centralized API Client
 * Tất cả fetch() calls tập trung tại đây.
 * Modules gọi ApiService thay vì fetch trực tiếp → dễ mock, dễ thay URL.
 */
const ApiService = (() => {
  'use strict';

  function _getBaseUrl() {
    if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'string') {
      return window.__APP_BASE__.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const knownAppRoots = [
        'learn', 'live-band', 'manager', 'editor', 'huong-dan', 'omr',
        'api', 'assets', 'storage', 'tools', 'tests', 'docs',
        'index.php', 'login.php', 'register.php', 'projector.php'
      ];
      if (parts.length > 0 && !knownAppRoots.includes(parts[0])) {
        return '/' + parts[0];
      }
    }
    return '';
  }

  function resolveUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (/^(https?:|\/\/|blob:|data:)/i.test(url)) {
      return url;
    }
    const base = _getBaseUrl();
    const cleanUrl = url.replace(/^\/+/, '');
    return base ? `${base}/${cleanUrl}` : `/${cleanUrl}`;
  }

  async function _request(url, options = {}) {
    const finalUrl = resolveUrl(url);
    const res = await fetch(finalUrl, options);
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
    get:    async (id)    => {
      if (!id) return null;
      try {
        const res = await _request(`api/index.php?route=songs&action=get&id=${encodeURIComponent(id)}`);
        if (res && res.data) return res.data;
        if (res && res.id) return res;
      } catch (e) {
        // Fallback to searching in full song list
      }
      const list = await _request('api/index.php?route=songs');
      const items = Array.isArray(list) ? list : (list?.data || []);
      return items.find(s => s.id === id) || null;
    },
    search: (q = '', filters = {}) => {
      const p = new URLSearchParams();
      p.set('route', 'songs');
      p.set('action', 'search');
      if (q) p.set('q', q);
      if (filters.season) p.set('season', filters.season);
      if (filters.theme)  p.set('theme', filters.theme);
      if (filters.category_id) p.set('category_id', filters.category_id);
      if (filters.limit) p.set('limit', filters.limit);
      return _request(`api/index.php?${p.toString()}`);
    },
    getTaxonomy: ()       => _request('api/index.php?route=songs&action=taxonomy'),
    rebuildFts:  ()       => _json('POST', 'api/index.php?route=songs&action=rebuild_fts', {}),
    getVersions: (songId) => _request(`api/index.php?route=songs&action=get_versions&song_id=${encodeURIComponent(songId)}`),
    saveVersion: (payload) => _json('POST', 'api/index.php?route=songs&action=save_version', payload),
    deleteVersion: (versionId) => _json('POST', 'api/index.php?route=songs&action=delete_version', { version_id: versionId }),
    add:    (data)        => _json('POST',   'api/index.php?route=songs', data),
    update: (id, data)    => _json('PUT',    `api/index.php?route=songs&id=${encodeURIComponent(id)}`, data),
    updateMetadata: (id, patch) => _json('PUT', `api/index.php?route=songs&action=update_metadata&id=${encodeURIComponent(id)}`, patch),
    delete: (id)          => _request(`api/index.php?route=songs&id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };

  const chordSets = {
    list:   (songId)             => _request(`api/index.php?route=chord_sets&action=list&songId=${encodeURIComponent(songId)}`),
    load:   (songId, name)       => _request(`api/index.php?route=chord_sets&action=load&songId=${encodeURIComponent(songId)}&name=${encodeURIComponent(name)}`),
    save:   (songId, name, chords) => _json('POST', 'api/index.php?route=chord_sets', { action:'save', songId, name, chords }),
    clone:  (songId, source, target) => _json('POST', 'api/index.php?route=chord_sets', { action:'clone', songId, source, target, sourceName: source, targetName: target, name: target }),
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
    list:             ()                  => _request('api/index.php?route=setlists'),
    get:              (id)                => _request(`api/index.php?route=setlists&id=${id}`),
    create:           (data)              => _json('POST',   'api/index.php?route=setlists', data),
    update:           (id, data)          => _json('POST',   `api/index.php?route=setlists&action=update&id=${id}`, data),
    publish:          (id)                => _json('POST',   `api/index.php?route=setlists&action=publish&id=${id}`, {}),
    delete:           (id)                => _request(`api/index.php?route=setlists&id=${id}`, { method: 'DELETE' }),
    addItem:          (data)              => _json('POST',   'api/index.php?route=setlists&action=add_item', data),
    updateItem:       (id, data)          => _json('POST',   `api/index.php?route=setlists&action=update_item&id=${id}`, data),
    removeItem:       (id)                => _request(`api/index.php?route=setlists&action=remove_item&id=${id}`, { method: 'DELETE' }),
    assign:           (data)              => _json('POST',   'api/index.php?route=setlists&action=assign', data),
    removeAssignment: (id)                => _request(`api/index.php?route=setlists&action=remove_assignment&id=${id}`, { method: 'DELETE' }),
    respondAssignment:(id, status, notes) => _json('POST',   `api/index.php?route=setlists&action=respond_assignment&id=${id}`, { status, notes }),
    songUsage:        (songId)            => _request(`api/index.php?route=setlists&action=song_usage&song_id=${encodeURIComponent(songId)}`),
    checkRecentUsage: (songId, weeks = 4) => _request(`api/index.php?route=setlists&action=check_recent_usage&song_id=${encodeURIComponent(songId)}&weeks=${weeks}`),
    usageReport:      (params = {}) => {
      const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
      return _request('api/index.php?route=setlists&action=usage_report' + (qs ? '&' + qs : ''));
    },
    getOfflinePackage:(id)                => _request(`api/index.php?route=setlists&action=offline_package&id=${id}`),
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
    me:            ()         => _request('api/index.php?route=auth&action=me'),
    login:         (data)     => _json('POST', 'api/index.php?route=auth&action=login', data),
    register:      (data)     => _json('POST', 'api/index.php?route=auth&action=register', data),
    updateProfile: (data)     => _json('POST', 'api/index.php?route=auth&action=update_profile', data),
    logout:        ()         => _request('api/index.php?route=auth&action=logout', { method: 'POST' }),
  };

  const omr = {
    list:   ()       => _request('api/index.php?route=omr').then(r => r.jobs ?? []),
    create: (fd)     => _request('api/index.php?route=omr', { method: 'POST', body: fd }), // fd is FormData, don't use _json
    delete: (id)     => _request(`api/index.php?route=omr&id=${id}`, { method: 'DELETE' }),
  };

  const importer = {
    search: (url)    => _json('POST', 'api/index.php?route=import', { type: 'search', url }),
    fetch:  (url)    => _json('POST', 'api/index.php?route=import', { type: 'fetch', url }),
    upload: (fd)     => _request('api/index.php?route=import&type=upload', { method: 'POST', body: fd }),
    save:   (data)   => _json('POST', 'api/index.php?route=import', { type: 'save', ...data })
  };

  const practice = {
    start:         (data)           => _json('POST', 'api/index.php?route=practice&action=start', data),
    checkpoint:    (data)           => _json('POST', 'api/index.php?route=practice&action=checkpoint', data),
    finish:        (data)           => _json('POST', 'api/index.php?route=practice&action=finish', data),
    getProgress:   (songId)         => _request(`api/index.php?route=practice&action=progress&song_id=${encodeURIComponent(songId)}`),
    getDashboard:  ()               => _request('api/index.php?route=practice&action=dashboard'),
    getLeaderView: (songId = '')    => _request(`api/index.php?route=practice&action=leader_view${songId ? '&song_id=' + encodeURIComponent(songId) : ''}`),
    setConsent:    (consent)        => _json('POST', 'api/index.php?route=practice&action=consent', { consent: !!consent }),
    stats:         (userId, songId) => _request(`api/index.php?route=practice&action=stats&userId=${encodeURIComponent(userId)}&songId=${encodeURIComponent(songId)}`)
  };

  const manager = {
    searchSongs:            (q)      => _request(`api/index.php?route=manager&action=search_songs&q=${encodeURIComponent(q)}`),
    songDetails:            (songId) => _request(`api/index.php?route=manager&action=song_details&song_id=${encodeURIComponent(songId)}`),
    stats:                  ()       => _request('api/index.php?route=manager&action=stats'),
    categories:             ()       => _request('api/index.php?route=manager&action=categories'),
    repertoire:             (params = {}) => {
      const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
      return _request('api/index.php?route=manager&action=repertoire' + (qs ? '&' + qs : ''));
    },
    communityChords:        (params = {}) => {
      const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
      return _request('api/index.php?route=manager&action=community_chords' + (qs ? '&' + qs : ''));
    },
    versions:               (params = {}) => {
      const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
      return _request('api/index.php?route=manager&action=versions' + (qs ? '&' + qs : ''));
    },
    deleteVersion:          (data)   => _json('POST', 'api/index.php?route=manager&action=delete_version', data),
    toggleVersionRecommend: (data)   => _json('POST', 'api/index.php?route=manager&action=toggle_version_recommend', data),
    users:                  Object.assign(
      () => _request('api/index.php?route=manager&action=users'),
      {
        list: () => _request('api/index.php?route=manager&action=users'),
        manage: (data) => _json('POST', 'api/index.php?route=manager&action=manage_user', data),
        myContributions: () => _request('api/index.php?route=manager&action=my_contributions')
      }
    ),
    forkSong:               (data)   => _json('POST', 'api/index.php?route=manager&action=fork_song', data),
    manageUser:             (data)   => _json('POST', 'api/index.php?route=manager&action=manage_user', data),
    manageCategory:         (data)   => _json('POST', 'api/index.php?route=manager&action=manage_category', data),
    myContributions:        ()       => _request('api/index.php?route=manager&action=my_contributions'),
    updateSongCategory:     (data)   => _json('POST', 'api/index.php?route=manager&action=update_song_category', data),
    toggleRecommend:        (data)   => _json('POST', 'api/index.php?route=manager&action=toggle_recommend', data),
    deleteChordSet:         (data)   => _json('POST', 'api/index.php?route=manager&action=delete_chord_set', data)
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
    poll:   (room, rev = 0, clientId = '', role = '') => {
      let u = `api/index.php?route=live_sync&room=${encodeURIComponent(room)}&rev=${rev}`;
      if (clientId) u += `&clientId=${encodeURIComponent(clientId)}`;
      if (role) u += `&role=${encodeURIComponent(role)}`;
      return _request(u);
    },
    update: (room, hostToken, data)   => _json('POST', 'api/index.php?route=live_sync', { room, hostToken, ...data }),
    close:  (room, hostToken)         => _json('POST', 'api/index.php?route=live_sync&action=close', { room, hostToken }),
  };

  const errors = {
    report: (data) => _json('POST', 'api/log_error.php', data)
  };

  const notifications = {
    list: (limit = 20, offset = 0) =>
      _request(`api/index.php?route=notifications&action=list&limit=${limit}&offset=${offset}`),
    count: () =>
      _request('api/index.php?route=notifications&action=count'),
    markRead: (id) =>
      _json('POST', 'api/index.php?route=notifications&action=mark_read', { id }),
    markAllRead: () =>
      _json('POST', 'api/index.php?route=notifications&action=mark_all_read', {})
  };

  const practiceAssignments = {
    mine: () =>
      _request('api/index.php?route=practice_assignments&action=mine'),
    board: (setlistId) =>
      _request(`api/index.php?route=practice_assignments&action=board&setlist_id=${encodeURIComponent(setlistId)}`),
    detail: (id) =>
      _request(`api/index.php?route=practice_assignments&action=detail&id=${encodeURIComponent(id)}`),
    createFromPlan: (setlistId) =>
      _json('POST', 'api/index.php?route=practice_assignments&action=create_from_plan', { setlist_id: setlistId }),
    create: (data) =>
      _json('POST', 'api/index.php?route=practice_assignments&action=create', data),
    markDone: (assignmentId) =>
      _json('POST', 'api/index.php?route=practice_assignments&action=mark_done', { assignment_id: assignmentId }),
    markExcused: (assignmentId, targetUserId) =>
      _json('POST', 'api/index.php?route=practice_assignments&action=mark_excused', { assignment_id: assignmentId, target_user_id: targetUserId }),
    archive: (assignmentId) =>
      _json('POST', 'api/index.php?route=practice_assignments&action=archive', { assignment_id: assignmentId })
  };

  const exportService = {
    chordproUrl: (songId, set = 'HD', transpose = 0, download = false) => {
      let u = `api/index.php?route=export&format=chordpro&song_id=${encodeURIComponent(songId)}&set=${encodeURIComponent(set)}&transpose=${encodeURIComponent(transpose)}`;
      if (download) u += '&download=1';
      return resolveUrl(u);
    },
    chordproJson: (songId, set = 'HD', transpose = 0) =>
      _request(`api/index.php?route=export&format=chordpro&song_id=${encodeURIComponent(songId)}&set=${encodeURIComponent(set)}&transpose=${encodeURIComponent(transpose)}&as_json=1`),
    chordproText: async (songId, set = 'HD', transpose = 0) => {
      const u = resolveUrl(`api/index.php?route=export&format=chordpro&song_id=${encodeURIComponent(songId)}&set=${encodeURIComponent(set)}&transpose=${encodeURIComponent(transpose)}`);
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    }
  };

  const reviews = {
    getQueue:   (params = {}) => {
      const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
      return _request('api/index.php?route=reviews&action=queue' + (qs ? '&' + qs : ''));
    },
    getMyRequests: () => _request('api/index.php?route=reviews&action=mine'),
    getDetail:  (id) => _request(`api/index.php?route=reviews&action=detail&id=${id}`),
    getHdHistory: (songId) => _request(`api/index.php?route=reviews&action=hd_history&song_id=${encodeURIComponent(songId)}`),
    submit:     (data) => _json('POST', 'api/index.php?route=reviews&action=submit', data),
    approve:    (id, reviewNote = '') => _json('POST', 'api/index.php?route=reviews&action=approve', { id, review_note: reviewNote }),
    reject:     (id, reviewNote) => _json('POST', 'api/index.php?route=reviews&action=reject', { id, review_note: reviewNote }),
    withdraw:   (id) => _json('POST', 'api/index.php?route=reviews&action=withdraw', { id }),
    rollbackHd: (historyId) => _json('POST', 'api/index.php?route=reviews&action=rollback_hd', { history_id: historyId }),
  };

  const notificationPreferences = {
    get:  () => _request('api/index.php?route=notification_preferences&action=get'),
    save: (payload) => _json('POST', 'api/index.php?route=notification_preferences&action=save', payload),
  };

  return {
    resolveUrl,
    getBaseUrl: _getBaseUrl,
    songs, chordSets, sessions, annotations, setlists, servicePlans: setlists, categories, saveXml, omr, importer, practice, manager, users, auth, liveSync, arrangements, notifications, practiceAssignments, export: exportService, reviews, notificationPreferences, errors, reportError: errors.report
  };
})();

window.ApiService = ApiService;
