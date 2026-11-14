# Panduan bot komunitas multiserver — versi pengembangan

Satu proses bot dan satu aplikasi Discord melayani beberapa server secara bersamaan. Aktivasi dan pilihan akses disimpan per ID server di MongoDB. Template welcome, profil member, referensi pesan, backup dan konfigurasi fitur lama tetap disimpan dalam channel Discord privat masing-masing server; **tidak dipindahkan ke MongoDB**. Data lama di channel tidak dihapus atau dimigrasikan otomatis. Konten default masih membawa merek, tautan dan email Ainun Ijlal Studio; periksa dan sesuaikan sebelum digunakan di komunitas lain.

## Perhatian sebelum memperbarui

- Gunakan server uji dan cadangan. Ini adalah versi pengembangan, belum diuji langsung pada Discord, Render, atau MongoDB Anda, dan belum siap dijual sebagai layanan komersial tanpa uji integrasi, audit keamanan, kebijakan privasi, backup, pemantauan dan pengaturan lisensi/pembayaran. Tidak ada sistem pembayaran atau lisensi.
- Enam command bawaan bot yang dikenal kini default-nya tersembunyi untuk member biasa. Hak akses khusus/overwrite Integrations yang sudah ada **tidak dihapus otomatis** dan bisa membuat command lama tetap terlihat. Periksa tiap server dan command global lama. Administrator Discord tetap bisa melihat/menjalankan command menurut aturan Discord, tetapi bot juga memeriksa izin saat menjalankan.
- Registrasi command global pada startup memperbarui default permission command global bot yang dikenal **di seluruh server aplikasi ini**. Tidak menghapus command lain atau overwrite yang sudah ada; pastikan semua server yang memakai bot siap untuk perubahan ini.
- `WELCOME_CHANNEL_ID` (yang sebelumnya berisi ID server) dan `OWNER_ROLE_ID` global tidak digunakan lagi. Tidak perlu menghapus env lama, tetapi tidak mengubah server dengan mengedit kedua nilai tersebut. Setiap server diaktifkan lewat dashboard dan harus memiliki tepat satu role bernama `Owner` (huruf besar/kecil sesuai). Owner harus memiliki role ini, termasuk pemilik server.
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

## 3. Aktifkan server dari dashboard

1. Undang bot ke server. Pastikan tepat satu role `Owner` ada dan akun yang masuk memilikinya. Selain itu akun harus punya **Manage Server** dan **Manage Roles**, atau menjadi pemilik server. Ini juga membantu memenuhi persyaratan Discord untuk mengelola izin command.
2. Buka URL Render dan klik **Masuk dengan Discord**; setujui scope `identify`, `guilds`, dan `applications.commands.permissions.update`. Token OAuth disimpan sementara di memori proses, bukan di MongoDB; sesi habis paling lama sekitar satu jam atau saat restart/logout. Jangan bagikan sesi atau token.
3. Klik **Aktifkan** pada server, atau masukkan ID server pada kolom di dashboard. Bot harus sudah ada dalam server. Dashboard memverifikasi keanggotaan dan izin ulang di server tersebut sebelum mendaftarkan command dan menyimpan ID-nya. Daftar menampilkan paling banyak 50 server pertama dari respons Discord; ID server bisa dimasukkan secara manual bila tidak tercantum.
4. Jalankan `/setup-komunitas` pada server tersebut untuk membuat/memperbarui panel privat, termasuk `#kelola-slash-command`. Jika role Owner bukan Administrator dan perintah tidak terlihat, desktop Discord → Server Settings → Integrations → aplikasi bot → `/setup-komunitas` → berikan akses role Owner. Atur juga `/hapus-pesan` untuk Owner bila dibutuhkan. User harus punya izin Use Application Commands.
5. **Perhatian izin:** `/setup-komunitas` mengganti overwrite kategori dan channel pengelola, kategori backup dan kedua channel-nya, serta `#feedback-and-request` bila ada. Izin khusus pada lokasi tersebut dapat hilang; periksa kembali. Saat startup bot tidak otomatis mengubah role/channel atau menerapkan kunci chat; gunakan `/kunci-chat` setelah meninjau izin jika dibutuhkan.
6. Mengklik **Nonaktifkan** menghentikan pemrosesan server oleh bot dan menghapus pilihan akses member dari MongoDB; data channel dan riwayat tetap ada. Perintah yang sudah terdaftar dan overwrite Discord **tidak dihapus**, sehingga bisa tetap terlihat walau bot menolak penggunaannya. Atur Integrations atau hapus bot secara manual bila ingin menghilangkannya. Mengaktifkan kembali mendaftarkan ulang command, lalu lakukan pengaturan member ulang.
7. Jika bot dikeluarkan dari server, aplikasi mencoba menonaktifkannya di MongoDB. Jika database sedang gagal, verifikasi status manual sebelum restart atau undang ulang.

