# Panduan bot komunitas multiserver — versi pengembangan

Satu proses bot dan satu aplikasi Discord melayani beberapa server secara bersamaan. Aktivasi dan pilihan akses disimpan per ID server di MongoDB. Template welcome, profil member, referensi pesan, backup dan konfigurasi fitur lama tetap disimpan dalam channel Discord privat masing-masing server; **tidak dipindahkan ke MongoDB**. Data lama di channel tidak dihapus atau dimigrasikan otomatis. Konten default masih membawa merek, tautan dan email Ainun Ijlal Studio; periksa dan sesuaikan sebelum digunakan di komunitas lain.

## Perhatian sebelum memperbarui

- Gunakan server uji dan cadangan. Ini adalah versi pengembangan, belum diuji langsung pada Discord, Render, atau MongoDB Anda, dan belum siap dijual sebagai layanan komersial tanpa uji integrasi, audit keamanan, kebijakan privasi, backup, pemantauan dan pengaturan lisensi/pembayaran. Tidak ada sistem pembayaran atau lisensi.
- Enam command bawaan bot yang dikenal kini default-nya tersembunyi untuk member biasa. Hak akses khusus/overwrite Integrations yang sudah ada **tidak dihapus otomatis** dan bisa membuat command lama tetap terlihat. Periksa tiap server dan command global lama. Administrator Discord tetap bisa melihat/menjalankan command menurut aturan Discord, tetapi bot juga memeriksa izin saat menjalankan.
- Registrasi command global pada startup memperbarui default permission command global bot yang dikenal **di seluruh server aplikasi ini**. Tidak menghapus command lain atau overwrite yang sudah ada; pastikan semua server yang memakai bot siap untuk perubahan ini.
- `WELCOME_CHANNEL_ID` (yang sebelumnya berisi ID server) dan `OWNER_ROLE_ID` global tidak digunakan lagi. Tidak perlu menghapus env lama, tetapi tidak mengubah server dengan mengedit kedua nilai tersebut. Server baru tidak aktif saat bot diundang; hanya pemilik aplikasi bot dapat mengaktifkannya di dashboard. `/setup-server` membuat role `Owner` jika belum ada dan mencoba memberikannya kepada pemilik server. Pemilik server sebenarnya tetap dikenali sebagai Owner oleh bot jika pemberian role gagal; pengelola lain tetap memerlukan role Owner yang unik.
- Jalankan **satu instance** Render saja: sesi OAuth, cache server aktif, kunci operasi dan sebagian batasan berada di memori. Tidak mendukung beberapa instance/worker atau perubahan MongoDB manual ketika proses berjalan; restart diperlukan setelah perubahan manual. Maksimal 1.000 server aktif dalam implementasi ini; belum diuji untuk skala tersebut.

## 1. Siapkan Discord dan MongoDB

1. Buat/siapkan satu Discord Application dan bot. Undang bot ke setiap server dengan scope `bot` dan `applications.commands`. Berikan izin yang dibutuhkan fitur yang dipakai, misalnya Manage Channels, Manage Roles, Manage Messages, View Channels, Read Message History, Send Messages, Embed Links dan Attach Files. Posisi role bot harus di atas role status yang dikelolanya. Berikan hanya izin yang diperlukan dan uji di server percobaan.
2. Aktifkan **Server Members Intent** dan **Message Content Intent** pada Developer Portal → Bot. Aplikasi berskala tertentu dapat memerlukan persetujuan Discord.
3. Siapkan database MongoDB/Atlas, user database terpisah dengan hak minimum untuk database aplikasi, koneksi TLS, dan jaringan yang mengizinkan Render terhubung. Simpan string koneksi hanya pada env Render, bukan dalam kode, chat atau Git. Atur backup dan pembatasan jaringan sesuai infrastruktur. IP terbuka untuk semua sumber meningkatkan risiko dan bukan pengganti autentikasi yang kuat.
4. Di Developer Portal → OAuth2, tambahkan redirect URI **persis** `https://ALAMAT-RENDER-ANDA/auth/callback`. Gunakan domain HTTPS Render yang benar, tanpa slash di akhir pada nilai DASHBOARD_URL.

## 2. Environment Render

Buat Web Service dari folder ini, dengan Build Command `npm ci` dan Start Command `npm start`. Set environment berikut (jangan sertakan tanda kutip):

