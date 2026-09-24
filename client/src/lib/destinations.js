export const DESTINATIONS = [
  {
    id: "japan",
    name: "Japan",
    subtitle: "Little streets. Big discoveries.",
    image: "/assets/kyoto.jpg",
    location: "Kyoto, Japan",
    tag: "Culture & city walks",
    center: [35.005, 135.775],
  },
  {
    id: "thailand",
    name: "Thailand",
    subtitle: "Follow your appetite for adventure.",
    image: "/assets/thailand.jpg",
    location: "Bangkok, Thailand",
    tag: "Markets & hidden gems",
    center: [13.75, 100.49],
  },
  {
    id: "bali",
    name: "Bali",
    subtitle: "A slower kind of somewhere.",
    image: "/assets/bali.jpg",
    location: "Bali, Indonesia",
    tag: "Nature & slow days",
    center: [-8.51, 115.26],
  },
];
// Real points of interest, shown only in explicitly labelled destination previews.
export const EXAMPLE_PLACES = {
  japan: [
    {
      id: "kyoto-1",
      name: "Fushimi Inari Taisha",
      category: "Shrine",
      address: "Fukakusa, Fushimi Ward, Kyoto, Japan",
      lat: 34.9671,
      lng: 135.7727,
      notes:
        "Walk beneath the torii gates on the wooded trails of Mount Inari.",
    },
    {
      id: "kyoto-2",
      name: "Nishiki Market",
      category: "Market",
      address: "Nakagyo Ward, Kyoto, Japan",
      lat: 35.005,
      lng: 135.7649,
      notes:
        "A covered market filled with Kyoto's food shops and local specialties.",
    },
    {
      id: "kyoto-3",
      name: "Kiyomizu-dera",
      category: "Temple",
      address: "Higashiyama Ward, Kyoto, Japan",
      lat: 34.9948,
      lng: 135.785,
      notes:
        "A hillside temple overlooking Kyoto, near the lanes of Sannenzaka.",
    },
  ],
  thailand: [
    {
      id: "thai-1",
      name: "Wat Arun",
      category: "Temple",
      address: "Bangkok Yai, Bangkok, Thailand",
      lat: 13.7437,
      lng: 100.4889,
      notes: "The Temple of Dawn on the banks of the Chao Phraya.",
    },
    {
      id: "thai-2",
      name: "Chatuchak Weekend Market",
      category: "Market",
      address: "Chatuchak, Bangkok, Thailand",
      lat: 13.7999,
      lng: 100.5502,
      notes:
        "Explore the market's many sections and keep track of the places you visit.",
    },
    {
      id: "thai-3",
      name: "Lumphini Park",
      category: "Park",
      address: "Pathum Wan, Bangkok, Thailand",
      lat: 13.7306,
      lng: 100.5418,
      notes: "A green escape in the middle of Bangkok.",
    },
  ],
  bali: [
    {
      id: "bali-1",
      name: "Sacred Monkey Forest",
      category: "Nature",
      address: "Ubud, Bali, Indonesia",
      lat: -8.5188,
      lng: 115.2586,
      notes: "A forest sanctuary with shaded paths and temple grounds.",
    },
    {
      id: "bali-2",
      name: "Tegallalang Rice Terraces",
      category: "Viewpoint",
      address: "Tegallalang, Bali, Indonesia",
      lat: -8.4312,
      lng: 115.2793,
      notes: "Terraced rice fields north of Ubud.",
    },
    {
      id: "bali-3",
      name: "Ubud Palace",
      category: "Culture",
      address: "Ubud, Bali, Indonesia",
      lat: -8.5068,
      lng: 115.2625,
      notes: "Traditional Balinese architecture in the heart of Ubud.",
    },
  ],
};
export function destinationFor(place) {
  const text = `${place.address || ""} ${place.name || ""}`.toLowerCase();
  if (/japan|kyoto|tokyo|osaka/.test(text)) return DESTINATIONS[0];
  if (/thailand|bangkok|phuket|chiang mai/.test(text)) return DESTINATIONS[1];
  if (/bali|ubud/.test(text)) return DESTINATIONS[2];
  return null;
}
