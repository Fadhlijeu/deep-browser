# Peta Arsitektur Konten & Inventaris Frontend UI Deep-Browser

Dokumen ini merupakan panduan inventarisasi struktural seluruh antarmuka pengguna (Frontend UI) yang ada di dalam Deep-Browser. Dokumen ini berfokus murni pada **konten, data, hierarki informasi, kontrol interaktif, dan fungsionalitas**, tanpa membahas styling visual atau aturan CSS. Dokumen ini disiapkan sebagai basis spesifikasi sebelum melakukan perancangan ulang (redesign).

---

## 1. Peta Ekosistem Antarmuka Pengguna

Deep-Browser memiliki 2 lapisan antarmuka utama yang berinteraksi langsung dengan pengguna:
1. **Sidepanel Extension (Shell Utama)**: Panel kontrol AI di samping browser tempat pengguna berinteraksi melalui chat, memantau riwayat tindakan, mengatur sesi, dan mengelola konfigurasi mesin.
2. **In-Page Injected HUD (Overlay di Halaman Web)**: Elemen visual yang disuntikkan langsung ke halaman web target untuk menampilkan status otonom dan memandu interaksi elemen.

---

## 2. Inventaris Konten Sidepanel Extension

```
[Sidepanel Root Shell]
│
├── 1. Topbar (Header Navigasi Utama)
│    ├── Tombol Menu Sesi (Laci Riwayat)
│    ├── Ikon Identitas Browser Aktif (Chrome / Edge)
│    ├── Pill Status Koneksi Engine & Aksi Cepat Online
│    ├── Penghitung Langkah Otonom (Step Counter)
│    ├── Pengalih Tampilan (Chat vs Logs) + Badge Jumlah Event
│    ├── Tombol Pasang / Lepas Jendela (Dock / Pop-Out)
│    ├── Tombol Buat Sesi Baru
│    └── Tombol Pengaturan & Kebijakan Engine
│
├── 2. Area Tampilan Utama (Dua Mode Tampilan)
│    ├── A. Tampilan Chat & Timeline (Default View)
│    │    ├── Kondisi Kosong (Empty State)
│    │    │    ├── Judul Aplikasi & Deskripsi Kemampuan
│    │    │    └── Daftar Kartu Rekomendasi Prompt 1-Klik
│    │    │
│    │    ├── Pesan Pengguna (User Message)
│    │    │    ├── Teks Prompt Pengguna
│    │    │    ├── Waktu Pengiriman Pesan
│    │    │    └── Tombol Salin Teks
│    │    │
│    │    └── Pesan Asisten / AI (Assistant Message)
│    │         ├── Strip Metadata Respon (Model AI, Waktu, Tombol Salin Respon)
│    │         ├── Akordeon Timeline Tindakan Browser (Riwayat Tool Step)
│    │         │    ├── Header Akordeon (Status expand/collapse, Total langkah)
│    │         │    └── Daftar Kartu Tindakan (ToolStepCard):
│    │         │         ├── Identitas Tool & Nama Aksi
│    │         │         ├── Durasi Waktu Eksekusi
│    │         │         ├── Tag Status (Succeeded / Running / Failed)
│    │         │         └── Detail Rinci (Waktu, Argumen JSON, Hasil JSON, Bukti Verifikasi DOM, Pesan Error, Tombol Salin)
│    │         ├── Akordeon Penalaran Agen (Thought / Inner Monologue)
│    │         │    ├── Header Akordeon Penalaran
│    │         │    └── Isi Monolog Berpikir & Logika Analisis AI
│    │         ├── Kartu Interaksi & Konfirmasi Manusia (HITL Card)
│    │         │    ├── Tag Jenis Interaksi (Approval, Pilihan, Input Teks, Input Angka, Menunggu CAPTCHA)
│    │         │    ├── Pertanyaan Utama & Konteks Aksi Sensitif
│    │         │    ├── Pratinjau Parameter Perintah Sensitif (JSON)
│    │         │    ├── Kontrol Masukan Interaktif (Tombol Opsi, Checkbox Multi-Opsi, Input Teks Modifikasi, Stepper Angka)
│    │         │    └── Tombol Aksi (Setujui [A], Tolak [R], Ubah [E], Lanjutkan)
│    │         ├── Badan Respon Akhir (Markdown & Math Renderer):
│    │         │    ├── Hierarki Teks (Heading 1-4, Paragraf, Kutipan, Hyperlink)
│    │         │    ├── Blok Kode Sintaksis + Tombol Salin Kode
│    │         │    ├── Tabel Data Responsif (Kolom & Baris)
│    │         │    └── Rumus Matematika / Formula Sains (KaTeX)
│    │         └── Banner Peringatan Kesalahan (Jika tugas gagal)
│    │
│    └── B. Tampilan Event Logs (Tampilan Diagnostik)
│         ├── Bilah Pencarian Event
│         ├── Tombol Salin Seluruh Riwayat Log
│         ├── Barisan Filter Kategori (Semua, Tools, Approvals, Errors, Verifications)
│         └── Daftar Kartu Entri Log (Kategori, Waktu, Pesan, Data JSON)
│
├── 3. Komposer Masukan (Bottom Composer Dock)
│    ├── Barisan Slider Preset Agen:
│    │    ├── Tombol Navigasi Geser Kiri / Kanan
│    │    └── Pilihan Mode Preset:
│    │         ├── Auto (Default)
│    │         ├── Research (Riset Multi-Tab)
│    │         ├── Extraction (Pengambilan Data)
│    │         ├── Form Fill (Pengisian Formulir)
│    │         └── Read-Only (Hanya Membaca)
│    ├── Kolom Masukan Teks (Textarea Elastis):
│    │    ├── Kotak Teks Multiline
│    │    ├── Teks Panduan (Placeholder)
│    │    └── Kontrol Keyboard (Enter = Kirim, Shift+Enter = Baris Baru)
│    └── Footer Kontrol Komposer:
│         ├── Tombol Pemilih Model AI Aktif (Nama Model & Trigger Modal)
│         └── Tombol Eksekusi Dual-State (Kirim Perintah saat idle / Hentikan saat berjalan)
│
└── 4. Dialog Modal & Laci Pengaturan
     ├── Laci Riwayat Sesi (Session Drawer)
     │    ├── Daftar Riwayat Sesi Percakapan
     │    ├── Status Sesi Aktif
     │    ├── Tombol Ganti Sesi & Hapus Sesi
     │    └── Tombol Buat Sesi Baru & Bersihkan Sesi
     │
     ├── Modal Mode & Kebijakan Engine (Settings Modal)
     │    ├── Pilihan Tingkat Otonomi Agen:
     │    │    ├── Agent Decide (Keputusan adaptif dinamis)
     │    │    ├── Always Proceed (Eksekusi otomatis cepat tanpa jeda)
     │    │    └── Request Review (Konfirmasi sebelum aksi)
     │    ├── Toggle Integrasi Otomatis Sidepanel
     │    ├── Toggle Visual Index Labeling ([1], [2], ...)
     │    ├── Tombol Buka di Jendela Melayang (Pop-Out)
     │    ├── Pilihan Mode Koneksi Engine:
     │    │    ├── Auto-On (Rekomendasi)
     │    │    ├── In-Browser Mandiri (Tanpa Python Backend)
     │    │    └── Backend Daemon Saja (ws://127.0.0.1:7788)
     │    └── Tombol Pintasan Kelola Kunci API
     │
     ├── Modal Pemilihan Model AI (Models Modal)
     │    ├── Daftar Model yang Didukung (Gemini 2.0 Flash, Flash Lite, Pro, GPT-4o, Claude 3.5, DeepSeek, Llama 3)
     │    ├── Label Provider (Google, OpenAI, Anthropic, Custom, Ollama)
     │    └── Indikator Model Terpilih
     │
     └── Modal Manajemen Kunci API (ApiKeysModal)
          ├── Catatan Privasi & Keamanan Lokal
          ├── Kolom Input Kunci API per Penyedia (Gemini, OpenAI, Claude, DeepSeek, Ollama Endpoint)
          └── Tombol Simpan Kunci & Batal
```