| Key | Isi |
| --- | --- |
| `DISCORD_TOKEN` | Bot token aplikasi Discord; rahasia. |
| `DISCORD_CLIENT_ID` | Application ID dari aplikasi yang sama dengan token bot. |
| `DISCORD_CLIENT_SECRET` | OAuth2 Client Secret aplikasi Discord; rahasia. |
| `MONGODB_URI` | MongoDB connection string termasuk kredensial; rahasia. |
| `MONGODB_DB` | Opsional; nama database, default `komunitas`. |
| `DASHBOARD_URL` | Origin HTTPS dashboard, misalnya `https://contoh.onrender.com`, tanpa path atau slash di akhir. |
| `PORT` | Diisi Render otomatis. |

Node.js 20 atau lebih baru disarankan. Bila kredensial pernah terlanjur bocor, rotasi di penyedia masing-masing. Jangan isi contoh atau nilai asli pada file proyek. Aplikasi berhenti jika MongoDB/token/env dashboard tidak valid; baca log Render tanpa membagikan rahasia.

## 3. Undang dan siapkan server

1. Di Discord Developer Portal → Bot aktifkan **Public Bot** bila server lain akan mengundang aplikasi. Login ke dashboard memakai Discord, lalu salin link **Undang bot ke komunitas lain** dan kirim ke pengelola server. Link ini meminta izin yang ditampilkan Discord, termasuk Manage Server, Manage Roles, Manage Channels, dan Manage Messages; minta pemilik memeriksa cakupannya sebelum menyetujui. Jangan pernah membagikan token atau client secret.
2. Setelah bot diundang, muat ulang dashboard. Server baru muncul sebagai **Tidak aktif**; penjual memilih **Edit setup** untuk menyimpan permintaan pembeli, kemudian menekan **Aktifkan**. Aktivasi hanya melalui dashboard dan mendaftarkan slash command, tidak membuat kategori/channel. Jika gagal, periksa log dan MongoDB. Server yang sudah aktif tetap aktif saat restart. Bila event bot dikeluarkan dan diundang kembali terdeteksi ketika bot online, server kembali tidak aktif dan penjual harus mengaktifkannya lagi. Jika kedua peristiwa terjadi saat bot offline, Discord tidak memberikan riwayat event tersebut saat startup; periksa status secara manual di dashboard.
3. Pemilik server menjalankan `/setup-server`, membaca rincian, lalu memilih **Setup struktur** untuk setup baru. Bot membuat role `Owner`, `Admin`, `Pekerja`, `Pelajar`, dan `Umum` jika belum ada; **semua role baru termasuk Admin dibuat tanpa izin istimewa**, sehingga pemilik harus mengatur izin Admin bila diinginkan. Role lama tidak dimodifikasi. Bot mencoba memberikan role Owner pada pemilik server; kegagalan izin/hierarki akan dilaporkan dan pemilik tetap diakui berdasarkan ID Discord-nya. Bot memerlukan Manage Roles dan posisi role bot lebih tinggi daripada role yang akan diberikan.
4. Setup juga membuat struktur kategori/channel yang belum ada, panel role dan panel privat komunitas. Channel dan riwayat lama tidak dihapus; channel lama dengan nama yang sesuai dipakai tanpa diubah isinya, kecuali panel role dapat ditambahkan. **Overwrite pada kategori/channel kelola, kategori dan channel backup, dan `#feedback-and-request` akan diganti**, serta welcome sistem Discord dapat dinonaktifkan. Periksa konfirmasi sebelum melanjutkan. Jika ada duplikat role/channel penting, setup berhenti untuk menghindari salah sasaran; operasi yang sudah sempat berhasil tidak otomatis di-rollback.
5. Channel yang baru dibuat mendapat izin awal. Channel lama tidak dikunci secara otomatis; jika diperlukan, tinjau dulu lalu jalankan `/kunci-chat`, yang dapat mengubah izin di banyak channel. Setup versi ini tidak membuat/menghapus aturan AutoMod otomatis. Konten awal masih bermerek Ainun Ijlal Studio.

### Tabel server dan akses dashboard

