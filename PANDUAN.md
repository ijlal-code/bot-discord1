# Panduan bot komunitas

## Isi dan pemasangan
ZIP ini berisi seluruh berkas proyek, termasuk `index.js`, `role.js`, `role-lock.js`, `setup.js`, `community.js`, `channel-management.js`, `member-management.js`, `register-commands.js`, `welcome.js`, `package.json`, dan `package-lock.json`. Gunakan semua file pada folder proyek yang sama (jangan unggah hanya `index.js`). Tidak ada token atau folder `node_modules` di dalam ZIP.

1. Cadangkan repository dan pengaturan permission server saat ini. Salin isi folder `bot-discord` ke root proyek/repository yang digunakan Render, lalu commit dan push. Jika menggunakan Root Directory, pastikan mengarah ke folder yang benar. Jalankan build `npm ci` (atau `npm install`) dan start `npm start`.
2. Di environment Render atur `DISCORD_TOKEN` dan `GUILD_ID` yang benar. `WELCOME_CHANNEL_ID` tidak dipakai lagi: welcome dikirim khusus ke #announcements dan #diskusi. Jangan membagikan token. Aktifkan **Server Members Intent** di Discord Developer Portal.
3. Siapkan tepat satu role bernama `Owner`, atau atur `OWNER_ROLE_ID` ke ID role yang benar jika namanya berbeda atau ada duplikat. Anggota yang akan menggunakan panel dan `/setup-komunitas` harus memiliki role tersebut, termasuk pemilik server. Bot memerlukan **Manage Server** (untuk mematikan sambutan sistem bawaan), **Manage Channels**, **Manage Roles**, **View Channels**, **Send Messages**, **Read Message History**, dan **Embed Links** (di kanal pengelola member, pengaturan welcome, announcements, dan diskusi); letakkan role bot di atas role status yang dikelola. Pastikan izin ini efektif di kanal terkait.
4. Pastikan tepat satu kanal teks untuk masing-masing `#announcements` dan `#diskusi` tersedia. Untuk form feedback, siapkan tepat satu `#feedback-and-request`; bila tidak ada atau duplikat, channel pengelola tetap dibuat dan bot memberi peringatan bahwa form dilewati. Untuk fitur role lama, pastikan kanal `#rules-and-role` dan masing-masing satu role `Pekerja`, `Pelajar`, `Umum` tersedia. Panel role bisa dikirim dengan `/panel-role` di kanal rules.
5. Setelah deploy dan slash command terdaftar, anggota ber-role Owner menjalankan **`/setup-komunitas`** di server yang `GUILD_ID`-nya sesuai. Jika command belum muncul, tunggu registrasi Discord atau coba restart. Perintah tidak menghapus channel, kategori, role, atau riwayat pesan. Jika terjadi error, periksa log dan izin bot lalu ulangi perintah. Jika feedback belum tersedia, kanal pengelola tetap dibuat; perbaiki feedback dan ulangi perintah untuk memasang form.
6. Pengaturan akan membuat kategori `🔐 KELOLA KOMUNITAS` dengan `#kelola-kategori`, `#kelola-channel`, `#kelola-embed-welcome-member`, `#kelola-member`, dan `#terima-form`, lalu memasang panel form di `#feedback-and-request`. Menjalankan perintah lagi mengamankan ulang overwrite kategori pengelola, kelima kanal privat, dan kanal feedback dan memasang panel yang belum ditemukan. Riwayat lama feedback tetap ada.

## Jika slash command tidak muncul

