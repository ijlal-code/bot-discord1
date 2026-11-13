# Panduan bot komunitas

## Pemasangan dan pembaruan

1. Cadangkan repository dan izin server. Salin **semua** file dari folder `bot-discord` ke root repository Render (termasuk `editor-template.js` dan `message-management.js`). Commit dan deploy. Build: `npm ci`; start: `npm start`. Jangan unggah `node_modules` atau token ke repository.
2. Atur environment `DISCORD_TOKEN` dan **`WELCOME_CHANNEL_ID`** (walaupun namanya CHANNEL, isinya harus ID **server**, bukan ID channel/aplikasi). `OWNER_ROLE_ID` opsional bila nama role bukan `Owner` atau terdapat duplikat. Aktifkan **Server Members Intent** dan **Message Content Intent** di Discord Developer Portal → Bot. Message Content Intent wajib untuk isi pesan dan lampiran pengguna; tanpa akses ini bot dapat gagal terhubung atau menerima data kosong. Bot terverifikasi mungkin memerlukan persetujuan Discord. Bot menggunakan `WELCOME_CHANNEL_ID` sebagai ID server dan tidak membaca `GUILD_ID`. Bot membaca kedua nilai hanya dari environment; tidak ada ID server cadangan di kode. Jika salah satu tidak tersedia, bot berhenti. Jangan bagikan token.
3. Bot memerlukan izin Manage Server (untuk mematikan welcome sistem), Manage Channels, Manage Roles, View Channels, Send Messages, Read Message History, Embed Links, Attach Files, dan izin efektif pada channel terkait. Posisi role bot harus di atas role status. Pastikan role `Pekerja`, `Pelajar`, dan `Umum`, serta satu `#rules-and-role` dan satu `#diskusi`, tersedia. Member baru perlu izin **View Channel** dan **Read Message History** di `#diskusi` agar melihat welcome sebelum memilih role; tidak perlu izin kirim pesan.
4. Jalankan **`/setup-komunitas`** sebagai anggota yang benar-benar memiliki role Owner (atau role `OWNER_ROLE_ID`), termasuk bila Anda pemilik server. Perintah memasang/memperbarui panel dan menyiapkan kategori `🔐 KELOLA KOMUNITAS` dengan enam channel privat: `#kelola-kategori`, `#kelola-channel`, `#kelola-embed-welcome-member`, `#kelola-member`, `#edit-pesan-channel-awal`, dan `#terima-form`. Setup juga membuat kategori privat `🗄️ BACKUP` berisi `#pesan-dihapus` dan `#riwayat-chat`.
5. Jika satu `#feedback-and-request` tersedia, perintah juga memasang panel formulir dan menata izinnya. Jika tidak ada atau duplikat, channel pengelola tetap dibuat dan peringatan ditampilkan.

**Penting:** `/setup-komunitas` mengganti seluruh permission overwrite kategori pengelola, keenam channel privat, kategori BACKUP dan kedua channel-nya, dan `#feedback-and-request` bila ada. Overwrite khusus sebelumnya di lokasi tersebut akan terhapus. Periksa akses setelahnya. Pemilik server dan anggota berizin Administrator dapat melewati privasi Discord. Perintah ini tidak menghapus channel atau riwayat pesan.

## Welcome dan onboarding di #diskusi

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

Di `#diskusi`, gunakan `/onboarding-member` lalu pilih `member`. Pemanggil harus memiliki role Owner, Pekerja, Pelajar, atau Umum. Pesan hasilnya publik; jangan masukkan data rahasia. Member tanpa profil khusus menggunakan template umum. Akun bot tidak dapat dipilih.

## Edit pesan awal channel

Setelah `/setup-komunitas`, buka `#edit-pesan-channel-awal` dan klik **Pilih channel & pesan**. Pilih channel teks atau pengumuman di kategori mana pun yang dapat dilihat dan dibaca riwayatnya oleh Owner dan bot. Pilih pesan bot yang ingin diubah. Editor menampilkan hingga 25 pesan embed bot terawal dari 1.000 pesan awal channel. Discord tidak mengizinkan bot mengedit pesan milik pengguna atau bot lain; forum/thread serta pesan konfigurasi pengelola dan backup dilindungi/tidak didukung.

