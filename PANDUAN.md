# Panduan bot komunitas

## Isi dan pemasangan
ZIP ini berisi seluruh berkas proyek, termasuk `index.js`, `role.js`, `role-lock.js`, `setup.js`, `community.js`, `channel-management.js`, `welcome.js`, `package.json`, dan `package-lock.json`. Gunakan semua file pada folder proyek yang sama (jangan unggah hanya `index.js`). Tidak ada token atau folder `node_modules` di dalam ZIP.

1. Cadangkan repository dan pengaturan permission server saat ini. Salin isi folder `bot-discord` ke root proyek/repository yang digunakan Render, lalu commit dan push. Jika menggunakan Root Directory, pastikan mengarah ke folder yang benar. Jalankan build `npm ci` (atau `npm install`) dan start `npm start`.
2. Di environment Render atur `DISCORD_TOKEN` dan `GUILD_ID` yang benar. `WELCOME_CHANNEL_ID` tidak dipakai lagi: welcome dikirim khusus ke #announcements dan #diskusi. Jangan membagikan token. Aktifkan **Server Members Intent** di Discord Developer Portal.
3. Siapkan tepat satu role bernama `Owner`, atau atur `OWNER_ROLE_ID` ke ID role yang benar jika namanya berbeda atau ada duplikat. Anggota yang akan menggunakan panel dan `/setup-komunitas` harus memiliki role tersebut, termasuk pemilik server. Bot memerlukan **Manage Server** (untuk mematikan sambutan sistem bawaan), **Manage Channels**, **Manage Roles**, **View Channels**, **Send Messages**, **Read Message History**, **Embed Links**, dan **Attach Files** (di kanal pengaturan welcome, announcements, dan diskusi); letakkan role bot di atas role status yang dikelola. Pastikan izin ini efektif di kanal terkait.
4. Pastikan tepat satu kanal teks untuk masing-masing `#feedback-and-request`, `#announcements`, dan `#diskusi` tersedia. Untuk fitur role lama, pastikan kanal `#rules-and-role` dan masing-masing satu role `Pekerja`, `Pelajar`, `Umum` tersedia. Panel role bisa dikirim dengan `/panel-role` di kanal rules.
5. Setelah deploy dan slash command terdaftar, anggota ber-role Owner menjalankan **`/setup-komunitas`** di server yang `GUILD_ID`-nya sesuai. Jika command belum muncul, tunggu registrasi Discord atau coba restart. Perintah tidak menghapus channel, kategori, role, atau riwayat pesan. Jika terjadi error, periksa log dan izin bot lalu ulangi perintah.
6. Pengaturan akan membuat kategori `🔐 KELOLA KOMUNITAS` dengan `#kelola-kategori`, `#kelola-channel`, `#kelola-embed-welcome-member`, dan `#terima-form`, lalu memasang panel form di `#feedback-and-request`. Menjalankan perintah lagi mengamankan ulang overwrite kategori pengelola, keempat kanal privat, dan kanal feedback dan memasang panel yang belum ditemukan. Riwayat lama feedback tetap ada.

## Izin dan privasi
- `/setup-komunitas` **mengganti seluruh permission overwrite** kategori dan empat kanal privat tersebut, serta kanal `#feedback-and-request`, agar akses dan blokir chat bekerja. Overwrite khusus role/member yang pernah dibuat di lokasi itu akan dihapus. Konfigurasi akses lihat kanal feedback diatur agar anggota dapat melihatnya. Periksa hasilnya setelah pemasangan.
- Kategori dan keempat kanal pengelola disembunyikan dari `@everyone` dan dibuka untuk role Owner serta bot. **Discord selalu mengizinkan pemilik server dan anggota dengan permission Administrator melewati batasan kanal**; oleh sebab itu privasi tidak dapat dijamin terhadap mereka. Jangan berikan Administrator kepada role lain jika mereka tidak boleh melihat hasil form. Periksa pengaturan role dan akses efektif dengan akun uji.
- Anggota tanpa role status harus memilihnya dahulu untuk menggunakan form. Form memiliki judul dan isi; pengirim mendapat konfirmasi privat dan hasil dikirim ke `#terima-form` bersama nama dan ID Discord pengirim. Bot menolak pengiriman jika deteksi izin kanal inbox tidak aman. Jangan mengirim data rahasia bila akses server belum diverifikasi.
- `#feedback-and-request` menjadi read-only untuk anggota biasa; tombol formulir tetap bisa dipakai. Administrator tetap dapat melewati blokir chat. Role/permission khusus yang ditambahkan kemudian dapat mengubah hasil ini, jadi periksa kembali setelah mengubah izin.
- Bot tidak memberi role tambahan otomatis kepada anggota baru; `@everyone` adalah role bawaan Discord. Matikan auto-role dari bot/integrasi lain jika diperlukan. Discord tidak memberitahu bot tentang percobaan mengirim pesan yang ditolak izin; peringatan memilih role diberikan pada embed di #announcements. Bot tidak mengirim DM sambutan.

## Pengaturan embed welcome

