# HAJI YUK — Sahabat Perjalanan Ibadah Anda

Prototype aplikasi informasi dan layanan perjalanan Haji & Umroh, lengkap dengan **Dashboard Admin** yang terhubung ke data pengguna. Dibangun dengan **HTML5, CSS3, dan JavaScript Vanilla** tanpa backend.

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

Atau buka `index.html` langsung di browser modern (Chrome, Edge, Firefox, Safari). Disarankan memakai server lokal agar navigasi dan penyimpanan berjalan konsisten.

Halaman:

- `index.html` — aplikasi pengguna (Beranda, Katalog, Pendaftaran, Status, Panduan, Profil, Bantuan).
- `admin.html` — login dan Dashboard Admin. Bisa juga diakses lewat tautan kecil **Area Admin** di footer.

## Kredensial Login Demo

| Field | Nilai |
| --- | --- |
| Username | `admin` |
| Password | `admin123` |

Login memakai `sessionStorage`; sesi berakhir saat tab ditutup atau admin menekan Logout. Membuka `admin.html` tanpa login akan menampilkan halaman login.

## Fitur Dashboard Admin

- **Dashboard overview** — 6 kartu statistik (total, Haji, Umroh, menunggu pemeriksaan, sedang diproses, selesai), grafik Haji/Umroh, grafik status, 5 pendaftaran terbaru, serta log aktivitas admin. Semua angka dihitung dari data yang tersimpan.
- **Data pendaftaran** — tabel, pencarian nama/nomor/HP, filter layanan dan status, urutan tanggal, detail lengkap, pembaruan status + catatan untuk jamaah + catatan internal, dan hapus dengan konfirmasi.
- **Kelola paket** — tambah, edit, lihat detail, cari, filter kategori/publikasi, aktif/nonaktif, hapus dengan konfirmasi, validasi kolom wajib, pratinjau gambar dan gambar pengganti.
- **Kelola konten** — panduan Haji, Umroh, persiapan, manasik, doa, tips, FAQ; pratinjau, kategori, publikasi.
- **Pengumuman** — tambah/edit/hapus, tanggal, aktif/nonaktif; pengumuman aktif tampil di Beranda.
- **Laporan** — rekap total, Haji, Umroh, status, filter tanggal/layanan/status, riwayat, dan **Export CSV** (quoting karakter khusus serta penetralan formula spreadsheet).
- **Pengaturan** — identitas aplikasi, identitas admin (password tidak ditampilkan), versi, info penyimpanan, reset data, logout.
- **Keamanan tampilan** — semua input pengguna dirender lewat `escapeHTML`; catatan internal admin tidak pernah dikirim ke halaman pengguna.

## Alur Integrasi yang Berfungsi

1. Pengguna memilih paket → mengisi formulir → memeriksa ringkasan → mengirim permintaan.
2. Permintaan masuk ke `localStorage` dengan nomor unik (contoh `HY-261124-JAJ7`).
3. Admin login → membuka Data Pendaftaran → melihat detail.
4. Admin memperbarui status dan catatan → tersimpan beserta riwayat dan waktu pembaruan.
5. Pengguna membuka Status Pendaftaran → melihat status, catatan, dan riwayat terbaru.
6. Perubahan paket, konten, dan pengumuman langsung tampil di aplikasi pengguna.

Status hanya menunjukkan tindak lanjut melalui aplikasi Haji Yuk, bukan persetujuan pemerintah atau jaminan keberangkatan.

## Struktur Berkas

```
index.html               Aplikasi pengguna
admin.html               Login + dashboard admin
assets/css/style.css     Gaya bersama & halaman pengguna
assets/css/admin.css     Gaya dashboard admin
assets/js/store.js       Lapisan data localStorage (dipakai kedua sisi)
assets/js/ui.js          Toast, modal, dialog konfirmasi, badge
assets/js/app.js         Logika aplikasi pengguna
assets/js/admin.js       Logika dashboard admin
assets/img/*.svg         Ilustrasi & logo
```

## Penyimpanan Data (localStorage)

| Kunci | Isi |
| --- | --- |
| `hajiyuk_packages` | Katalog paket Haji & Umroh |
| `hajiyuk_requests` | Permintaan pendaftaran |
| `hajiyuk_guides` | Konten panduan |
| `hajiyuk_announcements` | Pengumuman |
| `hajiyuk_activity_logs` | Log aktivitas admin |
| `hajiyuk_client_id` | ID sesi browser untuk isolasi Status Pendaftaran |
| `hajiyuk_profile`, `hajiyuk_text_scale` | Profil & preferensi teks |

Data awal paket/panduan/pengumuman otomatis diisi saat pertama kali dijalankan dan tidak menimpa data pengguna. JSON tidak valid ditangani dengan fallback aman. Halaman Status hanya menampilkan permintaan milik sesi browser tersebut.

## Batasan Prototype

- Tidak ada backend, payment gateway, database online, atau integrasi sistem pemerintah.
- Tidak mengirim WhatsApp/email sungguhan dan tidak memverifikasi dokumen.
- **Autentikasi berbasis JavaScript di browser dapat diperiksa dan dilewati**; kredensial demo bukan sistem keamanan produksi. Versi produksi membutuhkan autentikasi server, password hashing, dan kontrol akses.
- Data hanya tersimpan di browser dan perangkat yang sama; tidak tersinkronisasi antarperangkat dan hilang bila data browser dibersihkan.
- Jangan memasukkan NIK, nomor paspor, atau dokumen identitas asli.
