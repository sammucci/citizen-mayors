// Curated list of Philadelphia neighborhood names, used for the
// autocomplete on the "Neighborhood" geography field. Swapped in for
// live Nominatim (OpenStreetMap) lookups because Nominatim is a general
// address geocoder — it matches whole words against its index and
// doesn't do true as-you-type prefix matching, so "Fish" wouldn't
// surface "Fishtown" until you'd typed most of the word. A fixed list
// filters instantly on every keystroke and guarantees correct, consistent
// spelling/capitalization since there's nothing to mistype into it.
//
// Not exhaustive — Philadelphia's neighborhood boundaries are informal
// and overlapping, and different residents draw them differently. This
// covers the commonly used names across the city. If a neighborhood is
// missing, it's easy to add: just append the name below.
export const PHILLY_NEIGHBORHOODS = [
  // Center City
  "Rittenhouse Square",
  "Washington Square West",
  "Society Hill",
  "Old City",
  "Chinatown",
  "Logan Square",
  "Fitler Square",
  "Avenue of the Arts",
  "Callowhill",
  "Franklintown",

  // South Philadelphia
  "Bella Vista",
  "Queen Village",
  "Passyunk Square",
  "East Passyunk",
  "Pennsport",
  "Point Breeze",
  "Grays Ferry",
  "Newbold",
  "Girard Estate",
  "Packer Park",
  "Whitman",
  "Wharton",
  "Lower Moyamensing",
  "Italian Market",
  "Marconi Plaza",
  "Dickinson Narrows",
  "Melrose Park Gardens",

  // River Wards / Lower North
  "Northern Liberties",
  "Fishtown",
  "Kensington",
  "East Kensington",
  "West Kensington",
  "Port Richmond",
  "Bridesburg",
  "Harrowgate",
  "Olde Kensington",

  // North Philadelphia
  "Fairhill",
  "Hunting Park",
  "Nicetown-Tioga",
  "Franklinville",
  "Feltonville",
  "Juniata Park",
  "Olney",
  "Fern Rock",
  "Logan",
  "Strawberry Mansion",
  "Brewerytown",
  "Sharswood",
  "Francisville",
  "Yorktown",
  "Ludlow",
  "Glenwood",
  "Templetown",
  "Cabot",

  // West Philadelphia
  "University City",
  "Powelton Village",
  "Mantua",
  "Spruce Hill",
  "Cedar Park",
  "Cobbs Creek",
  "Walnut Hill",
  "Haddington",
  "Overbrook",
  "Wynnefield",
  "Wynnefield Heights",
  "Parkside",
  "Mill Creek",
  "Kingsessing",
  "Angora",
  "Elmwood",
  "Eastwick",
  "Garden Court",
  "Squirrel Hill",
  "Belmont",

  // Northwest Philadelphia
  "Manayunk",
  "Roxborough",
  "East Falls",
  "Germantown",
  "East Mount Airy",
  "West Mount Airy",
  "Chestnut Hill",
  "Wissahickon",
  "Andorra",
  "Upper Roxborough",
  "Germantown-Penn Knox",

  // Northeast Philadelphia
  "Fox Chase",
  "Rhawnhurst",
  "Mayfair",
  "Holmesburg",
  "Tacony",
  "Wissinoming",
  "Frankford",
  "Oxford Circle",
  "Bustleton",
  "Somerton",
  "Torresdale",
  "Academy Gardens",
  "Pennypack",
  "Rockledge",
  "Lawncrest",
  "Crescentville",
  "Lawndale",
  "Burholme",
  "Winchester Park",
  "Millbrook",
  "Morrell Park",
  "Parkwood",
  "Modena Park",
  "Normandy Village",
  "Byberry",
];
