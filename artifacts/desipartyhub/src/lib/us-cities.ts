// A curated list of ~450 well-known US cities paired with their state, used
// to power the city-typeahead on the Events forms. This intentionally isn't
// an exhaustive gazetteer (that would be tens of thousands of rows and slow
// to search) - it's weighted toward state capitals and the largest/most
// recognizable cities in each state, which covers the vast majority of
// places a real event would be held. Users can always type a city that
// isn't in this list; the suggestions are a convenience, not a restriction.
export interface USCity {
  city: string;
  state: string;
}

const RAW: [string, string][] = [
  // Alabama
  ["Birmingham", "Alabama"], ["Montgomery", "Alabama"], ["Huntsville", "Alabama"], ["Mobile", "Alabama"], ["Tuscaloosa", "Alabama"],
  // Alaska
  ["Anchorage", "Alaska"], ["Fairbanks", "Alaska"], ["Juneau", "Alaska"],
  // Arizona
  ["Phoenix", "Arizona"], ["Tucson", "Arizona"], ["Mesa", "Arizona"], ["Chandler", "Arizona"], ["Scottsdale", "Arizona"], ["Gilbert", "Arizona"], ["Tempe", "Arizona"], ["Peoria", "Arizona"],
  // Arkansas
  ["Little Rock", "Arkansas"], ["Fayetteville", "Arkansas"], ["Fort Smith", "Arkansas"],
  // California
  ["Los Angeles", "California"], ["San Diego", "California"], ["San Jose", "California"], ["San Francisco", "California"], ["Fresno", "California"], ["Sacramento", "California"], ["Long Beach", "California"], ["Oakland", "California"], ["Bakersfield", "California"], ["Anaheim", "California"], ["Santa Ana", "California"], ["Riverside", "California"], ["Irvine", "California"], ["Chula Vista", "California"], ["Fremont", "California"], ["San Bernardino", "California"], ["Modesto", "California"], ["Fontana", "California"], ["Oxnard", "California"], ["Moreno Valley", "California"], ["Huntington Beach", "California"], ["Glendale", "California"], ["Santa Clarita", "California"], ["Garden Grove", "California"], ["Santa Rosa", "California"], ["Oceanside", "California"], ["Rancho Cucamonga", "California"], ["Ontario", "California"], ["Elk Grove", "California"], ["Corona", "California"], ["Lancaster", "California"], ["Palmdale", "California"], ["Salinas", "California"], ["Pomona", "California"], ["Hayward", "California"], ["Escondido", "California"], ["Sunnyvale", "California"], ["Torrance", "California"], ["Pasadena", "California"], ["Orange", "California"], ["Fullerton", "California"], ["Thousand Oaks", "California"], ["Visalia", "California"], ["Simi Valley", "California"], ["Concord", "California"], ["Roseville", "California"], ["Santa Clara", "California"], ["Vallejo", "California"], ["Berkeley", "California"], ["El Monte", "California"], ["Downey", "California"], ["Milpitas", "California"], ["San Ramon", "California"], ["Cupertino", "California"], ["San Mateo", "California"], ["Union City", "California"], ["Newark", "California"], ["Pleasanton", "California"], ["Dublin", "California"], ["Walnut Creek", "California"], ["Fremont", "California"], ["Cerritos", "California"], ["Artesia", "California"],
  // Colorado
  ["Denver", "Colorado"], ["Colorado Springs", "Colorado"], ["Aurora", "Colorado"], ["Fort Collins", "Colorado"], ["Lakewood", "Colorado"], ["Boulder", "Colorado"], ["Highlands Ranch", "Colorado"], ["Centennial", "Colorado"], ["Greeley", "Colorado"], ["Westminster", "Colorado"],
  // Connecticut
  ["Bridgeport", "Connecticut"], ["New Haven", "Connecticut"], ["Hartford", "Connecticut"], ["Stamford", "Connecticut"], ["Waterbury", "Connecticut"], ["Norwalk", "Connecticut"], ["Danbury", "Connecticut"],
  // Delaware
  ["Wilmington", "Delaware"], ["Dover", "Delaware"], ["Newark", "Delaware"],
  // Florida
  ["Jacksonville", "Florida"], ["Miami", "Florida"], ["Tampa", "Florida"], ["Orlando", "Florida"], ["St. Petersburg", "Florida"], ["Hialeah", "Florida"], ["Tallahassee", "Florida"], ["Fort Lauderdale", "Florida"], ["Port St. Lucie", "Florida"], ["Cape Coral", "Florida"], ["Pembroke Pines", "Florida"], ["Hollywood", "Florida"], ["Gainesville", "Florida"], ["Miramar", "Florida"], ["Coral Springs", "Florida"], ["West Palm Beach", "Florida"], ["Lakeland", "Florida"], ["Pompano Beach", "Florida"], ["Davie", "Florida"], ["Miami Gardens", "Florida"], ["Boca Raton", "Florida"], ["Sunrise", "Florida"], ["Plantation", "Florida"], ["Deltona", "Florida"], ["Palm Bay", "Florida"], ["Largo", "Florida"], ["Melbourne", "Florida"], ["Kissimmee", "Florida"], ["Sarasota", "Florida"], ["Clearwater", "Florida"], ["Naples", "Florida"], ["Fort Myers", "Florida"],
  // Georgia
  ["Atlanta", "Georgia"], ["Augusta", "Georgia"], ["Columbus", "Georgia"], ["Macon", "Georgia"], ["Savannah", "Georgia"], ["Athens", "Georgia"], ["Sandy Springs", "Georgia"], ["Roswell", "Georgia"], ["Johns Creek", "Georgia"], ["Albany", "Georgia"], ["Alpharetta", "Georgia"], ["Marietta", "Georgia"], ["Smyrna", "Georgia"], ["Duluth", "Georgia"], ["Lawrenceville", "Georgia"], ["Suwanee", "Georgia"], ["Norcross", "Georgia"], ["Peachtree Corners", "Georgia"],
  // Hawaii
  ["Honolulu", "Hawaii"], ["Hilo", "Hawaii"], ["Kailua", "Hawaii"],
  // Idaho
  ["Boise", "Idaho"], ["Meridian", "Idaho"], ["Nampa", "Idaho"], ["Idaho Falls", "Idaho"],
  // Illinois
  ["Chicago", "Illinois"], ["Aurora", "Illinois"], ["Naperville", "Illinois"], ["Joliet", "Illinois"], ["Rockford", "Illinois"], ["Springfield", "Illinois"], ["Elgin", "Illinois"], ["Peoria", "Illinois"], ["Champaign", "Illinois"], ["Waukegan", "Illinois"], ["Cicero", "Illinois"], ["Schaumburg", "Illinois"], ["Bolingbrook", "Illinois"], ["Evanston", "Illinois"], ["Skokie", "Illinois"], ["Arlington Heights", "Illinois"], ["Des Plaines", "Illinois"], ["Oak Lawn", "Illinois"], ["Berwyn", "Illinois"], ["Tinley Park", "Illinois"], ["Orland Park", "Illinois"], ["Hoffman Estates", "Illinois"], ["Vernon Hills", "Illinois"],
  // Indiana
  ["Indianapolis", "Indiana"], ["Fort Wayne", "Indiana"], ["Evansville", "Indiana"], ["South Bend", "Indiana"], ["Carmel", "Indiana"], ["Fishers", "Indiana"], ["Bloomington", "Indiana"],
  // Iowa
  ["Des Moines", "Iowa"], ["Cedar Rapids", "Iowa"], ["Davenport", "Iowa"], ["Iowa City", "Iowa"],
  // Kansas
  ["Wichita", "Kansas"], ["Overland Park", "Kansas"], ["Kansas City", "Kansas"], ["Topeka", "Kansas"], ["Olathe", "Kansas"], ["Lenexa", "Kansas"],
  // Kentucky
  ["Louisville", "Kentucky"], ["Lexington", "Kentucky"], ["Bowling Green", "Kentucky"],
  // Louisiana
  ["New Orleans", "Louisiana"], ["Baton Rouge", "Louisiana"], ["Shreveport", "Louisiana"], ["Lafayette", "Louisiana"], ["Metairie", "Louisiana"],
  // Maine
  ["Portland", "Maine"], ["Lewiston", "Maine"], ["Bangor", "Maine"],
  // Maryland
  ["Baltimore", "Maryland"], ["Columbia", "Maryland"], ["Germantown", "Maryland"], ["Silver Spring", "Maryland"], ["Waldorf", "Maryland"], ["Glen Burnie", "Maryland"], ["Ellicott City", "Maryland"], ["Frederick", "Maryland"], ["Gaithersburg", "Maryland"], ["Rockville", "Maryland"], ["Bethesda", "Maryland"], ["Bowie", "Maryland"], ["Annapolis", "Maryland"], ["Towson", "Maryland"], ["Bel Air", "Maryland"], ["Potomac", "Maryland"],
  // Massachusetts
  ["Boston", "Massachusetts"], ["Worcester", "Massachusetts"], ["Springfield", "Massachusetts"], ["Cambridge", "Massachusetts"], ["Lowell", "Massachusetts"], ["Brockton", "Massachusetts"], ["Quincy", "Massachusetts"], ["Lynn", "Massachusetts"], ["Newton", "Massachusetts"], ["Somerville", "Massachusetts"], ["Framingham", "Massachusetts"], ["Waltham", "Massachusetts"], ["Malden", "Massachusetts"], ["Medford", "Massachusetts"],
  // Michigan
  ["Detroit", "Michigan"], ["Grand Rapids", "Michigan"], ["Warren", "Michigan"], ["Sterling Heights", "Michigan"], ["Ann Arbor", "Michigan"], ["Lansing", "Michigan"], ["Flint", "Michigan"], ["Dearborn", "Michigan"], ["Livonia", "Michigan"], ["Troy", "Michigan"], ["Westland", "Michigan"], ["Farmington Hills", "Michigan"], ["Novi", "Michigan"], ["Canton", "Michigan"],
  // Minnesota
  ["Minneapolis", "Minnesota"], ["St. Paul", "Minnesota"], ["Rochester", "Minnesota"], ["Duluth", "Minnesota"], ["Bloomington", "Minnesota"], ["Brooklyn Park", "Minnesota"], ["Plymouth", "Minnesota"], ["Woodbury", "Minnesota"], ["Maple Grove", "Minnesota"], ["Eden Prairie", "Minnesota"], ["Eagan", "Minnesota"],
  // Mississippi
  ["Jackson", "Mississippi"], ["Gulfport", "Mississippi"], ["Southaven", "Mississippi"],
  // Missouri
  ["Kansas City", "Missouri"], ["St. Louis", "Missouri"], ["Springfield", "Missouri"], ["Columbia", "Missouri"], ["Independence", "Missouri"], ["O'Fallon", "Missouri"],
  // Montana
  ["Billings", "Montana"], ["Missoula", "Montana"], ["Bozeman", "Montana"],
  // Nebraska
  ["Omaha", "Nebraska"], ["Lincoln", "Nebraska"], ["Bellevue", "Nebraska"],
  // Nevada
  ["Las Vegas", "Nevada"], ["Henderson", "Nevada"], ["Reno", "Nevada"], ["North Las Vegas", "Nevada"], ["Sparks", "Nevada"],
  // New Hampshire
  ["Manchester", "New Hampshire"], ["Nashua", "New Hampshire"], ["Concord", "New Hampshire"],
  // New Jersey
  ["Newark", "New Jersey"], ["Jersey City", "New Jersey"], ["Paterson", "New Jersey"], ["Elizabeth", "New Jersey"], ["Edison", "New Jersey"], ["Woodbridge", "New Jersey"], ["Lakewood", "New Jersey"], ["Toms River", "New Jersey"], ["Hamilton", "New Jersey"], ["Trenton", "New Jersey"], ["Clifton", "New Jersey"], ["Camden", "New Jersey"], ["Cherry Hill", "New Jersey"], ["Passaic", "New Jersey"], ["Union City", "New Jersey"], ["East Orange", "New Jersey"], ["Bayonne", "New Jersey"], ["Franklin Township", "New Jersey"], ["Piscataway", "New Jersey"], ["New Brunswick", "New Jersey"], ["Perth Amboy", "New Jersey"], ["North Bergen", "New Jersey"], ["Vineland", "New Jersey"], ["Union", "New Jersey"], ["West New York", "New Jersey"], ["Old Bridge", "New Jersey"], ["Bridgewater", "New Jersey"], ["Hillsborough", "New Jersey"], ["Princeton", "New Jersey"], ["East Brunswick", "New Jersey"], ["Parsippany-Troy Hills", "New Jersey"], ["Montgomery Township", "New Jersey"], ["South Brunswick", "New Jersey"], ["Plainsboro", "New Jersey"], ["Monroe Township", "New Jersey"], ["Iselin", "New Jersey"], ["Edison", "New Jersey"],
  // New Mexico
  ["Albuquerque", "New Mexico"], ["Las Cruces", "New Mexico"], ["Rio Rancho", "New Mexico"], ["Santa Fe", "New Mexico"],
  // New York
  ["New York City", "New York"], ["Buffalo", "New York"], ["Rochester", "New York"], ["Yonkers", "New York"], ["Syracuse", "New York"], ["Albany", "New York"], ["New Rochelle", "New York"], ["Mount Vernon", "New York"], ["Schenectady", "New York"], ["Utica", "New York"], ["White Plains", "New York"], ["Hicksville", "New York"], ["Troy", "New York"], ["Niagara Falls", "New York"], ["Binghamton", "New York"], ["Freeport", "New York"], ["Valley Stream", "New York"], ["Long Beach", "New York"], ["Poughkeepsie", "New York"], ["Flushing", "New York"], ["Jericho", "New York"], ["Hempstead", "New York"],
  // North Carolina
  ["Charlotte", "North Carolina"], ["Raleigh", "North Carolina"], ["Greensboro", "North Carolina"], ["Durham", "North Carolina"], ["Winston-Salem", "North Carolina"], ["Fayetteville", "North Carolina"], ["Cary", "North Carolina"], ["Wilmington", "North Carolina"], ["High Point", "North Carolina"], ["Concord", "North Carolina"], ["Asheville", "North Carolina"], ["Chapel Hill", "North Carolina"], ["Huntersville", "North Carolina"], ["Apex", "North Carolina"], ["Morrisville", "North Carolina"],
  // North Dakota
  ["Fargo", "North Dakota"], ["Bismarck", "North Dakota"], ["Grand Forks", "North Dakota"],
  // Ohio
  ["Columbus", "Ohio"], ["Cleveland", "Ohio"], ["Cincinnati", "Ohio"], ["Toledo", "Ohio"], ["Akron", "Ohio"], ["Dayton", "Ohio"], ["Parma", "Ohio"], ["Canton", "Ohio"], ["Youngstown", "Ohio"], ["Lorain", "Ohio"], ["Hamilton", "Ohio"], ["Springfield", "Ohio"], ["Kettering", "Ohio"], ["Elyria", "Ohio"], ["Lakewood", "Ohio"], ["Cuyahoga Falls", "Ohio"], ["Middletown", "Ohio"], ["Mason", "Ohio"], ["Westerville", "Ohio"], ["Dublin", "Ohio"],
  // Oklahoma
  ["Oklahoma City", "Oklahoma"], ["Tulsa", "Oklahoma"], ["Norman", "Oklahoma"], ["Broken Arrow", "Oklahoma"], ["Edmond", "Oklahoma"],
  // Oregon
  ["Portland", "Oregon"], ["Eugene", "Oregon"], ["Salem", "Oregon"], ["Gresham", "Oregon"], ["Hillsboro", "Oregon"], ["Beaverton", "Oregon"], ["Bend", "Oregon"], ["Tigard", "Oregon"],
  // Pennsylvania
  ["Philadelphia", "Pennsylvania"], ["Pittsburgh", "Pennsylvania"], ["Allentown", "Pennsylvania"], ["Erie", "Pennsylvania"], ["Reading", "Pennsylvania"], ["Scranton", "Pennsylvania"], ["Bethlehem", "Pennsylvania"], ["Lancaster", "Pennsylvania"], ["Harrisburg", "Pennsylvania"], ["Altoona", "Pennsylvania"], ["King of Prussia", "Pennsylvania"], ["State College", "Pennsylvania"],
  // Rhode Island
  ["Providence", "Rhode Island"], ["Warwick", "Rhode Island"], ["Cranston", "Rhode Island"],
  // South Carolina
  ["Columbia", "South Carolina"], ["Charleston", "South Carolina"], ["North Charleston", "South Carolina"], ["Mount Pleasant", "South Carolina"], ["Rock Hill", "South Carolina"], ["Greenville", "South Carolina"],
  // South Dakota
  ["Sioux Falls", "South Dakota"], ["Rapid City", "South Dakota"],
  // Tennessee
  ["Nashville", "Tennessee"], ["Memphis", "Tennessee"], ["Knoxville", "Tennessee"], ["Chattanooga", "Tennessee"], ["Clarksville", "Tennessee"], ["Murfreesboro", "Tennessee"], ["Franklin", "Tennessee"],
  // Texas
  ["Houston", "Texas"], ["San Antonio", "Texas"], ["Dallas", "Texas"], ["Austin", "Texas"], ["Fort Worth", "Texas"], ["El Paso", "Texas"], ["Arlington", "Texas"], ["Corpus Christi", "Texas"], ["Plano", "Texas"], ["Laredo", "Texas"], ["Lubbock", "Texas"], ["Garland", "Texas"], ["Irving", "Texas"], ["Frisco", "Texas"], ["McKinney", "Texas"], ["Amarillo", "Texas"], ["Grand Prairie", "Texas"], ["Brownsville", "Texas"], ["Pasadena", "Texas"], ["Mesquite", "Texas"], ["McAllen", "Texas"], ["Killeen", "Texas"], ["Carrollton", "Texas"], ["Midland", "Texas"], ["Waco", "Texas"], ["Denton", "Texas"], ["Abilene", "Texas"], ["Odessa", "Texas"], ["Round Rock", "Texas"], ["Richardson", "Texas"], ["Pearland", "Texas"], ["League City", "Texas"], ["Sugar Land", "Texas"], ["Tyler", "Texas"], ["College Station", "Texas"], ["San Angelo", "Texas"], ["Allen", "Texas"], ["Wylie", "Texas"], ["Cedar Park", "Texas"], ["San Marcos", "Texas"], ["New Braunfels", "Texas"], ["Missouri City", "Texas"], ["Flower Mound", "Texas"], ["Katy", "Texas"], ["Spring", "Texas"], ["The Woodlands", "Texas"], ["Conroe", "Texas"], ["Baytown", "Texas"],
  // Utah
  ["Salt Lake City", "Utah"], ["West Valley City", "Utah"], ["Provo", "Utah"], ["West Jordan", "Utah"], ["Orem", "Utah"], ["Sandy", "Utah"], ["Ogden", "Utah"], ["St. George", "Utah"], ["Layton", "Utah"], ["Draper", "Utah"], ["Lehi", "Utah"],
  // Vermont
  ["Burlington", "Vermont"], ["South Burlington", "Vermont"],
  // Virginia
  ["Virginia Beach", "Virginia"], ["Norfolk", "Virginia"], ["Chesapeake", "Virginia"], ["Richmond", "Virginia"], ["Newport News", "Virginia"], ["Alexandria", "Virginia"], ["Hampton", "Virginia"], ["Roanoke", "Virginia"], ["Portsmouth", "Virginia"], ["Suffolk", "Virginia"], ["Fairfax", "Virginia"], ["Arlington", "Virginia"], ["Reston", "Virginia"], ["Ashburn", "Virginia"], ["Herndon", "Virginia"], ["Leesburg", "Virginia"], ["Sterling", "Virginia"], ["Manassas", "Virginia"], ["Woodbridge", "Virginia"], ["Chantilly", "Virginia"], ["Vienna", "Virginia"], ["McLean", "Virginia"], ["Centreville", "Virginia"], ["Fredericksburg", "Virginia"], ["Charlottesville", "Virginia"], ["Blacksburg", "Virginia"],
  // Washington
  ["Seattle", "Washington"], ["Spokane", "Washington"], ["Tacoma", "Washington"], ["Vancouver", "Washington"], ["Bellevue", "Washington"], ["Kent", "Washington"], ["Everett", "Washington"], ["Renton", "Washington"], ["Federal Way", "Washington"], ["Yakima", "Washington"], ["Redmond", "Washington"], ["Kirkland", "Washington"], ["Auburn", "Washington"], ["Sammamish", "Washington"], ["Bothell", "Washington"], ["Issaquah", "Washington"], ["Olympia", "Washington"],
  // West Virginia
  ["Charleston", "West Virginia"], ["Huntington", "West Virginia"], ["Morgantown", "West Virginia"],
  // Wisconsin
  ["Milwaukee", "Wisconsin"], ["Madison", "Wisconsin"], ["Green Bay", "Wisconsin"], ["Kenosha", "Wisconsin"], ["Racine", "Wisconsin"], ["Appleton", "Wisconsin"],
  // Wyoming
  ["Cheyenne", "Wyoming"], ["Casper", "Wyoming"],
  // District of Columbia
  ["Washington", "District of Columbia"],
];

export const US_CITIES: USCity[] = RAW.map(([city, state]) => ({ city, state }));

// Ranks startsWith matches ahead of contains matches (so typing "San" surfaces
// "San Francisco"/"San Diego"/"San Jose" before something like "Grand Sands"),
// then keeps each group in the dataset's original (population-weighted) order.
export function searchCities(query: string, limit = 7): USCity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: USCity[] = [];
  const contains: USCity[] = [];
  const seen = new Set<string>();
  for (const c of US_CITIES) {
    const key = `${c.city}, ${c.state}`;
    if (seen.has(key)) continue;
    const cl = c.city.toLowerCase();
    if (cl.startsWith(q)) {
      starts.push(c);
      seen.add(key);
    } else if (cl.includes(q)) {
      contains.push(c);
      seen.add(key);
    }
  }
  return [...starts, ...contains].slice(0, limit);
}
