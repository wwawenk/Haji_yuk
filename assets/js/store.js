/**
 * Haji Yuk — Lapisan data prototype (localStorage)
 * Dipakai bersama oleh aplikasi pengguna (index.html) dan dashboard admin (admin.html).
 *
 * CATATAN KEAMANAN: autentikasi ditangani modul auth.js memakai hash PBKDF2,
 * rate limit, MFA TOTP, dan sesi berbatas waktu. Karena seluruhnya berjalan di
 * browser, ini tetap kontrol demo, bukan pengganti autentikasi server.
 */
(function (global) {
  'use strict';

  var KEYS = {
    packages: 'hajiyuk_packages',
    requests: 'hajiyuk_requests',
    guides: 'hajiyuk_guides',
    announcements: 'hajiyuk_announcements',
    logs: 'hajiyuk_activity_logs',
    client: 'hajiyuk_client_id',
    profile: 'hajiyuk_profile',
    textScale: 'hajiyuk_text_scale'
  };

  var SEED_VERSION = 1;
  var LOG_RETENTION_DAYS = 90;
  var LOG_LIMIT = 300;

  var APP = {
    name: 'Haji Yuk',
    tagline: 'Sahabat Perjalanan Ibadah Anda',
    version: '1.0.0-prototype'
  };

  var STATUS_ORDER = [
    'diterima',
    'menunggu',
    'perlu_lengkapi',
    'ditindaklanjuti',
    'selesai',
    'tidak_dilanjutkan'
  ];

  var STATUSES = {
    diterima: { label: 'Permintaan Diterima', tone: 'info' },
    menunggu: { label: 'Menunggu Pemeriksaan', tone: 'warning' },
    perlu_lengkapi: { label: 'Perlu Melengkapi Informasi', tone: 'danger' },
    ditindaklanjuti: { label: 'Sedang Ditindaklanjuti', tone: 'primary' },
    selesai: { label: 'Selesai Ditindaklanjuti', tone: 'success' },
    tidak_dilanjutkan: { label: 'Tidak Dilanjutkan', tone: 'muted' }
  };

  var DEFAULT_PACKAGES = [
    {
      id: 'pkg-haji-reguler',
      name: 'Haji Reguler',
      serviceType: 'Haji',
      price: 'Mulai Rp 49.500.000',
      duration: '± 40 hari',
      schedule: 'Musim haji 2027 (jadwal simulasi)',
      description:
        'Layanan pendampingan ibadah haji reguler untuk calon jamaah yang mengikuti kuota pemerintah. Mencakup bimbingan manasik, pendampingan keberangkatan, dan akomodasi selama di Tanah Suci.',
      facilities: [
        'Bimbingan manasik 8 kali',
        'Pendampingan petugas selama perjalanan',
        'Akomodasi dan konsumsi selama di Tanah Suci',
        'Transportasi bus antar lokasi ibadah',
        'Perlengkapan jamaah'
      ],
      organizer: 'Haji Yuk Travel Partner (mitra simulasi)',
      image: 'assets/img/haji-reguler.jpg',
      published: true,
      updatedAt: '2026-01-08'
    },
    {
      id: 'pkg-haji-khusus',
      name: 'Haji Khusus',
      serviceType: 'Haji',
      price: 'Mulai Rp 98.000.000',
      duration: '± 25 hari',
      schedule: 'Musim haji 2027 (jadwal simulasi)',
      description:
        'Layanan haji dengan masa tinggal lebih singkat dan akomodasi berjarak dekat ke Masjidil Haram. Cocok untuk jamaah lanjut usia yang membutuhkan pendampingan lebih intensif.',
      facilities: [
        'Akomodasi dekat Masjidil Haram',
        'Pendampingan intensif untuk lansia',
        'Manasik dan bimbingan pribadi',
        'Konsumsi tiga kali sehari',
        'Transportasi dan handling bagasi'
      ],
      organizer: 'Haji Yuk Travel Partner (mitra simulasi)',
      image: 'assets/img/haji-khusus.jpg',
      published: true,
      updatedAt: '2026-01-08'
    },
    {
      id: 'pkg-umroh-reguler',
      name: 'Paket Umroh Reguler',
      serviceType: 'Umroh',
      price: 'Mulai Rp 28.900.000',
      duration: '9 hari',
      schedule: 'Keberangkatan bulanan (jadwal simulasi)',
      description:
        'Paket umroh dengan bimbingan ibadah lengkap, akomodasi nyaman, dan pendampingan dari keberangkatan hingga kembali ke Indonesia.',
      facilities: [
        'Tiket pesawat pulang-pergi',
        'Visa umroh',
        'Hotel dekat Masjidil Haram dan Masjid Nabawi',
        'Konsumsi tiga kali sehari',
        'Muthawif dan bimbingan ibadah',
        'Transportasi bus pendingin'
      ],
      organizer: 'Haji Yuk Travel Partner (mitra simulasi)',
      image: 'assets/img/umroh-reguler.jpg',
      published: true,
      updatedAt: '2026-01-08'
    },
    {
      id: 'pkg-umroh-plus',
      name: 'Paket Umroh Plus',
      serviceType: 'Umroh',
      price: 'Mulai Rp 34.500.000',
      duration: '12 hari',
      schedule: 'Keberangkatan bulanan (jadwal simulasi)',
      description:
        'Paket umroh dengan kunjungan city tour Madinah dan kota-kota bersejarah di Arab Saudi, akomodasi pilihan, dan pendampingan penuh.',
      facilities: [
        'Tiket pesawat pulang-pergi',
        'Visa umroh',
        'Hotel bintang 4',
        'City tour Madinah dan Jeddah',
        'Konsumsi tiga kali sehari',
        'Muthawif dan bimbingan ibadah'
      ],
      organizer: 'Haji Yuk Travel Partner (mitra simulasi)',
      image: 'assets/img/umroh-plus.jpg',
      published: true,
      updatedAt: '2026-01-08'
    },
    {
      id: 'pkg-umroh-ramadhan',
      name: 'Paket Umroh Ramadhan',
      serviceType: 'Umroh',
      price: 'Mulai Rp 39.900.000',
      duration: '14 hari',
      schedule: '10 hari terakhir Ramadhan (jadwal simulasi)',
      description:
        'Paket umroh pada sepuluh hari terakhir Ramadhan dengan sahur dan berbuka bersama, bimbingan ibadah, serta pendampingan petugas.',
      facilities: [
        'Tiket pesawat pulang-pergi',
        'Visa umroh',
        'Hotel dekat Masjidil Haram',
        'Sahur dan berbuka bersama',
        'Muthawif dan bimbingan ibadah',
        'Perlengkapan umroh'
      ],
      organizer: 'Haji Yuk Travel Partner (mitra simulasi)',
      image: 'assets/img/umroh-ramadhan.jpg',
      published: true,
      updatedAt: '2026-01-08'
    }
  ];

  var DEFAULT_GUIDES = [
    {
      id: 'guide-haji-dasar',
      title: 'Panduan Dasar Ibadah Haji',
      category: 'Panduan Haji',
      summary:
        'Rangkaian utama ibadah haji: ihram, wukuf di Arafah, thawaf ifadah, sa\'i, dan tahallul.',
      content:
        'Ibadah haji dilaksanakan pada bulan Dzulhijjah dengan rangkaian utama:\n\n1. Ihram dan niat haji dari miqat.\n2. Wukuf di Arafah pada 9 Dzulhijjah — rukun haji yang tidak boleh ditinggalkan.\n3. Mabit di Muzdalifah dan Mina.\n4. Melempar jumrah.\n5. Thawaf ifadah dan sa\'i.\n6. Tahallul (memotong atau mencukur rambut).\n\nRukun, wajib, dan larangan ihram perlu dipahami melalui bimbingan manasik bersama pembimbing yang kompeten. Materi ini adalah ringkasan umum, bukan pengganti bimbingan manasik resmi.',
      image: '',
      source: 'Ringkasan umum — perlu ditinjau pembimbing ibadah sebelum dipublikasikan.',
      updatedAt: '2026-01-08',
      published: true
    },
    {
      id: 'guide-umroh-dasar',
      title: 'Panduan Dasar Ibadah Umroh',
      category: 'Panduan Umroh',
      summary: 'Tata cara umroh: ihram, thawaf, sa\'i, tahallul, dan tertib.',
      content:
        'Rangkaian ibadah umroh dapat dilakukan kapan saja di luar waktu haji:\n\n1. Ihram dan niat umroh dari miqat.\n2. Thawaf tujuh putaran mengelilingi Ka\'bah.\n3. Sa\'i tujuh kali antara Shafa dan Marwah.\n4. Tahallul (memotong atau mencukur rambut).\n\nLarangan selama ihram seperti memotong kuku, memakai wewangian, dan berkata kotor perlu diperhatikan. Ikuti bimbingan muthawif atau pembimbing manasik di lapangan.',
      image: '',
      source: 'Ringkasan umum — perlu ditinjau pembimbing ibadah sebelum dipublikasikan.',
      updatedAt: '2026-01-08',
      published: true
    },
    {
      id: 'guide-persiapan',
      title: 'Persiapan Sebelum Berangkat',
      category: 'Persiapan Perjalanan',
      summary:
        'Dokumen, kesehatan, obat pribadi, dan perlengkapan yang sebaiknya disiapkan calon jamaah.',
      content:
        'Beberapa hal yang sebaiknya disiapkan sebelum berangkat:\n\n• Dokumen: paspor, visa, tiket, dan kartu identitas. Simpan salinan terpisah.\n• Kesehatan: periksa kondisi fisik, bawa obat rutin beserta resep, dan catat alergi.\n• Perlengkapan: pakaian ihram, alas kaki yang nyaman, tas kecil, dan perlengkapan mandi.\n• Keuangan: uang saku dalam bentuk tunai dan kartu, simpan di tempat berbeda.\n• Komunikasi: simpan nomor petugas, keluarga, dan kedutaan.\n\nBawa selalu gelang identitas jamaah agar mudah dikenali bila terpisah dari rombongan.',
      image: '',
      source: 'Materi edukasi umum Haji Yuk — perlu ditinjau petugas perjalanan.',
      updatedAt: '2026-01-08',
      published: true
    },
    {
      id: 'guide-manasik',
      title: 'Manasik Ibadah: Mengapa Penting?',
      category: 'Manasik Ibadah',
      summary:
        'Manasik membantu jamaah memahami urutan ibadah, lokasi, dan hal-hal yang harus dihindari.',
      content:
        'Manasik ibadah adalah latihan dan pembekalan sebelum berangkat. Melalui manasik, jamaah:\n\n• Memahami urutan ibadah haji atau umroh.\n• Mengenal lokasi dan alur perpindahan di Tanah Suci.\n• Berlatih membaca doa dan bacaan talbiyah.\n• Mengetahui larangan ihram dan hal-hal yang membatalkan ibadah.\n• Berdiskusi dengan pembimbing mengenai kondisi kesehatan dan kebutuhan khusus.\n\nIkuti manasik secara utuh dan catat pertanyaan untuk ditanyakan kepada pembimbing.',
      image: '',
      source: 'Materi edukasi umum Haji Yuk — perlu ditinjau pembimbing manasik.',
      updatedAt: '2026-01-08',
      published: true
    },
    {
      id: 'guide-doa',
      title: 'Doa dan Dzikir Penting',
      category: 'Doa dan Dzikir',
      summary:
        'Bacaan talbiyah dan dzikir harian yang dianjurkan selama perjalanan ibadah.',
      content:
        'Talbiyah:\n\nلَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ\n\n"Labbaika Allahumma labbaik, labbaika la syarika laka labbaik, innal hamda wan ni\'mata laka wal mulka, la syarika lak."\n\nArtinya: "Aku memenuhi panggilan-Mu ya Allah, aku memenuhi panggilan-Mu. Aku memenuhi panggilan-Mu, tidak ada sekutu bagi-Mu. Sesungguhnya segala puji, nikmat, dan kerajaan adalah milik-Mu, tidak ada sekutu bagi-Mu."\n\nPerbanyak dzikir, istighfar, dan doa selama perjalanan. Bacaan dan tata caranya sebaiknya dipelajari bersama pembimbing manasik.',
      image: '',
      source: 'HR. Bukhari & Muslim — perlu ditinjau pembimbing ibadah.',
      updatedAt: '2026-01-08',
      published: true
    },
    {
      id: 'guide-tips',
      title: 'Tips Nyaman di Tanah Suci',
      category: 'Tips Perjalanan',
      summary:
        'Tips sederhana untuk menjaga stamina, kebersihan, dan keamanan selama ibadah.',
      content:
        '• Minum air cukup dan gunakan pelembab agar tidak dehidrasi.\n• Pakai alas kaki yang nyaman dan simpan catatan nomor hotel serta nama petugas.\n• Hindari berdesakan pada waktu ramai; ikuti arahan petugas.\n• Istirahat cukup di sela jadwal ibadah.\n• Untuk jamaah lanjut usia, gunakan kursi roda bila diperlukan dan tetap bersama pendamping.\n• Simpan uang di beberapa tempat dan hindari membawa barang berharga berlebihan.',
      image: '',
      source: 'Materi edukasi umum Haji Yuk — perlu ditinjau petugas perjalanan.',
      updatedAt: '2026-01-08',
      published: true
    },
    {
      id: 'guide-faq',
      title: 'Apakah pengisian formulir berarti sudah mendaftar haji resmi?',
      category: 'FAQ',
      summary:
        'Pengisian formulir di Haji Yuk hanya permintaan pendaftaran awal, bukan pendaftaran resmi.',
      content:
        'Tidak. Formulir pada aplikasi Haji Yuk hanya berupa permintaan pendaftaran awal untuk dihubungi dan ditindaklanjuti oleh petugas. Pengisian formulir bukan pendaftaran haji resmi, bukan penerbitan nomor porsi, bukan bukti pembayaran, dan bukan jaminan keberangkatan. Pendaftaran haji resmi dilakukan melalui kanal resmi pemerintah.',
      image: '',
      source: 'Ketentuan prototype Haji Yuk.',
      updatedAt: '2026-01-08',
      published: true
    },
    {
      id: 'guide-faq-hp',
      title: 'Apakah data saya tersimpan di server?',
      category: 'FAQ',
      summary:
        'Pada prototype ini seluruh data hanya tersimpan di browser perangkat yang digunakan.',
      content:
        'Belum. Prototype Haji Yuk menyimpan data di localStorage browser pada perangkat yang Anda gunakan. Data tidak tersinkronisasi ke perangkat lain dan dapat hilang jika data browser dihapus. Sinkronisasi antarpengguna memerlukan backend dan database.',
      image: '',
      source: 'Ketentuan prototype Haji Yuk.',
      updatedAt: '2026-01-08',
      published: true
    }
  ];

  var DEFAULT_ANNOUNCEMENTS = [
    {
      id: 'ann-1',
      title: 'Pendampingan manasik dibuka setiap Sabtu',
      body:
        'Sesi bimbingan manasik bersama pembimbing akan dibuka setiap Sabtu pukul 09.00 WIB. Calon jamaah dan keluarga dapat mengikuti sesi ini secara gratis. Hubungi petugas melalui halaman Bantuan untuk informasi lebih lanjut.',
      category: 'Jadwal Kegiatan',
      createdAt: '2026-01-10',
      updatedAt: '2026-01-10',
      active: true
    },
    {
      id: 'ann-2',
      title: 'Informasi biaya paket masih berupa simulasi',
      body:
        'Seluruh harga, jadwal, dan fasilitas paket pada prototype ini adalah data simulasi dan belum diverifikasi. Harga dapat berubah sewaktu-waktu. Silakan konfirmasi kepada petugas sebelum mengambil keputusan.',
      category: 'Informasi Layanan',
      createdAt: '2026-01-09',
      updatedAt: '2026-01-09',
      active: true
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Utilitas umum                                                       */
  /* ------------------------------------------------------------------ */

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var parts = value.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    var date = parseDate(value);
    if (!date) return '—';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatDateTime(value) {
    var date = parseDate(value);
    if (!date) return '—';
    return (
      date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' +
      date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
      ' WIB'
    );
  }

  function todayISO() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    return (
      (prefix || 'id') +
      '-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function makeRequestCode() {
    var now = new Date();
    var stamp =
      String(now.getFullYear()).slice(2) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var suffix = '';
    for (var i = 0; i < 4; i++) {
      suffix += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return 'HY-' + stamp + '-' + suffix;
  }

  /* ------------------------------------------------------------------ */
  /* Akses penyimpanan                                                   */
  /* ------------------------------------------------------------------ */

  function safeGet(key, fallback) {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(key) : null;
      if (raw === null || raw === undefined || raw === '') return fallback;
      var parsed = JSON.parse(raw);
      return parsed;
    } catch (error) {
      if (global.console && console.warn) {
        console.warn('[Haji Yuk] Data localStorage tidak valid untuk', key, '- memakai data awal.');
      }
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (global.console && console.warn) {
        console.warn('[Haji Yuk] Gagal menyimpan data', key, error);
      }
      return false;
    }
  }

  function removeKey(key) {
    try {
      if (global.localStorage) global.localStorage.removeItem(key);
    } catch (error) {
      /* diabaikan */
    }
  }

  function readList(key) {
    var value = safeGet(key, null);
    return Array.isArray(value) ? value : null;
  }

  /* ------------------------------------------------------------------ */
  /* Inisialisasi & migrasi data awal                                    */
  /* ------------------------------------------------------------------ */

  var PACKAGE_IMAGE_MIGRATIONS = {
    'pkg-haji-reguler': 'assets/img/haji-reguler.jpg',
    'pkg-haji-khusus': 'assets/img/haji-khusus.jpg',
    'pkg-umroh-reguler': 'assets/img/umroh-reguler.jpg',
    'pkg-umroh-plus': 'assets/img/umroh-plus.jpg',
    'pkg-umroh-ramadhan': 'assets/img/umroh-ramadhan.jpg'
  };

  // Ganti ilustrasi SVG lama dengan foto asli tanpa menimpa gambar kustom admin.
  function migrateSeedImages() {
    var list = readList(KEYS.packages);
    if (!list) return;
    var changed = false;
    list.forEach(function (item) {
      var target = PACKAGE_IMAGE_MIGRATIONS[item.id];
      if (!target) return;
      if (item.image === 'assets/img/haji.svg' || item.image === 'assets/img/umroh.svg') {
        item.image = target;
        changed = true;
      }
    });
    if (changed) safeSet(KEYS.packages, list);
  }

  function init() {
    if (!readList(KEYS.packages)) {
      safeSet(KEYS.packages, DEFAULT_PACKAGES);
    }
    if (!readList(KEYS.guides)) {
      safeSet(KEYS.guides, DEFAULT_GUIDES);
    }
    if (!readList(KEYS.announcements)) {
      safeSet(KEYS.announcements, DEFAULT_ANNOUNCEMENTS);
    }
    if (!readList(KEYS.requests)) {
      safeSet(KEYS.requests, []);
    }
    if (!readList(KEYS.logs)) {
      safeSet(KEYS.logs, []);
    }
    if (!safeGet(KEYS.client, null)) {
      safeSet(KEYS.client, makeId('client'));
    }
    migrateSeedImages();
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Profil & pengaturan pengguna                                        */
  /* ------------------------------------------------------------------ */

  function getClientId() {
    var id = safeGet(KEYS.client, null);
    if (!id) {
      id = makeId('client');
      safeSet(KEYS.client, id);
    }
    return id;
  }

  function getProfile() {
    var profile = safeGet(KEYS.profile, null);
    if (!profile || typeof profile !== 'object') {
      return { name: '', phone: '' };
    }
    return {
      name: typeof profile.name === 'string' ? profile.name : '',
      phone: typeof profile.phone === 'string' ? profile.phone : ''
    };
  }

  function saveProfile(profile) {
    var next = {
      name: String((profile && profile.name) || '').trim(),
      phone: String((profile && profile.phone) || '').trim()
    };
    safeSet(KEYS.profile, next);
    return next;
  }

  function getTextScale() {
    var value = safeGet(KEYS.textScale, 'normal');
    return ['normal', 'large', 'xlarge'].indexOf(value) === -1 ? 'normal' : value;
  }

  function saveTextScale(scale) {
    var allowed = ['normal', 'large', 'xlarge'];
    var next = allowed.indexOf(scale) === -1 ? 'normal' : scale;
    safeSet(KEYS.textScale, next);
    return next;
  }

  /* ------------------------------------------------------------------ */
  /* Paket                                                               */
  /* ------------------------------------------------------------------ */

  function normalizePackage(item) {
    return {
      id: item.id || makeId('pkg'),
      name: String(item.name || '').trim(),
      serviceType: item.serviceType === 'Haji' ? 'Haji' : 'Umroh',
      price: String(item.price || '').trim(),
      duration: String(item.duration || '').trim(),
      schedule: String(item.schedule || '').trim(),
      description: String(item.description || '').trim(),
      facilities: Array.isArray(item.facilities)
        ? item.facilities.map(function (f) { return String(f).trim(); }).filter(Boolean)
        : String(item.facilities || '')
            .split('\n')
            .map(function (f) { return f.trim(); })
            .filter(Boolean),
      organizer: String(item.organizer || '').trim(),
      image: String(item.image || '').trim(),
      published: item.published !== false,
      updatedAt: item.updatedAt || todayISO()
    };
  }

  function getPackages(options) {
    var list = readList(KEYS.packages) || [];
    var includeUnpublished = options && options.includeUnpublished;
    var serviceType = options && options.serviceType;
    return list
      .map(normalizePackage)
      .filter(function (item) {
        if (!includeUnpublished && !item.published) return false;
        if (serviceType && item.serviceType !== serviceType) return false;
        return true;
      });
  }

  function getPackageById(id) {
    var list = getPackages({ includeUnpublished: true });
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function savePackage(data) {
    var list = getPackages({ includeUnpublished: true });
    var item = normalizePackage(data);
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === item.id) {
        index = i;
        break;
      }
    }
    var isNew = index === -1;
    if (isNew) {
      item.id = makeId('pkg');
      list.unshift(item);
    } else {
      list[index] = item;
    }
    safeSet(KEYS.packages, list);
    logActivity(isNew ? 'Tambah paket' : 'Edit paket', item.name, 'package');
    return item;
  }

  function deletePackage(id) {
    var list = getPackages({ includeUnpublished: true });
    var target = null;
    var next = list.filter(function (item) {
      if (item.id === id) {
        target = item;
        return false;
      }
      return true;
    });
    if (!target) return false;
    safeSet(KEYS.packages, next);
    logActivity('Hapus paket', target.name, 'package');
    return true;
  }

  function togglePackagePublished(id) {
    var item = getPackageById(id);
    if (!item) return null;
    item.published = !item.published;
    item.updatedAt = todayISO();
    savePackage(item);
    logActivity(
      item.published ? 'Aktifkan paket' : 'Nonaktifkan paket',
      item.name,
      'package'
    );
    return item;
  }

  /* ------------------------------------------------------------------ */
  /* Pendaftaran                                                         */
  /* ------------------------------------------------------------------ */

  function normalizeRequest(item) {
    return {
      id: item.id || makeId('req'),
      code: item.code || makeRequestCode(),
      clientId: item.clientId || '',
      userId: item.userId || '',
      name: String(item.name || '').trim(),
      phone: String(item.phone || '').trim(),
      serviceType: item.serviceType === 'Haji' ? 'Haji' : 'Umroh',
      packageId: item.packageId || '',
      packageName: String(item.packageName || '').trim(),
      departurePlan: String(item.departurePlan || '').trim(),
      submittedBy: String(item.submittedBy || '').trim(),
      needs: String(item.needs || '').trim(),
      createdAt: item.createdAt || nowISO(),
      updatedAt: item.updatedAt || item.createdAt || nowISO(),
      status: STATUSES[item.status] ? item.status : 'menunggu',
      followUpNote: String(item.followUpNote || ''),
      internalNote: String(item.internalNote || ''),
      history: Array.isArray(item.history) ? item.history : []
    };
  }

  function getRequests() {
    var list = readList(KEYS.requests) || [];
    return list
      .map(normalizeRequest)
      .sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  function getRequestsForClient(clientId) {
    return getRequests().filter(function (item) {
      return item.clientId === clientId;
    });
  }

  function getRequestsForUser(userId) {
    if (!userId) return [];
    return getRequests().filter(function (item) {
      return item.userId === userId;
    });
  }

  function getRequestById(id) {
    var list = getRequests();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function addRequest(data) {
    var list = getRequests();
    var entry = normalizeRequest({
      clientId: data.clientId || getClientId(),
      userId: data.userId || '',
      name: data.name,
      phone: data.phone,
      serviceType: data.serviceType,
      packageId: data.packageId,
      packageName: data.packageName,
      departurePlan: data.departurePlan,
      submittedBy: data.submittedBy,
      needs: data.needs,
      status: 'menunggu',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      history: [
        {
          status: 'menunggu',
          at: nowISO(),
          note: 'Permintaan pendaftaran awal diterima sistem.'
        }
      ]
    });
    entry.id = makeId('req');
    entry.code = makeRequestCode();
    list.unshift(entry);
    safeSet(KEYS.requests, list);
    logActivity('Pendaftaran baru', entry.code + ' — ' + entry.name, 'request');
    return entry;
  }

  function updateRequestStatus(id, status, followUpNote, internalNote) {
    var list = getRequests();
    var updated = null;
    var next = list.map(function (item) {
      if (item.id !== id) return item;
      var nextStatus = STATUSES[status] ? status : item.status;
      updated = normalizeRequest(item);
      updated.status = nextStatus;
      updated.followUpNote = String(followUpNote || '');
      updated.internalNote = String(internalNote || '');
      updated.updatedAt = nowISO();
      updated.history = (updated.history || []).concat([
        {
          status: nextStatus,
          at: updated.updatedAt,
          note: String(followUpNote || '')
        }
      ]);
      return updated;
    });
    if (!updated) return null;
    safeSet(KEYS.requests, next);
    logActivity(
      'Perbarui status',
      updated.code + ' → ' + STATUSES[updated.status].label,
      'request'
    );
    return updated;
  }

  function deleteRequest(id) {
    var list = getRequests();
    var target = null;
    var next = list.filter(function (item) {
      if (item.id === id) {
        target = item;
        return false;
      }
      return true;
    });
    if (!target) return false;
    safeSet(KEYS.requests, next);
    logActivity('Hapus pendaftaran', target.code + ' — ' + target.name, 'request');
    return true;
  }

  function getStats() {
    var requests = getRequests();
    var byStatus = {};
    STATUS_ORDER.forEach(function (status) {
      byStatus[status] = 0;
    });
    var haji = 0;
    var umroh = 0;
    requests.forEach(function (item) {
      if (byStatus[item.status] !== undefined) byStatus[item.status] += 1;
      if (item.serviceType === 'Haji') haji += 1;
      else umroh += 1;
    });
    return {
      total: requests.length,
      haji: haji,
      umroh: umroh,
      menunggu: byStatus.menunggu + byStatus.diterima,
      ditindaklanjuti: byStatus.ditindaklanjuti,
      selesai: byStatus.selesai,
      byStatus: byStatus
    };
  }

  /* ------------------------------------------------------------------ */
  /* Panduan / konten                                                    */
  /* ------------------------------------------------------------------ */

  var GUIDE_CATEGORIES = [
    'Panduan Haji',
    'Panduan Umroh',
    'Persiapan Perjalanan',
    'Manasik Ibadah',
    'Doa dan Dzikir',
    'Tips Perjalanan',
    'FAQ'
  ];

  function normalizeGuide(item) {
    return {
      id: item.id || makeId('guide'),
      title: String(item.title || '').trim(),
      category: GUIDE_CATEGORIES.indexOf(item.category) === -1 ? 'Panduan Haji' : item.category,
      summary: String(item.summary || '').trim(),
      content: String(item.content || ''),
      image: String(item.image || '').trim(),
      source: String(item.source || '').trim(),
      updatedAt: item.updatedAt || todayISO(),
      published: item.published !== false
    };
  }

  function getGuides(options) {
    var list = readList(KEYS.guides) || [];
    var includeUnpublished = options && options.includeUnpublished;
    var category = options && options.category;
    return list
      .map(normalizeGuide)
      .filter(function (item) {
        if (!includeUnpublished && !item.published) return false;
        if (category && item.category !== category) return false;
        return true;
      });
  }

  function getGuideById(id) {
    var list = getGuides({ includeUnpublished: true });
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function saveGuide(data) {
    var list = getGuides({ includeUnpublished: true });
    var item = normalizeGuide(data);
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === item.id) {
        index = i;
        break;
      }
    }
    var isNew = index === -1;
    if (isNew) {
      item.id = makeId('guide');
      list.unshift(item);
    } else {
      list[index] = item;
    }
    safeSet(KEYS.guides, list);
    logActivity(isNew ? 'Tambah konten' : 'Edit konten', item.title, 'guide');
    return item;
  }

  function deleteGuide(id) {
    var list = getGuides({ includeUnpublished: true });
    var target = null;
    var next = list.filter(function (item) {
      if (item.id === id) {
        target = item;
        return false;
      }
      return true;
    });
    if (!target) return false;
    safeSet(KEYS.guides, next);
    logActivity('Hapus konten', target.title, 'guide');
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Pengumuman                                                          */
  /* ------------------------------------------------------------------ */

  var ANNOUNCEMENT_CATEGORIES = [
    'Informasi Layanan',
    'Jadwal Kegiatan',
    'Pengumuman Penting',
    'Edukasi'
  ];

  function normalizeAnnouncement(item) {
    return {
      id: item.id || makeId('ann'),
      title: String(item.title || '').trim(),
      body: String(item.body || '').trim(),
      category:
        ANNOUNCEMENT_CATEGORIES.indexOf(item.category) === -1
          ? 'Informasi Layanan'
          : item.category,
      createdAt: item.createdAt || todayISO(),
      updatedAt: item.updatedAt || item.createdAt || todayISO(),
      active: item.active !== false
    };
  }

  function getAnnouncements(options) {
    var list = readList(KEYS.announcements) || [];
    var activeOnly = options && options.activeOnly;
    return list
      .map(normalizeAnnouncement)
      .filter(function (item) {
        return activeOnly ? item.active : true;
      })
      .sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  function saveAnnouncement(data) {
    var list = getAnnouncements();
    var item = normalizeAnnouncement(data);
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === item.id) {
        index = i;
        break;
      }
    }
    var isNew = index === -1;
    if (isNew) {
      item.id = makeId('ann');
      list.unshift(item);
    } else {
      list[index] = item;
    }
    safeSet(KEYS.announcements, list);
    logActivity(isNew ? 'Tambah pengumuman' : 'Edit pengumuman', item.title, 'announcement');
    return item;
  }

  function deleteAnnouncement(id) {
    var list = getAnnouncements();
    var target = null;
    var next = list.filter(function (item) {
      if (item.id === id) {
        target = item;
        return false;
      }
      return true;
    });
    if (!target) return false;
    safeSet(KEYS.announcements, next);
    logActivity('Hapus pengumuman', target.title, 'announcement');
    return true;
  }

  function toggleAnnouncementActive(id) {
    var list = getAnnouncements();
    var target = null;
    var next = list.map(function (item) {
      if (item.id !== id) return item;
      target = item;
      return normalizeAnnouncement({
        id: item.id,
        title: item.title,
        body: item.body,
        category: item.category,
        createdAt: item.createdAt,
        updatedAt: todayISO(),
        active: !item.active
      });
    });
    if (!target) return null;
    safeSet(KEYS.announcements, next);
    logActivity(
      target.active ? 'Nonaktifkan pengumuman' : 'Aktifkan pengumuman',
      target.title,
      'announcement'
    );
    return next.filter(function (item) { return item.id === id; })[0] || null;
  }

  /* ------------------------------------------------------------------ */
  /* Log aktivitas admin                                                 */
  /* ------------------------------------------------------------------ */

  function logActivity(action, detail, type, actor) {
    var logs = readList(KEYS.logs) || [];
    logs.unshift({
      id: makeId('log'),
      action: String(action || '').slice(0, 120),
      detail: String(detail || '').slice(0, 300),
      type: type || 'umum',
      at: nowISO(),
      actor: String(actor || (type === 'system' ? 'Sistem' : 'Admin Haji Yuk')).slice(0, 80)
    });
    var cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    var pruned = logs
      .filter(function (entry) {
        if (!entry || typeof entry !== 'object') return false;
        var time = new Date(entry.at).getTime();
        return isNaN(time) || time >= cutoff;
      })
      .slice(0, LOG_LIMIT);
    safeSet(KEYS.logs, pruned);
  }

  function getLogs() {
    var logs = readList(KEYS.logs) || [];
    return logs.filter(function (item) {
      return item && typeof item === 'object';
    });
  }

  /* ------------------------------------------------------------------ */
  /* CSV                                                                 */
  /* ------------------------------------------------------------------ */

  function csvCell(value) {
    var str = value === null || value === undefined ? '' : String(value);
    // Cegah formula injection pada spreadsheet.
    if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
    if (/[",\n\r;]/.test(str)) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function buildCSV(headers, rows) {
    var lines = [];
    lines.push(headers.map(csvCell).join(','));
    rows.forEach(function (row) {
      lines.push(row.map(csvCell).join(','));
    });
    return lines.join('\r\n');
  }

  function downloadCSV(filename, csv) {
    try {
      var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Reset data simulasi                                                 */
  /* ------------------------------------------------------------------ */

  function resetSimulationData() {
    // Akun pengguna, sesi, dan log audit sengaja dipertahankan.
    removeKey(KEYS.packages);
    removeKey(KEYS.requests);
    removeKey(KEYS.guides);
    removeKey(KEYS.announcements);
    removeKey(KEYS.profile);
    removeKey(KEYS.textScale);
    removeKey(KEYS.client);
    init();
    logActivity('Reset data', 'Data operasional dikembalikan ke kondisi awal; akun dan log dipertahankan', 'system');
    return true;
  }

  global.HajiYuk = {
    KEYS: KEYS,
    APP: APP,
    STATUSES: STATUSES,
    STATUS_ORDER: STATUS_ORDER,
    GUIDE_CATEGORIES: GUIDE_CATEGORIES,
    ANNOUNCEMENT_CATEGORIES: ANNOUNCEMENT_CATEGORIES,
    escapeHTML: escapeHTML,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    todayISO: todayISO,
    nowISO: nowISO,
    init: init,
    getClientId: getClientId,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getTextScale: getTextScale,
    saveTextScale: saveTextScale,
    getPackages: getPackages,
    getPackageById: getPackageById,
    savePackage: savePackage,
    deletePackage: deletePackage,
    togglePackagePublished: togglePackagePublished,
    getRequests: getRequests,
    getRequestsForClient: getRequestsForClient,
    getRequestsForUser: getRequestsForUser,
    getRequestById: getRequestById,
    addRequest: addRequest,
    updateRequestStatus: updateRequestStatus,
    deleteRequest: deleteRequest,
    getStats: getStats,
    getGuides: getGuides,
    getGuideById: getGuideById,
    saveGuide: saveGuide,
    deleteGuide: deleteGuide,
    getAnnouncements: getAnnouncements,
    saveAnnouncement: saveAnnouncement,
    deleteAnnouncement: deleteAnnouncement,
    toggleAnnouncementActive: toggleAnnouncementActive,
    logActivity: logActivity,
    getLogs: getLogs,
    buildCSV: buildCSV,
    downloadCSV: downloadCSV,
    resetSimulationData: resetSimulationData
  };
})(typeof window !== 'undefined' ? window : this);
