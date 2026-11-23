import {missions as locations, boss as finalLocation} from './missions.js';
import {gradeTopics} from './grade-topics.js';

export function gradeFromClass(label) {
  const value = String(label).trim().replace(/^kelas\s+/i,'');
  const number = /^([1-6])(?=$|[a-z\s.\-/])/i.exec(value);
  if (number) return Number(number[1]);
  const roman = /^(VI|IV|III|II|V|I)(?=$|[\s.\-/]|[A-Z]$)/i.exec(value)?.[1].toUpperCase();
  return {I:1,II:2,III:3,IV:4,V:5,VI:6}[roman] || 0;
}

// Setiap pos memuat pengantar konsep dan soal sesuai kelas.
const content = [
  [
    ['Membilang sampai 20','Sentuh atau tunjuk benda satu per satu. Bilangan terakhir adalah jumlah benda.',
      ['● ● ● ● ● ● ● ada berapa?', '7', '6', '8', '9'],['Setelah 13, bilangan berikutnya adalah …','14','12','15','16']],
    ['Membandingkan bilangan','Makin jauh ke kanan pada garis bilangan, makin besar nilainya.',
      ['Antara 8 dan 11, mana yang lebih besar?','11','8','9','10'],['Mana bilangan yang paling kecil?','4','7','6','5']],
    ['Penjumlahan sampai 10','Gabungkan dua kelompok benda, lalu hitung semuanya.',
      ['Ada 3 mangga. Ditambah 4 mangga. Berapa semuanya?','7','6','8','9'],['Lengkapi 2 + 6 = …','8','6','7','9']],
    ['Pengurangan sampai 10','Ambil benda sesuai bilangan yang dikurangkan, lalu hitung sisanya.',
      ['Ada 8 kerang. Diambil 3. Berapa sisanya?','5','4','6','7'],['Lengkapi 9 − 2 = …','7','6','8','11']],
    ['Pola dan bangun datar','Cari bagian pola yang berulang. Bentuk juga bisa dikenali dari sisi atau sudutnya.',
      ['Apa lanjutannya? ○ △ ○ △ ○ …','△','○','□','◇'],['Bangun datar mana yang punya tiga sisi?','Segitiga','Lingkaran','Persegi','Persegi panjang']],
    ['Panjang dan posisi','Bandingkan dari titik awal yang sama. Gunakan kata seperti kiri, kanan, di atas, atau di bawah.',
      ['Pita merah 5 langkah dan pita biru 3 langkah. Mana yang lebih panjang?','Pita merah','Pita biru','Sama panjang','Tidak bisa dibandingkan'],['Buku terletak di bawah kotak. Di mana kotak terhadap buku?','Di atas','Di bawah','Di kiri','Di belakang']],
    ['Membaca gambar data','Pada piktogram ini, satu gambar mewakili satu benda. Hitung gambar dalam setiap kelompok.',
      ['Apel: ● ● ●. Pir: ● ●. Mana yang lebih banyak?','Apel','Pir','Sama banyak','Tidak ada apel'],['Kapal: ● ● ● ●. Berapa banyak kapal?','4','3','5','6']]
  ],
  [
    ['Puluhan dan satuan','Bilangan dua angka terdiri dari puluhan dan satuan. Sepuluh satuan membentuk satu puluhan.',
      ['Berapa puluhan dan satuan pada 47?','4 puluhan dan 7 satuan','7 puluhan dan 4 satuan','4 puluhan dan 4 satuan','7 puluhan dan 7 satuan'],['Bilangan yang terdiri dari 6 puluhan dan 2 satuan adalah …','62','26','60','64']],
    ['Mengurutkan sampai 100','Bandingkan angka puluhan terlebih dahulu. Jika sama, bandingkan satuannya.',
      ['Urutkan 31, 27, dan 39 dari yang terkecil.','27, 31, 39','39, 31, 27','31, 27, 39','27, 39, 31'],['Antara 73 dan 79, bilangan yang lebih besar adalah …','79','73','70','71']],
    ['Penjumlahan dan pengurangan','Gunakan benda atau gambar. Tanda sama dengan berarti kedua ruas bernilai sama.',
      ['Pada 8 + 5 = 10 + …, bilangan yang hilang adalah …','3','2','5','13'],['Ada 19 biji. Tujuh diambil. Berapa sisanya?','12','11','13','14']],
    ['Setengah dan seperempat','Bagi benda menjadi bagian yang sama besar. Satu dari dua bagian adalah setengah.',
      ['Satu dari empat potong kue yang sama besar disebut …','Seperempat','Setengah','Sepertiga','Satu utuh'],['Setengah dari 12 biji adalah …','6','3','4','8']],
    ['Bangun ruang','Perhatikan permukaan dan bentuk benda. Dadu dan bola memiliki bentuk ruang berbeda.',
      ['Benda berbentuk kubus adalah …','Dadu','Bola tenis','Topi ulang tahun berbentuk kerucut','Buku tebal berbentuk balok'],['Bangun yang bentuknya seperti bola bekel adalah …','Bola','Kubus','Balok','Kerucut']],
    ['Berat dan durasi','Pada neraca seimbang, sisi yang turun lebih rendah memuat benda lebih berat.',
      ['Piring kiri neraca turun. Batu ada di kiri dan kapas di kanan. Mana yang lebih berat?','Batu','Kapas','Keduanya sama berat','Tidak ada yang lebih berat'],['Mana yang biasanya memerlukan waktu lebih lama?','Membaca satu buku cerita','Mengedipkan mata','Menepuk tangan sekali','Mengucapkan satu kata']],
    ['Turus dan piktogram','Turus adalah tanda untuk mencatat jumlah. Satu turus menandai satu benda.',
      ['Merah: | | |. Biru: | | | | |. Berapa selisih jumlahnya?','2','3','5','8'],['Kapten: ★★★★. Pelaut: ★★★. Jika satu bintang mewakili satu orang, berapa jumlah keduanya?','7','6','8','1']]
  ],
  [
    ['Nilai tempat','Angka yang sama punya nilai berbeda sesuai letaknya: ribuan, ratusan, puluhan, atau satuan.',
      ['Nilai angka 6 pada 2.613 adalah …','600','60','6','6.000'],['Bentuk uraian 3.205 adalah …','3.000 + 200 + 5','3.000 + 20 + 5','300 + 200 + 5','3.000 + 200 + 50']],
    ['Tambah dan kurang sampai 1.000','Susun bilangan menurut nilai tempat sebelum menghitung.',
      ['Penjelajah membawa 245 buah salak dan menerima 132 lagi. Berapa jumlahnya?','377','367','387','397'],['Berapa hasil 680 − 240?','440','420','450','460']],
    ['Perkalian dan pembagian','Perkalian menghitung beberapa kelompok sama banyak. Pembagian dapat membagi rata suatu kumpulan.',
      ['Enam baki masing-masing berisi 4 kue. Berapa jumlah kuenya?','24','20','22','28'],['Dua puluh delapan kerang dibagi rata kepada 7 anak. Setiap anak mendapat …','4','3','5','6']],
    ['Pecahan berpenyebut sama','Jika ukuran bagiannya sama, bandingkan banyak bagian yang diambil.',
      ['Antara 2/8 dan 5/8, mana yang lebih besar?','5/8','2/8','Sama besar','Tidak bisa dibandingkan'],['Urutkan 3/7, 1/7, dan 5/7 dari yang terkecil.','1/7, 3/7, 5/7','1/7, 5/7, 3/7','3/7, 1/7, 5/7','5/7, 3/7, 1/7']],
    ['Satuan panjang dan berat','Satu meter sama dengan 100 sentimeter. Satu kilogram sama dengan 1.000 gram.',
      ['3 m sama dengan berapa sentimeter?','300 cm','30 cm','3 cm','3.000 cm'],['2 kg sama dengan berapa gram?','2.000 g','200 g','20 g','20.000 g']],
    ['Ciri bangun datar','Hitung sisi dan perhatikan bentuknya. Semua sisi persegi sama panjang.',
      ['Bangun dengan empat sisi sama panjang dan empat sudut siku-siku adalah …','Persegi','Segitiga','Persegi panjang yang tidak persegi','Lingkaran'],['Segi lima mempunyai berapa sisi?','5','4','6','7']],
    ['Pola dan tabel','Cari beda yang tetap untuk melanjutkan pola. Pada tabel, baca angka sesuai kategori.',
      ['Lanjutkan pola 24, 29, 34, …','39','38','40','44'],['Jumlah buku yang dipinjam: Senin 12, Selasa 17, Rabu 15. Hari tertinggi adalah …','Selasa','Senin','Rabu','Semua sama']]
  ],
  [
    ['Perkalian 4–10','Kelompok yang banyaknya sama dapat dihitung dengan perkalian.',
      ['7 kotak, masing-masing memuat 8 bola. Berapa seluruh bola?','56','48','54','64'],['9 ikat, masing-masing berisi 6 batang. Berapa batang seluruhnya?','54','45','48','60']],
    ['Kelipatan dan faktor','Jika 24 ÷ 6 = 4 tanpa sisa, 6 adalah faktor dari 24.',
      ['Manakah faktor dari 36?','9','8','7','5'],['Manakah kelipatan 7?','42','40','45','48']],
    ['Pecahan senilai, desimal, dan persen','Pecahan senilai mewakili bagian yang sama. Persen menyatakan berapa bagian dari seratus.',
      ['Manakah pecahan senilai dengan 3/4?','6/8','4/6','3/8','5/8'],['0,25 sama dengan …','25%','2,5%','250%','0,25%']],
    ['Pola dan bilangan yang hilang','Gunakan operasi kebalikan untuk mengisi bagian kosong. Cari perubahan tetap untuk meneruskan pola.',
      ['□ + 36 = 82. Berapa nilai kotak?','46','44','48','54'],['Berapa bilangan berikutnya? 84, 77, 70, …','63','62','64','67']],
    ['Luas dan volume dengan satuan','Luas bisa diukur dengan petak sama besar. Volume dapat dihitung dari banyak kubus satuan.',
      ['Sebuah alas terdiri dari 4 baris, masing-masing 6 petak. Berapa luasnya?','24 petak satuan','10 petak satuan','20 petak satuan','28 petak satuan'],['Ada 3 lapisan. Tiap lapisan berisi 8 kubus satuan. Berapa volumenya?','24 kubus satuan','11 kubus satuan','16 kubus satuan','32 kubus satuan']],
    ['Mengurai bangun datar','Satu bangun dapat dibagi menjadi beberapa bangun lain, misalnya dengan garis diagonal.',
      ['Satu diagonal membagi persegi menjadi dua bangun apa?','Segitiga','Lingkaran','Trapesium','Persegi panjang'],['Dua persegi sama ukuran ditempel sepanjang satu sisi. Bentuk luarnya adalah …','Persegi panjang','Segitiga','Segi lima','Lingkaran']],
    ['Membaca diagram batang','Bandingkan tinggi batang dengan skala. Selisih diperoleh melalui pengurangan.',
      ['Setiap tingkat = 1 buku. Batang kelas 4A tinggi 14 dan 4B tinggi 9. Berapa selisihnya?','5 buku','4 buku','6 buku','23 buku'],['Data kunjungan: Senin 13, Selasa 19, Rabu 15. Berapa jumlahnya?','47','43','46','49']]
  ],
  [
    ['Bilangan besar dan uang','Uraikan bilangan menurut nilai tempat. Untuk menghitung kembalian, kurangi uang bayar dengan harga.',
      ['Nilai angka 7 dalam 572.430 adalah …','70.000','7.000','700','700.000'],['Barang seharga Rp37.500 dibayar Rp50.000. Berapa kembaliannya?','Rp12.500','Rp12.000','Rp13.500','Rp17.500']],
    ['KPK dan FPB','KPK adalah kelipatan bersama terkecil. FPB adalah faktor bersama terbesar.',
      ['KPK dari 6 dan 8 adalah …','24','12','36','48'],['FPB dari 24 dan 36 adalah …','12','6','8','18']],
    ['Tambah dan kurang pecahan','Samakan penyebut terlebih dahulu sebelum menjumlahkan atau mengurangkan pembilang.',
      ['1/2 + 1/4 = …','3/4','2/6','1/6','2/4'],['7/8 − 1/4 = …','5/8','6/8','3/8','1/2']],
    ['Keliling dan luas','Keliling mengukur panjang tepi. Luas mengukur bagian permukaan yang tertutup.',
      ['Persegi panjang berukuran 9 cm × 5 cm. Berapa kelilingnya?','28 cm','14 cm','36 cm','45 cm'],['Luas segitiga dengan alas 12 cm dan tinggi 7 cm adalah …','42 cm²','19 cm²','38 cm²','84 cm²']],
    ['Sudut dan durasi','Sudut siku-siku besarnya 90°. Hitung durasi dari saat mulai hingga selesai.',
      ['Sudut 120° termasuk jenis apa?','Tumpul','Lancip','Siku-siku','Lurus'],['Perjalanan berangkat pukul 08.45 dan tiba pukul 10.10. Berapa durasinya?','1 jam 25 menit','1 jam 15 menit','1 jam 35 menit','2 jam 25 menit']],
    ['Peta berpetak dan bangun ruang','Ikuti kolom dan baris pada petak. Bangun ruang terlihat berbeda dari tiap arah.',
      ['Dari B2, bergerak dua kolom ke kanan dan satu baris ke atas. Nomor baris naik ke atas. Di petak mana kamu berhenti?','D3','D1','C4','A3'],['Balok diletakkan dengan sisi 5 cm × 3 cm di bagian atas. Apa bentuk tampak atasnya?','Persegi panjang','Persegi','Segitiga','Lingkaran']],
    ['Tabel frekuensi','Frekuensi menyatakan banyaknya kejadian pada satu kategori atau nilai.',
      ['Nilai 70 muncul 4 kali, 80 muncul 6 kali, dan 90 muncul 5 kali. Nilai mana yang paling sering muncul?','80','70','90','85'],['Jumlah wisatawan: 9 pagi, 13 siang, dan 8 sore. Berapa totalnya?','30','29','31','32']]
  ],
  [
    ['Operasi bilangan cacah','Untuk belanja beberapa barang sejenis, kalikan jumlah barang dengan harganya.',
      ['Ada 125 kotak, masing-masing berisi 48 buah. Berapa buah semuanya?','6.000','5.000','5.500','6.125'],['Rp96.000 dibagi sama rata kepada 8 orang. Berapa bagian tiap orang?','Rp12.000','Rp8.000','Rp11.000','Rp14.000']],
    ['Operasi pecahan','Perkalian pecahan dengan bilangan asli berarti mengambil pecahan yang sama berulang kali.',
      ['3 × 2/5 = …','1 1/5','5/5','2/15','6/15'],['3/4 liter dibagi rata ke 3 gelas. Berapa isi tiap gelas?','1/4 liter','1/3 liter','1/2 liter','3/7 liter']],
    ['Pecahan campuran dan desimal','Ubah pecahan ke bentuk senilai jika diperlukan. Bandingkan bagian bulat sebelum bagian pecahannya.',
      ['Yang senilai dengan 1 3/4 adalah …','7/4','4/7','4/4','3/4'],['Urutkan 2,4; 2,8; dan 2,1 dari yang terbesar.','2,8; 2,4; 2,1','2,1; 2,4; 2,8','2,4; 2,8; 2,1','2,8; 2,1; 2,4']],
    ['Rasio satuan dan proporsi','Cari banyaknya untuk satu unit, lalu gunakan untuk jumlah unit yang diperlukan.',
      ['Untuk 3 gelas dibutuhkan 600 mL air. Berapa air untuk 5 gelas dengan ukuran sama?','1.000 mL','800 mL','900 mL','1.200 mL'],['Harga 4 buku Rp32.000. Berapa harga 7 buku sejenis?','Rp56.000','Rp48.000','Rp52.000','Rp64.000']],
    ['Pola perkalian dan kalimat matematika','Cari faktor pengali atau pembaginya. Gunakan operasi kebalikan untuk menemukan nilai yang hilang.',
      ['Pola 3, 9, 27, 81, … dilanjutkan dengan …','243','162','252','324'],['Jika □ × 12 = 288, berapa nilai kotak?','24','22','26','36']],
    ['Luas gabungan dan susunan kubus','Pecah bentuk gabungan menjadi bagian sederhana. Untuk susunan kubus, hitung per lapisan.',
      ['Dari petak 12 m × 8 m dipotong sudut berbentuk persegi 3 m × 3 m. Berapa luas sisanya?','87 m²','84 m²','90 m²','105 m²'],['Susunan memiliki 12 kubus di alas dan 7 kubus di lapis atas. Berapa jumlah kubus?','19','17','20','21']],
    ['Menganalisis data','Jumlahkan kategori yang diminta. Perbandingan perlu menggunakan satuan yang sama.',
      ['Peserta kelas 6A berjumlah 24, 6B berjumlah 31, dan 6C berjumlah 27. Berapa selisih terbesar dan terkecil?','7','4','6','8'],['Data hobi: membaca 12, menggambar 9, olahraga 15. Berapa siswa yang memilih selain olahraga?','21','15','24','36']]
  ]
];

const practiceQuestions = items => items.map(([prompt,answer,...distractors])=>({prompt,answer,distractors}));

export const levels = content.map((units,index) => {
  const grade = index+1;
  const phase = 'ABC'[Math.floor(index/2)];
  const missions = units.map(([topic,lesson,...items],i) => {
    const modules = gradeTopics[index].filter(module => module[0] === i);
    const core = modules.filter(module => !module[4]);
    const enrichment = modules.filter(module => module[4]).map(([,topic,lesson,items]) => ({
      ...locations[i],topic,game:topic,lesson,questions:practiceQuestions(items)
    }));
    return {
      ...locations[i],topic,lesson,
      story:'Kapalmu singgah di '+locations[i].region+' di pos '+locations[i].game+'.',
      core:core.map(([,topic,lesson])=>({topic,lesson})),enrichment,
      questions:practiceQuestions([...items,...core.flatMap(module => module[3])])
    };
  });
  const boss = {...finalLocation,story:'Uji kembali tujuh topik yang sudah kamu pelajari dalam petualangan ini.',questions:missions.map(mission=>mission.questions.at(-1))};
  return {grade,phase,missions,boss};
});