- Dashboard hanya untuk **pemilik aplikasi bot** yang diverifikasi melalui Discord. Untuk aplikasi milik tim, hanya pemilik tim yang dapat masuk; anggota tim lain tidak otomatis punya akses. Tidak perlu `DASHBOARD_ADMIN_ID`. Jika key lama masih ada di Render, hapus; kode ini mengabaikannya. Lindungi akun Discord dengan 2FA.
- Masuk dengan akun pemilik aplikasi, salin undangan, lalu berikan kepada pemilik server lain. Setelah mereka mengundang bot, server otomatis muncul di tabel (nama, ID, status); tombol Aktifkan/Daftarkan ulang dan Nonaktifkan berlaku untuk setiap server yang masih diikuti bot. Muat ulang dashboard bila daftar belum berubah. Tabel 10 server per halaman; pada ponsel geser tabel ke samping untuk melihat tindakan.
- Dashboard menyediakan daftar, status, aktivasi/nonaktif, sakelar slash command, dan konfigurasi kategori/channel tambahan per server. Pengaturan welcome dan role tetap melalui panel Discord. Bot bertindak hanya dengan izin yang diberikan saat undangan, dan pemilik server harus mengetahui serta menyetujuinya.
- **Nonaktifkan** menghentikan pemrosesan server dan menghapus pilihan akses member di MongoDB; perintah dan overwrite Discord tidak dihapus sehingga mungkin tetap terlihat. Hanya penjual melalui dashboard dapat mengaktifkannya lagi. Gunakan **Aktifkan** untuk mendaftarkan ulang. ID saja tidak mengundang bot.
- Pemilik server lain tidak perlu login untuk mengundang bot atau menjalankan `/setup-server`. Khusus perubahan visibilitas slash command lewat panel, Discord memerlukan otorisasi terpisah dari akun yang berwenang di server itu; ini tidak memberi akses dashboard. Lihat bagian 4.
- Discord membatasi penetapan role berdasarkan izin dan hierarki. Jika role Owner gagal diberikan, naikkan posisi role bot di atas role Owner, pastikan Manage Roles dan jalankan setup lagi; jika tetap ditolak, pemilik dapat menambahkan role secara manual. Pemilik sebenarnya tetap bisa memakai kontrol bot berkat pemeriksaan ID pemilik server.

## Pemulihan setelah bot dikeluarkan dan diundang ulang

1. Undang kembali bot yang **sama** dengan izin yang dibutuhkan. Pastikan bot memiliki Manage Channels dan Manage Roles pada server dan di lokasi yang akan dikelola. Pemilik server menjalankan `/setup-server` pada channel yang dapat dilihat bot, lalu pilih **Pulihkan akses**. Server harus diaktifkan lebih dahulu oleh penjual di dashboard; perintah tidak mengaktifkan server. Opsi ini tidak membuat atau menghapus role/channel/pesan.
2. Jika bot tidak bisa melihat kategori privat, pemilik server perlu membuka **Edit Category → Permissions** untuk `🔐 KELOLA KOMUNITAS` dan `🗄️ BACKUP`, lalu menambahkan **akun bot sebagai member** (bukan role bot) dan memberi **View Channel**, **Read Message History**, **Send Messages**, **Embed Links**, dan **Attach Files**. Hapus penolakan eksplisit untuk bot pada izin tersebut. Bila channel tidak sinkron dengan kategori, ulangi pada setiap channel privat yang disebut dalam hasil pemeriksaan; jangan menyinkronkan secara membabi buta karena dapat mengganti izin lain. Jangan membuka akses untuk `@everyone`. Pemeriksaan privasi bot mengizinkan akun bot dan role Owner; tambahan role lain yang memiliki View Channel, termasuk role bot, dapat dianggap tidak aman. Gunakan akun bot langsung. Lalu jalankan **Pulihkan akses** lagi. Jika Discord masih menolak akses, tinjau juga Manage Channels dan Manage Roles serta posisi role bot. Discord tidak mengizinkan bot melewati pembatasan izin; bisa diperlukan tindakan pemilik secara manual.
3. Hasil menampilkan jumlah lokasi yang diperiksa, izin efektif yang terverifikasi, perubahan overwrite bot, serta lokasi yang dilewati/gagal. `2 diperbaiki` pada versi lama hanya berarti dua perubahan dikirim, bukan bahwa semua akses berfungsi. Saat bot diundang kembali, perhatikan `[GUILD]` di log; saat menjalankan pemulihan manual, lihat hasil di Discord. Channel yang tidak dapat dilihat bot mungkin tidak muncul pada daftar Discord sama sekali, sehingga jumlah terverifikasi bukan jaminan bahwa semua channel di server sudah diperiksa.
4. Pilih **Setup struktur** hanya untuk membuat struktur awal atau memasang ulang setelah akses channel lama beres. Ini dapat mengganti overwrite kategori/channel kelola, backup, feedback dan pengaturan welcome sistem. Jika role Owner sudah ada tetapi kategori kelola tidak terlihat atau tidak aman, tindakan dihentikan untuk mencegah duplikat. Pada server baru yang telah memiliki role bernama Owner tanpa struktur bot, hal ini juga dapat menghentikan setup; tinjau/rapikan role dan struktur terlebih dahulu. Nama channel yang tidak terlihat tidak bisa dibedakan secara pasti dari channel yang belum ada: periksa akses sebelum setup ulang dan buat cadangan.
5. Saat deploy/restart, bot tidak memindai atau memulihkan izin channel, sehingga log `[PEMULIHAN]` tidak muncul. Bot tidak memulihkan izin otomatis ketika bergabung; setelah penjual mengaktifkan server, pemulihan manual tersedia lewat `/setup-server` → **Pulihkan akses**. Pemulihan mengubah hanya overwrite akun bot pada channel yang dikenali; tidak mengubah overwrite anggota atau role lain, dan tidak memaksa izin yang secara eksplisit ditolak untuk bot. Channel duplikat atau tidak terbukti privat dilewati. Jika server tidak aktif, penjual perlu menggunakan tombol **Aktifkan** di dashboard sebelum pemulihan manual. Jika panel komunitas perlu dipasang atau izinnya dibaca lagi, pemilik dapat menjalankan `/setup-komunitas`; perintah itu mengganti overwrite lokasi kelola, backup, dan feedback, jadi periksa izin dahulu.
6. Jika `/setup-server` tidak terlihat, periksa command global dan Server Settings → Integrations, gunakan akun pemilik server pada channel yang terlihat bot, pastikan aplikasi sudah terundang dengan scope `applications.commands`, dan pastikan sakelar `/setup-server` di dashboard menyala. Jika registrasi, MongoDB, atau Discord gagal, aktivasi mungkin tidak selesai; periksa log dan coba lagi. Perubahan izin slash command oleh Discord dapat memerlukan otorisasi ulang di panel.