---

## 3. Inventaris Konten In-Page Overlay (Di Halaman Web Target)

Komponen ini tidak berada di sidepanel, melainkan disuntikkan ke dalam tab web tempat agen sedang bekerja:

1. **Floating Island HUD (Dynamic Island)**:
   - *Status Kapsul Mini*: Titik indikator status eksekusi, ringkasan tugas aktif, tombol perluas.
   - *Status Jendela Melayang Lengkap*:
     - Gagang geser (drag handle) untuk memindahkan jendela di layar.
     - Aliran lini masa aktivitas browser (activity stream).
     - Kartu progres riset paralel per-tab (Topik riset, persentase progress bar, status selesai).
     - Kartu struktur HTML hasil ekstraksi dengan tombol salin.
     - Kartu dokumen PDF yang diunduh.
     - Kontrol aksi: Jeda/Lanjutkan (Pause/Resume), Berhenti (Stop), Tutup jendela floating.

2. **Visual Index Badging (`[1]`, `[2]`, ...)**:
   - Angka indeks numerik tepat di atas setiap tombol, input, dan tautan interaktif pada halaman web.
   - Membantu pengguna dan vision engine melihat elemen persis mana yang sedang ditarget.

3. **Kotak Sorotan Target (Target Pulse Box)**:
   - Kotak penanda elemen yang sedang dieksekusi secara aktif (sedang diklik atau sedang diketik).