- Versi ini mendaftarkan `/setup-komunitas` dan `/onboarding-member` **langsung ke server pada `GUILD_ID`** saat bot menyala, agar lebih cepat dibanding command global. Gunakan ID server yang benar di environment Render, bukan ID channel atau aplikasi. Setelah deploy/restart, periksa log `[SLASH] /setup-komunitas siap untuk GUILD_ID ...` dan `[SLASH] /onboarding-member siap untuk GUILD_ID ...`. Jika muncul `[SLASH ERROR]`, baca pesan lengkapnya. Pada awal startup log `[CONFIG]` memperingatkan jika GUILD_ID belum diatur.
- Pastikan aplikasi bot sudah terpasang pada server dengan cakupan **`bot`** dan **`applications.commands`**, serta pengguna memiliki izin **Use Application Commands** di channel tersebut. Periksa juga pengaturan Integrations untuk mengizinkan command bagi role/channel yang diperlukan. Discord mungkin perlu waktu singkat untuk menyegarkan daftar; coba buka kembali aplikasi dan ketik `/onboarding-member` di `#diskusi`.
- Jika guild command sudah terpasang, bot menghapus hanya versi global lama dari dua command tersebut agar tidak ganda. Perintah aplikasi lain tidak dihapus. Jika registrasi server gagal, command global lama dipertahankan dan kesalahan ditulis di log.
- Setelah `/setup-komunitas` berhasil, cari `#kelola-member` di kategori privat `🔐 KELOLA KOMUNITAS`. Perintah harus dijalankan oleh anggota yang benar-benar memiliki role **Owner** (atau role yang ID-nya di `OWNER_ROLE_ID`); pemilik server tanpa role itu perlu ditambahkan ke role tersebut. Pastikan bot memiliki Manage Channels, Manage Roles, View Channels, Send Messages, dan Read Message History. Periksa peringatan dalam balasan dan log bila sebagian pemasangan gagal. Administrator dan pemilik server dapat melewati privasi channel Discord.
- Perintah `/onboarding-member` hanya bekerja di `#diskusi` server yang dikonfigurasi. Pemanggil harus memiliki salah satu role Pekerja/Pelajar/Umum atau Owner; isi onboarding yang muncul di channel bersifat publik.

## Izin dan privasi
- `/setup-komunitas` **mengganti seluruh permission overwrite** kategori dan lima kanal privat tersebut, serta kanal `#feedback-and-request`, agar akses dan blokir chat bekerja. Overwrite khusus role/member yang pernah dibuat di lokasi itu akan dihapus. Konfigurasi akses lihat kanal feedback diatur agar anggota dapat melihatnya. Periksa hasilnya setelah pemasangan.
- Kategori dan kelima kanal pengelola disembunyikan dari `@everyone` dan dibuka untuk role Owner serta bot. **Discord selalu mengizinkan pemilik server dan anggota dengan permission Administrator melewati batasan kanal**; oleh sebab itu privasi tidak dapat dijamin terhadap mereka. Jangan berikan Administrator kepada role lain jika mereka tidak boleh melihat hasil form. Periksa pengaturan role dan akses efektif dengan akun uji.
- Anggota tanpa role status harus memilihnya dahulu untuk menggunakan form. Form memiliki judul dan isi; pengirim mendapat konfirmasi privat dan hasil dikirim ke `#terima-form` bersama nama dan ID Discord pengirim. Bot menolak pengiriman jika deteksi izin kanal inbox tidak aman. Jangan mengirim data rahasia bila akses server belum diverifikasi.
- `#feedback-and-request` menjadi read-only untuk anggota biasa; tombol formulir tetap bisa dipakai. Administrator tetap dapat melewati blokir chat. Role/permission khusus yang ditambahkan kemudian dapat mengubah hasil ini, jadi periksa kembali setelah mengubah izin.
- Bot tidak memberi role tambahan otomatis kepada anggota baru; `@everyone` adalah role bawaan Discord. Matikan auto-role dari bot/integrasi lain jika diperlukan. Discord tidak memberitahu bot tentang percobaan mengirim pesan yang ditolak izin; peringatan memilih role diberikan pada embed di #announcements. Bot tidak mengirim DM sambutan.

## Mengatur bagian onboarding

Di `#kelola-embed-welcome-member`, terdapat tombol **Isi announcements**, **Bagian announcements**, **Isi diskusi**, dan **Bagian diskusi**. Pengaturan tiap channel terpisah. Pada menu **Bagian**, Anda dapat mengubah atau menyembunyikan:

- Nama Pengguna, Anggota Ke, dan Akun Dibuat: ubah teks dengan format `Judul | Isi`. Contohnya `Profil | {tag}`. Kosongkan satu kolom untuk menyembunyikan bagian itu.
- Footer/User ID: ubah teksnya atau kosongkan kolom footer untuk menyembunyikannya.
- Waktu pesan: isi `YA` untuk menampilkan atau `TIDAK` untuk menyembunyikan timestamp Discord. Waktu otomatis itu tidak bisa diubah ke waktu lain dari menu ini; teks tanggal lain dapat ditulis pada footer.

Variabel yang didukung di isi dan bagian: `{member}`, `{username}`, `{tag}`, `{id}`, `{server}`, `{member_count}`, `{role}`, `{account_created}`, `{rules}`, `{diskusi}`, dan `{template}`. `{member_count}` adalah **jumlah anggota server saat embed dibuat**, bukan nomor urut bergabung yang permanen. Isi maksimal 3.000 karakter; hasil penggantian variabel dapat dipotong agar tidak melewati batas Discord. Judul dan avatar masih otomatis, tanpa banner. Pengaturan umum berlaku untuk pesan berikutnya; perubahan umum tidak mengubah semua pesan lama.

## Kelola member dan slash command

1. Di kanal privat `#kelola-member`, Owner tekan **Edit onboarding member**, pilih member, dan ubah isi khususnya. Isinya menggantikan isi umum **hanya untuk member tersebut**; bagian field/footer mengikuti pengaturan umum `#diskusi`. Jika belum ada isi khusus, bot menggunakan isi diskusi umum.
2. Setelah disimpan, bot mencoba memperbarui **satu pesan onboarding terakhir member itu** di `#diskusi`. Pesan bot baru dilacak dari versi ini. Untuk pesan lama, bot hanya mencari hingga 1.000 pesan terakhir dan hanya mengubah pesan bot dengan `User ID` yang cocok di footer. Jika tidak ditemukan atau tidak bisa diedit, pengaturan tetap tersimpan; jalankan `/onboarding-member` untuk membuat pesan yang nantinya bisa diperbarui. Pesan lain tidak diubah secara massal.
3. Di `#diskusi`, gunakan **`/onboarding-member`** dan pilih pilihan `member` yang ingin ditampilkan. Perintah mengirim embed publik berisi onboarding dan informasi member yang dipilih. Hanya pemanggil yang memiliki role status Pekerja/Pelajar/Umum atau role Owner dapat menggunakan perintah ini. Akun bot bukan target. Jika target belum punya role dan tidak ada isi khusus, bot memberi tahu bahwa target belum memilih role.

**Penting:** Isi khusus dan informasi yang diaktifkan akan terlihat secara publik di `#diskusi` saat perintah dijalankan. Jangan masukkan data pribadi/rahasia. Kanal `#kelola-member` juga memuat pesan konfigurasi dan status onboarding yang dipakai bot; jangan hapus pesan-pesan tersebut. Anggota dengan Administrator dan pemilik server tetap dapat melihat kanal privat.

## Alur welcome dan migrasi

Saat member baru bergabung, bot mengirim embed onboarding ke `#announcements` tanpa DM atau auto-role. Setelah member itu berhasil memilih role pertama melalui panel bot, bot mengirim onboarding ke `#diskusi`. Berpindah atau melepas role tidak mengirim ulang. Konfirmasi tombol role bersifat privat di Discord, bukan DM.

Mulai versi ini status join dicatat secara privat di `#kelola-member`, bukan di footer publik, sehingga footer dapat benar-benar disembunyikan. Status pada footer lama tetap didukung untuk anggota yang telah bergabung sebelum pembaruan. Bot harus online saat anggota bergabung dan memilih role; pastikan `/setup-komunitas` berhasil dan bot dapat menulis ke #kelola-member. Jika pengiriman atau pencatatan gagal, periksa log; tidak ada antrean retry otomatis. Gunakan satu instance bot; kegagalan menyimpan status setelah mengirim dapat mengakibatkan duplikasi saat percobaan ulang.