## Pengaturan setup tambahan per server

1. Penjual login dan klik **Edit setup** pada baris server. Pilih **Gunakan bawaan saja** atau **Bawaan + kategori dan channel tambahan**. Bawaan selalu dipertahankan, termasuk `#diskusi` dan `#rules-and-role`. Tambahan tidak mengganti atau menghapus kategori, channel, isi pesan, maupun riwayat lama.
2. Dalam mode tambahan, pilih nama dan visibilitas kategori; tambahkan satu sampai lima channel teks/suara dan visibilitasnya. Maksimum lima kategori dan 20 channel total per server. Nama channel memakai huruf kecil ASCII, angka, tanda `-` atau `_`, maksimal 80 karakter, unik dan bukan nama bawaan. Channel tidak boleh lebih terbuka daripada kategorinya. **Simpan setup** hanya menyimpan pengaturan di MongoDB; belum membuat apa pun di Discord.
3. Visibilitas **Publik** memperlihatkan kepada @everyone; **Role status + Owner** kepada role Pekerja, Pelajar, Umum dan Owner; **Owner saja** kepada role Owner. Bot diberi akses. Administrator dan pemilik server dapat melewati pembatasan channel Discord. Pada channel teks, @everyone tidak dapat mengirim pesan; role yang diberi akses dapat mengirim pesan bila tidak dibatasi aturan Discord lain. Voice memakai izin koneksi Discord yang berlaku. Periksa izin dan hierarki role langsung di Discord.
4. Penjual mengaktifkan server, lalu pemilik server menjalankan `/setup-server`, meninjau ringkasan dan memilih **Setup struktur**. Struktur bawaan dibuat terlebih dahulu, lalu tambahan. Bot melewati nama channel yang sudah ada dan tidak mengubahnya. Kategori yang sudah ada hanya digunakan kembali bila tercatat sebagai kategori tambahan yang dibuat bot dengan nama dan visibilitas yang sama; kategori lain atau visibilitas yang diubah akan dilewati, bukan diubah. Ini menjaga izin dan isi lama; ubah kategori/channel yang sudah ada secara manual di Discord jika diperlukan.
5. Bot hanya dapat memeriksa channel yang terlihat. Berikan akses View Channel pada channel lama sebelum setup agar tidak terduplikasi. Pembuatan sebagian yang gagal tidak otomatis dibatalkan; lihat rincian respons setup, perbaiki izin dan jalankan lagi. Jika penyimpanan MongoDB gagal setelah membuat kategori, kategori itu akan dilewati pada percobaan berikutnya sampai diperiksa manual. Perubahan konfigurasi setelah dialog konfirmasi terbuka membatalkan setup dan harus ditinjau ulang. Mode bawaan menyimpan draft tambahan tetapi tidak membuatnya.

