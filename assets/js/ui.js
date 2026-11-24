/**
 * Haji Yuk — Helper UI bersama (toast, modal, dialog konfirmasi)
 */
(function (global) {
  'use strict';

  var toastTimer = null;
  var confirmResolver = null;

  function ensureToastHost() {
    var host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, type) {
    var host = ensureToastHost();
    var item = document.createElement('div');
    item.className = 'toast toast--' + (type || 'success');
    var icon = type === 'error' ? '!' : type === 'info' ? 'i' : '✓';
    item.innerHTML =
      '<span class="toast__icon" aria-hidden="true">' +
      icon +
      '</span><span class="toast__text"></span>';
    item.querySelector('.toast__text').textContent = String(message || '');
    host.appendChild(item);
    window.setTimeout(function () {
      item.classList.add('is-leaving');
      window.setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 250);
    }, 3200);
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      host.innerHTML = '';
    }, 3600);
  }

  function openModal(id) {
    var modal = typeof id === 'string' ? document.getElementById(id) : id;
    if (!modal) return null;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal');
    var focusable = modal.querySelector(
      'input:not([type="hidden"]):not([disabled]), select, textarea, button'
    );
    if (focusable) {
      window.setTimeout(function () {
        try {
          focusable.focus({ preventScroll: true });
        } catch (error) {
          focusable.focus();
        }
      }, 60);
    }
    return modal;
  }

  function closeModal(id) {
    var modal = typeof id === 'string' ? document.getElementById(id) : id;
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.is-open')) {
      document.body.classList.remove('has-modal');
    }
  }

  function closeAllModals() {
    var modals = document.querySelectorAll('.modal.is-open');
    Array.prototype.forEach.call(modals, function (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('has-modal');
  }

  function ensureConfirmModal() {
    var modal = document.getElementById('confirmModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'confirmTitle');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="modal__backdrop" data-confirm-cancel></div>' +
      '<div class="modal__dialog modal__dialog--sm" role="document">' +
      '<div class="modal__head">' +
      '<h3 id="confirmTitle">Konfirmasi</h3>' +
      '<button type="button" class="icon-button" data-confirm-cancel aria-label="Tutup dialog">✕</button>' +
      '</div>' +
      '<div class="modal__body">' +
      '<p class="confirm-message" id="confirmMessage"></p>' +
      '</div>' +
      '<div class="modal__foot">' +
      '<button type="button" class="btn btn--ghost" data-confirm-cancel>Batal</button>' +
      '<button type="button" class="btn btn--danger" id="confirmAction">Ya, lanjutkan</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (event) {
      if (event.target.closest('[data-confirm-cancel]')) {
        finishConfirm(false);
      }
    });
    modal.querySelector('#confirmAction').addEventListener('click', function () {
      finishConfirm(true);
    });
    return modal;
  }

  function finishConfirm(result) {
    var modal = document.getElementById('confirmModal');
    if (modal) {
      closeModal(modal);
    }
    if (confirmResolver) {
      var resolver = confirmResolver;
      confirmResolver = null;
      resolver(result);
    }
  }

  function confirmDialog(options) {
    var opts = options || {};
    var modal = ensureConfirmModal();
    modal.querySelector('#confirmTitle').textContent = opts.title || 'Konfirmasi';
    modal.querySelector('#confirmMessage').textContent = opts.message || 'Lanjutkan tindakan ini?';
    var action = modal.querySelector('#confirmAction');
    action.textContent = opts.confirmLabel || 'Ya, lanjutkan';
    action.className = 'btn ' + (opts.tone === 'primary' ? 'btn--primary' : 'btn--danger');
    openModal(modal);
    return new Promise(function (resolve) {
      confirmResolver = resolve;
    });
  }

  function initModalDismiss() {
    document.addEventListener('click', function (event) {
      var closer = event.target.closest('[data-close-modal]');
      if (closer) {
        var target = closer.getAttribute('data-close-modal');
        if (target) closeModal(target);
        else {
          var parent = closer.closest('.modal');
          if (parent) closeModal(parent);
        }
      }
      if (event.target.classList && event.target.classList.contains('modal__backdrop')) {
        var modal = event.target.closest('.modal');
        if (modal && modal.id !== 'confirmModal') closeModal(modal);
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeAllModals();
      }
    });
  }

  function statusBadge(statusKey) {
    var data = global.HajiYuk && global.HajiYuk.STATUSES[statusKey];
    var label = data ? data.label : 'Status tidak diketahui';
    var tone = data ? data.tone : 'muted';
    return '<span class="badge badge--' + tone + '">' + global.HajiYuk.escapeHTML(label) + '</span>';
  }

  function imageOrFallback(url, alt, className) {
    var safeUrl = global.HajiYuk.escapeHTML(url || '');
    var safeAlt = global.HajiYuk.escapeHTML(alt || 'Gambar paket');
    if (!safeUrl) {
      return (
        '<div class="' +
        (className || 'media-fallback') +
        '" role="img" aria-label="' +
        safeAlt +
        '"><span>Haji Yuk</span></div>'
      );
    }
    return (
      '<img class="' +
      (className || '') +
      '" src="' +
      safeUrl +
      '" alt="' +
      safeAlt +
      '" loading="lazy" onerror="this.classList.add(\'is-broken\');this.parentNode.classList.add(\'has-broken-image\');" />'
    );
  }

  global.HajiYukUI = {
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    closeAllModals: closeAllModals,
    confirmDialog: confirmDialog,
    initModalDismiss: initModalDismiss,
    statusBadge: statusBadge,
    imageOrFallback: imageOrFallback
  };
})(typeof window !== 'undefined' ? window : this);
