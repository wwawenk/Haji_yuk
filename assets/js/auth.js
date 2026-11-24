/**
 * Haji Yuk — Modul autentikasi & keamanan (prototype frontend)
 *
 * Mencakup:
 * - Akun pengguna (role "user") dan akun admin (role "admin")
 * - Password hashing PBKDF2-SHA256 + salt acak (Web Crypto)
 * - Pembatasan percobaan login (5 percobaan / 15 menit, kunci 15 menit)
 * - MFA admin berbasis TOTP (aplikasi authenticator, 6 digit / 30 detik)
 * - Sesi dengan batas waktu diam (20 menit) dan batas absolut (8 jam)
 * - Log audit, kebijakan password, dan backup/restore data operasional
 *
 * CATATAN KEAMANAN: seluruh proses berjalan di browser klien. Ini adalah
 * demonstrasi kontrol keamanan untuk prototype statis, BUKAN pengganti
 * autentikasi server. Pada produksi, verifikasi password, MFA, rate limit,
 * dan otorisasi wajib dilakukan di backend.
 */
(function (global) {
  'use strict';

  var store = global.HajiYuk;

  var USERS_KEY = 'hajiyuk_users';
  var SESSION_KEY = 'hajiyuk_session';
  var ATTEMPTS_KEY = 'hajiyuk_login_attempts';

  var MAX_ATTEMPTS = 5;
  var WINDOW_MS = 15 * 60 * 1000;
  var LOCK_MS = 15 * 60 * 1000;
  var IDLE_MS = 20 * 60 * 1000;
  var ABSOLUTE_MS = 8 * 60 * 60 * 1000;
  var PBKDF2_ITERATIONS = 150000;

  var BACKUP_KEYS = ['packages', 'requests', 'guides', 'announcements', 'logs'];

  var pendingLogin = null; // { userId, role, at }
  var pendingMfaSecret = ''; // rahasia TOTP sebelum diverifikasi

  /* ------------------------------------------------------------------ */
  /* Utilitas dasar                                                      */
  /* ------------------------------------------------------------------ */

  function now() {
    return Date.now();
  }

  function hasCrypto() {
    return !!(global.crypto && global.crypto.subtle && global.crypto.getRandomValues);
  }

  function randomBytes(length) {
    var bytes = new Uint8Array(length);
    global.crypto.getRandomValues(bytes);
    return bytes;
  }

  function bytesToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return global.btoa(binary);
  }

  function base64ToBytes(value) {
    var binary = global.atob(String(value || ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bytesToHex(bytes) {
    return Array.prototype.map
      .call(bytes, function (b) {
        return ('0' + b.toString(16)).slice(-2);
      })
      .join('');
  }

  function safeGetRaw(key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (error) {
      return null;
    }
  }

  function safeSetRaw(key, value) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readJSON(key, fallback) {
    var raw = safeGetRaw(key);
    if (!raw) return fallback;
    try {
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      return safeSetRaw(key, JSON.stringify(value));
    } catch (error) {
      return false;
    }
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeIdentifier(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value) && value.length <= 120;
  }

  function audit(action, detail, actor) {
    if (store && store.logActivity) {
      store.logActivity(action, detail, 'auth', actor || 'Sistem');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Hash password                                                       */
  /* ------------------------------------------------------------------ */

  async function derivePassword(password, saltBytes, iterations) {
    var key = await global.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(password)),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    var bits = await global.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: iterations || PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      key,
      256
    );
    return bytesToHex(new Uint8Array(bits));
  }

  function constantTimeEqual(a, b) {
    var left = String(a || '');
    var right = String(b || '');
    var diff = left.length ^ right.length;
    var length = Math.max(left.length, right.length);
    for (var i = 0; i < length; i++) {
      diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
    }
    return diff === 0;
  }

  function passwordIssues(password) {
    var value = String(password || '');
    var issues = [];
    if (value.length < 8) issues.push('minimal 8 karakter');
    if (value.length > 128) issues.push('maksimal 128 karakter');
    if (!/[A-Za-z]/.test(value)) issues.push('harus memuat huruf');
    if (!/[0-9]/.test(value)) issues.push('harus memuat angka');
    return issues;
  }

  /* ------------------------------------------------------------------ */
  /* Akun                                                                */
  /* ------------------------------------------------------------------ */

  function readUsers() {
    var list = readJSON(USERS_KEY, []);
    return Array.isArray(list) ? list.filter(function (user) {
      return user && typeof user === 'object' && user.id && user.role;
    }) : [];
  }

  function writeUsers(list) {
    return writeJSON(USERS_KEY, list);
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username || '',
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt || '',
      mfaEnabled: !!(user.mfa && user.mfa.enabled)
    };
  }

  function findUser(identifier) {
    var needle = normalizeIdentifier(identifier);
    if (!needle) return null;
    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      var user = users[i];
      if (
        normalizeEmail(user.email) === needle ||
        normalizeIdentifier(user.username) === needle
      ) {
        return user;
      }
    }
    return null;
  }

  function findUserById(id) {
    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) return users[i];
    }
    return null;
  }

  function makeId(prefix) {
    return prefix + '-' + bytesToHex(randomBytes(6));
  }

  async function buildUser(data) {
    var salt = bytesToBase64(randomBytes(16));
    var iterations = PBKDF2_ITERATIONS;
    var hash = await derivePassword(data.password, base64ToBytes(salt), iterations);
    var createdAt = store && store.nowISO ? store.nowISO() : new Date().toISOString();
    return {
      id: makeId('usr'),
      name: String(data.name || '').trim(),
      email: normalizeEmail(data.email),
      username: String(data.username || '').trim(),
      role: data.role === 'admin' ? 'admin' : 'user',
      salt: salt,
      hash: hash,
      iterations: iterations,
      createdAt: createdAt,
      passwordChangedAt: createdAt,
      lastLoginAt: '',
      mfa: { enabled: false, secret: '' }
    };
  }

  async function init() {
    if (!hasCrypto()) {
      return {
        ok: false,
        message:
          'Browser ini tidak mendukung Web Crypto. Buka aplikasi melalui HTTPS atau localhost.'
      };
    }
    var users = readUsers();
    var hasAdmin = users.some(function (user) {
      return user.role === 'admin';
    });
    if (!hasAdmin) {
      var admin = await buildUser({
        name: 'Admin Haji Yuk',
        email: 'admin@hajiyuk.local',
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });
      users.push(admin);
      writeUsers(users);
      audit('Inisialisasi akun', 'Akun admin default dibuat dengan password ter-hash', 'Sistem');
    }
    pruneAttempts();
    return { ok: true };
  }

  /* ------------------------------------------------------------------ */
  /* Rate limiting login                                                 */
  /* ------------------------------------------------------------------ */

  function attemptKey(identifier, role) {
    return String(role || 'user') + ':' + normalizeIdentifier(identifier);
  }

  function readAttempts() {
    var data = readJSON(ATTEMPTS_KEY, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }

  function pruneAttempts() {
    var data = readAttempts();
    var current = now();
    var changed = false;
    Object.keys(data).forEach(function (key) {
      var entry = data[key];
      if (!entry || typeof entry !== 'object') {
        delete data[key];
        changed = true;
        return;
      }
      var expiredWindow = current - Number(entry.firstAt || 0) > WINDOW_MS;
      var lockOver = !entry.lockedUntil || Number(entry.lockedUntil) <= current;
      if (expiredWindow && lockOver) {
        delete data[key];
        changed = true;
      }
    });
    if (changed) writeJSON(ATTEMPTS_KEY, data);
  }

  function getLock(identifier, role) {
    var data = readAttempts();
    var entry = data[attemptKey(identifier, role)];
    if (!entry) return { locked: false, remaining: MAX_ATTEMPTS };
    var current = now();
    if (entry.lockedUntil && Number(entry.lockedUntil) > current) {
      return {
        locked: true,
        retryAfterMs: Number(entry.lockedUntil) - current,
        remaining: 0
      };
    }
    if (current - Number(entry.firstAt || 0) > WINDOW_MS) {
      return { locked: false, remaining: MAX_ATTEMPTS };
    }
    return {
      locked: false,
      remaining: Math.max(0, MAX_ATTEMPTS - Number(entry.count || 0))
    };
  }

  function registerFailure(identifier, role) {
    var data = readAttempts();
    var key = attemptKey(identifier, role);
    var current = now();
    var entry = data[key];
    if (!entry || current - Number(entry.firstAt || 0) > WINDOW_MS) {
      entry = { count: 0, firstAt: current, lockedUntil: 0 };
    }
    entry.count = Number(entry.count || 0) + 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.lockedUntil = current + LOCK_MS;
      audit(
        'Login diblokir',
        'Terlalu banyak percobaan untuk ' + normalizeIdentifier(identifier) + ' (' + role + ')',
        'Sistem'
      );
    }
    data[key] = entry;
    writeJSON(ATTEMPTS_KEY, data);
    return getLock(identifier, role);
  }

  function clearFailures(identifier, role) {
    var data = readAttempts();
    var key = attemptKey(identifier, role);
    if (data[key]) {
      delete data[key];
      writeJSON(ATTEMPTS_KEY, data);
    }
  }

  function lockMessage(lock) {
    var minutes = Math.ceil(Number(lock.retryAfterMs || 0) / 60000);
    return (
      'Terlalu banyak percobaan login. Coba lagi dalam ' +
      Math.max(1, minutes) +
      ' menit.'
    );
  }

  /* ------------------------------------------------------------------ */
  /* TOTP (MFA)                                                          */
  /* ------------------------------------------------------------------ */

  var BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Encode(bytes) {
    var bits = '';
    for (var i = 0; i < bytes.length; i++) {
      bits += ('00000000' + bytes[i].toString(2)).slice(-8);
    }
    var output = '';
    for (var j = 0; j + 5 <= bits.length; j += 5) {
      output += BASE32_ALPHABET[parseInt(bits.slice(j, j + 5), 2)];
    }
    var rest = bits.length % 5;
    if (rest) {
      output += BASE32_ALPHABET[parseInt(bits.slice(-rest) + '0'.repeat(5 - rest), 2)];
    }
    return output;
  }

  function base32Decode(value) {
    var clean = String(value || '')
      .toUpperCase()
      .replace(/[^A-Z2-7]/g, '');
    var bits = '';
    for (var i = 0; i < clean.length; i++) {
      var index = BASE32_ALPHABET.indexOf(clean[i]);
      if (index === -1) continue;
      bits += ('00000' + index.toString(2)).slice(-5);
    }
    var bytes = [];
    for (var j = 0; j + 8 <= bits.length; j += 8) {
      bytes.push(parseInt(bits.slice(j, j + 8), 2));
    }
    return new Uint8Array(bytes);
  }

  async function hmacSha1(keyBytes, messageBytes) {
    var key = await global.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    var signature = await global.crypto.subtle.sign('HMAC', key, messageBytes);
    return new Uint8Array(signature);
  }

  async function totpCode(secret, counterOffset) {
    var keyBytes = base32Decode(secret);
    var counter = Math.floor(now() / 30000) + (counterOffset || 0);
    var message = new Uint8Array(8);
    var high = Math.floor(counter / 4294967296);
    var low = counter % 4294967296;
    message[0] = (high >>> 24) & 0xff;
    message[1] = (high >>> 16) & 0xff;
    message[2] = (high >>> 8) & 0xff;
    message[3] = high & 0xff;
    message[4] = (low >>> 24) & 0xff;
    message[5] = (low >>> 16) & 0xff;
    message[6] = (low >>> 8) & 0xff;
    message[7] = low & 0xff;

    var hmac = await hmacSha1(keyBytes, message);
    var offset = hmac[hmac.length - 1] & 0x0f;
    var binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(binary % 1000000).padStart(6, '0');
  }

  async function verifyTotp(secret, code) {
    var value = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(value) || !secret) return false;
    for (var offset = -1; offset <= 1; offset++) {
      var expected = await totpCode(secret, offset);
      if (constantTimeEqual(expected, value)) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Sesi                                                                */
  /* ------------------------------------------------------------------ */

  function sessionStorage() {
    try {
      return global.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function createSession(user) {
    var current = now();
    var session = {
      token: bytesToHex(randomBytes(32)),
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      issuedAt: current,
      lastSeen: current,
      expiresAt: current + ABSOLUTE_MS,
      lastLoginAt: user.lastLoginAt || '',
      pwdAt: user.passwordChangedAt || user.createdAt || ''
    };
    try {
      sessionStorage().setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      return { ok: false, message: 'Browser tidak mengizinkan penyimpanan sesi.' };
    }
    return { ok: true, session: session };
  }

  function getSession() {
    var storage = sessionStorage();
    if (!storage) return null;
    var raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    var session;
    try {
      session = JSON.parse(raw);
    } catch (error) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    if (!session || typeof session !== 'object' || !session.token || !session.userId) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    var current = now();
    var user = findUserById(session.userId);
    var expired =
      current >= Number(session.expiresAt || 0) ||
      current - Number(session.lastSeen || 0) > IDLE_MS;
    var passwordChanged =
      user && String(session.pwdAt || '') !== String(user.passwordChangedAt || '');
    if (!user || expired || passwordChanged || user.role !== session.role) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    if (current - Number(session.lastSeen || 0) > 60000) {
      session.lastSeen = current;
      try {
        storage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (error) {
        /* diabaikan */
      }
    }
    return session;
  }

  function isLoggedIn(role) {
    var session = getSession();
    if (!session) return false;
    return role ? session.role === role : true;
  }

  function logout() {
    var session = getSession();
    try {
      var storage = sessionStorage();
      if (storage) storage.removeItem(SESSION_KEY);
    } catch (error) {
      /* diabaikan */
    }
    if (session) audit('Logout', 'Sesi ' + session.role + ' diakhiri', session.name);
  }

  function sessionMinutesLeft() {
    var session = getSession();
    if (!session) return 0;
    var idleLeft = IDLE_MS - (now() - Number(session.lastSeen || 0));
    var absoluteLeft = Number(session.expiresAt || 0) - now();
    return Math.max(0, Math.floor(Math.min(idleLeft, absoluteLeft) / 60000));
  }

  /* ------------------------------------------------------------------ */
  /* Daftar & login                                                      */
  /* ------------------------------------------------------------------ */

  async function register(data) {
    if (!hasCrypto()) {
      return { ok: false, message: 'Browser tidak mendukung autentikasi aman (Web Crypto).' };
    }
    var name = String((data && data.name) || '').trim();
    var email = normalizeEmail(data && data.email);
    var password = String((data && data.password) || '');
    var confirm = String((data && data.confirm) || '');

    if (name.length < 2) return { ok: false, field: 'name', message: 'Nama minimal 2 karakter.' };
    if (!isEmail(email)) return { ok: false, field: 'email', message: 'Format email tidak valid.' };
    var issues = passwordIssues(password);
    if (issues.length) {
      return { ok: false, field: 'password', message: 'Password ' + issues.join(', ') + '.' };
    }
    if (password !== confirm) {
      return { ok: false, field: 'confirm', message: 'Konfirmasi password tidak sama.' };
    }
    if (findUser(email)) {
      return { ok: false, field: 'email', message: 'Email sudah terdaftar. Silakan masuk.' };
    }

    var user = await buildUser({ name: name, email: email, password: password, role: 'user' });
    var users = readUsers();
    users.push(user);
    if (!writeUsers(users)) {
      return { ok: false, message: 'Penyimpanan browser penuh atau diblokir.' };
    }
    audit('Registrasi akun', 'Akun baru: ' + email, name);
    var sessionResult = createSession(user);
    if (!sessionResult.ok) return sessionResult;
    return { ok: true, session: sessionResult.session, user: publicUser(user) };
  }

  async function login(identifier, password, role, code) {
    var id = String(identifier || '').trim();
    var pass = String(password || '');
    var expectedRole = role === 'admin' ? 'admin' : 'user';

    if (!hasCrypto()) {
      return { ok: false, message: 'Browser tidak mendukung autentikasi aman (Web Crypto).' };
    }
    if (!id || !pass) {
      return { ok: false, message: 'Isi email/username dan password.' };
    }

    var lock = getLock(id, expectedRole);
    if (lock.locked) {
      return { ok: false, locked: true, retryAfterMs: lock.retryAfterMs, message: lockMessage(lock) };
    }

    var user = findUser(id);
    var usable = !!(user && user.role === expectedRole && user.hash && user.salt);

    // Tetap hitung hash walau akun tidak ada, agar waktu respons tidak membocorkan data.
    var saltBytes = usable ? base64ToBytes(user.salt) : randomBytes(16);
    var candidate = await derivePassword(pass, saltBytes, usable ? user.iterations : PBKDF2_ITERATIONS);
    var valid = usable && constantTimeEqual(candidate, user.hash);

    if (!valid) {
      var nextLock = registerFailure(id, expectedRole);
      audit('Login gagal', 'Percobaan login gagal untuk ' + normalizeIdentifier(id), 'Tidak dikenal');
      if (nextLock.locked) {
        return {
          ok: false,
          locked: true,
          retryAfterMs: nextLock.retryAfterMs,
          message: lockMessage(nextLock)
        };
      }
      return {
        ok: false,
        remaining: nextLock.remaining,
        message:
          'Email/username atau password salah.' +
          (nextLock.remaining <= 2 ? ' Sisa ' + nextLock.remaining + ' percobaan.' : '')
      };
    }

    if (user.mfa && user.mfa.enabled) {
      var pendingValid =
        pendingLogin &&
        pendingLogin.userId === user.id &&
        pendingLogin.role === expectedRole &&
        now() - pendingLogin.at < 5 * 60 * 1000;
      if (!code) {
        pendingLogin = { userId: user.id, role: expectedRole, at: now() };
        return {
          ok: false,
          mfaRequired: true,
          message: 'Masukkan kode 6 digit dari aplikasi authenticator Anda.'
        };
      }
      if (!pendingValid) {
        pendingLogin = null;
        return { ok: false, mfaRequired: true, message: 'Sesi verifikasi kedaluwarsa. Masukkan password kembali.' };
      }
      var validCode = await verifyTotp(user.mfa.secret, code);
      if (!validCode) {
        var mfaLock = registerFailure(id, expectedRole);
        audit('MFA gagal', 'Kode MFA salah untuk ' + user.email, user.name);
        if (mfaLock.locked) {
          return {
            ok: false,
            locked: true,
            retryAfterMs: mfaLock.retryAfterMs,
            message: lockMessage(mfaLock)
          };
        }
        return { ok: false, mfaRequired: true, message: 'Kode MFA salah atau sudah kedaluwarsa.' };
      }
    }

    pendingLogin = null;
    clearFailures(id, expectedRole);

    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === user.id) {
        users[i].lastLoginAt = store.nowISO();
        user = users[i];
        break;
      }
    }
    writeUsers(users);

    var sessionResult = createSession(user);
    if (!sessionResult.ok) return sessionResult;
    audit(
      'Login ' + expectedRole,
      (expectedRole === 'admin' ? 'Admin' : 'Pengguna') + ' masuk: ' + user.email,
      user.name
    );
    return { ok: true, session: sessionResult.session, user: publicUser(user) };
  }

  /* ------------------------------------------------------------------ */
  /* Manajemen akun                                                      */
  /* ------------------------------------------------------------------ */

  async function changePassword(currentPassword, newPassword, confirmPassword) {
    var session = getSession();
    if (!session) return { ok: false, message: 'Sesi berakhir. Silakan masuk kembali.' };
    var user = findUserById(session.userId);
    if (!user) return { ok: false, message: 'Akun tidak ditemukan.' };

    if (!constantTimeEqual(
      await derivePassword(currentPassword, base64ToBytes(user.salt), user.iterations),
      user.hash
    )) {
      audit('Ganti password gagal', 'Password lama salah', user.name);
      return { ok: false, field: 'current', message: 'Password saat ini salah.' };
    }
    var issues = passwordIssues(newPassword);
    if (issues.length) {
      return { ok: false, field: 'new', message: 'Password baru ' + issues.join(', ') + '.' };
    }
    if (String(newPassword) !== String(confirmPassword)) {
      return { ok: false, field: 'confirm', message: 'Konfirmasi password tidak sama.' };
    }
    if (constantTimeEqual(newPassword, currentPassword)) {
      return { ok: false, field: 'new', message: 'Password baru harus berbeda dari password lama.' };
    }

    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id !== user.id) continue;
      var salt = bytesToBase64(randomBytes(16));
      users[i].salt = salt;
      users[i].hash = await derivePassword(newPassword, base64ToBytes(salt), PBKDF2_ITERATIONS);
      users[i].iterations = PBKDF2_ITERATIONS;
      users[i].passwordChangedAt = store.nowISO();
      user = users[i];
      break;
    }
    writeUsers(users);
    audit('Ganti password', 'Password akun diperbarui; sesi lama tidak berlaku', user.name);

    // Perbarui sesi aktif agar pengguna tidak langsung ter-logout.
    var storage = sessionStorage();
    var raw = storage ? storage.getItem(SESSION_KEY) : null;
    if (raw) {
      try {
        var current = JSON.parse(raw);
        current.pwdAt = user.passwordChangedAt;
        current.lastSeen = now();
        storage.setItem(SESSION_KEY, JSON.stringify(current));
      } catch (error) {
        /* diabaikan */
      }
    }
    return { ok: true, message: 'Password berhasil diperbarui.' };
  }

  function updateName(name) {
    var session = getSession();
    if (!session) return { ok: false, message: 'Sesi berakhir.' };
    var value = String(name || '').trim();
    if (value.length < 2) return { ok: false, message: 'Nama minimal 2 karakter.' };
    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id !== session.userId) continue;
      users[i].name = value;
      users[i].nameUpdatedAt = store.nowISO();
    }
    writeUsers(users);
    try {
      var storage = sessionStorage();
      var current = JSON.parse(storage.getItem(SESSION_KEY));
      current.name = value;
      storage.setItem(SESSION_KEY, JSON.stringify(current));
    } catch (error) {
      /* diabaikan */
    }
    audit('Ubah nama akun', 'Nama akun diperbarui', value);
    return { ok: true, name: value };
  }

  /* ------------------------------------------------------------------ */
  /* MFA admin                                                           */
  /* ------------------------------------------------------------------ */

  function startMfaSetup() {
    var session = getSession();
    if (!session || session.role !== 'admin') {
      return { ok: false, message: 'Hanya admin yang dapat mengaktifkan MFA.' };
    }
    pendingMfaSecret = base32Encode(randomBytes(20));
    var issuer = encodeURIComponent('Haji Yuk');
    var label = encodeURIComponent('Haji Yuk Admin:' + session.email);
    return {
      ok: true,
      secret: pendingMfaSecret,
      otpauth:
        'otpauth://totp/' +
        label +
        '?secret=' +
        pendingMfaSecret +
        '&issuer=' +
        issuer +
        '&digits=6&period=30'
    };
  }

  async function confirmMfaSetup(code) {
    var session = getSession();
    if (!session || session.role !== 'admin') {
      return { ok: false, message: 'Sesi admin diperlukan.' };
    }
    if (!pendingMfaSecret) {
      return { ok: false, message: 'Mulai pengaturan MFA terlebih dahulu.' };
    }
    if (!(await verifyTotp(pendingMfaSecret, code))) {
      return { ok: false, message: 'Kode MFA tidak valid. Pastikan waktu perangkat Anda benar.' };
    }
    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id !== session.userId) continue;
      users[i].mfa = { enabled: true, secret: pendingMfaSecret };
      users[i].mfaEnabledAt = store.nowISO();
    }
    writeUsers(users);
    pendingMfaSecret = '';
    audit('Aktifkan MFA', 'MFA TOTP diaktifkan untuk akun admin', session.name);
    return { ok: true, message: 'MFA berhasil diaktifkan.' };
  }

  async function disableMfa(password, code) {
    var session = getSession();
    if (!session || session.role !== 'admin') {
      return { ok: false, message: 'Sesi admin diperlukan.' };
    }
    var user = findUserById(session.userId);
    if (!user || !user.mfa || !user.mfa.enabled) {
      return { ok: false, message: 'MFA belum aktif.' };
    }
    var validPassword = constantTimeEqual(
      await derivePassword(password, base64ToBytes(user.salt), user.iterations),
      user.hash
    );
    if (!validPassword || !(await verifyTotp(user.mfa.secret, code))) {
      audit('Nonaktifkan MFA gagal', 'Password atau kode MFA salah', user.name);
      return { ok: false, message: 'Password atau kode MFA salah.' };
    }
    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id !== user.id) continue;
      users[i].mfa = { enabled: false, secret: '' };
    }
    writeUsers(users);
    audit('Nonaktifkan MFA', 'MFA TOTP dimatikan untuk akun admin', user.name);
    return { ok: true, message: 'MFA dinonaktifkan.' };
  }

  async function resetAdminAccess() {
    if (!hasCrypto()) {
      return { ok: false, message: 'Browser tidak mendukung Web Crypto. Buka aplikasi melalui HTTPS.' };
    }
    var users = readUsers();
    var admin = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].role === 'admin') {
        admin = users[i];
        break;
      }
    }
    var password = 'admin123';
    if (admin) {
      var salt = bytesToBase64(randomBytes(16));
      admin.salt = salt;
      admin.hash = await derivePassword(password, base64ToBytes(salt), PBKDF2_ITERATIONS);
      admin.iterations = PBKDF2_ITERATIONS;
      admin.mfa = { enabled: false, secret: '' };
      admin.passwordChangedAt = store.nowISO();
    } else {
      admin = await buildUser({
        name: 'Admin Haji Yuk',
        email: 'admin@hajiyuk.local',
        username: 'admin',
        password: password,
        role: 'admin'
      });
      users.push(admin);
    }
    writeUsers(users);
    try {
      var storage = sessionStorage();
      if (storage) storage.removeItem(SESSION_KEY);
    } catch (error) {
      /* diabaikan */
    }
    clearFailures('admin', 'admin');
    audit('Pemulihan akses', 'Akun admin demo direset ke kredensial awal', 'Sistem');
    return {
      ok: true,
      message: 'Akses admin dipulihkan. Masuk dengan admin / admin123, lalu segera ganti password.'
    };
  }

  function mfaEnabled() {
    var session = getSession();
    if (!session) return false;
    var user = findUserById(session.userId);
    return !!(user && user.mfa && user.mfa.enabled);
  }

  function cancelMfaSetup() {
    pendingMfaSecret = '';
  }

  /* ------------------------------------------------------------------ */
  /* Backup & restore                                                    */
  /* ------------------------------------------------------------------ */

  function exportBackup() {
    var payload = {
      app: 'Haji Yuk',
      format: 'hajiyuk-backup',
      version: 1,
      exportedAt: store.nowISO(),
      data: {}
    };
    BACKUP_KEYS.forEach(function (name) {
      payload.data[name] = readJSON(store.KEYS[name], []);
    });
    try {
      var text = JSON.stringify(payload, null, 2);
      var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      var stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = 'hajiyuk-backup-' + stamp + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      audit('Backup data', 'Unduhan backup data operasional dibuat', 'Admin');
      return { ok: true };
    } catch (error) {
      return { ok: false, message: 'Gagal membuat berkas backup.' };
    }
  }

  function readFileText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error('Gagal membaca berkas.'));
      };
      reader.readAsText(file);
    });
  }

  async function restoreBackup(file) {
    var session = getSession();
    if (!session || session.role !== 'admin') {
      return { ok: false, message: 'Sesi admin diperlukan.' };
    }
    if (!file || file.size > 5 * 1024 * 1024) {
      return { ok: false, message: 'Berkas harus berukuran maksimal 5 MB.' };
    }
    var text;
    try {
      text = await readFileText(file);
    } catch (error) {
      return { ok: false, message: 'Berkas tidak dapat dibaca.' };
    }
    var payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      return { ok: false, message: 'Berkas bukan JSON yang valid.' };
    }
    if (
      !payload ||
      payload.format !== 'hajiyuk-backup' ||
      !payload.data ||
      typeof payload.data !== 'object'
    ) {
      return { ok: false, message: 'Format backup tidak dikenali.' };
    }
    var invalid = BACKUP_KEYS.filter(function (name) {
      return payload.data[name] !== undefined && !Array.isArray(payload.data[name]);
    });
    if (invalid.length) {
      return { ok: false, message: 'Struktur data backup tidak valid: ' + invalid.join(', ') + '.' };
    }
    BACKUP_KEYS.forEach(function (name) {
      if (Array.isArray(payload.data[name])) {
        safeSetRaw(store.KEYS[name], JSON.stringify(payload.data[name]));
      }
    });
    audit('Restore data', 'Data operasional dipulihkan dari backup', session.name);
    return { ok: true, message: 'Backup berhasil dipulihkan.' };
  }

  /* ------------------------------------------------------------------ */
  /* Ekspor modul                                                        */
  /* ------------------------------------------------------------------ */

  global.HajiYukAuth = {
    init: init,
    hasCrypto: hasCrypto,
    register: register,
    login: login,
    logout: logout,
    getSession: getSession,
    isLoggedIn: isLoggedIn,
    sessionMinutesLeft: sessionMinutesLeft,
    getLock: getLock,
    passwordIssues: passwordIssues,
    changePassword: changePassword,
    updateName: updateName,
    startMfaSetup: startMfaSetup,
    confirmMfaSetup: confirmMfaSetup,
    disableMfa: disableMfa,
    cancelMfaSetup: cancelMfaSetup,
    mfaEnabled: mfaEnabled,
    resetAdminAccess: resetAdminAccess,
    exportBackup: exportBackup,
    restoreBackup: restoreBackup,
    IDLE_MINUTES: IDLE_MS / 60000,
    MAX_ATTEMPTS: MAX_ATTEMPTS
  };
})(typeof window !== 'undefined' ? window : this);
