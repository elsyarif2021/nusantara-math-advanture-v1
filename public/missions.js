const travel = 'https://www.indonesia.travel/id/id/';
export const missions = [
  {
    region:'Sumatra', label:'Sumatra', game:'Gasing Tradisional', factor:4, icon:'🪀', theme:'gasing', pin:[7,17,9,28],
    story:'Kapalmu berlabuh di Sabang. Putar gasing kayu warna-warni untuk menghidupkan baling-baling kapal!',
    fact:'Atap Rumah Gadang di Sumatra Barat melengkung seperti tanduk kerbau.',
    source:travel+'travel-ideas/culture/rumah-gadang',
    questions:[
      [5,'Setiap gasing memiliki 4 tali utama. Jika ada 5 gasing, berapa jumlah talinya?'],
      [7,'Kamu menyiapkan 7 gasing. Setiap gasing memakai 4 tali. Berapa tali yang kamu butuhkan?'],
      [9,'Ada 9 gasing di dermaga. Jika masing-masing punya 4 tali, berapa jumlah seluruh tali?']
    ]
  },
  {
    region:'Jawa', label:'Jawa', game:'Dakon / Congklak', factor:5, icon:'🌰', theme:'dakon', pin:[34,74,34,84],
    story:'Anak-anak desa mengajakmu bermain dakon. Hitung biji sawo untuk mengisi lubang di papan congklak.',
    fact:'Candi Borobudur di Magelang, Jawa Tengah, memiliki 72 stupa berlubang pada tiga pelataran atasnya.',
    source:travel+'travel-ideas/heritage/candi-borobudur',
    questions:[
      [7,'Satu lubang congklak berisi 5 biji. Jika ada 7 lubang yang terisi, berapa jumlah bijinya?'],
      [4,'Ada 4 lubang dengan 5 biji sawo di tiap lubang. Berapa jumlah biji sawo?'],
      [9,'Kamu mengisi 9 lubang dengan 5 kerang per lubang. Berapa kerang yang kamu perlukan?']
    ]
  },
  {
    region:'Kalimantan', label:'Kalimantan', game:'Enggrang Bambu', factor:6, icon:'🎋', theme:'enggrang', pin:[41,42,41,30],
    story:'Ada titian yang harus kamu lewati. Siapkan ikatan rotan untuk menguatkan enggrang bambumu.',
    fact:'Sungai Kapuas mengalir melewati Pontianak di Kalimantan Barat.',
    source:travel+'travel-ideas/culture/sungai-kapuas',
    questions:[
      [6,'Setiap pasang enggrang bambu membutuhkan 6 ikatan rotan. Berapa ikatan untuk 6 pasang?'],
      [8,'Delapan pasang enggrang akan diperbaiki. Tiap pasang memerlukan 6 ikatan. Berapa ikatan rotan yang dibutuhkan?'],
      [4,'Ada 4 pasang enggrang, masing-masing memakai 6 ikatan. Berapa jumlah ikatannya?']
    ]
  },
  {
    region:'Sulawesi', label:'Sulawesi', game:'Lompat Karet (Yeye)', factor:7, icon:'🪢', theme:'karet', pin:[54,43,54,31],
    story:'Lompati tali karet! Mulai dari setinggi lutut, lalu naik ke pinggang dan bahu.',
    fact:'Rumah adat Tongkonan di Toraja, Sulawesi Selatan, memiliki atap yang bentuknya mengingatkan pada perahu.',
    source:travel+'destination/sulawesi',
    questions:[
      [8,'Di tingkat lutut, ada 8 rangkaian karet. Masing-masing punya 7 jalinan. Berapa jumlah jalinannya?'],
      [6,'Di tingkat pinggang, setiap lompatan berhasil memberi 7 poin. Berapa poin dari 6 lompatan?'],
      [9,'Di tingkat bahu, kamu berhasil melompat 9 kali. Jika tiap lompatan bernilai 7 poin, berapa skormu?']
    ]
  },
  {
    region:'Bali & Nusa Tenggara', label:'Bali & Nusa Tenggara', game:'Perang Topeng / Tari Tradisional', factor:8, icon:'🎭', theme:'topeng', pin:[49,79,53,90],
    story:'Bantu penari topeng di Bali dan Lombok menyiapkan ornamen. Temukan jumlah yang tepat agar tarian bisa dimulai.',
    fact:'Sasando adalah alat musik petik yang menjadi bagian dari budaya Pulau Rote, Nusa Tenggara Timur.',
    source:travel+'destination/bali-nusa-tenggara/east-nusa-tenggara',
    questions:[
      [4,'Satu penari topeng membutuhkan 8 ornamen selendang dan bunga. Berapa ornamen untuk 4 penari?'],
      [6,'Enam penari masing-masing memerlukan 8 ornamen. Berapa jumlah ornamennya?'],
      [7,'Ada 7 topeng yang masing-masing dihiasi 8 ornamen. Berapa ornamen yang dipakai seluruhnya?']
    ]
  },
  {
    region:'Maluku', label:'Maluku', game:'Bentengan', factor:9, icon:'🏰', theme:'benteng', pin:[67,53,67,41],
    story:'Jaga benteng di kepulauan rempah. Hitung langkah para penjaga untuk menyelesaikan patroli.',
    fact:'Kepulauan Banda di Maluku sejak lama dikenal sebagai penghasil pala.',
    source:travel+'destination/maluku-papua/maluku/banda-neira',
    questions:[
      [9,'Satu putaran patroli membutuhkan 9 langkah. Jika kamu berpatroli 9 putaran, berapa langkahmu?'],
      [7,'Tujuh penjaga masing-masing maju 9 langkah. Berapa jumlah langkah mereka?'],
      [8,'Ada 8 jalur patroli yang masing-masing panjangnya 9 langkah. Berapa langkah untuk menelusuri semua jalur?']
    ]
  },
  {
    region:'Papua', label:'Papua', game:'Panahan Tradisional (Kaseang)', factor:10, icon:'🎯', theme:'panah', pin:[89,76,89,64],
    story:'Di Merauke, bidik sasaran emas pada permainan panahan. Kumpulkan poin untuk membuka Final Boss!',
    fact:'Tifa Papua berbentuk tabung dan dimainkan dengan cara dipukul menggunakan tangan.',
    source:travel+'travel-ideas/culture/tifa',
    questions:[
      [9,'Setiap sasaran emas bernilai 10 poin. Jika kamu mengenainya 9 kali, berapa poin yang kamu peroleh?'],
      [6,'Kamu mengenai 6 sasaran emas. Jika masing-masing bernilai 10 poin, berapa skormu?'],
      [8,'Dari 8 tembakan, semuanya mengenai sasaran emas bernilai 10 poin. Berapa skor akhirmu?']
    ]
  }
];

export const boss = {
  region:'Final Boss', game:'Tantangan Campuran', icon:'🏆', theme:'boss',
  story:'Selesaikan satu soal untuk setiap perkalian 4–10. Setelah itu, sertifikat penjelajahmu akan terbuka.',
  questions:[
    [7,'5 × 7 = …',5], [6,'4 × 6 = …',4], [8,'9 × 8 = …',9], [9,'3 × 9 = …',3],
    [5,'8 × 5 = …',8], [10,'7 × 10 = …',7], [4,'7 × 4 = …',7]
  ]
};
