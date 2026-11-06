/**
 * Thailand's 77 provinces (6-region grouping), with the exact location names SerpApi Google Jobs accepts.
 * Location names were checked against https://serpapi.com/locations.json (Nov 2026).
 */

export type Region = "central" | "north" | "northeast" | "east" | "west" | "south";

export type Province = { th: string; en: string; region: Region; location: string };

export const regions: Array<{ id: Region; th: string }> = [
  { id: "central", th: "ภาคกลาง" },
  { id: "north", th: "ภาคเหนือ" },
  { id: "northeast", th: "ภาคตะวันออกเฉียงเหนือ" },
  { id: "east", th: "ภาคตะวันออก" },
  { id: "west", th: "ภาคตะวันตก" },
  { id: "south", th: "ภาคใต้" },
];

/** Whole-country search. */
export const ALL_THAILAND: Province = { th: "ทั่วประเทศไทย", en: "Thailand", region: "central", location: "Thailand" };

// Pre-sorted in Thai alphabetical order. Do not sort at runtime: the server runtime has no Thai collation,
// so a runtime sort renders a different order than the browser and breaks hydration.
export const provinces: Province[] = [
  { th: "กระบี่", en: "Krabi", region: "south", location: "Krabi,Thailand" },
  { th: "กรุงเทพมหานคร", en: "Bangkok", region: "central", location: "Bangkok,Thailand" },
  { th: "กาญจนบุรี", en: "Kanchanaburi", region: "west", location: "Kanchanaburi,Thailand" },
  { th: "กาฬสินธุ์", en: "Kalasin", region: "northeast", location: "Kalasin,Thailand" },
  { th: "กำแพงเพชร", en: "Kamphaeng Phet", region: "central", location: "Kamphaeng Phet,Thailand" },
  { th: "ขอนแก่น", en: "Khon Kaen", region: "northeast", location: "Khon Kaen,Thailand" },
  { th: "จันทบุรี", en: "Chanthaburi", region: "east", location: "Chanthaburi,Thailand" },
  { th: "ฉะเชิงเทรา", en: "Chachoengsao", region: "east", location: "Chachoengsao,Thailand" },
  { th: "ชลบุรี", en: "Chonburi", region: "east", location: "Chon Buri,Thailand" },
  { th: "ชัยนาท", en: "Chai Nat", region: "central", location: "Chai Nat,Thailand" },
  { th: "ชัยภูมิ", en: "Chaiyaphum", region: "northeast", location: "Chaiyaphum,Thailand" },
  { th: "ชุมพร", en: "Chumphon", region: "south", location: "Chumphon,Thailand" },
  { th: "เชียงราย", en: "Chiang Rai", region: "north", location: "Chiang Rai,Thailand" },
  { th: "เชียงใหม่", en: "Chiang Mai", region: "north", location: "Chiang Mai,Thailand" },
  { th: "ตรัง", en: "Trang", region: "south", location: "Trang,Thailand" },
  { th: "ตราด", en: "Trat", region: "east", location: "Trat,Thailand" },
  { th: "ตาก", en: "Tak", region: "west", location: "Tak,Thailand" },
  { th: "นครนายก", en: "Nakhon Nayok", region: "central", location: "Nakhon Nayok,Thailand" },
  { th: "นครปฐม", en: "Nakhon Pathom", region: "central", location: "Nakhon Pathom,Thailand" },
  { th: "นครพนม", en: "Nakhon Phanom", region: "northeast", location: "Nakhon Phanom,Thailand" },
  { th: "นครราชสีมา", en: "Nakhon Ratchasima", region: "northeast", location: "Nakhon Ratchasima,Thailand" },
  { th: "นครศรีธรรมราช", en: "Nakhon Si Thammarat", region: "south", location: "Nakhon Si Thammarat,Thailand" },
  { th: "นครสวรรค์", en: "Nakhon Sawan", region: "central", location: "Nakhon Sawan,Thailand" },
  { th: "นนทบุรี", en: "Nonthaburi", region: "central", location: "Nonthaburi,Thailand" },
  { th: "นราธิวาส", en: "Narathiwat", region: "south", location: "Narathiwat,Thailand" },
  { th: "น่าน", en: "Nan", region: "north", location: "Nan,Thailand" },
  { th: "บึงกาฬ", en: "Bueng Kan", region: "northeast", location: "Bueng Kan,Thailand" },
  { th: "บุรีรัมย์", en: "Buriram", region: "northeast", location: "Buri Ram,Thailand" },
  { th: "ปทุมธานี", en: "Pathum Thani", region: "central", location: "Pathum Thani,Thailand" },
  { th: "ประจวบคีรีขันธ์", en: "Prachuap Khiri Khan", region: "west", location: "Prachuap Khiri Khan,Thailand" },
  { th: "ปราจีนบุรี", en: "Prachinburi", region: "east", location: "Prachin Buri,Thailand" },
  { th: "ปัตตานี", en: "Pattani", region: "south", location: "Pattani,Thailand" },
  { th: "พระนครศรีอยุธยา", en: "Phra Nakhon Si Ayutthaya", region: "central", location: "Phra Nakhon Si Ayutthaya,Thailand" },
  { th: "พะเยา", en: "Phayao", region: "north", location: "Phayao,Thailand" },
  { th: "พังงา", en: "Phang Nga", region: "south", location: "Phang-nga,Thailand" },
  { th: "พัทลุง", en: "Phatthalung", region: "south", location: "Phatthalung,Thailand" },
  { th: "พิจิตร", en: "Phichit", region: "central", location: "Phichit,Thailand" },
  { th: "พิษณุโลก", en: "Phitsanulok", region: "central", location: "Phitsanulok,Thailand" },
  { th: "เพชรบุรี", en: "Phetchaburi", region: "west", location: "Phetchaburi,Thailand" },
  { th: "เพชรบูรณ์", en: "Phetchabun", region: "central", location: "Phetchabun,Thailand" },
  { th: "แพร่", en: "Phrae", region: "north", location: "Phrae,Thailand" },
  { th: "ภูเก็ต", en: "Phuket", region: "south", location: "Phuket,Thailand" },
  { th: "มหาสารคาม", en: "Maha Sarakham", region: "northeast", location: "Maha Sarakham,Thailand" },
  { th: "มุกดาหาร", en: "Mukdahan", region: "northeast", location: "Mukdahan,Thailand" },
  { th: "แม่ฮ่องสอน", en: "Mae Hong Son", region: "north", location: "Mae Hong Son,Thailand" },
  { th: "ยโสธร", en: "Yasothon", region: "northeast", location: "Yasothon,Thailand" },
  { th: "ยะลา", en: "Yala", region: "south", location: "Yala,Thailand" },
  { th: "ร้อยเอ็ด", en: "Roi Et", region: "northeast", location: "Roi Et,Thailand" },
  { th: "ระนอง", en: "Ranong", region: "south", location: "Ranong,Thailand" },
  { th: "ระยอง", en: "Rayong", region: "east", location: "Rayong,Thailand" },
  { th: "ราชบุรี", en: "Ratchaburi", region: "west", location: "Ratchaburi,Thailand" },
  { th: "ลพบุรี", en: "Lopburi", region: "central", location: "Lopburi,Thailand" },
  { th: "ลำปาง", en: "Lampang", region: "north", location: "Lampang,Thailand" },
  { th: "ลำพูน", en: "Lamphun", region: "north", location: "Lamphun,Thailand" },
  { th: "เลย", en: "Loei", region: "northeast", location: "Loei,Thailand" },
  { th: "ศรีสะเกษ", en: "Sisaket", region: "northeast", location: "Si Sa Ket,Thailand" },
  { th: "สกลนคร", en: "Sakon Nakhon", region: "northeast", location: "Sakon Nakhon,Thailand" },
  { th: "สงขลา", en: "Songkhla", region: "south", location: "Songkhla,Thailand" },
  { th: "สตูล", en: "Satun", region: "south", location: "Satun,Thailand" },
  { th: "สมุทรปราการ", en: "Samut Prakan", region: "central", location: "Samut Prakan,Thailand" },
  { th: "สมุทรสงคราม", en: "Samut Songkhram", region: "central", location: "Samut Songkhram,Thailand" },
  { th: "สมุทรสาคร", en: "Samut Sakhon", region: "central", location: "Samut Sakhon,Thailand" },
  { th: "สระแก้ว", en: "Sa Kaeo", region: "east", location: "Sa Kaeo,Thailand" },
  { th: "สระบุรี", en: "Saraburi", region: "central", location: "Saraburi,Thailand" },
  { th: "สิงห์บุรี", en: "Sing Buri", region: "central", location: "Sing Buri,Thailand" },
  { th: "สุโขทัย", en: "Sukhothai", region: "central", location: "Sukhothai,Thailand" },
  { th: "สุพรรณบุรี", en: "Suphan Buri", region: "central", location: "Suphan Buri,Thailand" },
  { th: "สุราษฎร์ธานี", en: "Surat Thani", region: "south", location: "Surat Thani,Thailand" },
  { th: "สุรินทร์", en: "Surin", region: "northeast", location: "Surin,Thailand" },
  { th: "หนองคาย", en: "Nong Khai", region: "northeast", location: "Nong Khai,Thailand" },
  { th: "หนองบัวลำภู", en: "Nong Bua Lamphu", region: "northeast", location: "Nong Bua Lam Phu,Thailand" },
  { th: "อ่างทอง", en: "Ang Thong", region: "central", location: "Ang Thong,Thailand" },
  { th: "อำนาจเจริญ", en: "Amnat Charoen", region: "northeast", location: "Amnat Charoen,Thailand" },
  { th: "อุดรธานี", en: "Udon Thani", region: "northeast", location: "Udon Thani,Thailand" },
  { th: "อุตรดิตถ์", en: "Uttaradit", region: "north", location: "Uttaradit,Thailand" },
  { th: "อุทัยธานี", en: "Uthai Thani", region: "central", location: "Uthai Thani,Thailand" },
  { th: "อุบลราชธานี", en: "Ubon Ratchathani", region: "northeast", location: "Ubon Ratchathani,Thailand" },
];

export const DEFAULT_LOCATION = "Bangkok,Thailand";

export function provinceByLocation(location: string): Province | undefined {
  if (location === ALL_THAILAND.location) return ALL_THAILAND;
  return provinces.find((province) => province.location === location);
}