## Pengaturan perintah per server

- Login sebagai pemilik aplikasi bot, klik **nama server** pada tabel, atur enam pilihan perintah, lalu klik **Simpan perubahan**. Tersimpan terpisah di MongoDB, tetap ada setelah restart dan undangan ulang. Pengaturan lama tanpa pilihan dianggap semua aktif. Pengaturan dapat disimpan sebelum server diaktifkan.
- Sakelar ini **menonaktifkan pelaksanaan slash command** oleh bot di server tersebut, termasuk jika dijalankan oleh Owner atau Administrator. Ini tidak menghapus command, tidak menjamin command tersembunyi di Discord, dan tidak menonaktifkan panel/tombol, pekerjaan terjadwal, atau fitur lain. Mematikan `/setup-server` misalnya tidak menghapus struktur yang sudah dibuat. Untuk pembatasan pengguna/channel dan menyembunyikan perintah di pemilih Discord, atur izin command melalui Integrations atau panel yang relevan; perubahan melalui API membutuhkan otorisasi pengguna yang berwenang di server, bukan token bot saja.
- Ini kontrol fitur sederhana, bukan sistem pembayaran/lisensi otomatis. Komunikasikan batasan kepada pemilik server. Jalankan satu instance saja; jangan edit data MongoDB secara manual saat bot aktif.

## 4. Pilih command untuk member

1. Di Discord, sebagai pemilik server atau role Owner yang memenuhi izin, jalankan `/setup-komunitas`, lalu buka `🔐 KELOLA KOMUNITAS` → `#kelola-slash-command`. Bila diminta, buka link otorisasi khusus yang dikirim bot dan login dengan akun Discord yang sama; ini tidak memberi akses ke dashboard. Otorisasi berlaku sementara dan mungkin perlu diulang.
2. Klik **Pilih perintah**, pilih `/onboarding-member` atau **Tidak ada**, lalu **Terapkan**, atau **Batal**. Saat ini hanya `/onboarding-member` yang dianggap aman untuk member. Perintah reset, hapus, setup dan pengelola tidak dapat dibuka ke member melalui panel ini; menambahkan pilihan lain memerlukan implementasi pengecekan akses terlebih dahulu.
3. Bot memakai OAuth akun yang login untuk mengganti **seluruh overwrite permission** `/onboarding-member` versi guild: @everyone, role Owner, semua channel dan #diskusi. Overwrite individual sebelumnya untuk command itu akan tertimpa. Pengaturan ini tidak mengubah command lain. User OAuth harus dapat menjalankan command tersebut serta mempunyai Manage Server, Manage Roles dan hak mengelola resource terkait. Jika gagal, lakukan otorisasi ulang; periksa izin dan bila perlu berikan akses Owner ke command tersebut di Discord Integrations sebelum menerapkan.
4. Discord dapat menerapkan izin channel juga pada thread. Bot tetap memeriksa ID channel #diskusi, server aktif, pilihan perintah, dan role status sebelum memproses member; thread tidak didukung. Jika #diskusi dibuat ulang, pilih dan terapkan lagi.
5. Mengubah Integrations secara manual tidak menyinkronkan pilihan ke MongoDB; panel adalah sumber perubahan yang disarankan. Hak Discord lain, khususnya Administrator dan overwrite lama/perintah global lama, dapat memengaruhi visibilitas. Jika penyimpanan MongoDB gagal sesudah perubahan Discord, command mungkin terlihat tetapi bot menolak; perbaiki database lalu terapkan lagi. Discord membatasi API; ini tidak menjamin bebas rate limit.

**Perintah setup:** `/setup-server` → **Pulihkan akses** hanya mencoba memulihkan overwrite bot dan tidak membuat/menghapus channel. **Setup struktur** tidak menghapus role, channel, riwayat, atau AutoMod, tetapi tetap mengganti overwrite lokasi yang disebutkan di atas setelah konfirmasi. `/setup-komunitas` tetap tersedia untuk memasang panel ulang dan juga mengubah overwrite tersebut. Backup dan periksa izin terlebih dahulu.

## Fitur yang sudah ada

