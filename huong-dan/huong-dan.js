/**
 * SheetApp 2.0 — Interactive User Guide Controller (huong-dan.js)
 * Live Search, Role Filtering, Scroll Spy, Mobile Drawer & FAQ Accordion
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    initRoleFilters();
    initScrollSpy();
    initMobileSidebar();
    initFaqAccordion();
    initBackToTop();
    initKeyboardShortcuts();
  });

  /* ── 1. Live Instant Search Engine ────────────────────────── */
  function initSearch() {
    const input = document.getElementById('search-docs');
    const clearBtn = document.getElementById('search-clear');
    if (!input) return;

    function removeAccents(str) {
      return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    }

    input.addEventListener('input', () => {
      const rawQuery = input.value.trim();
      const query = removeAccents(rawQuery);
      if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

      const cards = document.querySelectorAll('.doc-card');
      const chapters = document.querySelectorAll('.docs-chapter');
      let matchCount = 0;

      if (!query) {
        cards.forEach(card => card.style.display = '');
        chapters.forEach(ch => ch.style.display = '');
        _removeSearchEmptyNotice();
        return;
      }

      cards.forEach(card => {
        const text = removeAccents(card.innerText);
        const matches = text.includes(query);
        card.style.display = matches ? '' : 'none';
        if (matches) matchCount++;
      });

      // Show/Hide chapters if no cards match
      chapters.forEach(ch => {
        const visibleCards = ch.querySelectorAll('.doc-card:not([style*="display: none"])');
        ch.style.display = visibleCards.length > 0 ? '' : 'none';
      });

      if (matchCount === 0) {
        _showSearchEmptyNotice(rawQuery);
      } else {
        _removeSearchEmptyNotice();
      }
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  }

  function _showSearchEmptyNotice(query) {
    let notice = document.getElementById('search-empty-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'search-empty-notice';
      notice.className = 'callout callout-warning';
      notice.style.marginTop = '24px';
      const content = document.querySelector('.docs-content');
      content?.insertBefore(notice, content.firstChild);
    }
    notice.innerHTML = `
      <div class="callout-title">⚠️ Không tìm thấy kết quả phù hợp</div>
      <div>Không tìm thấy hướng dẫn nào khớp với từ khóa <strong>"${query}"</strong>. Thử tìm với các từ khóa phổ biến như: <code>capo</code>, <code>break</code>, <code>tap tempo</code>, <code>slash chord</code>, <code>a-b loop</code>, <code>setlist</code>, <code>in-ear</code>.</div>
    `;
  }

  function _removeSearchEmptyNotice() {
    const notice = document.getElementById('search-empty-notice');
    notice?.remove();
  }

  /* ── 2. Role-based Filter ─────────────────────────────────── */
  function initRoleFilters() {
    const pills = document.querySelectorAll('.btn-role-filter');
    if (pills.length === 0) return;

    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        pills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');

        const role = e.currentTarget.getAttribute('data-role');
        const cards = document.querySelectorAll('.doc-card');
        const chapters = document.querySelectorAll('.docs-chapter');

        if (role === 'all') {
          cards.forEach(card => card.style.display = '');
          chapters.forEach(ch => ch.style.display = '');
          return;
        }

        cards.forEach(card => {
          const cardRoles = card.getAttribute('data-roles') || '';
          const matches = cardRoles.includes(role) || cardRoles.includes('all');
          card.style.display = matches ? '' : 'none';
        });

        chapters.forEach(ch => {
          const visibleCards = ch.querySelectorAll('.doc-card:not([style*="display: none"])');
          ch.style.display = visibleCards.length > 0 ? '' : 'none';
        });
      });
    });
  }

  /* ── 3. Scroll Spy for Sticky Sidebar Navigation ─────────── */
  function initScrollSpy() {
    const chapters = document.querySelectorAll('.docs-chapter');
    const links = document.querySelectorAll('.sidebar-link');
    if (chapters.length === 0 || links.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          links.forEach(link => {
            const href = link.getAttribute('href')?.substring(1);
            link.classList.toggle('active', href === id);
          });
        }
      });
    }, {
      rootMargin: '-20% 0px -70% 0px'
    });

    chapters.forEach(ch => observer.observe(ch));
  }

  /* ── 4. Mobile Sidebar Drawer ─────────────────────────────── */
  function initMobileSidebar() {
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    const sidebar = document.getElementById('docs-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!toggleBtn || !sidebar) return;

    function toggle() {
      sidebar.classList.toggle('open');
      backdrop?.classList.toggle('open');
    }

    function close() {
      sidebar.classList.remove('open');
      backdrop?.classList.remove('open');
    }

    toggleBtn.addEventListener('click', toggle);
    backdrop?.addEventListener('click', close);

    // Auto-close when clicking any link inside sidebar on mobile
    sidebar.querySelectorAll('.sidebar-link').forEach(link => {
      link.addEventListener('click', close);
    });
  }

  /* ── 5. FAQ Accordion ─────────────────────────────────────── */
  function initFaqAccordion() {
    document.querySelectorAll('.faq-question').forEach(q => {
      q.addEventListener('click', () => {
        const item = q.closest('.faq-item');
        item?.classList.toggle('open');
      });
    });
  }

  /* ── 6. Back to Top Button ────────────────────────────────── */
  function initBackToTop() {
    const btn = document.getElementById('btn-back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 350) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── 7. Global Keyboard Shortcuts ─────────────────────────── */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Cmd + K or Ctrl + K -> Focus Search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.getElementById('search-docs');
        input?.focus();
        input?.select();
      }
      // Esc -> Clear search if focused
      if (e.key === 'Escape') {
        const input = document.getElementById('search-docs');
        if (input && document.activeElement === input) {
          input.value = '';
          input.dispatchEvent(new Event('input'));
          input.blur();
        }
      }
    });
  }
})();