Isi onboarding versi sebelumnya dipertahankan. Pengaturan banner versi lama tetap tidak dipakai dan tidak dihapus. Pengaturan baru disimpan pada pesan bot di kanal privat, bukan filesystem sementara Render. Jangan hapus pesan konfigurasi. Bot mencoba mematikan notifikasi join sistem Discord saat startup dan saat `/setup-komunitas`; jika ada peringatan `[WELCOME SYSTEM]`, berikan Manage Server atau matikan notifikasi join sistem pada Server Settings → Overview/System Messages. Bot lain perlu diatur terpisah.

## Cara mengelola kategori
Di `#kelola-kategori`, tekan:
- **Tambah kategori**: isi satu nama per baris, maksimal 25 per pengiriman.
- **Edit kategori**: pilih hingga 25 kategori dari pemilih Discord, lalu ubah nama setelah `ID |` pada masing-masing baris. Jangan ubah atau hapus ID. Tekan submit untuk menerapkan.
- **Hapus kategori**: pilih hingga 25 kategori, periksa daftar lengkap, kemudian konfirmasi. Menghapus kategori **tidak menghapus kanal di dalamnya**; kanal kehilangan kategorinya dan izin perlu diperiksa kembali. Kategori kelola komunitas dilindungi dari edit/hapus melalui panel.

Setiap operasi dijalankan satu per satu; hasil menampilkan jumlah berhasil dan gagal. Jika bot restart atau lebih dari 15 menit berlalu saat konfirmasi/edit, pilih ulang kategori. Jika ada beberapa instance bot, gunakan satu instance agar sesi interaksi tidak hilang.

## Cara mengelola channel

Di `#kelola-channel`, tekan:
- **Tambah channel**: pilih satu kategori, pilih jenis **teks** atau **suara**, lalu masukkan satu nama per baris (maksimal 25). Izin kategori disalin secara eksplisit saat channel dibuat. Sistem kunci role bot dapat mengubah overwrite `@everyone` pada channel baru; periksa akses efektifnya. Untuk membuka chat bagi role status di channel baru, atur izin sesuai kebutuhan tanpa membuka chat bagi anggota yang belum memilih role.
- **Edit channel**: pilih hingga 25 channel dan ganti nama setelah `ID |` pada setiap baris. Jangan ubah atau hapus ID. Edit di panel ini hanya mengganti nama; untuk topik, kategori, dan izin gunakan pengaturan Discord.
- **Hapus channel**: pilih hingga 25 channel, periksa daftar lengkap, lalu konfirmasi. **Penghapusan channel dan riwayatnya permanen**. Channel `#kelola-kategori`, `#kelola-channel`, `#kelola-embed-welcome-member`, `#kelola-member`, dan `#terima-form` di kategori privat dilindungi agar tidak dapat diubah namanya atau dihapus dari panel. Channel lain, termasuk channel role dan form, dapat dihapus jika dipilih—periksa dengan teliti.

Pengelolaan mendukung edit/hapus channel teks, suara, announcement, stage, forum, dan media yang tersedia melalui pemilih Discord; thread tidak dikelola. Jika kategori yang diinginkan belum ada, buat dahulu lewat `#kelola-kategori`. Setelah perubahan, periksa hasil dan izin tiap channel; sebagian operasi dapat gagal bila izin bot tidak cukup atau Discord membatasi permintaan.

## Perhatian
Perintah lama **`/setup-server` bersifat merusak**: ia dapat menghapus/membuat ulang role, kanal beserta riwayat, dan aturan AutoMod. Jangan gunakan untuk memasang fitur baru pada server yang sudah digunakan; pakai `/setup-komunitas` saja. Jika tetap melakukan reset server, jalankan `/setup-komunitas` kembali setelahnya.

Pengujian lokal mencakup sintaks, validasi komponen Discord, dan simulasi izin, pemasangan, form, serta tambah/edit/hapus kategori dan channel, termasuk penyalinan izin kategori, pengaturan tampilan onboarding, kelola member, registrasi command per server, pembaruan pesan dan alur role pertama. Belum diuji langsung pada server Discord Anda. Uji dengan satu akun Owner dan satu akun anggota biasa sebelum digunakan luas.