Saat anggota baru masuk, bot mengirim **welcome member baru** di `#diskusi` yang mengarahkan mereka memilih role, tanpa DM dan tanpa memberikan role otomatis. Setelah anggota itu pertama kali memilih role di panel bot, bot mengirim **onboarding setelah role** yang berbeda, juga di `#diskusi`. Mengganti atau melepas role tidak mengirim ulang. Konfirmasi pemilihan role berupa respons privat, bukan DM.

Di `#kelola-embed-welcome-member` ada dua tombol:
- **Edit welcome member baru**: pengaturan pesan saat anggota masuk. Pengaturan lama yang sebelumnya untuk announcements tetap dipakai, tetapi tujuan pesan baru sekarang `#diskusi`.
- **Edit onboarding setelah role**: pengaturan pesan sesudah anggota memilih role.

Setiap tombol membuka **satu formulir** untuk author dan judul, isi, tiga bagian informasi, footer, serta waktu. Perubahan berlaku untuk pesan berikutnya dan tidak mengubah pesan lama secara massal.

### Format formulir
- **Header:** dua baris: author lalu judul. Tulis `-` pada baris yang ingin disembunyikan.
- **Isi:** isi pesan, maksimal 3.000 karakter.
- **Informasi:** tepat tiga baris, masing-masing `Judul | Isi`. Gunakan `-` pada baris yang tidak ingin ditampilkan. Contoh:

```text
Nama Pengguna | `{tag}`
Anggota Ke | **#{member_count}**
Akun Dibuat | {account_created}
```

- **Footer:** baris pertama `YA` atau `TIDAK` untuk menampilkan/menyembunyikan waktu otomatis Discord; baris berikutnya isi footer. Kosongkan teks setelah baris pertama untuk menyembunyikan footer. Tampilan waktu seperti “Today at 4:13 PM” ditentukan oleh Discord dan tidak dapat diubah menjadi teks sembarang; matikan dengan `TIDAK` atau tambahkan teks waktu ke footer.
- Variabel: `{member}`, `{username}`, `{tag}`, `{id}`, `{server}`, `{member_count}`, `{role}`, `{account_created}`, `{rules}`, `{diskusi}`, `{template}`. Jumlah anggota adalah jumlah server saat pesan dibuat, bukan nomor urut tetap. Avatar tetap otomatis; tidak ada pengaturan banner pada menu welcome.

Pengaturan disimpan di pesan bot dalam channel privat, bukan di filesystem Render. Jangan hapus pesan konfigurasi atau status dalam channel pengelola. Bot harus online ketika member bergabung dan memilih role; bila pengiriman/pencatatan gagal, periksa log. Belum ada antrean ulang otomatis; jalankan satu instance bot. Untuk sambutan Discord bawaan, bot mencoba mematikannya; bila gagal, periksa izin Manage Server dan pengaturan System Messages. Bot lain perlu diatur secara terpisah.

## Kelola member

Di `#kelola-member`, klik **Edit onboarding member**, pilih member, lalu edit semua bagian pada satu formulir dengan format di atas. Pengaturan khusus hanya berlaku pada member tersebut, menggantikan template umum. Setelah disimpan bot mencoba mengedit **pesan onboarding terakhir** member di `#diskusi`; jika tidak ditemukan, pengaturan tetap tersimpan. Pesan baru dilacak secara privat. Untuk pesan lama bot mencari hingga 1.000 pesan terakhir dengan User ID yang cocok di footer; hasil bergantung pada format lama. Jalankan `/onboarding-member` untuk menerbitkan pesan baru yang dapat dilacak.

Di `#diskusi`, gunakan `/onboarding-member` lalu pilih `member`. Untuk member biasa, Owner harus mengaktifkannya melalui #kelola-slash-command terlebih dahulu. Pemanggil harus memiliki role Owner, Pekerja, Pelajar, atau Umum. Pesan hasilnya publik; jangan masukkan data rahasia. Member tanpa profil khusus menggunakan template umum. Akun bot tidak dapat dipilih.

## Edit pesan awal channel

Setelah `/setup-komunitas`, buka `#edit-pesan-channel-awal` dan klik **Pilih channel & pesan**. Pilih channel teks atau pengumuman di kategori mana pun yang dapat dilihat dan dibaca riwayatnya oleh Owner dan bot. Pilih pesan bot yang ingin diubah. Editor menampilkan hingga 25 pesan embed bot terawal dari 1.000 pesan awal channel. Discord tidak mengizinkan bot mengedit pesan milik pengguna atau bot lain; forum/thread serta pesan konfigurasi pengelola dan backup dilindungi/tidak didukung.