4. **Kursor Agen Virtual (Agent Cursor Simulator)**:
   - Kursor pointer buatan yang bergerak melintasi koordinat layar saat agen melakukan klik atau scroll, memberikan umpan balik visual bahwa peramban sedang dikendalikan.

---

## 4. Evaluasi Konten & Saran Inovasi untuk Redesign

Berikut adalah usulan saran struktural, hierarki informasi, dan pengalaman pengguna (UX) untuk rencana redesign Anda:

---

### Saran 1: Penyederhanaan Topbar & Pengelompokan Berbasis Konteks
* **Kondisi Saat Ini**: Topbar menampung banyak kontrol sekaligus dalam satu baris sempit (Menu, Brand, Status koneksi, Tombol Go Online, Step counter, Tab Chat/Logs, Pop-out, Sesi baru, Pengaturan).
* **Usulan Redesign Konten**:
  - **Satu Titik Pusat Status**: Gabungkan status koneksi, model aktif, dan step counter ke dalam satu *Status Pill* ringkas yang bisa diklik untuk membuka ringkasan status sistem (drawer/popover).
  - **Pindahkan Aksi Sesi Baru**: Sesi baru dan riwayat sesi dapat diintegrasikan langsung ke dalam satu dropdown atau navigasi tab atas yang lebih intuitif.
  - **Quick Action Bar Minimalis**: Cukup sediakan 3 aksi primer di kanan: Status Engine, Switcher Chat/Logs, dan Menu Opsi Lainnya (Pengaturan, Pop-out).

---

### Saran 2: Penguatan Komposer Masukan (Composer Ergonomics)
* **Kondisi Saat Ini**: Komposer hanya memiliki textarea polos, slider preset di atasnya, serta selector model di bawahnya.
* **Usulan Redesign Konten**:
  - **Dukungan Perintah Cepat (Slash Commands `/`)**:
    - Pengguna bisa mengetik `/research [topik]`, `/extract [target]`, `/fill [data]`, atau `/summarize` tanpa harus mengklik slider preset di atas. Ini menghemat ruang vertikal secara drastis.
  - **Indikator Konteks Tab Aktif (Target Tab Pill)**:
    - Tampilkan pill kecil di dalam komposer yang memberitahu URL atau judul halaman web yang saat ini menjadi target eksekusi (contoh: `Target: github.com/Fadhlijeu`). Pengguna akan merasa yakin tab mana yang akan dikendalikan.
  - **Pilihan Lampiran Data / Konteks**:
    - Tombol untuk menyertakan teks yang sedang diseleksi di halaman web (*"Gunakan teks yang diseleksi"*).

---

### Saran 3: Struktur Bubble Asisten & Bukti Verifikasi
* **Kondisi Saat Ini**: Pesan asisten menampilkan metadata model, akordeon langkah, akordeon penalaran, kartu konfirmasi, dan jawaban markdown.
* **Usulan Redesign Konten**:
  - **Satu "Process Drawer / Step Bar" Terpadu**:
    - Alih-alih memisahkan antara "Langkah Tindakan Browser" dan "Penalaran Agen", satukan proses tersebut dalam bentuk *Audit Trail* linear: `[Penalaran] -> [Aksi: Klik Elemen] -> [Verifikasi: Berhasil]`.
  - **Kartu Hasil Temuan (Insight Cards)**:
    - Jika tugas menghasilkan data terstruktur (misal daftar repo, profil peneliti, atau tabel harga), berikan opsi tampilan ringkas berupa *Data Cards* atau *Quick Table View* selain markdown standar.
  - **Tindakan Lanjutan Cepat (Follow-up Suggestions)**:
    - Di bagian bawah respon asisten, berikan 2-3 tombol saran aksi lanjutan (contoh setelah mencari repo: *"Buka repo pertama"*, *"Ekspor daftar ke JSON"*, *"Buka tab baru"*).

