# HAJI YUK — Sahabat Perjalanan Ibadah Anda

Prototype aplikasi informasi dan layanan perjalanan Haji & Umroh dengan **akun pengguna**, **Dashboard Admin**, dan **kontrol keamanan berlapis**. Dibangun dengan **HTML5, CSS3, dan JavaScript Vanilla** tanpa backend.

> Prototype demonstrasi. Seluruh harga, jadwal, dan fasilitas paket adalah simulasi dan belum diverifikasi. Pengisian formulir bukan pendaftaran haji resmi, bukan penerbitan nomor porsi, dan bukan jaminan keberangkatan.

## Cara Menjalankan

Aplikasi adalah situs statis. Jalankan dari folder proyek:

```bash
# Opsi 1 — Python
python3 -m http.server 3000
# Buka http://localhost:3000

# Opsi 2 — Node
npx serve .
```

Buka melalui `http://localhost` atau HTTPS (bukan `file://`) karena autentikasi memakai **Web Crypto API** yang hanya aktif pada secure context.

Halaman:

- `index.html` — aplikasi pengguna (Beranda, Katalog, Pendaftaran, Status, Panduan, Profil, Masuk/Daftar, Bantuan, Privasi).
- `admin.html` — login dan Dashboard Admin. Bisa juga diakses lewat tautan **Area Admin** di footer.

## Akun & Kredensial

### Pengguna

Buat akun melalui **Masuk → Daftar** (nama, email, password). Akun diperlukan untuk membuka halaman **Pendaftaran** dan **Status**; permintaan terhubung ke akun, bukan sekadar browser.

### Admin

| Field | Nilai |
| --- | --- |
| Username | `admin` |
| Password | `admin123` |

Akun admin dibuat otomatis pada pemakaian pertama dengan password **ter-hash PBKDF2-SHA256 + salt acak**. Kredensial demo dapat diganti melalui **Pengaturan → Ganti password**. MFA nonaktif secara default; aktifkan di **Pengaturan → Autentikasi dua faktor**.

## Kontrol Keamanan

Checklist mengacu pada kontrol minimum UMKM:

| Kontrol | Implementasi |
| --- | --- |
| Autentikasi & rate limiting | Password PBKDF2-SHA256 (150.000 iterasi, salt acak per akun), maksimal 5 percobaan login per 15 menit, kunci 15 menit, pesan gagal generik, dan MFA TOTP (6 digit/30 detik) untuk admin. |
| HTTPS & `.gitignore` | Deployment Vercel memakai TLS/HSTS. `.gitignore` mengecualikan `.env`, kunci, log, dependensi, dan output build. |
| Validasi input & OWASP | Validasi email/password/nama/telepon, escaping seluruh input sebelum dirender (`escapeHTML`), netralisasi formula CSV, dan CSP tanpa `unsafe-eval`. |
| Kontrol akses & isolasi | Peran `user`/`admin` diperiksa saat login dan setiap pemuatan halaman; Status hanya menampilkan permintaan milik akun yang masuk; catatan internal admin tidak pernah dirender ke pengguna. |
| Sesi | `sessionStorage`, batas diam 20 menit, batas absolut 8 jam, validasi ulang setiap 30 detik, dan sesi batal otomatis setelah password diganti. |
| Dependensi, log & backup | Tanpa dependensi runtime; log audit maksimal 90 hari/300 entri; unduh backup JSON dan pulihkan dengan validasi format. |
| Kebijakan privasi | Halaman **Privasi** menjelaskan data yang dikumpulkan, tujuan, masa simpan, hak pengguna, dan kontrol keamanan. |
| Header keamanan | `vercel.json`: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, dan `Permissions-Policy`. |

## Fitur Dashboard Admin