## 4. Pilih command untuk member

1. Login ulang ke dashboard dengan akun yang sama bila sesi telah habis. Di Discord, sebagai role Owner, jalankan `/setup-komunitas`, lalu buka `🔐 KELOLA KOMUNITAS` → `#kelola-slash-command`.
2. Klik **Pilih perintah**, pilih `/onboarding-member` atau **Tidak ada**, lalu **Terapkan**, atau **Batal**. Saat ini hanya `/onboarding-member` yang dianggap aman untuk member. Perintah reset, hapus, setup dan pengelola tidak dapat dibuka ke member melalui panel ini; menambahkan pilihan lain memerlukan implementasi pengecekan akses terlebih dahulu.
3. Bot memakai OAuth akun yang login untuk mengganti **seluruh overwrite permission** `/onboarding-member` versi guild: @everyone, role Owner, semua channel dan #diskusi. Overwrite individual sebelumnya untuk command itu akan tertimpa. Pengaturan ini tidak mengubah command lain. User OAuth harus dapat menjalankan command tersebut serta mempunyai Manage Server, Manage Roles dan hak mengelola resource terkait. Jika gagal, login ulang; periksa izin dan bila perlu berikan akses Owner ke command tersebut di Discord Integrations sebelum menerapkan.
4. Discord dapat menerapkan izin channel juga pada thread. Bot tetap memeriksa ID channel #diskusi, server aktif, pilihan perintah, dan role status sebelum memproses member; thread tidak didukung. Jika #diskusi dibuat ulang, pilih dan terapkan lagi.
5. Mengubah Integrations secara manual tidak menyinkronkan pilihan ke MongoDB; panel adalah sumber perubahan yang disarankan. Hak Discord lain, khususnya Administrator dan overwrite lama/perintah global lama, dapat memengaruhi visibilitas. Jika penyimpanan MongoDB gagal sesudah perubahan Discord, command mungkin terlihat tetapi bot menolak; perbaiki database lalu terapkan lagi. Discord membatasi API; ini tidak menjamin bebas rate limit.

**Perintah reset:** `/setup-server` lama tetap ada tetapi memerlukan role Owner, Administrator, dan konfirmasi. Ia dapat menghapus channel, riwayat, role dan aturan AutoMod secara permanen serta menciptakan ulang struktur dengan merek lama. Jangan gunakan untuk upgrade; gunakan `/setup-komunitas`. Backup terlebih dahulu.

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

Bot tidak dapat mengetahui upaya kirim yang ditolak Discord; welcome mengingatkan pengguna untuk memilih role. `@everyone` adalah role dasar Discord; overwrite lain, Administrator dan bot lain dapat memengaruhi hasil. Izin channel privat tidak dapat menyembunyikan isi dari Administrator atau pemilik server. Periksa dengan akun uji biasa dan setiap server sebelum digunakan. Uji fitur reset, backup, role, form, izin command, aktivasi dan isolasi server secara langsung di lingkungan percobaan. Tidak ada jaminan bebas gangguan, penyalahgunaan, biaya, atau rate limit.
