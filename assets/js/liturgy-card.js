/**
 * assets/js/liturgy-card.js
 *
 * Quản lý Thẻ Chờ Chương Trình / Tiết mục không phải bài hát (Ticket L3-4):
 * - Hiển thị các tiết mục như: Cầu nguyện, Đọc Kinh Thánh, Thông báo, Dâng hiến, Giảng luận.
 * - Hiển thị thời lượng mục này và tổng thời lượng dự kiến của toàn bộ chương trình lễ.
 * - Tự động ẩn bản nhạc sheet và thay thế bằng thẻ chờ trang trọng.
 * - Điều hướng liền mạch ◀ ▶ sang bài hoặc tiết mục tiếp theo.
 */

const LiturgyCard = (() => {
  'use strict';

  const TYPE_MAP = {
    prayer: { icon: '🙏', label: 'Cầu Nguyện', badge: 'CẦU NGUYỆN' },
    scripture: { icon: '📖', label: 'Kinh Thánh', badge: 'ĐỌC KINH THÁNH' },
    announcement: { icon: '📢', label: 'Thông Báo', badge: 'THÔNG BÁO' },
    offering: { icon: '🎁', label: 'Dâng Hiến', badge: 'DÂNG HIẾN' },
    sermon: { icon: '✝️', label: 'Giảng Luận', badge: 'GIẢNG LUẬN' },
    benediction: { icon: '🕊️', label: 'Chúc Phước', badge: 'CHÚC PHƯỚC' },
    testimony: { icon: '💬', label: 'Làm Chứng', badge: 'LÀM CHỨNG' },
    liturgy: { icon: '✝️', label: 'Chương Trình', badge: 'CHƯƠNG TRÌNH' },
    other: { icon: '⛪', label: 'Tiết Mục', badge: 'TIẾT MỤC' }
  };

  function init() {
    _bindEvents();
  }

  function _bindEvents() {
    document.getElementById('btn-lc-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget?.blur();
      window.SetlistPlayer?.next?.();
    });

    document.getElementById('btn-lc-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget?.blur();
      window.SetlistPlayer?.prev?.();
    });
  }

  function getTypeInfo(type) {
    if (!type || typeof type !== 'string') return TYPE_MAP.other;
    const key = type.toLowerCase().trim();
    return TYPE_MAP[key] || { icon: '⛪', label: type, badge: type.toUpperCase() };
  }

  function calcTotalDuration(items) {
    if (!Array.isArray(items) || items.length === 0) return 0;
    return items.reduce((sum, it) => {
      const dur = parseInt(it.duration_minutes, 10);
      return sum + (!isNaN(dur) && dur > 0 ? dur : 5);
    }, 0);
  }

  function show(item, setlist, currentIndex) {
    if (!item) return;

    const card = document.getElementById('liturgy-card');
    const sheetArea = document.getElementById('sheet-area');
    const welcome = document.getElementById('welcome-screen');
    const loading = document.getElementById('loading-screen');

    // Ẩn các khu vực khác
    if (sheetArea) sheetArea.classList.add('hidden');
    if (welcome) welcome.classList.add('hidden');
    if (loading) loading.classList.add('hidden');

    const typeInfo = getTypeInfo(item.item_type);
    const title = item.custom_title || item.title || typeInfo.label;
    const dur = parseInt(item.duration_minutes, 10) || 5;

    // Tính tổng thời lượng của setlist
    const totalItems = setlist?.items || [];
    const totalDuration = calcTotalDuration(totalItems);

    // Cập nhật DOM
    const iconEl = document.getElementById('lc-icon');
    if (iconEl) iconEl.textContent = typeInfo.icon;

    const badgeEl = document.getElementById('lc-badge');
    if (badgeEl) badgeEl.textContent = typeInfo.badge;

    const titleEl = document.getElementById('lc-title');
    if (titleEl) titleEl.textContent = title;

    // Ghi chú ca trưởng (nếu có)
    const notesBox = document.getElementById('lc-notes-box');
    const notesText = document.getElementById('lc-notes-text');
    if (item.leader_notes && item.leader_notes.trim() !== '') {
      if (notesText) notesText.textContent = item.leader_notes.trim();
      notesBox?.classList.remove('hidden');
    } else {
      notesBox?.classList.add('hidden');
    }

    // Thời lượng
    const itemDurEl = document.getElementById('lc-item-duration');
    if (itemDurEl) itemDurEl.textContent = `⏱️ Thời lượng mục: ${dur} phút`;

    const totalDurEl = document.getElementById('lc-total-duration');
    if (totalDurEl) {
      totalDurEl.textContent = `⏱️ Tổng thời lượng chương trình: ${totalDuration} phút (${totalItems.length} mục)`;
    }

    // Cập nhật nút điều hướng
    const hasNext = currentIndex < totalItems.length - 1;
    const nextBtn = document.getElementById('btn-lc-next');
    if (nextBtn) {
      if (hasNext) {
        const nextItem = totalItems[currentIndex + 1];
        const nextType = getTypeInfo(nextItem.item_type);
        const nextTitle = nextItem.custom_title || nextItem.title || nextType.label;
        nextBtn.textContent = `Tiếp: ${nextTitle} ▶`;
        nextBtn.removeAttribute('disabled');
      } else {
        nextBtn.textContent = 'Kết thúc chương trình';
        nextBtn.setAttribute('disabled', 'true');
      }
    }

    const prevBtn = document.getElementById('btn-lc-prev');
    if (prevBtn) {
      prevBtn.disabled = (currentIndex === 0);
    }

    // Hiển thị thẻ chờ
    if (card) {
      card.classList.remove('hidden');
    }

    // Đồng bộ HUD Sân khấu nếu đang mở
    const gigTitle = document.getElementById('gig-hud-title');
    if (gigTitle) gigTitle.textContent = `${typeInfo.icon} ${title}`;
    const gigKey = document.getElementById('gig-hud-key');
    if (gigKey) gigKey.textContent = `${dur}'`;
  }

  function hide() {
    const card = document.getElementById('liturgy-card');
    if (card) {
      card.classList.add('hidden');
    }
    const sheetArea = document.getElementById('sheet-area');
    if (sheetArea) {
      sheetArea.classList.remove('hidden');
    }
  }

  function isVisible() {
    const card = document.getElementById('liturgy-card');
    return !!(card && !card.classList.contains('hidden'));
  }

  return {
    init,
    show,
    hide,
    isVisible,
    getTypeInfo,
    calcTotalDuration,
    TYPE_MAP
  };
})();

if (typeof window !== 'undefined') {
  window.LiturgyCard = LiturgyCard;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', LiturgyCard.init);
    } else {
      LiturgyCard.init();
    }
  }
}
