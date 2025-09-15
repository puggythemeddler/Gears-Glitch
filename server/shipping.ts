const COUNTIES = [
  { id: "nairobi", name: "Nairobi", region: "city", fee: 250 },
  { id: "kiambu", name: "Kiambu", region: "central", fee: 350 },
  { id: "kajiado", name: "Kajiado", region: "central", fee: 400 },
  { id: "machakos", name: "Machakos", region: "central", fee: 400 },
  { id: "muranga", name: "Murang'a", region: "central", fee: 400 },
  { id: "nyeri", name: "Nyeri", region: "central", fee: 450 },
  { id: "kirinyaga", name: "Kirinyaga", region: "central", fee: 450 },
  { id: "nyandarua", name: "Nyandarua", region: "central", fee: 450 },
  { id: "mombasa", name: "Mombasa", region: "coast", fee: 500 },
  { id: "kwale", name: "Kwale", region: "coast", fee: 550 },
  { id: "kilifi", name: "Kilifi", region: "coast", fee: 550 },
  { id: "tana-river", name: "Tana River", region: "coast", fee: 600 },
  { id: "lamu", name: "Lamu", region: "coast", fee: 650 },
  { id: "taita-taveta", name: "Taita-Taveta", region: "coast", fee: 550 },
  { id: "garissa", name: "Garissa", region: "north-eastern", fee: 700 },
  { id: "wajir", name: "Wajir", region: "north-eastern", fee: 750 },
  { id: "mandera", name: "Mandera", region: "north-eastern", fee: 800 },
  { id: "kisumu", name: "Kisumu", region: "nyanza", fee: 450 },
  { id: "siaya", name: "Siaya", region: "nyanza", fee: 500 },
  { id: "homa-bay", name: "Homa Bay", region: "nyanza", fee: 500 },
  { id: "migori", name: "Migori", region: "nyanza", fee: 500 },
  { id: "kisii", name: "Kisii", region: "nyanza", fee: 500 },
  { id: "nyamira", name: "Nyamira", region: "nyanza", fee: 500 },
  { id: "nakuru", name: "Nakuru", region: "rift-valley", fee: 400 },
  { id: "eldoret", name: "Eldoret / Uasin Gishu", region: "rift-valley", fee: 450 },
  { id: "naivasha", name: "Naivasha", region: "rift-valley", fee: 400 },
  { id: "kericho", name: "Kericho", region: "rift-valley", fee: 500 },
  { id: "nandi", name: "Nandi", region: "rift-valley", fee: 500 },
  { id: "baringo", name: "Baringo", region: "rift-valley", fee: 550 },
  { id: "laikipia", name: "Laikipia", region: "rift-valley", fee: 500 },
  { id: "narok", name: "Narok", region: "rift-valley", fee: 500 },
  { id: "samburu", name: "Samburu", region: "rift-valley", fee: 650 },
  { id: "trans-nzoia", name: "Trans Nzoia", region: "rift-valley", fee: 500 },
  { id: "west-pokot", name: "West Pokot", region: "rift-valley", fee: 600 },
  { id: "elgeyo-marakwet", name: "Elgeyo-Marakwet", region: "rift-valley", fee: 550 },
  { id: "bomet", name: "Bomet", region: "rift-valley", fee: 500 },
  { id: "kakamega", name: "Kakamega", region: "western", fee: 500 },
  { id: "bungoma", name: "Bungoma", region: "western", fee: 550 },
  { id: "vihiga", name: "Vihiga", region: "western", fee: 550 },
  { id: "busia", name: "Busia", region: "western", fee: 550 },
  { id: "embu", name: "Embu", region: "eastern", fee: 450 },
  { id: "meru", name: "Meru", region: "eastern", fee: 500 },
  { id: "tharaka-nithi", name: "Tharaka-Nithi", region: "eastern", fee: 500 },
  { id: "kitui", name: "Kitui", region: "eastern", fee: 500 },
  { id: "makueni", name: "Makueni", region: "eastern", fee: 500 },
  { id: "isiolo", name: "Isiolo", region: "eastern", fee: 600 },
  { id: "marsabit", name: "Marsabit", region: "eastern", fee: 750 },
];

export type County = { id: string; name: string; region: string; fee: number };

export function getCounties(): County[] {
  return COUNTIES;
}

export function getShippingFee(countyId: string): number {
  const county = COUNTIES.find(c => c.id === countyId);
  return county?.fee ?? 0;
}