- **Dashboard overview** — kartu statistik dan grafik yang dihitung dari data tersimpan, pendaftaran terbaru, serta log aktivitas.
- **Data pendaftaran** — pencarian, filter, detail, pembaruan status + catatan publik/internal, dan hapus dengan konfirmasi.
- **Kelola paket** — CRUD, publikasi, pratinjau gambar, validasi kolom.
- **Kelola konten** — panduan Haji/Umroh/persiapan/manasik/doa/tips/FAQ dengan pratinjau.
- **Pengumuman** — CRUD dan aktif/nonaktif; pengumuman aktif tampil di Beranda.
- **Laporan** — rekap, filter tanggal/layanan/status, dan ekspor CSV yang aman dari formula injection.
- **Pengaturan & keamanan** — identitas admin, ganti password, MFA (aktifkan/nonaktifkan dengan verifikasi), info sesi, log keamanan, backup/restore JSON, reset data simulasi, dan logout.

## Alur Integrasi yang Berfungsi

1. Pengguna mendaftar/masuk → memilih paket → mengisi formulir → memeriksa ringkasan → mengirim permintaan.
2. Permintaan tersimpan dengan nomor unik (contoh `HY-261124-WPG6`) dan `userId` pemiliknya.
3. Admin masuk (dengan MFA bila diaktifkan) → melihat detail permintaan.
4. Admin memperbarui status dan catatan → riwayat serta waktu pembaruan tersimpan.
5. Pengguna membuka Status → hanya melihat permintaan milik akunnya beserta catatan tindak lanjut.
6. Perubahan paket, konten, dan pengumuman langsung tampil di aplikasi pengguna.

## Struktur Berkas

```
index.html               Aplikasi pengguna
admin.html               Login + dashboard admin
assets/css/style.css     Gaya bersama & halaman pengguna
assets/css/admin.css     Gaya dashboard admin
assets/js/store.js       Lapisan data localStorage
assets/js/auth.js        Akun, hash password, rate limit, MFA, sesi, backup
assets/js/ui.js          Toast, modal, dialog konfirmasi, badge
assets/js/app.js         Logika aplikasi pengguna
assets/js/admin.js       Logika dashboard admin
assets/img/*.svg         Ilustrasi & logo
vercel.json              Header keamanan untuk deployment Vercel
.gitignore               Pengecualian env, kunci, log, dan build
```

## Penyimpanan Data

| Kunci | Isi |
| --- | --- |
| `hajiyuk_users` | Akun pengguna & admin (hash password, salt, status MFA) |
| `hajiyuk_session` | Sesi aktif (sessionStorage, per tab) |
| `hajiyuk_login_attempts` | Penghitung percobaan login & kunci sementara |
| `hajiyuk_packages` | Katalog paket Haji & Umroh |
| `hajiyuk_requests` | Permintaan pendaftaran beserta `userId` |
| `hajiyuk_guides` | Konten panduan |
| `hajiyuk_announcements` | Pengumuman |
| `hajiyuk_activity_logs` | Log aktivitas & audit keamanan (90 hari/300 entri) |
| `hajiyuk_client_id` | ID perangkat untuk kompatibilitas data lama |
| `hajiyuk_profile`, `hajiyuk_text_scale` | Profil kontak & preferensi teks |

Data awal paket/panduan/pengumuman diisi sekali dan tidak menimpa data pengguna. JSON tidak valid ditangani dengan fallback aman. Reset data simulasi **tidak** menghapus akun, sesi, atau log audit.

## Batasan Prototype

- **Tidak ada backend.** Verifikasi password, MFA, rate limit, dan otorisasi berjalan di browser sehingga dapat diperiksa atau dimodifikasi pengguna teknis. Ini demonstrasi kontrol keamanan, bukan keamanan produksi.
- Kunci rahasia MFA dan hash password tersimpan di `localStorage` perangkat; untuk produksi wajib dipindahkan ke server dengan secret terenkripsi.
- Tidak ada payment gateway, database online, integrasi pemerintah, pengiriman WhatsApp/email, atau verifikasi dokumen.
- Data hanya tersimpan di browser dan perangkat yang sama; tidak tersinkronisasi antarperangkat dan hilang bila data browser dibersihkan.
- Jangan memasukkan NIK, nomor paspor, atau dokumen identitas asli.
- Kredensial demo `admin/admin123` bersifat publik; ganti password dan aktifkan MFA sebelum memakai data nyata.