Formulir mengedit **pesan yang dipilih**, bukan membuat pesan baru: teks di luar embed, author, judul, isi embed pertama, field, footer, dan waktu. Untuk field, isi satu baris per field: `Judul | Isi | YA` (inline) atau `Judul | Isi | TIDAK` (tidak inline); gunakan `\n` untuk baris baru di isi field. Kosongkan daftar untuk menghapus semua field. Tombol interaktif seperti role/form, lampiran, gambar, warna, thumbnail, dan embed lainnya dipertahankan, tidak diedit. Pesan yang melebihi batas formulir ditolak tanpa perubahan. Jika pesan berubah saat formulir terbuka, pilih ulang agar tidak menimpa perubahan lain.

## Tombol Batal dan pengelolaan

Pada dropdown di panel kategori, channel, member, editor pesan awal, backup dan hapus pesan: pilih opsi lalu tekan **Lanjutkan**. Bila formulir ditutup tanpa menyimpan, tekan **Lanjutkan** lagi pada pesan pilihan yang masih ada; tidak perlu membuka panel dari awal. Tombol **Batal** menutup/menghapus pesan pilihan privat tanpa menerapkan perubahan. Konfirmasi hapus kategori/channel juga memiliki Batal. Modal bawaan Discord dapat ditutup tanpa menyimpan.

`#kelola-kategori`: tambah hingga 25 nama per formulir; pilih hingga 25 kategori untuk edit nama atau hapus dengan konfirmasi. Menghapus kategori tidak menghapus channel anak, tetapi dapat mengubah aksesnya; periksa izin. Kategori pengelola dilindungi.

`#kelola-channel`: buat hingga 25 channel teks/suara, atau pilih hingga 25 channel untuk edit nama/hapus. Izin kategori disalin saat pembuatan. **Hapus channel menghapus riwayat secara permanen** setelah konfirmasi. Channel pengelola termasuk #kelola-slash-command dilindungi. Periksa izin efektif channel baru, termasuk role status, karena kunci chat bot dan overwrite lain dapat memengaruhinya. Pilihan tersimpan sementara maksimal 15 menit dan hilang saat bot restart.

## Hapus pesan dan salinan di #pesan-dihapus

1. Jalankan `/hapus-pesan` **di channel asal** sebagai anggota role Owner. Owner dan bot harus dapat melihat serta membaca riwayat channel; bot juga memerlukan **Manage Messages** di channel asal dan **Attach Files** di `#pesan-dihapus`. Kategori pengelola dan backup dilindungi dari command ini.
2. Gunakan **Berikutnya**, **Kembali ke awal**, atau **Cari pesan** untuk mencari teks, nama pengguna, atau ID pesan. Pencarian teks/nama memeriksa maksimal 500 pesan terbaru; pencarian berdasarkan ID tepat dapat menemukan pesan lebih lama yang masih dapat diakses. Hasil tidak selalu mencakup seluruh riwayat. Pilih 1–10 pesan, tekan **Lanjutkan**, periksa preview dan ID, lalu konfirmasi.
3. Sebelum menghapus setiap pesan, bot mengirim metadata serta **salinan isi, embed yang didukung dan lampiran** ke `🗄️ BACKUP` → `#pesan-dihapus` sebagai pesan Discord, bukan ZIP. Salinan dikirim oleh bot, **bukan oleh akun penulis asli**; header menunjukkan ID penulis, channel, pesan, dan waktu asal. Bot menonaktifkan ping pada salinan. Pesan sumber baru dihapus setelah salinan terkirim. Jika pengiriman, lampiran, atau pengecekan gagal, sumber dilewati. Jika sumber berubah, salinan dapat tetap ada tetapi sumber tidak dihapus.

Salinan bukan pemulihan otomatis: ID asli, status reply, reaksi, thread, dan tanggal tampilan Discord tidak bisa direproduksi persis. Tombol/komponen, stiker, polling, pesan terusan, dan embed otomatis/eksternal yang tidak didukung menyebabkan pesan sumber dilewati; media dari URL eksternal tidak diunduh. Maksimal empat lampiran per pesan, 3 MiB per lampiran, 6 MiB per aksi; hanya CDN Discord yang diizinkan. Lampiran terlalu besar atau tidak dapat diunduh menyebabkan pesan dilewati. Pesan lama yang sudah disimpan sebagai ZIP oleh versi sebelumnya tetap ada dan tidak dikonversi.