1. Di `#kelola-embed-welcome-member`, tekan **Edit announcements** atau **Edit diskusi** untuk mengatur sambutan kedua channel secara terpisah.
2. Isi **Judul** dan **Isi pesan**. Untuk banner pilih salah satu cara:
   - **Unggah gambar** langsung di form: PNG, JPG, GIF, atau WebP, maksimal 8 MB. Gambar baru yang diunggah dipakai meskipun kolom URL terisi.
   - Atau isi **URL banner HTTPS** dengan tautan langsung ke gambar yang dapat diakses publik oleh Discord. URL baru menggantikan banner yang sebelumnya diunggah.
   - Untuk menghapus banner, isi kolom penghapusan dengan `HAPUS`. Jangan mengunggah file pada saat yang sama. Jika tidak ada file/URL baru dan kolom hapus kosong, banner sebelumnya tetap dipertahankan.
   Fitur upload menggunakan komponen form Discord terbaru; jika komponen tidak tampil, perbarui aplikasi Discord dan pastikan dependensi bot terpasang dari `package-lock.json`.
3. Variabel yang dapat digunakan: `{member}` (mention), `{username}`, `{server}`, `{member_count}`, dan `{role}`. Pada announcements role bernilai `belum dipilih`. Simpan untuk menerapkan pada sambutan berikutnya; pesan lama tidak berubah.

Saat member baru bergabung, bot mengirim **satu embed** ke `#announcements` tanpa DM dan tanpa otomatis menambahkan role. Setelah member baru berhasil memilih role status pertama kali melalui panel bot, bot mengirim **embed yang berbeda** ke `#diskusi`. Berpindah atau melepas role tidak mengirim welcome baru. Pesan role yang dipilih tetap mendapat konfirmasi privat di Discord; itu adalah respons tombol, bukan DM.

Bot mencatat status sambutan pada footer embed miliknya di `#announcements` agar welcome diskusi tidak dikirim berulang setelah restart. Jangan hapus atau mengubah embed tersebut sebelum anggota memilih role. Pengaturan judul, isi dan gambar yang diunggah disimpan di pesan bot pada kanal pengaturan privat, bukan pada filesystem sementara Render; jangan menghapus pesan konfigurasi bot beserta lampirannya. Jika dihapus, nilai bawaan akan dipakai sampai diatur ulang. Saat dikirim, gambar yang diunggah dilampirkan kembali ke embed. Jika unduhan lampiran Discord gagal, sambutan tetap dikirim tanpa gambar dan kesalahannya dicatat pada log `[WELCOME BANNER ERROR]`.

Bot harus online saat member bergabung dan saat memilih role. Jika sambutan announcements gagal/terhapus, sambutan diskusi tidak dapat ditautkan ke member tersebut. Jika pengiriman diskusi gagal, periksa log dan permission; role tetap diberikan dan tidak ada antrean retry otomatis. Gunakan hanya satu instance bot untuk menghindari duplikasi. Jika Discord gagal menyimpan tanda selesai setelah mengirim, sambutan duplikat masih mungkin terjadi pada percobaan ulang.

Bot mencoba mematikan notifikasi join sistem Discord saat startup dan saat `/setup-komunitas` tanpa mengubah flags lain; memerlukan izin Manage Server. Jika ada peringatan `[WELCOME SYSTEM]` atau command menyatakan gagal, matikan **Send a message when someone joins this server** pada Server Settings → Overview/System Messages, lalu uji lagi. Sambutan dari bot lain tetap harus dimatikan secara terpisah.

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
- **Hapus channel**: pilih hingga 25 channel, periksa daftar lengkap, lalu konfirmasi. **Penghapusan channel dan riwayatnya permanen**. Channel `#kelola-kategori`, `#kelola-channel`, `#kelola-embed-welcome-member`, dan `#terima-form` di kategori privat dilindungi agar tidak dapat diubah namanya atau dihapus dari panel. Channel lain, termasuk channel role dan form, dapat dihapus jika dipilih—periksa dengan teliti.

Pengelolaan mendukung edit/hapus channel teks, suara, announcement, stage, forum, dan media yang tersedia melalui pemilih Discord; thread tidak dikelola. Jika kategori yang diinginkan belum ada, buat dahulu lewat `#kelola-kategori`. Setelah perubahan, periksa hasil dan izin tiap channel; sebagian operasi dapat gagal bila izin bot tidak cukup atau Discord membatasi permintaan.

## Perhatian
Perintah lama **`/setup-server` bersifat merusak**: ia dapat menghapus/membuat ulang role, kanal beserta riwayat, dan aturan AutoMod. Jangan gunakan untuk memasang fitur baru pada server yang sudah digunakan; pakai `/setup-komunitas` saja. Jika tetap melakukan reset server, jalankan `/setup-komunitas` kembali setelahnya.

Pengujian lokal mencakup sintaks, validasi komponen Discord, dan simulasi izin, pemasangan, form, serta tambah/edit/hapus kategori dan channel, termasuk penyalinan izin kategori, konfigurasi welcome terpisah, unggah gambar/URL, dan alur role pertama. Belum diuji langsung pada server Discord Anda. Uji dengan satu akun Owner dan satu akun anggota biasa sebelum digunakan luas.
