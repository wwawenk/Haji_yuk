/**
 * Haji Yuk — Logika Dashboard Admin
 *
 * Prototype frontend: sesi memakai sessionStorage, data memakai localStorage.
 * Bukan sistem autentikasi produksi.
 */
(function () {
  'use strict';

  var store = window.HajiYuk;
  var auth = window.HajiYukAuth;
  var ui = window.HajiYukUI;
  var esc = store.escapeHTML;

  var VIEWS = ['overview', 'requests', 'packages', 'guides', 'announcements', 'reports', 'settings'];

  var VIEW_META = {
    overview: ['Dashboard', 'Ringkasan aktivitas aplikasi Haji Yuk'],
    requests: ['Data Pendaftaran', 'Kelola permintaan pendaftaran awal calon jamaah'],
    packages: ['Kelola Paket Haji & Umroh', 'Katalog layanan yang tampil pada aplikasi pengguna'],
    guides: ['Kelola Konten', 'Materi panduan ibadah dan informasi aplikasi'],
    announcements: ['Pengumuman', 'Informasi penting pada halaman Beranda pengguna'],
    reports: ['Laporan', 'Rekap dan ekspor data permintaan pendaftaran'],
    settings: ['Pengaturan', 'Akun admin, MFA, log keamanan, dan penyimpanan data']
  };

  var STATUS_COLORS = {
    diterima: '#3d7fa1',
    menunggu: '#c9971f',
    perlu_lengkapi: '#a63b2f',
    ditindaklanjuti: '#1f805d',
    selesai: '#2d8a55',
    tidak_dilanjutkan: '#97a8a0'
  };

  var STATUS_SHORT = {
    diterima: 'Diterima',
    menunggu: 'Menunggu',
    perlu_lengkapi: 'Perlu Info',
    ditindaklanjuti: 'Diproses',
    selesai: 'Selesai',
    tidak_dilanjutkan: 'Tidak Lanjut'
  };

  var state = {
    view: 'overview',
    requestSearch: '',
    requestService: 'Semua',
    requestStatus: 'Semua',
    requestSort: 'newest',
    activeRequestId: '',
    packageSearch: '',
    packageService: 'Semua',
    packagePublish: 'Semua',
    guideSearch: '',
    guideCategory: 'Semua',
    reportFrom: '',
    reportTo: '',
    reportService: 'Semua',
    reportStatus: 'Semua'
  };

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  /* ------------------------------------------------------------------ */
  /* Login & sesi                                                       */
  /* ------------------------------------------------------------------ */

  function showLogin(message) {
    els.loginScreen.hidden = false;
    els.adminApp.hidden = true;
    document.body.classList.remove('has-modal');
    var errorBox = $('loginError');
    if (message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    } else {
      errorBox.hidden = true;
    }
    var password = $('loginPassword');
    if (password) password.value = '';
    var mfaField = $('mfaField');
    if (mfaField) mfaField.hidden = true;
    var mfaInput = $('loginMfa');
    if (mfaInput) mfaInput.value = '';
    try {
      history.replaceState(null, '', window.location.pathname);
    } catch (error) {
      /* diabaikan */
    }
  }

  function showDashboard() {
    els.loginScreen.hidden = true;
    els.adminApp.hidden = false;
    var session = auth.getSession();
    var name = session && session.name ? session.name : 'Admin Haji Yuk';
    document.querySelectorAll('.profile-menu__name, .profile-menu__meta strong').forEach(function (el) {
      el.textContent = name;
    });
    var today = new Date();
    $('todayDate').textContent = today.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    switchView('overview', true);
    refreshBadges();
  }

  function initLogin() {
    var form = $('adminLoginForm');
    var toggle = $('passwordToggle');
    var password = $('loginPassword');
    var mfaField = $('mfaField');
    var mfaInput = $('loginMfa');

    if (toggle && password) {
      toggle.addEventListener('click', function () {
        var isPassword = password.getAttribute('type') === 'password';
        password.setAttribute('type', isPassword ? 'text' : 'password');
        toggle.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        toggle.setAttribute('aria-label', isPassword ? 'Sembunyikan password' : 'Tampilkan password');
        toggle.querySelector('span').textContent = isPassword ? '🙈' : '👁';
        password.focus();
      });
    }

    if (!form) return;
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var username = $('loginUsername').value.trim();
      var pass = password.value;
      var errorBox = $('loginError');
      var code = mfaField && !mfaField.hidden && mfaInput ? mfaInput.value.trim() : '';

      if (!username || !pass) {
        errorBox.textContent = 'Username dan password wajib diisi.';
        errorBox.hidden = false;
        return;
      }

      var submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      var result = await auth.login(username, pass, 'admin', code);
      if (submit) submit.disabled = false;

      if (!result.ok) {
        if (result.mfaRequired) {
          if (mfaField) mfaField.hidden = false;
          if (mfaInput) {
            mfaInput.value = '';
            mfaInput.focus();
          }
          errorBox.textContent = result.message;
          errorBox.hidden = false;
          return;
        }
        errorBox.textContent = result.message;
        errorBox.hidden = false;
        $('loginPassword').setAttribute('aria-invalid', 'true');
        $('loginUsername').setAttribute('aria-invalid', 'true');
        if (result.locked) {
          $('loginPassword').removeAttribute('aria-invalid');
          $('loginUsername').removeAttribute('aria-invalid');
        }
        return;
      }

      $('loginUsername').removeAttribute('aria-invalid');
      $('loginPassword').removeAttribute('aria-invalid');
      form.reset();
      if (mfaField) mfaField.hidden = true;
      errorBox.hidden = true;
      showDashboard();
      ui.toast('Selamat datang kembali, Admin.');
    });
  }

  function logout() {
    auth.logout();
    ui.closeAllModals();
    closeSidebar();
    showLogin();
    ui.toast('Anda telah keluar dari dashboard.', 'info');
  }

  function guardSession() {
    if (!auth.isLoggedIn('admin')) {
      showLogin('Sesi berakhir atau tidak valid. Silakan masuk kembali.');
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Navigasi view                                                       */
  /* ------------------------------------------------------------------ */

  function switchView(view, force) {
    if (VIEWS.indexOf(view) === -1) view = 'overview';
    if (!force && state.view === view) return;
    state.view = view;

    VIEWS.forEach(function (name) {
      var panel = $('view-' + name);
      if (!panel) return;
      var active = name === view;
      panel.classList.toggle('is-active', active);
      if (active) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
      if (active) {
        panel.style.animation = 'none';
        // memaksa animasi diputar kembali
        void panel.offsetWidth;
        panel.style.animation = '';
      }
    });

    document.querySelectorAll('.sidebar__link[data-view]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-view') === view);
    });

    var meta = VIEW_META[view];
    $('pageTitle').textContent = meta[0];
    $('pageSubtitle').textContent = meta[1];

    if (window.location.hash !== '#/' + view) {
      try {
        history.replaceState(null, '', '#/' + view);
      } catch (error) {
        /* diabaikan */
      }
    }

    renderView(view);
    closeSidebar();
  }

  function renderView(view) {
    if (view === 'overview') renderOverview();
    if (view === 'requests') renderRequests();
    if (view === 'packages') renderPackages();
    if (view === 'guides') renderGuides();
    if (view === 'announcements') renderAnnouncements();
    if (view === 'reports') renderReports();
    if (view === 'settings') renderSettings();
  }

  function refreshAfterChange() {
    if (!auth.isLoggedIn('admin')) return;
    refreshBadges();
    renderView(state.view);
    if (state.view !== 'overview') {
      // statistik overview ikut diperbarui saat dibuka kembali
      var overview = $('view-overview');
      if (overview && !overview.hidden) renderOverview();
    }
  }

  function initNavigation() {
    document.querySelectorAll('[data-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        switchView(button.getAttribute('data-view'));
      });
    });

    document.querySelectorAll('[data-view-link]').forEach(function (button) {
      button.addEventListener('click', function () {
        switchView(button.getAttribute('data-view-link'));
      });
    });

    ['sidebarLogout', 'profileLogout', 'settingsLogout'].forEach(function (id) {
      var button = $(id);
      if (button) button.addEventListener('click', logout);
    });

    var sidebarToggle = $('sidebarToggle');
    var sidebar = $('adminSidebar');
    var overlay = $('sidebarOverlay');
    var sidebarClose = $('sidebarClose');

    function openSidebar() {
      sidebar.classList.add('is-open');
      overlay.hidden = false;
      sidebarToggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('has-modal');
    }

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', function () {
        if (sidebar.classList.contains('is-open')) closeSidebar();
        else openSidebar();
      });
    }
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    var notifButton = $('notifButton');
    var notifPanel = $('notifPanel');
    var profileButton = $('profileMenuButton');
    var profilePanel = $('profileMenu');

    if (notifButton) {
      notifButton.addEventListener('click', function (event) {
        event.stopPropagation();
        var willOpen = notifPanel.hidden;
        closePanels();
        notifPanel.hidden = !willOpen;
        notifButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    }

    if (profileButton) {
      profileButton.addEventListener('click', function (event) {
        event.stopPropagation();
        var willOpen = profilePanel.hidden;
        closePanels();
        profilePanel.hidden = !willOpen;
        profileButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    }

    var seeAll = $('notifSeeAll');
    if (seeAll) {
      seeAll.addEventListener('click', function () {
        closePanels();
        switchView('requests');
      });
    }

    document.addEventListener('click', function (event) {
      if (event.target.closest('.notif') || event.target.closest('.profile-menu')) return;
      closePanels();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closePanels();
        closeSidebar();
      }
    });
  }

  function closePanels() {
    var notifPanel = $('notifPanel');
    var profilePanel = $('profileMenu');
    var notifButton = $('notifButton');
    var profileButton = $('profileMenuButton');
    if (notifPanel) notifPanel.hidden = true;
    if (profilePanel) profilePanel.hidden = true;
    if (notifButton) notifButton.setAttribute('aria-expanded', 'false');
    if (profileButton) profileButton.setAttribute('aria-expanded', 'false');
  }

  function closeSidebar() {
    var sidebar = $('adminSidebar');
    var overlay = $('sidebarOverlay');
    var toggle = $('sidebarToggle');
    if (sidebar) sidebar.classList.remove('is-open');
    if (overlay) overlay.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (!document.querySelector('.modal.is-open')) document.body.classList.remove('has-modal');
  }

  /* ------------------------------------------------------------------ */
  /* Badge & notifikasi                                                 */
  /* ------------------------------------------------------------------ */

  function refreshBadges() {
    var stats = store.getStats();
    var pending = store.getRequests().filter(function (item) {
      return item.status === 'menunggu' || item.status === 'diterima';
    });

    var sidebarCount = $('sidebarRequestCount');
    if (sidebarCount) {
      sidebarCount.textContent = String(stats.menunggu);
      sidebarCount.hidden = stats.menunggu === 0;
    }

    var notifBadge = $('notifBadge');
    if (notifBadge) {
      notifBadge.textContent = String(pending.length);
      notifBadge.hidden = pending.length === 0;
    }

    var notifList = $('notifList');
    if (notifList) {
      if (!pending.length) {
        notifList.innerHTML = '<li class="notif__empty">Tidak ada permintaan yang menunggu pemeriksaan.</li>';
      } else {
        notifList.innerHTML = pending
          .slice(0, 6)
          .map(function (item) {
            return (
              '<li><button type="button" class="notif__item" data-open-request="' +
              esc(item.id) +
              '"><strong>' +
              esc(item.name) +
              '</strong><span>' +
              esc(item.code) +
              ' · ' +
              esc(item.serviceType) +
              ' · ' +
              esc(store.formatDate(item.createdAt)) +
              '</span></button></li>'
            );
          })
          .join('');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Overview                                                           */
  /* ------------------------------------------------------------------ */

  function statCard(label, value, hint, tone) {
    return (
      '<article class="stat-card stat-card--' +
      tone +
      '">' +
      '<span class="stat-card__label">' +
      esc(label) +
      '</span>' +
      '<strong class="stat-card__value">' +
      esc(value) +
      '</strong>' +
      (hint ? '<span class="stat-card__hint">' + esc(hint) + '</span>' : '') +
      '</article>'
    );
  }

  function renderOverview() {
    var stats = store.getStats();
    var host = $('statGrid');
    if (host) {
      host.innerHTML =
        statCard('Total Pendaftaran', stats.total, 'Seluruh permintaan masuk', 'green') +
        statCard('Pendaftaran Haji', stats.haji, 'Layanan haji', 'gold') +
        statCard('Pendaftaran Umroh', stats.umroh, 'Layanan umroh', 'gold') +
        statCard('Menunggu Pemeriksaan', stats.menunggu, 'Belum diperiksa admin', 'warning') +
        statCard('Sedang Diproses', stats.ditindaklanjuti, 'Sedang ditindaklanjuti', 'info') +
        statCard('Selesai Ditindaklanjuti', stats.selesai, 'Permintaan tuntas', 'success');
    }

    drawServiceChart(stats);
    drawStatusChart(stats);

    var latest = store.getRequests().slice(0, 5);
    var latestHost = $('latestRequests');
    if (latestHost) {
      if (!latest.length) {
        latestHost.innerHTML =
          '<div class="empty-state" style="padding:1.75rem">' +
          '<h3>Belum ada pendaftaran</h3>' +
          '<p>Permintaan dari aplikasi pengguna akan muncul di sini.</p>' +
          '</div>';
      } else {
        latestHost.innerHTML = latest
          .map(function (item) {
            return (
              '<div class="list-row">' +
              '<div class="list-row__main"><strong>' +
              esc(item.name) +
              '</strong><span>' +
              esc(item.code) +
              ' · ' +
              esc(item.serviceType) +
              ' · ' +
              esc(store.formatDate(item.createdAt)) +
              '</span></div>' +
              '<div class="list-row__side">' +
              ui.statusBadge(item.status) +
              '<button type="button" class="btn btn--ghost btn-sm" data-open-request="' +
              esc(item.id) +
              '">Detail</button>' +
              '</div></div>'
            );
          })
          .join('');
      }
    }

    var logs = store.getLogs().slice(0, 8);
    var activityHost = $('activityList');
    if (activityHost) {
      if (!logs.length) {
        activityHost.innerHTML =
          '<div class="empty-state" style="padding:1.75rem"><p>Belum ada aktivitas yang tercatat.</p></div>';
      } else {
        activityHost.innerHTML = logs
          .map(function (log) {
            return (
              '<div class="activity-item">' +
              '<span class="activity-item__dot" aria-hidden="true">•</span>' +
              '<div class="activity-item__text"><strong>' +
              esc(log.action) +
              '</strong><span>' +
              esc(log.detail) +
              '</span><time>' +
              esc(store.formatDateTime(log.at)) +
              '</time></div></div>'
            );
          })
          .join('');
      }
    }
  }

  function setupCanvas(canvas) {
    if (!canvas) return null;
    var parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
    var width = Math.max(parentWidth || 320, 280);
    var height = 240;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = height + 'px';
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx: ctx, width: width, height: height };
  }

  function drawEmptyChart(ctx, width, height) {
    ctx.fillStyle = '#7b8f85';
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data pendaftaran', width / 2, height / 2);
  }

  function drawServiceChart(stats) {
    var canvas = $('serviceChart');
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx;
    var width = setup.width;
    var height = setup.height;
    var items = [
      { label: 'Haji', value: stats.haji, color: '#105c43' },
      { label: 'Umroh', value: stats.umroh, color: '#d9b96e' }
    ];
    var max = Math.max(items[0].value, items[1].value);

    var legend = $('serviceChartLegend');
    if (legend) {
      legend.innerHTML = items
        .map(function (item) {
          return (
            '<span class="chart-legend__item"><span class="chart-legend__swatch" style="background:' +
            item.color +
            '"></span>' +
            esc(item.label) +
            ': <strong>' +
            esc(item.value) +
            '</strong></span>'
          );
        })
        .join('');
    }

    if (!max) {
      drawEmptyChart(ctx, width, height);
      return;
    }

    var padding = { top: 24, right: 24, bottom: 42, left: 42 };
    var plotW = width - padding.left - padding.right;
    var plotH = height - padding.top - padding.bottom;
    var scaleMax = Math.max(4, max);
    var step = Math.max(1, Math.ceil(scaleMax / 4));
    var axisMax = step * 4;

    ctx.strokeStyle = '#e4ece8';
    ctx.fillStyle = '#7b8f85';
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    for (var i = 0; i <= 4; i++) {
      var value = step * i;
      var y = padding.top + plotH - (value / axisMax) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(String(value), padding.left - 8, y + 4);
    }

    var slot = plotW / items.length;
    var barWidth = Math.min(96, slot * 0.5);
    items.forEach(function (item, index) {
      var x = padding.left + slot * index + (slot - barWidth) / 2;
      var barHeight = (item.value / axisMax) * plotH;
      var y = padding.top + plotH - barHeight;

      ctx.fillStyle = item.color;
      ctx.beginPath();
      var radius = Math.min(10, barWidth / 2);
      ctx.moveTo(x, y + barHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barHeight);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#20352c';
      ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(item.value), x + barWidth / 2, Math.max(y - 8, padding.top + 10));

      ctx.fillStyle = '#5b7369';
      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(item.label, x + barWidth / 2, height - padding.bottom + 22);
    });
  }

  function drawStatusChart(stats) {
    var canvas = $('statusChart');
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx;
    var width = setup.width;
    var height = setup.height;
    var items = store.STATUS_ORDER.map(function (key) {
      return {
        key: key,
        label: STATUS_SHORT[key],
        value: stats.byStatus[key] || 0,
        color: STATUS_COLORS[key]
      };
    });

    var legend = $('statusChartLegend');
    if (legend) {
      legend.innerHTML = items
        .map(function (item) {
          return (
            '<span class="chart-legend__item"><span class="chart-legend__swatch" style="background:' +
            item.color +
            '"></span>' +
            esc(item.label) +
            ': <strong>' +
            esc(item.value) +
            '</strong></span>'
          );
        })
        .join('');
    }

    var total = stats.total;
    if (!total) {
      drawEmptyChart(ctx, width, height);
      return;
    }

    var padding = { top: 12, right: 44, bottom: 12, left: 96 };
    var plotW = width - padding.left - padding.right;
    var plotH = height - padding.top - padding.bottom;
    var rowHeight = plotH / items.length;
    var barHeight = Math.min(18, rowHeight * 0.55);

    items.forEach(function (item, index) {
      var y = padding.top + rowHeight * index + (rowHeight - barHeight) / 2;
      var barWidth = Math.max(0, (item.value / total) * plotW);

      ctx.fillStyle = '#eef3f0';
      ctx.beginPath();
      ctx.roundRect(padding.left, y, plotW, barHeight, 8);
      ctx.fill();

      if (item.value > 0) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.roundRect(padding.left, y, Math.max(barWidth, 4), barHeight, 8);
        ctx.fill();
      }

      ctx.fillStyle = '#5b7369';
      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.label, padding.left - 10, y + barHeight - 4);

      ctx.fillStyle = '#20352c';
      ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(item.value), padding.left + Math.max(barWidth, 0) + 8, y + barHeight - 4);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Data pendaftaran                                                   */
  /* ------------------------------------------------------------------ */

  function filteredRequests() {
    var list = store.getRequests();
    var query = state.requestSearch.trim().toLowerCase();

    if (query) {
      list = list.filter(function (item) {
        return (
          item.name.toLowerCase().indexOf(query) !== -1 ||
          item.code.toLowerCase().indexOf(query) !== -1 ||
          item.phone.toLowerCase().indexOf(query) !== -1
        );
      });
    }
    if (state.requestService !== 'Semua') {
      list = list.filter(function (item) {
        return item.serviceType === state.requestService;
      });
    }
    if (state.requestStatus !== 'Semua') {
      list = list.filter(function (item) {
        return item.status === state.requestStatus;
      });
    }
    if (state.requestSort === 'oldest') {
      list = list.slice().reverse();
    } else if (state.requestSort === 'name') {
      list = list.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, 'id');
      });
    }
    return list;
  }

  function populateStatusOptions(select, includeAll) {
    if (!select) return;
    var current = select.value;
    var options = [];
    if (includeAll) options.push('<option value="Semua">Semua status</option>');
    store.STATUS_ORDER.forEach(function (key) {
      options.push('<option value="' + key + '">' + esc(store.STATUSES[key].label) + '</option>');
    });
    select.innerHTML = options.join('');
    if (current) select.value = current;
  }

  function renderRequests() {
    var body = $('requestsBody');
    var empty = $('requestsEmpty');
    var count = $('requestsCount');
    if (!body) return;

    populateStatusOptions($('filterStatus'), true);

    var list = filteredRequests();
    if (count) count.textContent = list.length + ' permintaan';

    if (!list.length) {
      body.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.innerHTML =
          '<span class="empty-state__icon" aria-hidden="true">📋</span>' +
          '<h3>Tidak ada data pendaftaran</h3>' +
          '<p>' +
          (store.getRequests().length
            ? 'Tidak ada permintaan yang cocok dengan pencarian atau filter.'
            : 'Belum ada permintaan dari pengguna. Permintaan yang dikirim melalui formulir aplikasi akan muncul di sini.') +
          '</p>';
      }
      return;
    }
    if (empty) empty.hidden = true;

    body.innerHTML = list
      .map(function (item) {
        return (
          '<tr>' +
          '<td class="cell-nowrap"><span class="cell-strong">' +
          esc(item.code) +
          '</span></td>' +
          '<td><span class="cell-strong">' +
          esc(item.name) +
          '</span><span class="cell-sub">' +
          esc(item.submittedBy) +
          '</span></td>' +
          '<td class="cell-nowrap">' +
          esc(item.phone) +
          '</td>' +
          '<td class="cell-nowrap"><span class="badge badge--' +
          (item.serviceType === 'Haji' ? 'primary' : 'gold') +
          '">' +
          esc(item.serviceType) +
          '</span></td>' +
          '<td class="cell-wrap">' +
          esc(item.packageName) +
          '</td>' +
          '<td class="cell-nowrap">' +
          esc(store.formatDate(item.createdAt)) +
          '</td>' +
          '<td>' +
          ui.statusBadge(item.status) +
          '</td>' +
          '<td><div class="table-actions">' +
          '<button type="button" class="btn btn--outline btn-sm" data-open-request="' +
          esc(item.id) +
          '">Detail</button>' +
          '<button type="button" class="btn btn--ghost-danger btn-sm" data-delete-request="' +
          esc(item.id) +
          '">Hapus</button>' +
          '</div></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function detailItem(label, value, extraClass) {
    return (
      '<div class="detail-item' +
      (extraClass ? ' ' + extraClass : '') +
      '"><dt>' +
      esc(label) +
      '</dt><dd' +
      (extraClass === 'detail-item--full' ? ' class="detail-desc"' : '') +
      '>' +
      esc(value || '—') +
      '</dd></div>'
    );
  }

  function openRequest(id) {
    var request = store.getRequestById(id);
    if (!request) {
      ui.toast('Data permintaan tidak ditemukan.', 'error');
      return;
    }
    state.activeRequestId = id;

    var modalCode = $('requestModalCode');
    if (modalCode) modalCode.textContent = request.code + ' · diajukan ' + store.formatDate(request.createdAt);

    var body = $('requestDetailBody');
    if (body) {
      var history = (request.history || []).slice().reverse();
      body.innerHTML =
        '<div class="request-info__grid">' +
        detailItem('Nama lengkap calon jamaah', request.name) +
        detailItem('Nomor HP / WhatsApp', request.phone) +
        detailItem('Jenis layanan', request.serviceType) +
        detailItem('Paket / layanan dipilih', request.packageName) +
        detailItem('Rencana keberangkatan', request.departurePlan) +
        detailItem('Pihak yang mengisi formulir', request.submittedBy) +
        detailItem('Tanggal pengajuan', store.formatDate(request.createdAt)) +
        detailItem('Pembaruan terakhir', store.formatDateTime(request.updatedAt)) +
        '<div class="detail-item"><dt>Status saat ini</dt><dd>' + ui.statusBadge(request.status) + '</dd></div>' +
        '</div>' +
        '<div class="detail-block"><h3>Catatan / kebutuhan bantuan</h3><p class="article__body">' +
        esc(request.needs || 'Tidak ada catatan dari pengguna.') +
        '</p></div>' +
        '<div class="detail-block"><h3>Catatan tindak lanjut untuk calon jamaah</h3><p class="article__body">' +
        esc(request.followUpNote || 'Belum ada catatan tindak lanjut.') +
        '</p></div>' +
        '<div class="detail-block"><h3>Catatan internal admin (tidak tampil ke pengguna)</h3><p class="article__body">' +
        esc(request.internalNote || 'Belum ada catatan internal.') +
        '</p></div>' +
        (history.length
          ? '<div class="detail-block"><h3>Riwayat status</h3><ul class="status-history">' +
            history
              .map(function (entry) {
                var label = store.STATUSES[entry.status] ? store.STATUSES[entry.status].label : entry.status;
                return (
                  '<li><strong>' +
                  esc(label) +
                  '</strong> — ' +
                  esc(store.formatDateTime(entry.at)) +
                  (entry.note ? '<div>' + esc(entry.note) + '</div>' : '') +
                  '</li>'
                );
              })
              .join('') +
            '</ul></div>'
          : '');
    }

    var statusSelect = $('detailStatus');
    populateStatusOptions(statusSelect, false);
    if (statusSelect) statusSelect.value = request.status;
    if ($('detailFollowUp')) $('detailFollowUp').value = request.followUpNote || '';
    if ($('detailInternal')) $('detailInternal').value = request.internalNote || '';

    ui.openModal('requestModal');
  }

  function saveStatus() {
    var id = state.activeRequestId;
    if (!id) return;
    var status = $('detailStatus').value;
    if (!store.STATUSES[status]) {
      ui.toast('Pilih status yang valid.', 'error');
      return;
    }
    var followUp = $('detailFollowUp').value.trim();
    var internal = $('detailInternal').value.trim();
    var updated = store.updateRequestStatus(id, status, followUp, internal);
    if (!updated) {
      ui.toast('Gagal memperbarui status.', 'error');
      return;
    }
    ui.closeModal('requestModal');
    refreshAfterChange();
    ui.toast('Status ' + updated.code + ' berhasil diperbarui menjadi "' + store.STATUSES[status].label + '".');
  }

  function requestDeleteHandler(id) {
    var request = store.getRequestById(id);
    if (!request) return;
    ui.confirmDialog({
      title: 'Hapus data pendaftaran?',
      message:
        'Data permintaan ' +
        request.code +
        ' atas nama ' +
        request.name +
        ' akan dihapus permanen dari browser ini dan tidak lagi tampil pada halaman Status pengguna.',
      confirmLabel: 'Ya, hapus data',
      tone: 'danger'
    }).then(function (confirmed) {
      if (!confirmed) return;
      if (store.deleteRequest(id)) {
        if (state.activeRequestId === id) {
          state.activeRequestId = '';
          ui.closeModal('requestModal');
        }
        refreshAfterChange();
        ui.toast('Data pendaftaran berhasil dihapus.');
      } else {
        ui.toast('Data gagal dihapus.', 'error');
      }
    });
  }

  function initRequests() {
    var search = $('requestSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.requestSearch = search.value;
        renderRequests();
      });
    }
    var service = $('filterService');
    if (service) {
      service.addEventListener('change', function () {
        state.requestService = service.value;
        renderRequests();
      });
    }
    var status = $('filterStatus');
    if (status) {
      status.addEventListener('change', function () {
        state.requestStatus = status.value;
        renderRequests();
      });
    }
    var sort = $('sortRequests');
    if (sort) {
      sort.addEventListener('change', function () {
        state.requestSort = sort.value;
        renderRequests();
      });
    }
    var save = $('saveStatusBtn');
    if (save) save.addEventListener('click', saveStatus);
    var del = $('deleteRequestBtn');
    if (del) {
      del.addEventListener('click', function () {
        if (state.activeRequestId) requestDeleteHandler(state.activeRequestId);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Paket                                                              */
  /* ------------------------------------------------------------------ */

  function thumb(src, alt) {
    if (!src) {
      return '<span class="media-fallback" style="width:54px;height:42px;min-height:0;border-radius:8px;font-size:0.5rem">—</span>';
    }
    return (
      '<img class="table-thumb" src="' +
      esc(src) +
      '" alt="' +
      esc(alt || 'Gambar paket') +
      '" loading="lazy" />'
    );
  }

  function renderPackages() {
    var body = $('packagesBody');
    var empty = $('packagesEmpty');
    if (!body) return;

    var list = store.getPackages({ includeUnpublished: true });
    var query = state.packageSearch.trim().toLowerCase();

    if (query) {
      list = list.filter(function (item) {
        return item.name.toLowerCase().indexOf(query) !== -1;
      });
    }
    if (state.packageService !== 'Semua') {
      list = list.filter(function (item) {
        return item.serviceType === state.packageService;
      });
    }
    if (state.packagePublish === 'published') {
      list = list.filter(function (item) {
        return item.published;
      });
    }
    if (state.packagePublish === 'draft') {
      list = list.filter(function (item) {
        return !item.published;
      });
    }

    if (!list.length) {
      body.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.innerHTML =
          '<span class="empty-state__icon" aria-hidden="true">📦</span>' +
          '<h3>Tidak ada paket</h3>' +
          '<p>' +
          (store.getPackages({ includeUnpublished: true }).length
            ? 'Tidak ada paket yang cocok dengan pencarian atau filter.'
            : 'Belum ada paket. Tambahkan paket pertama untuk ditampilkan di katalog.') +
          '</p>';
      }
      return;
    }
    if (empty) empty.hidden = true;

    body.innerHTML = list
      .map(function (item) {
        return (
          '<tr>' +
          '<td><div class="package-cell">' +
          thumb(item.image, item.name) +
          '<div><span class="cell-strong">' +
          esc(item.name) +
          '</span><span class="cell-sub">' +
          esc(item.organizer) +
          '</span></div></div></td>' +
          '<td class="cell-nowrap"><span class="badge badge--' +
          (item.serviceType === 'Haji' ? 'primary' : 'gold') +
          '">' +
          esc(item.serviceType) +
          '</span></td>' +
          '<td class="cell-nowrap">' +
          esc(item.price) +
          '</td>' +
          '<td class="cell-nowrap">' +
          esc(item.duration) +
          '</td>' +
          '<td class="cell-wrap">' +
          esc(item.schedule) +
          '</td>' +
          '<td>' +
          (item.published
            ? '<span class="badge badge--success">Tayang</span>'
            : '<span class="badge badge--muted">Draf</span>') +
          '</td>' +
          '<td class="cell-nowrap">' +
          esc(store.formatDate(item.updatedAt)) +
          '</td>' +
          '<td><div class="table-actions">' +
          '<button type="button" class="btn btn--ghost btn-sm" data-package-preview="' +
          esc(item.id) +
          '">Lihat</button>' +
          '<button type="button" class="btn btn--outline btn-sm" data-package-edit="' +
          esc(item.id) +
          '">Edit</button>' +
          '<button type="button" class="btn btn--ghost btn-sm" data-package-toggle="' +
          esc(item.id) +
          '">' +
          (item.published ? 'Nonaktifkan' : 'Aktifkan') +
          '</button>' +
          '<button type="button" class="btn btn--ghost-danger btn-sm" data-package-delete="' +
          esc(item.id) +
          '">Hapus</button>' +
          '</div></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function setFormError(fieldId, message) {
    var field = $(fieldId);
    var error = document.querySelector('[data-error-for="' + fieldId + '"]');
    if (error) error.textContent = message || '';
    if (field) {
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }
  }

  function clearFormErrors(scopeId) {
    var scope = $(scopeId);
    if (!scope) return;
    scope.querySelectorAll('[data-error-for]').forEach(function (el) {
      el.textContent = '';
    });
    scope.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
  }

  function renderImagePreview() {
    var host = $('packageImagePreview');
    if (!host) return;
    var url = $('packageImage').value.trim();
    if (!url) {
      host.innerHTML =
        '<span class="image-preview__empty">Belum ada gambar. Gambar pengganti akan dipakai pada katalog.</span>';
      return;
    }
    host.innerHTML = '';
    var img = document.createElement('img');
    img.alt = 'Pratinjau gambar paket';
    img.src = url;
    img.addEventListener('error', function () {
      host.innerHTML =
        '<span class="image-preview__empty">Gambar tidak dapat dimuat. Katalog akan menampilkan gambar pengganti.</span>';
    });
    host.appendChild(img);
  }

  function openPackageForm(id) {
    var form = $('packageForm');
    if (!form) return;
    form.reset();
    clearFormErrors('packageForm');
    $('packageId').value = '';
    $('packagePublished').checked = true;
    $('packageUpdatedAt').value = store.todayISO();
    $('packageFormTitle').textContent = 'Tambah Paket';

    var item = id ? store.getPackageById(id) : null;
    if (item) {
      $('packageFormTitle').textContent = 'Edit Paket';
      $('packageId').value = item.id;
      $('packageName').value = item.name;
      $('packageServiceType').value = item.serviceType;
      $('packagePrice').value = item.price;
      $('packageDuration').value = item.duration;
      $('packageSchedule').value = item.schedule;
      $('packageOrganizer').value = item.organizer;
      $('packageDescription').value = item.description;
      $('packageFacilities').value = item.facilities.join('\n');
      $('packageImage').value = item.image;
      $('packagePublished').checked = item.published;
      $('packageUpdatedAt').value = item.updatedAt;
    }

    renderImagePreview();
    ui.openModal('packageFormModal');
  }

  function validatePackageForm() {
    var errors = {};
    if ($('packageName').value.trim().length < 3) errors.packageName = 'Nama paket minimal 3 karakter.';
    if (!$('packageServiceType').value) errors.packageServiceType = 'Pilih jenis layanan.';
    if (!$('packagePrice').value.trim()) errors.packagePrice = 'Harga atau keterangan biaya wajib diisi.';
    if (!$('packageDuration').value.trim()) errors.packageDuration = 'Durasi perjalanan wajib diisi.';
    if (!$('packageSchedule').value.trim()) errors.packageSchedule = 'Jadwal keberangkatan wajib diisi.';
    if (!$('packageOrganizer').value.trim()) errors.packageOrganizer = 'Nama penyelenggara wajib diisi.';
    if ($('packageDescription').value.trim().length < 10) {
      errors.packageDescription = 'Deskripsi minimal 10 karakter.';
    }
    if ($('packageFacilities').value.trim().length < 3) {
      errors.packageFacilities = 'Isi minimal satu fasilitas.';
    }
    return errors;
  }

  function savePackageForm(event) {
    event.preventDefault();
    clearFormErrors('packageForm');
    var errors = validatePackageForm();
    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (key) {
        setFormError(key, errors[key]);
      });
      ui.toast('Lengkapi kolom wajib yang ditandai.', 'error');
      return;
    }

    var data = {
      id: $('packageId').value || undefined,
      name: $('packageName').value,
      serviceType: $('packageServiceType').value,
      price: $('packagePrice').value,
      duration: $('packageDuration').value,
      schedule: $('packageSchedule').value,
      organizer: $('packageOrganizer').value,
      description: $('packageDescription').value,
      facilities: $('packageFacilities').value.split('\n'),
      image: $('packageImage').value,
      published: $('packagePublished').checked,
      updatedAt: $('packageUpdatedAt').value || store.todayISO()
    };

    var saved = store.savePackage(data);
    ui.closeModal('packageFormModal');
    refreshAfterChange();
    ui.toast('Paket "' + saved.name + '" berhasil disimpan.');
  }

  function previewPackage(id) {
    var item = store.getPackageById(id);
    if (!item) return;
    var body = $('packagePreviewBody');
    var title = $('packagePreviewTitle');
    if (!body) return;
    title.textContent = item.name;
    body.innerHTML =
      (item.image
        ? '<div style="margin-bottom:1rem">' +
          ui.imageOrFallback(item.image, 'Gambar ' + item.name) +
          '</div>'
        : '') +
      '<div class="detail-grid">' +
      detailItem('Jenis layanan', item.serviceType) +
      detailItem('Harga', item.price) +
      detailItem('Durasi', item.duration) +
      detailItem('Jadwal', item.schedule) +
      detailItem('Penyelenggara', item.organizer) +
      detailItem('Status publikasi', item.published ? 'Tayang di katalog' : 'Draf (tidak tampil)') +
      detailItem('Diperbarui', store.formatDate(item.updatedAt)) +
      '</div>' +
      '<h3>Deskripsi</h3><p class="article__body">' + esc(item.description) + '</p>' +
      '<h3>Fasilitas</h3><ul class="facility-list">' +
      item.facilities
        .map(function (f) {
          return '<li>' + esc(f) + '</li>';
        })
        .join('') +
      '</ul>' +
      '<p class="notice notice--warn" style="margin-top:1rem">Perubahan paket langsung tampil pada katalog pengguna.</p>';
    ui.openModal('packagePreviewModal');
  }

  function initPackages() {
    var add = $('addPackageBtn');
    if (add) {
      add.addEventListener('click', function () {
        openPackageForm('');
      });
    }
    var form = $('packageForm');
    if (form) form.addEventListener('submit', savePackageForm);

    ['packageSearch', 'packageFilter', 'packagePublishFilter'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener(id === 'packageSearch' ? 'input' : 'change', function () {
        if (id === 'packageSearch') state.packageSearch = el.value;
        if (id === 'packageFilter') state.packageService = el.value;
        if (id === 'packagePublishFilter') state.packagePublish = el.value;
        renderPackages();
      });
    });

    var image = $('packageImage');
    if (image) {
      image.addEventListener('input', renderImagePreview);
      image.addEventListener('change', renderImagePreview);
    }

  }

  function handlePackageAction(event) {
    var previewBtn = event.target.closest('[data-package-preview]');
    if (previewBtn) {
      previewPackage(previewBtn.getAttribute('data-package-preview'));
      return true;
    }
    var editBtn = event.target.closest('[data-package-edit]');
    if (editBtn) {
      openPackageForm(editBtn.getAttribute('data-package-edit'));
      return true;
    }
    var toggleBtn = event.target.closest('[data-package-toggle]');
    if (toggleBtn) {
      var id = toggleBtn.getAttribute('data-package-toggle');
      var updated = store.togglePackagePublished(id);
      if (updated) {
        refreshAfterChange();
        ui.toast(
          'Paket "' + updated.name + '" ' + (updated.published ? 'diaktifkan di katalog.' : 'dinonaktifkan dari katalog.')
        );
      }
      return true;
    }
    var deleteBtn = event.target.closest('[data-package-delete]');
    if (deleteBtn) {
      var targetId = deleteBtn.getAttribute('data-package-delete');
      var item = store.getPackageById(targetId);
      if (!item) return true;
      ui.confirmDialog({
        title: 'Hapus paket?',
        message:
          'Paket "' +
          item.name +
          '" akan dihapus dari katalog aplikasi pengguna. Permintaan pendaftaran yang sudah ada tidak terpengaruh.',
        confirmLabel: 'Ya, hapus paket',
        tone: 'danger'
      }).then(function (confirmed) {
        if (!confirmed) return;
        if (store.deletePackage(targetId)) {
          refreshAfterChange();
          ui.toast('Paket berhasil dihapus.');
        } else {
          ui.toast('Paket gagal dihapus.', 'error');
        }
      });
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Konten / panduan                                                   */
  /* ------------------------------------------------------------------ */

  function renderGuides() {
    var body = $('guidesBody');
    var empty = $('guidesEmpty');
    if (!body) return;

    var categorySelect = $('guideAdminCategory');
    if (categorySelect && categorySelect.options.length <= 1) {
      categorySelect.innerHTML =
        '<option value="Semua">Semua kategori</option>' +
        store.GUIDE_CATEGORIES.map(function (cat) {
          return '<option value="' + esc(cat) + '">' + esc(cat) + '</option>';
        }).join('');
    }

    var list = store.getGuides({ includeUnpublished: true });
    var query = state.guideSearch.trim().toLowerCase();
    if (query) {
      list = list.filter(function (item) {
        return (
          item.title.toLowerCase().indexOf(query) !== -1 ||
          item.summary.toLowerCase().indexOf(query) !== -1
        );
      });
    }
    if (state.guideCategory !== 'Semua') {
      list = list.filter(function (item) {
        return item.category === state.guideCategory;
      });
    }

    if (!list.length) {
      body.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.innerHTML =
          '<span class="empty-state__icon" aria-hidden="true">📖</span>' +
          '<h3>Tidak ada konten</h3>' +
          '<p>' +
          (store.getGuides({ includeUnpublished: true }).length
            ? 'Tidak ada konten yang cocok dengan filter.'
            : 'Belum ada materi panduan. Tambahkan konten pertama.') +
          '</p>';
      }
      return;
    }
    if (empty) empty.hidden = true;

    body.innerHTML = list
      .map(function (item) {
        return (
          '<tr>' +
          '<td class="cell-wrap"><span class="cell-strong">' +
          esc(item.title) +
          '</span><span class="cell-sub">' +
          esc(item.source || 'Tanpa sumber') +
          '</span></td>' +
          '<td class="cell-nowrap"><span class="badge badge--primary">' +
          esc(item.category) +
          '</span></td>' +
          '<td class="cell-wrap">' +
          esc(item.summary) +
          '</td>' +
          '<td>' +
          (item.published
            ? '<span class="badge badge--success">Tayang</span>'
            : '<span class="badge badge--muted">Draf</span>') +
          '</td>' +
          '<td class="cell-nowrap">' +
          esc(store.formatDate(item.updatedAt)) +
          '</td>' +
          '<td><div class="table-actions">' +
          '<button type="button" class="btn btn--ghost btn-sm" data-guide-preview="' +
          esc(item.id) +
          '">Pratinjau</button>' +
          '<button type="button" class="btn btn--outline btn-sm" data-guide-edit="' +
          esc(item.id) +
          '">Edit</button>' +
          '<button type="button" class="btn btn--ghost-danger btn-sm" data-guide-delete="' +
          esc(item.id) +
          '">Hapus</button>' +
          '</div></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function openGuideForm(id) {
    var form = $('guideForm');
    if (!form) return;
    form.reset();
    clearFormErrors('guideForm');
    $('guideId').value = '';
    $('guidePublished').checked = true;
    $('guideUpdatedAt').value = store.todayISO();
    $('guideFormTitle').textContent = 'Tambah Konten';

    var category = $('guideCategory');
    if (category) {
      category.innerHTML = store.GUIDE_CATEGORIES.map(function (cat) {
        return '<option value="' + esc(cat) + '">' + esc(cat) + '</option>';
      }).join('');
    }

    var item = id ? store.getGuideById(id) : null;
    if (item) {
      $('guideFormTitle').textContent = 'Edit Konten';
      $('guideId').value = item.id;
      $('guideTitle').value = item.title;
      $('guideCategory').value = item.category;
      $('guideSummary').value = item.summary;
      $('guideContent').value = item.content;
      $('guideImage').value = item.image;
      $('guideSource').value = item.source;
      $('guidePublished').checked = item.published;
      $('guideUpdatedAt').value = item.updatedAt;
    }
    ui.openModal('guideFormModal');
  }

  function saveGuideForm(event) {
    event.preventDefault();
    clearFormErrors('guideForm');
    var errors = {};
    if ($('guideTitle').value.trim().length < 4) errors.guideTitle = 'Judul minimal 4 karakter.';
    if (!$('guideCategory').value) errors.guideCategory = 'Pilih kategori konten.';
    if ($('guideSummary').value.trim().length < 10) errors.guideSummary = 'Deskripsi singkat minimal 10 karakter.';
    if ($('guideContent').value.trim().length < 20) errors.guideContent = 'Isi materi minimal 20 karakter.';

    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (key) {
        setFormError(key, errors[key]);
      });
      ui.toast('Lengkapi kolom wajib yang ditandai.', 'error');
      return;
    }

    var saved = store.saveGuide({
      id: $('guideId').value || undefined,
      title: $('guideTitle').value,
      category: $('guideCategory').value,
      summary: $('guideSummary').value,
      content: $('guideContent').value,
      image: $('guideImage').value,
      source: $('guideSource').value,
      published: $('guidePublished').checked,
      updatedAt: $('guideUpdatedAt').value || store.todayISO()
    });

    ui.closeModal('guideFormModal');
    refreshAfterChange();
    ui.toast('Konten "' + saved.title + '" berhasil disimpan.');
  }

  function previewGuide(id) {
    var item = store.getGuideById(id);
    if (!item) return;
    var title = $('guidePreviewTitle');
    var body = $('guidePreviewBody');
    if (!body) return;
    title.textContent = item.title;
    body.innerHTML =
      '<div class="detail-grid">' +
      detailItem('Kategori', item.category) +
      detailItem('Status', item.published ? 'Tayang' : 'Draf') +
      detailItem('Diperbarui', store.formatDate(item.updatedAt)) +
      '</div>' +
      (item.image ? '<div style="margin-bottom:1rem">' + ui.imageOrFallback(item.image, item.title) + '</div>' : '') +
      '<p class="article__body">' +
      esc(item.content) +
      '</p>' +
      (item.source ? '<div class="article__source"><strong>Sumber:</strong> ' + esc(item.source) + '</div>' : '');
    ui.openModal('guidePreviewModal');
  }

  function initGuides() {
    var add = $('addGuideBtn');
    if (add) {
      add.addEventListener('click', function () {
        openGuideForm('');
      });
    }
    var form = $('guideForm');
    if (form) form.addEventListener('submit', saveGuideForm);

    var search = $('guideAdminSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.guideSearch = search.value;
        renderGuides();
      });
    }
    var category = $('guideAdminCategory');
    if (category) {
      category.addEventListener('change', function () {
        state.guideCategory = category.value;
        renderGuides();
      });
    }
  }

  function handleGuideAction(event) {
    var previewBtn = event.target.closest('[data-guide-preview]');
    if (previewBtn) {
      previewGuide(previewBtn.getAttribute('data-guide-preview'));
      return true;
    }
    var editBtn = event.target.closest('[data-guide-edit]');
    if (editBtn) {
      openGuideForm(editBtn.getAttribute('data-guide-edit'));
      return true;
    }
    var deleteBtn = event.target.closest('[data-guide-delete]');
    if (deleteBtn) {
      var id = deleteBtn.getAttribute('data-guide-delete');
      var item = store.getGuideById(id);
      if (!item) return true;
      ui.confirmDialog({
        title: 'Hapus konten panduan?',
        message: 'Konten "' + item.title + '" akan dihapus dari halaman Panduan Ibadah pengguna.',
        confirmLabel: 'Ya, hapus konten',
        tone: 'danger'
      }).then(function (confirmed) {
        if (!confirmed) return;
        if (store.deleteGuide(id)) {
          refreshAfterChange();
          ui.toast('Konten berhasil dihapus.');
        } else {
          ui.toast('Konten gagal dihapus.', 'error');
        }
      });
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Pengumuman                                                         */
  /* ------------------------------------------------------------------ */

  function renderAnnouncements() {
    var host = $('announcementsList');
    var empty = $('announcementsEmpty');
    if (!host) return;

    var list = store.getAnnouncements();
    if (!list.length) {
      host.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.innerHTML =
          '<span class="empty-state__icon" aria-hidden="true">📣</span>' +
          '<h3>Belum ada pengumuman</h3>' +
          '<p>Tambahkan pengumuman agar tampil pada bagian Informasi Penting di Beranda.</p>';
      }
      return;
    }
    if (empty) empty.hidden = true;

    host.innerHTML = list
      .map(function (item) {
        return (
          '<article class="announcement-admin-card' +
          (item.active ? '' : ' is-inactive') +
          '">' +
          '<div class="announcement-admin-card__meta">' +
          '<span class="badge badge--gold">' +
          esc(item.category) +
          '</span>' +
          (item.active
            ? '<span class="badge badge--success">Aktif</span>'
            : '<span class="badge badge--muted">Tidak aktif</span>') +
          '<span>' +
          esc(store.formatDate(item.createdAt)) +
          '</span>' +
          '</div>' +
          '<h3>' +
          esc(item.title) +
          '</h3>' +
          '<p>' +
          esc(item.body) +
          '</p>' +
          '<div class="announcement-admin-card__actions">' +
          '<button type="button" class="btn btn--outline btn-sm" data-announcement-edit="' +
          esc(item.id) +
          '">Edit</button>' +
          '<button type="button" class="btn btn--ghost btn-sm" data-announcement-toggle="' +
          esc(item.id) +
          '">' +
          (item.active ? 'Nonaktifkan' : 'Aktifkan') +
          '</button>' +
          '<button type="button" class="btn btn--ghost-danger btn-sm" data-announcement-delete="' +
          esc(item.id) +
          '">Hapus</button>' +
          '</div></article>'
        );
      })
      .join('');
  }

  function openAnnouncementForm(id) {
    var form = $('announcementForm');
    if (!form) return;
    form.reset();
    clearFormErrors('announcementForm');
    $('announcementId').value = '';
    $('announcementActive').checked = true;
    $('announcementDate').value = store.todayISO();
    $('announcementFormTitle').textContent = 'Tambah Pengumuman';

    var category = $('announcementCategory');
    if (category) {
      category.innerHTML = store.ANNOUNCEMENT_CATEGORIES.map(function (cat) {
        return '<option value="' + esc(cat) + '">' + esc(cat) + '</option>';
      }).join('');
    }

    var item = id ? store.getAnnouncements().filter(function (a) { return a.id === id; })[0] : null;
    if (item) {
      $('announcementFormTitle').textContent = 'Edit Pengumuman';
      $('announcementId').value = item.id;
      $('announcementTitle').value = item.title;
      $('announcementCategory').value = item.category;
      $('announcementBody').value = item.body;
      $('announcementActive').checked = item.active;
      $('announcementDate').value = item.createdAt;
    }
    ui.openModal('announcementFormModal');
  }

  function saveAnnouncementForm(event) {
    event.preventDefault();
    clearFormErrors('announcementForm');
    var errors = {};
    if ($('announcementTitle').value.trim().length < 4) errors.announcementTitle = 'Judul minimal 4 karakter.';
    if (!$('announcementCategory').value) errors.announcementCategory = 'Pilih kategori pengumuman.';
    if ($('announcementBody').value.trim().length < 10) errors.announcementBody = 'Isi pengumuman minimal 10 karakter.';

    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (key) {
        setFormError(key, errors[key]);
      });
      ui.toast('Lengkapi kolom wajib yang ditandai.', 'error');
      return;
    }

    var saved = store.saveAnnouncement({
      id: $('announcementId').value || undefined,
      title: $('announcementTitle').value,
      category: $('announcementCategory').value,
      body: $('announcementBody').value,
      active: $('announcementActive').checked,
      createdAt: $('announcementDate').value || store.todayISO(),
      updatedAt: store.todayISO()
    });

    ui.closeModal('announcementFormModal');
    refreshAfterChange();
    ui.toast('Pengumuman "' + saved.title + '" berhasil disimpan.');
  }

  function initAnnouncements() {
    var add = $('addAnnouncementBtn');
    if (add) {
      add.addEventListener('click', function () {
        openAnnouncementForm('');
      });
    }
    var form = $('announcementForm');
    if (form) form.addEventListener('submit', saveAnnouncementForm);
  }

  function handleAnnouncementAction(event) {
    var editBtn = event.target.closest('[data-announcement-edit]');
    if (editBtn) {
      openAnnouncementForm(editBtn.getAttribute('data-announcement-edit'));
      return true;
    }
    var toggleBtn = event.target.closest('[data-announcement-toggle]');
    if (toggleBtn) {
      var updated = store.toggleAnnouncementActive(toggleBtn.getAttribute('data-announcement-toggle'));
      if (updated) {
        refreshAfterChange();
        ui.toast('Pengumuman ' + (updated.active ? 'diaktifkan.' : 'dinonaktifkan dari Beranda.'));
      }
      return true;
    }
    var deleteBtn = event.target.closest('[data-announcement-delete]');
    if (deleteBtn) {
      var id = deleteBtn.getAttribute('data-announcement-delete');
      var item = store.getAnnouncements().filter(function (a) { return a.id === id; })[0];
      if (!item) return true;
      ui.confirmDialog({
        title: 'Hapus pengumuman?',
        message: 'Pengumuman "' + item.title + '" akan dihapus permanen dari browser ini.',
        confirmLabel: 'Ya, hapus pengumuman',
        tone: 'danger'
      }).then(function (confirmed) {
        if (!confirmed) return;
        if (store.deleteAnnouncement(id)) {
          refreshAfterChange();
          ui.toast('Pengumuman berhasil dihapus.');
        } else {
          ui.toast('Pengumuman gagal dihapus.', 'error');
        }
      });
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Laporan                                                            */
  /* ------------------------------------------------------------------ */

  function localDateKey(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return (
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0')
    );
  }

  function reportRequests() {
    var list = store.getRequests();
    if (state.reportFrom) {
      list = list.filter(function (item) {
        return localDateKey(item.createdAt) >= state.reportFrom;
      });
    }
    if (state.reportTo) {
      list = list.filter(function (item) {
        return localDateKey(item.createdAt) <= state.reportTo;
      });
    }
    if (state.reportService !== 'Semua') {
      list = list.filter(function (item) {
        return item.serviceType === state.reportService;
      });
    }
    if (state.reportStatus !== 'Semua') {
      list = list.filter(function (item) {
        return item.status === state.reportStatus;
      });
    }
    return list;
  }

  function renderReports() {
    var select = $('reportStatus');
    if (select && select.options.length <= 1) populateStatusOptions(select, true);
    if (select) select.value = state.reportStatus;

    var list = reportRequests();
    var counts = { Haji: 0, Umroh: 0 };
    var byStatus = {};
    store.STATUS_ORDER.forEach(function (key) {
      byStatus[key] = 0;
    });

    list.forEach(function (item) {
      counts[item.serviceType] += 1;
      if (byStatus[item.status] !== undefined) byStatus[item.status] += 1;
    });

    var summary = $('reportSummary');
    if (summary) {
      summary.innerHTML =
        statCard('Total (filter)', list.length, 'Sesuai filter aktif', 'green') +
        statCard('Haji', counts.Haji, 'Permintaan haji', 'gold') +
        statCard('Umroh', counts.Umroh, 'Permintaan umroh', 'gold') +
        statCard('Menunggu', byStatus.menunggu + byStatus.diterima, 'Belum diperiksa', 'warning') +
        statCard('Diproses', byStatus.ditindaklanjuti, 'Sedang ditindaklanjuti', 'info') +
        statCard('Selesai', byStatus.selesai, 'Selesai ditindaklanjuti', 'success');
    }

    var statusBody = $('reportStatusBody');
    if (statusBody) {
      statusBody.innerHTML = store.STATUS_ORDER.map(function (key) {
        return (
          '<tr><td>' +
          esc(store.STATUSES[key].label) +
          '</td><td class="text-right"><strong>' +
          byStatus[key] +
          '</strong></td></tr>'
        );
      }).join('');
    }

    var reportList = $('reportList');
    var empty = $('reportEmpty');
    if (reportList) {
      if (!list.length) {
        reportList.innerHTML = '';
        if (empty) empty.hidden = false;
      } else {
        if (empty) empty.hidden = true;
        reportList.innerHTML = list
          .map(function (item) {
            return (
              '<div class="list-row">' +
              '<div class="list-row__main"><strong>' +
              esc(item.name) +
              '</strong><span>' +
              esc(item.code) +
              ' · ' +
              esc(item.serviceType) +
              ' · ' +
              esc(store.formatDate(item.createdAt)) +
              '</span></div>' +
              '<div class="list-row__side">' +
              ui.statusBadge(item.status) +
              '</div></div>'
            );
          })
          .join('');
      }
    }
  }

  function initReports() {
    var apply = $('reportApply');
    if (apply) {
      apply.addEventListener('click', function () {
        var from = $('reportDateFrom').value;
        var to = $('reportDateTo').value;
        if (from && to && from > to) {
          ui.toast('Tanggal awal tidak boleh melewati tanggal akhir.', 'error');
          return;
        }
        state.reportFrom = from;
        state.reportTo = to;
        state.reportService = $('reportService').value;
        state.reportStatus = $('reportStatus').value;
        renderReports();
        ui.toast('Filter laporan diterapkan.', 'info');
      });
    }

    var reset = $('reportReset');
    if (reset) {
      reset.addEventListener('click', function () {
        $('reportDateFrom').value = '';
        $('reportDateTo').value = '';
        $('reportService').value = 'Semua';
        $('reportStatus').value = 'Semua';
        state.reportFrom = '';
        state.reportTo = '';
        state.reportService = 'Semua';
        state.reportStatus = 'Semua';
        renderReports();
        ui.toast('Filter laporan direset.', 'info');
      });
    }

    var exportBtn = $('exportCsv');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var list = reportRequests();
        if (!list.length) {
          ui.toast('Tidak ada data untuk diekspor pada filter ini.', 'error');
          return;
        }
        var headers = [
          'Nomor Permintaan',
          'Nama Calon Jamaah',
          'Nomor HP',
          'Jenis Layanan',
          'Paket',
          'Rencana Keberangkatan',
          'Pihak Pengisi',
          'Catatan Kebutuhan',
          'Tanggal Pengajuan',
          'Status',
          'Catatan Tindak Lanjut',
          'Pembaruan Terakhir'
        ];
        var rows = list.map(function (item) {
          return [
            item.code,
            item.name,
            item.phone,
            item.serviceType,
            item.packageName,
            item.departurePlan,
            item.submittedBy,
            item.needs,
            store.formatDate(item.createdAt),
            store.STATUSES[item.status] ? store.STATUSES[item.status].label : item.status,
            item.followUpNote,
            store.formatDateTime(item.updatedAt)
          ];
        });
        var csv = store.buildCSV(headers, rows);
        var filename = 'hajiyuk-pendaftaran-' + store.todayISO() + '.csv';
        if (store.downloadCSV(filename, csv)) {
          ui.toast('Laporan CSV berhasil diunduh (' + rows.length + ' baris).');
        } else {
          ui.toast('Gagal membuat berkas CSV.', 'error');
        }
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pengaturan                                                         */
  /* ------------------------------------------------------------------ */

  function renderSettings() {
    var session = auth.getSession();
    if (session) {
      document.querySelectorAll('[data-admin-name]').forEach(function (label) {
        label.textContent = session.name;
      });
      var email = $('adminEmail');
      if (email) email.textContent = session.email;
      var lastLogin = $('adminLastLogin');
      if (lastLogin) {
        lastLogin.textContent = session.lastLoginAt
          ? store.formatDateTime(session.lastLoginAt)
          : 'Sesi pertama akun ini';
      }
      var left = $('adminSessionLeft');
      if (left) left.textContent = auth.sessionMinutesLeft() + ' menit lagi (idle ' + auth.IDLE_MINUTES + ' menit)';
      var countdown = $('sessionCountdown');
      if (countdown) countdown.textContent = 'Sisa waktu sesi ini: sekitar ' + auth.sessionMinutesLeft() + ' menit.';
    }
    renderMfaState();
    renderSecurityLogs();
  }

  function renderMfaState() {
    var enabled = auth.mfaEnabled();
    var status = $('mfaStatus');
    var enableBtn = $('mfaEnableBtn');
    var disableForm = $('mfaDisableForm');
    if (status) {
      status.textContent = enabled
        ? 'MFA aktif. Login admin memerlukan kode 6 digit dari aplikasi authenticator.'
        : 'MFA belum aktif. Disarankan untuk mengaktifkannya demi keamanan akun admin.';
    }
    if (enableBtn) enableBtn.hidden = enabled;
    if (disableForm) disableForm.hidden = !enabled;
  }

  function renderSecurityLogs() {
    var host = $('securityLogList');
    if (!host) return;
    var logs = store.getLogs().filter(function (entry) {
      return entry.type === 'auth' || entry.type === 'security' || entry.type === 'system';
    }).slice(0, 25);
    if (!logs.length) {
      host.innerHTML = '<p class="muted">Belum ada aktivitas keamanan yang tercatat.</p>';
      return;
    }
    host.innerHTML = logs.map(function (entry) {
      return (
        '<div class="security-log">' +
        '<div class="security-log__head"><strong>' + esc(entry.action) + '</strong>' +
        '<time>' + esc(store.formatDateTime(entry.at)) + '</time></div>' +
        '<p>' + esc(entry.detail) + '</p>' +
        '<span class="security-log__actor">' + esc(entry.actor || 'Sistem') + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function initSettings() {
    var passwordForm = $('adminPasswordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var error = $('adminPasswordError');
        if (error) error.textContent = '';
        var result = await auth.changePassword(
          $('currentAdminPassword').value,
          $('newAdminPassword').value,
          $('confirmAdminPassword').value
        );
        if (!result.ok) {
          if (error) error.textContent = result.message;
          return;
        }
        passwordForm.reset();
        ui.toast(result.message);
        renderSecurityLogs();
      });
    }

    var mfaEnable = $('mfaEnableBtn');
    if (mfaEnable) {
      mfaEnable.addEventListener('click', function () {
        var setup = auth.startMfaSetup();
        if (!setup.ok) {
          ui.toast(setup.message, 'error');
          return;
        }
        var panel = $('mfaSetupPanel');
        var secret = $('mfaSecret');
        var link = $('mfaOtpLink');
        if (secret) secret.textContent = setup.secret;
        if (link) link.setAttribute('href', setup.otpauth);
        if (panel) panel.hidden = false;
        mfaEnable.hidden = true;
        var code = $('mfaSetupCode');
        if (code) {
          code.value = '';
          code.focus();
        }
      });
    }

    var mfaCancel = $('mfaCancelBtn');
    if (mfaCancel) {
      mfaCancel.addEventListener('click', function () {
        auth.cancelMfaSetup();
        var panel = $('mfaSetupPanel');
        if (panel) panel.hidden = true;
        renderMfaState();
      });
    }

    var mfaConfirm = $('mfaConfirmBtn');
    if (mfaConfirm) {
      mfaConfirm.addEventListener('click', async function () {
        var error = $('mfaSetupError');
        if (error) error.textContent = '';
        var result = await auth.confirmMfaSetup(($('mfaSetupCode') || {}).value || '');
        if (!result.ok) {
          if (error) error.textContent = result.message;
          return;
        }
        var panel = $('mfaSetupPanel');
        if (panel) panel.hidden = true;
        ui.toast(result.message);
        renderMfaState();
        renderSecurityLogs();
      });
    }

    var mfaDisable = $('mfaDisableForm');
    if (mfaDisable) {
      mfaDisable.addEventListener('submit', async function (event) {
        event.preventDefault();
        var error = $('mfaDisableError');
        if (error) error.textContent = '';
        var result = await auth.disableMfa(
          ($('mfaDisablePassword') || {}).value || '',
          ($('mfaDisableCode') || {}).value || ''
        );
        if (!result.ok) {
          if (error) error.textContent = result.message;
          return;
        }
        mfaDisable.reset();
        ui.toast(result.message);
        renderMfaState();
        renderSecurityLogs();
      });
    }

    var exportBtn = $('exportBackupBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var result = auth.exportBackup();
        var status = $('backupStatus');
        if (status) status.textContent = result.ok ? 'Backup JSON berhasil diunduh.' : result.message;
        if (!result.ok) ui.toast(result.message, 'error');
        else ui.toast('Backup data berhasil dibuat.');
      });
    }

    var importBtn = $('importBackupBtn');
    var restoreFile = $('restoreFile');
    if (importBtn && restoreFile) {
      importBtn.addEventListener('click', function () {
        restoreFile.click();
      });
      restoreFile.addEventListener('change', function () {
        var file = restoreFile.files && restoreFile.files[0];
        restoreFile.value = '';
        if (!file) return;
        ui.confirmDialog({
          title: 'Pulihkan data dari backup?',
          message:
            'Data paket, permintaan, panduan, pengumuman, dan log saat ini akan diganti dengan isi backup. Tindakan ini tidak dapat dibatalkan.',
          confirmLabel: 'Ya, pulihkan data',
          tone: 'primary'
        }).then(async function (confirmed) {
          if (!confirmed) return;
          var result = await auth.restoreBackup(file);
          var status = $('backupStatus');
          if (status) status.textContent = result.message;
          if (!result.ok) {
            ui.toast(result.message, 'error');
            return;
          }
          refreshAfterChange();
          renderSettings();
          ui.toast(result.message);
        });
      });
    }

    var reset = $('resetDataAdmin');
    if (reset) {
      reset.addEventListener('click', function () {
        ui.confirmDialog({
          title: 'Hapus seluruh data simulasi?',
          message:
            'Semua paket, permintaan pendaftaran, panduan, dan pengumuman di browser ini akan dikembalikan ke kondisi awal. Akun, sesi, dan log audit tetap disimpan. Tindakan ini tidak dapat dibatalkan.',
          confirmLabel: 'Ya, hapus semua data',
          tone: 'danger'
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.resetSimulationData();
          refreshAfterChange();
          ui.toast('Data simulasi berhasil dihapus dan diisi ulang.');
        });
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Event global                                                       */
  /* ------------------------------------------------------------------ */

  function initGlobalEvents() {
    document.addEventListener('click', function (event) {
      var openBtn = event.target.closest('[data-open-request]');
      if (openBtn) {
        closePanels();
        openRequest(openBtn.getAttribute('data-open-request'));
        return;
      }

      var deleteRequestBtn = event.target.closest('[data-delete-request]');
      if (deleteRequestBtn) {
        requestDeleteHandler(deleteRequestBtn.getAttribute('data-delete-request'));
        return;
      }

      if (handlePackageAction(event)) return;
      if (handleGuideAction(event)) return;
      if (handleAnnouncementAction(event)) return;
    });

    window.addEventListener('resize', function () {
      if (state.view !== 'overview') return;
      window.clearTimeout(window.__hyChartTimer);
      window.__hyChartTimer = window.setTimeout(function () {
        var stats = store.getStats();
        drawServiceChart(stats);
        drawStatusChart(stats);
      }, 150);
    });

    window.addEventListener('storage', function (event) {
      if (!event.key || event.key.indexOf('hajiyuk_') !== 0) return;
      refreshAfterChange();
    });

    // Kompatibilitas canvas roundRect untuk browser lama
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        var radius = Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2);
        this.moveTo(x + radius, y);
        this.arcTo(x + w, y, x + w, y + h, radius);
        this.arcTo(x + w, y + h, x, y + h, radius);
        this.arcTo(x, y + h, x, y, radius);
        this.arcTo(x, y, x + w, y, radius);
        this.closePath();
        return this;
      };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Inisialisasi                                                       */
  /* ------------------------------------------------------------------ */

  async function init() {
    els.loginScreen = $('loginScreen');
    els.adminApp = $('adminApp');

    store.init();
    var authReady = await auth.init();
    initLogin();

    if (!authReady.ok) {
      showLogin(authReady.message);
      return;
    }

    ui.initModalDismiss();
    initNavigation();
    initRequests();
    initPackages();
    initGuides();
    initAnnouncements();
    initReports();
    initSettings();
    initGlobalEvents();

    var hashView = (window.location.hash || '').replace('#/', '');

    if (!auth.isLoggedIn('admin')) {
      showLogin();
      return;
    }

    showDashboard();

    if (VIEWS.indexOf(hashView) !== -1) switchView(hashView, true);

    window.setInterval(function () {
      if (!auth.isLoggedIn('admin')) {
        ui.closeAllModals();
        closeSidebar();
        showLogin('Sesi berakhir karena tidak ada aktivitas. Silakan masuk kembali.');
        return;
      }
      if (state.view === 'settings') {
        var left = $('adminSessionLeft');
        if (left) left.textContent = auth.sessionMinutesLeft() + ' menit lagi (idle ' + auth.IDLE_MINUTES + ' menit)';
        var countdown = $('sessionCountdown');
        if (countdown) countdown.textContent = 'Sisa waktu sesi ini: sekitar ' + auth.sessionMinutesLeft() + ' menit.';
      }
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