### Bersihkan atau backup dulu

Di `#pesan-dihapus`, panel memiliki dua tombol:
- **Bersihkan channel**: setelah konfirmasi, hapus hingga 25 pesan salinan terbaru **tanpa backup tambahan**. Penghapusan ini permanen.
- **Backup & bersihkan**: setelah konfirmasi, buat ZIP di `#riwayat-chat` terlebih dahulu, lalu hapus hingga 25 pesan yang berhasil dibackup. ZIP berisi folder per pesan dengan JSON dan file lampiran. Jika upload ZIP gagal, tidak ada pesan yang dihapus; pesan yang tidak dapat dibackup atau berubah dilewati.

Panel dipertahankan. Proses bertahap: ulangi untuk membersihkan lebih banyak pesan dan periksa laporan hasil. Batas aman per ZIP sekitar 4 MiB dan lampiran 3 MiB per file; pesan yang melebihi batas tetap ada. Isi di #pesan-dihapus dapat berasal dari channel privat, sehingga role Owner yang bisa melihat backup akan mendapat akses ke salinannya. Pemilik server dan Administrator tetap dapat melewati privasi Discord. Tentukan kebijakan penyimpanan dan jangan bagikan ZIP secara publik.

## Unduh riwayat chat teks

Di `🗄️ BACKUP` → `#riwayat-chat`, klik **Pilih channel**, pilih channel teks/pengumuman, dan tekan **Lanjutkan**. Bot hanya mengizinkan channel yang dapat dilihat dan dibaca riwayatnya oleh Owner yang meminta dan bot. Hasil adalah ZIP **privat sementara** berisi `riwayat.txt` dalam format JSON per baris: ID pesan, waktu, penulis, teks, dan jumlah lampiran. Riwayat menampilkan pesan yang masih tersedia, bukan pesan yang telah dihapus; file/gambar dan isi embed tidak diekspor.

Masing-masing bagian mengambil hingga **500 pesan**, dari terbaru ke terlama, dalam maksimal lima permintaan halaman. Jika masih ada, unduh ZIP bagian ini lebih dahulu, tunggu beberapa detik, lalu klik **Lanjutkan riwayat**. Tombol berikutnya mengganti pesan unduhan sebelumnya, sehingga unduh setiap ZIP sebelum melanjutkan. Ulangi untuk mengambil riwayat selanjutnya. Pilihan kedaluwarsa setelah 15 menit atau saat bot restart; mulai lagi bila kedaluwarsa. Jika tepat 500 pesan terakhir, bagian berikutnya mungkin kosong.

Hanya satu operasi pencarian/backup/ekspor/pembersihan berjalan per server, dengan jeda minimal lima detik antaroperasi dan jeda antarhalaman/pesan. Discord masih dapat menerapkan rate limit; library akan mengikutinya. Batas ini mengurangi beban, bukan jaminan bebas limit. Riwayat channel yang tidak didukung pemilih seperti thread harus diperiksa melalui Discord; fitur ekspor ini hanya mendukung channel teks dan pengumuman. Aktifkan Message Content Intent dan uji beberapa pesan sebelum mengandalkan hasil.

## Keamanan formulir feedback

Isi form diperlakukan sebagai data teks saja; bot tidak menjalankan atau mengevaluasi kode dari input dan tidak mengunduh tautan dalam feedback. Markdown di-escape, mention dinonaktifkan/diubah, dan awalan tautan HTTP(S) serta `www.` dinetralkan pada salinan yang diterima. Karakter kontrol tertentu dihapus. Batasnya satu kiriman per pengguna setiap 30 detik dan 30 kiriman per server setiap menit; batas ini bersifat sementara dalam memori dan direset saat restart. Bot dan Discord tetap tidak bisa menjamin keamanan semua tautan atau lampiran; jangan membuka konten mencurigakan.


## Keterbatasan

Bot tidak dapat mengetahui upaya kirim yang ditolak Discord; welcome mengingatkan pengguna untuk memilih role. `@everyone` adalah role dasar Discord; overwrite lain, Administrator dan bot lain dapat memengaruhi hasil. Izin channel privat tidak dapat menyembunyikan isi dari Administrator atau pemilik server. Periksa dengan akun uji biasa dan setiap server sebelum digunakan. Uji fitur setup, backup, role, form, izin command, aktivasi dan isolasi server secara langsung di lingkungan percobaan. Tidak ada jaminan bebas gangguan, penyalahgunaan, biaya, atau rate limit.