Formulir mengedit **pesan yang dipilih**, bukan membuat pesan baru: teks di luar embed, author, judul, isi embed pertama, field, footer, dan waktu. Untuk field, isi satu baris per field: `Judul | Isi | YA` (inline) atau `Judul | Isi | TIDAK` (tidak inline); gunakan `\n` untuk baris baru di isi field. Kosongkan daftar untuk menghapus semua field. Tombol interaktif seperti role/form, lampiran, gambar, warna, thumbnail, dan embed lainnya dipertahankan, tidak diedit. Pesan yang melebihi batas formulir ditolak tanpa perubahan. Jika pesan berubah saat formulir terbuka, pilih ulang agar tidak menimpa perubahan lain.

## Tombol Batal dan pengelolaan

Pada dropdown di panel kategori, channel, member, editor pesan awal, backup dan hapus pesan: pilih opsi lalu tekan **Lanjutkan**. Bila formulir ditutup tanpa menyimpan, tekan **Lanjutkan** lagi pada pesan pilihan yang masih ada; tidak perlu membuka panel dari awal. Tombol **Batal** menutup/menghapus pesan pilihan privat tanpa menerapkan perubahan. Konfirmasi hapus kategori/channel juga memiliki Batal. Modal bawaan Discord dapat ditutup tanpa menyimpan.

`#kelola-kategori`: tambah hingga 25 nama per formulir; pilih hingga 25 kategori untuk edit nama atau hapus dengan konfirmasi. Menghapus kategori tidak menghapus channel anak, tetapi dapat mengubah aksesnya; periksa izin. Kategori pengelola dilindungi.

`#kelola-channel`: buat hingga 25 channel teks/suara, atau pilih hingga 25 channel untuk edit nama/hapus. Izin kategori disalin saat pembuatan. **Hapus channel menghapus riwayat secara permanen** setelah konfirmasi. Keenam channel pengelola dilindungi. Periksa izin efektif channel baru, termasuk role status, karena kunci chat bot dan overwrite lain dapat memengaruhinya. Pilihan tersimpan sementara maksimal 15 menit dan hilang saat bot restart.

## Hapus pesan dan salinan di #pesan-dihapus

1. Jalankan `/hapus-pesan` **di channel asal** sebagai anggota role Owner (atau `OWNER_ROLE_ID`). Owner dan bot harus dapat melihat serta membaca riwayat channel; bot juga memerlukan **Manage Messages** di channel asal dan **Attach Files** di `#pesan-dihapus`. Kategori pengelola dan backup dilindungi dari command ini.
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

## Jika command tidak muncul

`/setup-komunitas`, `/onboarding-member`, dan `/hapus-pesan` didaftarkan langsung ke server pada `WELCOME_CHANNEL_ID` saat startup. Periksa log `[SLASH]` atau `[SLASH ERROR]`. Pastikan aplikasi diundang dengan cakupan `bot` dan `applications.commands`, pengguna memiliki Use Application Commands, dan pengaturan Integrations mengizinkan role/channel terkait. Buka ulang Discord bila perlu. Perintah global lain tetap dipertahankan. Bila registrasi server gagal, command global lama dipertahankan.

## Batasan dan pengujian

Discord tidak memberi bot informasi tentang upaya kirim pesan yang ditolak, jadi bot tidak dapat memperingatkan setiap percobaan tersebut; welcome meminta member memilih role. `@everyone` adalah role dasar Discord. Izin khusus, Administrator, atau bot auto-role lain dapat mengubah akses; periksa dengan akun uji.

**Jangan gunakan `/setup-server` untuk memperbarui bot:** perintah lama itu dapat menghapus/membuat ulang channel, riwayat, role, dan aturan AutoMod. Gunakan `/setup-komunitas` saja.

Pengujian proyek berupa simulasi lokal, bukan pengujian langsung di server Discord/Render Anda. Uji dahulu dengan satu akun Owner dan satu akun member biasa.
