/**
 * Haji Yuk — Logika aplikasi pengguna
 */
(function () {
  'use strict';

  var store = window.HajiYuk;
  var ui = window.HajiYukUI;
  var esc = store.escapeHTML;

  var PAGES = ['beranda', 'katalog', 'pendaftaran', 'status', 'panduan', 'profil', 'bantuan'];

  var state = {
    page: 'beranda',
    catalogFilter: 'Semua',
    catalogQuery: '',
    guideFilter: 'Semua',
    guideQuery: '',
    pendingPackageId: '',
    lastRequestId: ''
  };

  /* ------------------------------------------------------------------ */
  /* Navigasi                                                            */
  /* ------------------------------------------------------------------ */

  function pageFromHash() {
    var hash = window.location.hash || '';
    var match = hash.match(/^#\/([a-z-]+)/);
    var page = match ? match[1] : 'beranda';
    return PAGES.indexOf(page) === -1 ? 'beranda' : page;
  }

  function showPage(page, options) {
    if (PAGES.indexOf(page) === -1) page = 'beranda';
    state.page = page;

    PAGES.forEach(function (name) {
      var section = document.getElementById('page-' + name);
      if (!section) return;
      var isActive = name === page;
      section.classList.toggle('is-active', isActive);
      if (isActive) section.removeAttribute('hidden');
      else section.setAttribute('hidden', '');
    });

    document.querySelectorAll('[data-go]').forEach(function (link) {
      if (link.classList.contains('site-nav') || link.closest('.site-nav')) {
        link.classList.toggle('is-active', link.getAttribute('data-go') === page);
      }
    });

    closeMobileNav();

    if (page === 'beranda') renderHome();
    if (page === 'katalog') renderCatalog();
    if (page === 'pendaftaran') {
      syncPackageOptions();
      if (options && options.packageId) prefillRegistration(options.packageId);
    }
    if (page === 'status') renderStatus();
    if (page === 'panduan') renderGuides();
    if (page === 'profil') fillProfile();

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function go(page, options) {
    if (state.page === page) {
      showPage(page, options);
      if (window.location.hash !== '#/' + page) {
        try {
          history.replaceState(null, '', '#/' + page);
        } catch (error) {
          window.location.hash = '#/' + page;
        }
      }
      return;
    }
    window.location.hash = '#/' + page;
    if (options && options.packageId) {
      // simpan pilihan sebelum hashchange terjadi
      state.pendingPackageId = options.packageId;
    }
  }

  function handleRoute() {
    var page = pageFromHash();
    var options = {};
    if (page === 'pendaftaran' && state.pendingPackageId) {
      options.packageId = state.pendingPackageId;
      state.pendingPackageId = '';
    }
    showPage(page, options);
  }

  /* ------------------------------------------------------------------ */
  /* Navigasi mobile                                                     */
  /* ------------------------------------------------------------------ */

  function closeMobileNav() {
    var nav = document.getElementById('siteNav');
    var toggle = document.getElementById('navToggle');
    if (nav) nav.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function initMobileNav() {
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('siteNav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Ukuran teks                                                         */
  /* ------------------------------------------------------------------ */

  function applyTextScale(scale) {
    var next = store.saveTextScale(scale);
    document.documentElement.setAttribute('data-text-scale', next);
    document.querySelectorAll('[data-text-scale]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-text-scale') === next ? 'true' : 'false');
      button.classList.toggle('is-active', button.getAttribute('data-text-scale') === next);
    });
  }

  function initTextScale() {
    applyTextScale(store.getTextScale());
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-text-scale]');
      if (!button) return;
      event.preventDefault();
      applyTextScale(button.getAttribute('data-text-scale'));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Beranda                                                             */
  /* ------------------------------------------------------------------ */

  function renderHome() {
    var host = document.getElementById('homeAnnouncements');
    if (host) {
      var announcements = store.getAnnouncements({ activeOnly: true });
      if (!announcements.length) {
        host.innerHTML =
          '<div class="empty-state" style="grid-column:1/-1;padding:2rem">' +
          '<h3>Belum ada pengumuman</h3>' +
          '<p>Informasi penting dari petugas akan tampil di sini.</p>' +
          '</div>';
      } else {
        host.innerHTML = announcements
          .slice(0, 4)
          .map(function (item) {
            return (
              '<article class="announcement">' +
              '<span class="badge badge--gold">' +
              esc(item.category) +
              '</span>' +
              '<h3>' +
              esc(item.title) +
              '</h3>' +
              '<p>' +
              esc(item.body) +
              '</p>' +
              '<div class="announcement__meta">' +
              '<span>Tanggal: ' +
              esc(store.formatDate(item.createdAt)) +
              '</span>' +
              '</div>' +
              '</article>'
            );
          })
          .join('');
      }
    }

    var packagesHost = document.getElementById('homePackages');
    if (packagesHost) {
      var packages = store.getPackages().slice(0, 3);
      if (!packages.length) {
        packagesHost.innerHTML =
          '<div class="empty-state" style="grid-column:1/-1">' +
          '<h3>Katalog paket belum tersedia</h3>' +
          '<p>Petugas belum mempublikasikan paket. Silakan periksa kembali nanti.</p>' +
          '</div>';
      } else {
        packagesHost.innerHTML = packages.map(packageCard).join('');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Paket                                                               */
  /* ------------------------------------------------------------------ */

  function packageCard(pkg) {
    var badgeClass = pkg.serviceType === 'Haji' ? 'badge--primary' : 'badge--gold';
    return (
      '<article class="package-card">' +
      '<div class="package-card__media">' +
      ui.imageOrFallback(pkg.image, 'Ilustrasi ' + pkg.name) +
      '<span class="badge ' +
      badgeClass +
      '">' +
      esc(pkg.serviceType) +
      '</span>' +
      '</div>' +
      '<div class="package-card__body">' +
      '<h3>' +
      esc(pkg.name) +
      '</h3>' +
      '<p class="package-card__price">' +
      esc(pkg.price) +
      '</p>' +
      '<p class="package-card__summary">' +
      esc(pkg.description) +
      '</p>' +
      '<div class="package-card__meta">' +
      '<span>⏱ ' +
      esc(pkg.duration) +
      '</span>' +
      '<span>🗓 ' +
      esc(pkg.schedule) +
      '</span>' +
      '</div>' +
      '<span class="sim-label">Simulasi · belum diverifikasi</span>' +
      '<div class="package-card__actions">' +
      '<button type="button" class="btn btn--ghost" data-package-detail="' +
      esc(pkg.id) +
      '">Detail</button>' +
      '<button type="button" class="btn btn--primary" data-package-register="' +
      esc(pkg.id) +
      '">Daftar</button>' +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderCatalog() {
    var host = document.getElementById('catalogGrid');
    var empty = document.getElementById('catalogEmpty');
    if (!host) return;

    var list = store.getPackages({ serviceType: state.catalogFilter === 'Semua' ? null : state.catalogFilter });
    var query = state.catalogQuery.trim().toLowerCase();

    if (query) {
      list = list.filter(function (pkg) {
        return (
          pkg.name.toLowerCase().indexOf(query) !== -1 ||
          pkg.description.toLowerCase().indexOf(query) !== -1 ||
          pkg.facilities.join(' ').toLowerCase().indexOf(query) !== -1
        );
      });
    }

    host.innerHTML = list.map(packageCard).join('');
    if (empty) empty.hidden = list.length > 0;

    var chips = document.getElementById('catalogFilters');
    if (chips) {
      chips.querySelectorAll('[data-filter]').forEach(function (chip) {
        var active = chip.getAttribute('data-filter') === state.catalogFilter;
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  function openPackageDetail(id) {
    var pkg = store.getPackageById(id);
    if (!pkg) {
      ui.toast('Paket tidak ditemukan. Mungkin sudah dihapus admin.', 'error');
      return;
    }
    var body = document.getElementById('packageModalBody');
    var foot = document.getElementById('packageModalFoot');
    var title = document.getElementById('packageModalTitle');
    if (!body || !foot) return;

    title.textContent = pkg.name;
    body.innerHTML =
      '<div class="detail-grid">' +
      detailItem('Jenis layanan', pkg.serviceType) +
      detailItem('Harga / biaya', pkg.price) +
      detailItem('Durasi', pkg.duration) +
      detailItem('Jadwal keberangkatan', pkg.schedule) +
      detailItem('Penyelenggara', pkg.organizer) +
      detailItem('Informasi diperbarui', store.formatDate(pkg.updatedAt)) +
      '</div>' +
      '<h3>Deskripsi paket</h3>' +
      '<p class="article__body">' +
      esc(pkg.description) +
      '</p>' +
      '<h3>Fasilitas</h3>' +
      '<ul class="facility-list">' +
      pkg.facilities.map(function (item) {
        return '<li>' + esc(item) + '</li>';
      }).join('') +
      '</ul>' +
      '<p class="notice notice--warn" style="margin-top:1.25rem">Harga, jadwal, dan fasilitas ini masih simulasi dan belum diverifikasi. Silakan konfirmasi kepada petugas.</p>';

    foot.innerHTML =
      '<button type="button" class="btn btn--ghost" data-close-modal>Tutup</button>' +
      '<button type="button" class="btn btn--primary" data-package-register="' +
      esc(pkg.id) +
      '">Ajukan Pendaftaran</button>';

    ui.openModal('packageModal');
  }

  function detailItem(label, value) {
    return (
      '<div class="detail-item"><dt>' +
      esc(label) +
      '</dt><dd>' +
      esc(value || '—') +
      '</dd></div>'
    );
  }

  /* ------------------------------------------------------------------ */
  /* Panduan                                                             */
  /* ------------------------------------------------------------------ */

  function renderGuideFilters() {
    var host = document.getElementById('guideFilters');
    if (!host) return;
    var used = {};
    store.getGuides().forEach(function (guide) {
      used[guide.category] = true;
    });
    var categories = ['Semua'].concat(
      store.GUIDE_CATEGORIES.filter(function (cat) {
        return used[cat];
      })
    );
    if (state.guideFilter !== 'Semua' && categories.indexOf(state.guideFilter) === -1) {
      state.guideFilter = 'Semua';
    }
    host.innerHTML = categories
      .map(function (cat) {
        var active = cat === state.guideFilter;
        return (
          '<button type="button" class="chip' +
          (active ? ' is-active' : '') +
          '" data-category="' +
          esc(cat) +
          '" aria-pressed="' +
          (active ? 'true' : 'false') +
          '">' +
          esc(cat) +
          '</button>'
        );
      })
      .join('');
  }

  function renderGuides() {
    renderGuideFilters();
    var host = document.getElementById('guideGrid');
    var empty = document.getElementById('guideEmpty');
    if (!host) return;

    var query = state.guideQuery.trim().toLowerCase();
    var list = store.getGuides({
      category: state.guideFilter === 'Semua' ? null : state.guideFilter
    }).filter(function (guide) {
      if (!query) return true;
      return (
        guide.title.toLowerCase().indexOf(query) !== -1 ||
        guide.summary.toLowerCase().indexOf(query) !== -1 ||
        guide.content.toLowerCase().indexOf(query) !== -1
      );
    });

    host.innerHTML = list
      .map(function (guide) {
        return (
          '<article class="guide-card">' +
          '<span class="badge badge--primary">' +
          esc(guide.category) +
          '</span>' +
          '<h3>' +
          esc(guide.title) +
          '</h3>' +
          '<p>' +
          esc(guide.summary) +
          '</p>' +
          '<div class="guide-card__meta">' +
          '<span>Diperbarui ' +
          esc(store.formatDate(guide.updatedAt)) +
          '</span>' +
          '<div class="guide-card__actions">' +
          '<button type="button" class="btn btn--ghost btn-sm" data-guide-open="' +
          esc(guide.id) +
          '">Baca</button>' +
          '</div>' +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    if (empty) empty.hidden = list.length > 0;
  }

  function openGuide(id) {
    var guide = store.getGuideById(id);
    if (!guide) {
      ui.toast('Panduan tidak ditemukan.', 'error');
      return;
    }
    var body = document.getElementById('guideModalBody');
    var title = document.getElementById('guideModalTitle');
    if (!body) return;
    title.textContent = guide.title;
    body.innerHTML =
      '<div class="detail-grid"><div class="detail-item"><dt>Kategori</dt><dd>' +
      esc(guide.category) +
      '</dd></div><div class="detail-item"><dt>Diperbarui</dt><dd>' +
      esc(store.formatDate(guide.updatedAt)) +
      '</dd></div></div>' +
      '<p class="article__body">' +
      esc(guide.content) +
      '</p>' +
      (guide.image
        ? '<div style="margin-top:1.25rem">' +
          ui.imageOrFallback(guide.image, 'Ilustrasi ' + guide.title) +
          '</div>'
        : '') +
      (guide.source
        ? '<div class="article__source"><strong>Sumber / catatan:</strong> ' + esc(guide.source) + '</div>'
        : '');
    ui.openModal('guideModal');
  }

  /* ------------------------------------------------------------------ */
  /* Pendaftaran                                                         */
  /* ------------------------------------------------------------------ */

  function syncPackageOptions() {
    var service = document.getElementById('regService');
    var select = document.getElementById('regPackage');
    if (!service || !select) return;

    var current = select.value;
    var type = service.value;
    var list = type ? store.getPackages({ serviceType: type }) : [];

    if (!type) {
      select.innerHTML = '<option value="">Pilih jenis layanan terlebih dahulu</option>';
      return;
    }

    var options = ['<option value="">Pilih paket atau layanan</option>'];
    list.forEach(function (pkg) {
      options.push(
        '<option value="' + esc(pkg.id) + '">' + esc(pkg.name) + ' — ' + esc(pkg.price) + '</option>'
      );
    });
    options.push('<option value="konsultasi">Belum menentukan — ingin konsultasi paket</option>');
    select.innerHTML = options.join('');

    if (current === 'konsultasi') {
      select.value = 'konsultasi';
    } else if (current) {
      var exists = list.some(function (pkg) {
        return pkg.id === current;
      });
      select.value = exists ? current : '';
    }
  }

  function prefillRegistration(packageId) {
    var pkg = store.getPackageById(packageId);
    if (!pkg) return;
    showRegStep(1);
    var service = document.getElementById('regService');
    var consent = document.getElementById('regConsent');
    if (service) {
      service.value = pkg.serviceType;
      syncPackageOptions();
      var select = document.getElementById('regPackage');
      if (select) select.value = pkg.id;
    }
    if (consent) consent.checked = false;
    var nameField = document.getElementById('regName');
    if (nameField) {
      try {
        nameField.focus({ preventScroll: true });
      } catch (error) {
        nameField.focus();
      }
    }
  }

  function setError(fieldId, message) {
    var field = document.getElementById(fieldId);
    var error = document.querySelector('[data-error-for="' + fieldId + '"]');
    if (error) error.textContent = message || '';
    if (field) {
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }
  }

  function clearErrors() {
    document.querySelectorAll('[data-error-for]').forEach(function (el) {
      el.textContent = '';
    });
    document.querySelectorAll('#registrationForm [aria-invalid="true"]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
  }

  function readRegistrationForm() {
    return {
      name: document.getElementById('regName').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
      serviceType: document.getElementById('regService').value,
      packageId: document.getElementById('regPackage').value,
      departurePlan: document.getElementById('regDeparture').value.trim(),
      submittedBy: document.getElementById('regSubmitter').value,
      needs: document.getElementById('regNeeds').value.trim(),
      consent: document.getElementById('regConsent').checked
    };
  }

  function validateRegistration(data) {
    var errors = {};
    if (data.name.length < 3) errors.regName = 'Nama lengkap minimal 3 karakter.';
    if (!/^[0-9+\-\s()]{8,20}$/.test(data.phone)) {
      errors.regPhone = 'Masukkan nomor HP yang valid (8–20 digit).';
    }
    if (!data.serviceType) errors.regService = 'Pilih jenis layanan Haji atau Umroh.';
    if (!data.packageId) errors.regPackage = 'Pilih paket atau opsi konsultasi.';
    if (!data.departurePlan) errors.regDeparture = 'Isi rencana keberangkatan.';
    if (!data.submittedBy) errors.regSubmitter = 'Pilih pihak yang mengisi formulir.';
    if (!data.consent) errors.regConsent = 'Centang pernyataan bahwa Anda memahami ketentuan ini.';
    return errors;
  }

  function showRegStep(step) {
    document.querySelectorAll('[data-reg-step]').forEach(function (panel) {
      panel.hidden = Number(panel.getAttribute('data-reg-step')) !== step;
    });
    var steps = document.querySelectorAll('#regSteps li');
    Array.prototype.forEach.call(steps, function (item, index) {
      if (!item) return;
      var number = index + 1;
      item.classList.toggle('is-active', number === step);
      item.classList.toggle('is-done', number < step);
      item.setAttribute('aria-current', number === step ? 'step' : 'false');
    });
    var form = document.getElementById('registrationForm');
    if (form) {
      try {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        /* diabaikan */
      }
    }
  }

  function packageNameFor(data) {
    if (data.packageId === 'konsultasi') return 'Konsultasi pemilihan paket';
    var pkg = store.getPackageById(data.packageId);
    return pkg ? pkg.name : 'Paket tidak tersedia';
  }

  function renderReview(data) {
    var host = document.getElementById('reviewSummary');
    if (!host) return;
    var rows = [
      ['Nama calon jamaah', data.name],
      ['Nomor HP', data.phone],
      ['Jenis layanan', data.serviceType],
      ['Paket / layanan', packageNameFor(data)],
      ['Rencana keberangkatan', data.departurePlan],
      ['Pihak yang mengisi', data.submittedBy],
      ['Catatan / kebutuhan bantuan', data.needs || 'Tidak ada catatan']
    ];
    host.innerHTML = rows
      .map(function (row) {
        return (
          '<div class="review__item"><dt>' +
          esc(row[0]) +
          '</dt><dd>' +
          esc(row[1]) +
          '</dd></div>'
        );
      })
      .join('');
    showRegStep(2);
  }

  function renderSuccess(request) {
    var codeHost = document.getElementById('newRequestCode');
    if (codeHost) codeHost.textContent = request.code;
    var host = document.getElementById('successSummary');
    if (host) {
      host.innerHTML =
        '<div class="review__item"><dt>Nomor permintaan</dt><dd>' +
        esc(request.code) +
        '</dd></div>' +
        '<div class="review__item"><dt>Nama calon jamaah</dt><dd>' +
        esc(request.name) +
        '</dd></div>' +
        '<div class="review__item"><dt>Layanan</dt><dd>' +
        esc(request.serviceType) +
        ' — ' +
        esc(request.packageName) +
        '</dd></div>' +
        '<div class="review__item"><dt>Status saat ini</dt><dd>' +
        esc(store.STATUSES[request.status].label) +
        '</dd></div>';
    }
    showRegStep(3);
  }

  function submitRegistration() {
    var data = readRegistrationForm();
    var errors = validateRegistration(data);
    clearErrors();
    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (key) {
        setError(key, errors[key]);
      });
      showRegStep(1);
      ui.toast('Periksa kembali data yang ditandai merah.', 'error');
      return;
    }

    var request = store.addRequest({
      name: data.name,
      phone: data.phone,
      serviceType: data.serviceType,
      packageId: data.packageId,
      packageName: packageNameFor(data),
      departurePlan: data.departurePlan,
      submittedBy: data.submittedBy,
      needs: data.needs
    });

    state.lastRequestId = request.id;
    renderSuccess(request);
    ui.toast('Permintaan pendaftaran berhasil dikirim.');
  }

  function resetRegistrationForm() {
    var form = document.getElementById('registrationForm');
    if (form) form.reset();
    clearErrors();
    syncPackageOptions();
    var select = document.getElementById('regPackage');
    if (select) select.innerHTML = '<option value="">Pilih jenis layanan terlebih dahulu</option>';
    showRegStep(1);
    var nameField = document.getElementById('regName');
    if (nameField) nameField.focus();
  }

  function initRegistration() {
    var form = document.getElementById('registrationForm');
    if (!form) return;

    var service = document.getElementById('regService');
    if (service) {
      service.addEventListener('change', function () {
        syncPackageOptions();
        setError('regService', '');
      });
    }

    var toReview = document.getElementById('toReview');
    if (toReview) {
      toReview.addEventListener('click', function () {
        var data = readRegistrationForm();
        var errors = validateRegistration(data);
        clearErrors();
        if (Object.keys(errors).length) {
          Object.keys(errors).forEach(function (key) {
            setError(key, errors[key]);
          });
          ui.toast('Lengkapi data yang wajib diisi terlebih dahulu.', 'error');
          var first = document.querySelector('#registrationForm [aria-invalid="true"]');
          if (first) first.focus();
          return;
        }
        renderReview(data);
      });
    }

    var back = document.getElementById('backToEdit');
    if (back) back.addEventListener('click', function () { showRegStep(1); });

    var confirm = document.getElementById('confirmSubmit');
    if (confirm) confirm.addEventListener('click', submitRegistration);

    var goStatusBtn = document.getElementById('goStatus');
    if (goStatusBtn) {
      goStatusBtn.addEventListener('click', function () {
        go('status');
      });
    }

    var newRequest = document.getElementById('newRequest');
    if (newRequest) newRequest.addEventListener('click', resetRegistrationForm);

    syncPackageOptions();
  }

  /* ------------------------------------------------------------------ */
  /* Status pendaftaran                                                  */
  /* ------------------------------------------------------------------ */

  function renderStatus() {
    var host = document.getElementById('statusList');
    var empty = document.getElementById('statusEmpty');
    var meta = document.getElementById('statusMeta');
    if (!host) return;

    var clientId = store.getClientId();
    var requests = store.getRequestsForClient(clientId);

    if (meta) {
      meta.textContent = requests.length
        ? 'Menampilkan ' + requests.length + ' permintaan yang dibuat dari browser ini.'
        : 'Belum ada permintaan yang dibuat dari browser ini.';
    }

    if (!requests.length) {
      host.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    host.innerHTML = requests.map(statusCard).join('');
  }

  function statusCard(request) {
    var statusData = store.STATUSES[request.status] || store.STATUSES.menunggu;
    var history = (request.history || []).slice().reverse();
    var timeline = history
      .map(function (entry) {
        var label = store.STATUSES[entry.status] ? store.STATUSES[entry.status].label : 'Status diperbarui';
        return (
          '<li><strong>' +
          esc(label) +
          '</strong><time>' +
          esc(store.formatDateTime(entry.at)) +
          '</time>' +
          (entry.note ? '<div>' + esc(entry.note) + '</div>' : '') +
          '</li>'
        );
      })
      .join('');

    return (
      '<article class="status-card">' +
      '<div class="status-card__head">' +
      '<div><span class="status-card__code">' +
      esc(request.code) +
      '</span><h2 class="status-card__title">' +
      esc(request.name) +
      '</h2></div>' +
      '<span class="badge badge--' +
      esc(statusData.tone) +
      '">' +
      esc(statusData.label) +
      '</span>' +
      '</div>' +
      '<dl class="status-card__grid">' +
      '<div><dt>Layanan</dt><dd>' +
      esc(request.serviceType) +
      '</dd></div>' +
      '<div><dt>Paket dipilih</dt><dd>' +
      esc(request.packageName) +
      '</dd></div>' +
      '<div><dt>Rencana keberangkatan</dt><dd>' +
      esc(request.departurePlan) +
      '</dd></div>' +
      '<div><dt>Tanggal pengajuan</dt><dd>' +
      esc(store.formatDate(request.createdAt)) +
      '</dd></div>' +
      '<div><dt>Pembaruan terakhir</dt><dd>' +
      esc(store.formatDateTime(request.updatedAt)) +
      '</dd></div>' +
      '<div><dt>Pihak pengisi</dt><dd>' +
      esc(request.submittedBy) +
      '</dd></div>' +
      '</dl>' +
      '<div class="status-note"><strong>Catatan tindak lanjut petugas</strong>' +
      '<p>' +
      (request.followUpNote
        ? esc(request.followUpNote)
        : 'Belum ada catatan dari petugas untuk permintaan ini.') +
      '</p></div>' +
      (timeline ? '<p class="status-card__code" style="margin-top:1.25rem">Riwayat status</p><ul class="timeline">' + timeline + '</ul>' : '') +
      '<p class="field-hint" style="margin-top:1rem">Status ini hanya menunjukkan proses tindak lanjut melalui aplikasi Haji Yuk, bukan persetujuan pemerintah, nomor porsi, bukti pembayaran, atau jaminan keberangkatan.</p>' +
      '</article>'
    );
  }

  /* ------------------------------------------------------------------ */
  /* Profil                                                              */
  /* ------------------------------------------------------------------ */

  function fillProfile() {
    var profile = store.getProfile();
    var name = document.getElementById('profileName');
    var phone = document.getElementById('profilePhone');
    var client = document.getElementById('clientIdLabel');
    if (name) name.value = profile.name;
    if (phone) phone.value = profile.phone;
    if (client) client.textContent = store.getClientId();
  }

  function initProfile() {
    var form = document.getElementById('profileForm');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        store.saveProfile({
          name: document.getElementById('profileName').value,
          phone: document.getElementById('profilePhone').value
        });
        ui.toast('Profil berhasil disimpan.');
      });
    }

    var reset = document.getElementById('resetDataBtn');
    if (reset) {
      reset.addEventListener('click', function () {
        ui.confirmDialog({
          title: 'Hapus seluruh data simulasi?',
          message:
            'Semua paket, permintaan pendaftaran, panduan, pengumuman, dan pengaturan di browser ini akan dikembalikan ke kondisi awal. Tindakan ini tidak dapat dibatalkan.',
          confirmLabel: 'Ya, hapus semua data',
          tone: 'danger'
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.resetSimulationData();
          fillProfile();
          applyTextScale(store.getTextScale());
          showPage(state.page);
          ui.toast('Data simulasi berhasil dihapus dan diisi ulang.');
        });
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Event global                                                        */
  /* ------------------------------------------------------------------ */

  function initGlobalEvents() {
    document.addEventListener('click', function (event) {
      var goTarget = event.target.closest('[data-go]');
      if (goTarget) {
        event.preventDefault();
        var page = goTarget.getAttribute('data-go');
        var filter = goTarget.getAttribute('data-filter');
        if (filter) {
          state.catalogFilter = filter;
          state.catalogQuery = '';
          var search = document.getElementById('catalogSearch');
          if (search) search.value = '';
        }
        go(page);
        return;
      }

      var detailBtn = event.target.closest('[data-package-detail]');
      if (detailBtn) {
        openPackageDetail(detailBtn.getAttribute('data-package-detail'));
        return;
      }

      var registerBtn = event.target.closest('[data-package-register]');
      if (registerBtn) {
        var id = registerBtn.getAttribute('data-package-register');
        ui.closeAllModals();
        go('pendaftaran', { packageId: id });
        return;
      }

      var guideBtn = event.target.closest('[data-guide-open]');
      if (guideBtn) {
        openGuide(guideBtn.getAttribute('data-guide-open'));
        return;
      }

      var guideChip = event.target.closest('#guideFilters [data-category]');
      if (guideChip) {
        state.guideFilter = guideChip.getAttribute('data-category');
        renderGuides();
        return;
      }

      var catalogChip = event.target.closest('#catalogFilters [data-filter]');
      if (catalogChip) {
        state.catalogFilter = catalogChip.getAttribute('data-filter');
        renderCatalog();
      }
    });

    var catalogSearch = document.getElementById('catalogSearch');
    if (catalogSearch) {
      catalogSearch.addEventListener('input', function () {
        state.catalogQuery = catalogSearch.value;
        renderCatalog();
      });
    }

    var guideSearch = document.getElementById('guideSearch');
    if (guideSearch) {
      guideSearch.addEventListener('input', function () {
        state.guideQuery = guideSearch.value;
        renderGuides();
      });
    }

    var statusRefresh = document.getElementById('statusRefresh');
    if (statusRefresh) {
      statusRefresh.addEventListener('click', function () {
        renderStatus();
        ui.toast('Status pendaftaran diperbarui.', 'info');
      });
    }

    window.addEventListener('hashchange', handleRoute);

    window.addEventListener('storage', function (event) {
      if (!event.key || event.key.indexOf('hajiyuk_') !== 0) return;
      if (state.page === 'status') renderStatus();
      if (state.page === 'beranda') renderHome();
      if (state.page === 'katalog') renderCatalog();
      if (state.page === 'panduan') renderGuides();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Inisialisasi                                                        */
  /* ------------------------------------------------------------------ */

  function init() {
    store.init();
    initTextScale();
    initMobileNav();
    initRegistration();
    initProfile();
    initGlobalEvents();
    ui.initModalDismiss();

    if (!window.location.hash) {
      try {
        history.replaceState(null, '', '#/beranda');
      } catch (error) {
        /* diabaikan */
      }
    }

    handleRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