---

### Saran 4: Pengelolaan Human-in-the-Loop (HITL) In-Situ
* **Kondisi Saat Ini**: Kartu persetujuan tindakan sensitif muncul di tengah thread chat.
* **Usulan Redesign Konten**:
  - **Aksi Cepat Keyboard Terstandarisasi**:
    - Pastikan semua permintaan konfirmasi memiliki tombol pintasan visual yang jelas: `Enter` untuk Lanjutkan, `Esc` untuk Batalkan, dan `E` untuk Koreksi.
  - **Diff / Parameter Preview yang Dapat Diedit Langsung**:
    - Saat agen ingin mengisi form atau mengirim pesan, sediakan editor langsung pada nilai formulir sebelum pengguna menyetujuinya, alih-alih hanya menampilkan JSON statis.

---

### Saran 5: Pengelolaan Sesi & Riwayat yang Lebih Kaya
* **Kondisi Saat Ini**: Laci riwayat sesi hanya menampilkan nama dan tanggal.
* **Usulan Redesign Konten**:
  - **Penamaan Otomatis Berdasarkan Tugas (Auto-Title)**:
    - Sesi diberi nama otomatis dari intisari perintah pertama (contoh: *"Riset PDDIKTI"*, *"Pencarian Repo GitHub"*).
  - **Pencarian Riwayat Sesi**:
    - Input pencarian untuk menyaring sesi-sesi lama berdasarkan kata kunci tugas.
  - **Ekspor Sesi**:
    - Tombol untuk mengekspor rekaman percakapan dan riwayat aksi ke format Markdown atau JSON.

---

## 5. Ringkasan Kebutuhan Data per Komponen

| Komponen UI | Data Masukan (Input) | Kontrol Interaktif (Aksi Pengguna) | Status Kondisi (States) |
| :--- | :--- | :--- | :--- |
| **Topbar** | Status koneksi, Browser UA, Step count, Jumlah logs | Ganti view, Buka drawer, Detach window, Sesi baru, Buka settings, Toggle online | Connected, Standalone, Connecting, Disconnected, Detached |
| **Empty State** | Panduan prompt preset | Klik prompt rekomendasi untuk mengisi komposer | Default kosong |
| **Composer** | Teks prompt, Preset aktif, Model aktif, Status run | Ketik teks, Pilih model, Pilih preset, Submit/Stop | Idle, Typing, Running (tombol stop aktif) |
| **User Message** | Teks prompt, Timestamp | Tombol salin | Terkirim |
| **Assistant Message** | Respon markdown, Model, Waktu, Error | Salin respon, Perluas/ciutkan langkah, Perluas/ciutkan reasoning | Generating, Selesai, Gagal (error banner) |
| **Tool Step Card** | Nama aksi, Argumen, Hasil, Bukti verifikasi, Durasi | Perluas detail, Salin JSON payload | Running, Succeeded, Failed |
| **HITL Card** | Pertanyaan, Jenis interaksi, Parameter sensitif | Pilih opsi, Centang opsi, Edit teks/angka, Approve, Reject | Menunggu respon, Terkirim |
| **Logs View** | Array LogEvent, Kategori event | Filter kategori, Pencarian teks, Salin semua log | Kosong, Ada entri |
| **Settings Modal** | Mode eksekusi, Connection mode, Detach state | Pilih mode eksekusi, Toggle sidepanel, Toggle index labeling, Ganti connection mode | Terbuka / Tertutup |
| **Models Modal** | Daftar model, Provider | Pilih model aktif | Terbuka / Tertutup |
| **API Keys Modal** | Kunci API per provider | Edit input kunci, Simpan kunci, Batal | Tersimpan, Idle |
| **Session Drawer** | Daftar sesi, ID sesi aktif | Pilih sesi, Hapus sesi, Tambah sesi, Reset sesi | Terbuka / Tertutup |
| **Floating HUD** | Status tugas, Timeline, Hasil ekstraksi | Drag, Resize, Minimize, Pause/Resume, Stop, Unduh PDF, Salin data | Pill (kapsul), Jendela penuh, Sembunyi |
