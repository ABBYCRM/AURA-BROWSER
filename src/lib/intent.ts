// Query intent detection. Used to decide which search sources to consult
// and whether to surface a Wikipedia knowledge card.
//
// Returns an object with categorical flags — they aren't mutually exclusive.
// Callers can pick: e.g. isCommercial → skip Wikipedia; isTopic → show card.

const COMMERCIAL_PATTERNS: RegExp[] = [
  // Shopping
  /\b(for sale|for rent|buy|shop|order|price|pricing|cost|cheap|cheapest|affordable|discount|coupon|deal|shipping|delivery)\b/i,
  // Real estate
  /\b(house|houses|home|homes|apartment|apt|condo|townhouse|property|properties|real estate|realtor|listing|listings|mls|bedroom|bedrooms|bathroom|bathrooms|sqft|square feet|square foot)\b/i,
  // Jobs
  /\b(job|jobs|hiring|career|careers|vacancy|vacancies|salary|recruit|recruiting|employment|internship)\b/i,
  // Local
  /\b(near me|nearby|closest|nearest|in my area|local|open now|open today|hours|menu|reservation|book a table|reserve)\b/i,
  // Travel & tickets
  /\b(flight|flights|hotel|hotels|airbnb|booking|ticket|tickets|fare|itinerary)\b/i,
  // Reviews / compare
  /\b(review|reviews|vs\.?|versus|alternative|alternatives|comparison|compare)\b/i,
  // Rentals / services
  /\b(rental|lease|cars for|cars sale|used car|new car|insurance|loan|loans|mortgage| refinance)\b/i,
];

const TOPIC_PATTERNS: RegExp[] = [
  // Definitional
  /^(what|who|when|where|why|how|which|define|meaning of|definition of)\b/i,
  /\b(history of|origin of|background of|biography of|timeline of|theory of|law of)\b/i,
  // Educational
  /\b(explain|explanation|tutorial|guide|introduction to|intro to|learn|lesson)\b/i,
  // Factual
  /\b(causes of|effects of|symptoms of|treatment of|cure for)\b/i,
];

const TECH_PATTERNS: RegExp[] = [
  /\b(api|sdk|library|framework|tutorial|docs|documentation|github|npm|pip|cargo)\b/i,
  /\b(javascript|typescript|python|rust|golang|java|c\+\+|ruby|swift|kotlin|php)\b/i,
  /\b(react|vue|angular|svelte|nextjs|nodejs|deno|bun|tailwind|graphql|postgres|mysql|redis)\b/i,
  /\b(llm|gpt|claude|gemini|openai|anthropic|machine learning|deep learning|neural network|transformer)\b/i,
];

const NEWS_PATTERNS: RegExp[] = [
  /\b(news|headlines|breaking|latest|today|this week|recent)\b/i,
];

const ACADEMIC_PATTERNS: RegExp[] = [
  /\b(research paper|study|meta-analysis|systematic review|peer[- ]reviewed|journal|published|arxiv|preprint|citation|doi)\b/i,
  /\b(clinical trial|randomized|placebo|cohort|prospective|retrospective)\b/i,
];

export interface QueryIntent {
  isCommercial: boolean;
  isTopic: boolean;
  isTech: boolean;
  isNews: boolean;
  isAcademic: boolean;
  isLocal: boolean;
  isProduct: boolean;
  // For commercial/local queries, suggest specific verticals
  vertical?:
    | "real-estate"
    | "shopping"
    | "jobs"
    | "travel"
    | "restaurants"
    | "services"
    | "vehicles"
    | "general";
}

export function detectIntent(q: string): QueryIntent {
  const query = q.trim();
  const result: QueryIntent = {
    isCommercial: false,
    isTopic: false,
    isTech: false,
    isNews: false,
    isAcademic: false,
    isLocal: false,
    isProduct: false,
  };

  if (!query) return result;

  for (const re of COMMERCIAL_PATTERNS) {
    if (re.test(query)) {
      result.isCommercial = true;
      break;
    }
  }
  for (const re of TOPIC_PATTERNS) {
    if (re.test(query)) {
      result.isTopic = true;
      break;
    }
  }
  for (const re of TECH_PATTERNS) {
    if (re.test(query)) {
      result.isTech = true;
      break;
    }
  }
  for (const re of NEWS_PATTERNS) {
    if (re.test(query)) {
      result.isNews = true;
      break;
    }
  }
  for (const re of ACADEMIC_PATTERNS) {
    if (re.test(query)) {
      result.isAcademic = true;
      break;
    }
  }

  // Local intent often coexists with commercial
  if (/\b(near me|nearby|in my area|local|closest|nearest)\b/i.test(query)) {
    result.isLocal = true;
  }

  // Detect vertical
  if (/\b(house|houses|home|homes|apartment|condo|property|real estate|realtor|listing|mls|bedroom|townhouse)\b/i.test(query)) {
    result.vertical = "real-estate";
  } else if (/\b(job|jobs|hiring|career|vacancy|employment|internship)\b/i.test(query)) {
    result.vertical = "jobs";
  } else if (/\b(flight|flights|hotel|airbnb|vacation|booking)\b/i.test(query)) {
    result.vertical = "travel";
  } else if (/\b(restaurant|restaurants|cafe|food|pizza|sushi|bar|eat|dining)\b/i.test(query)) {
    result.vertical = "restaurants";
  } else if (/\b(car|cars|truck|vehicle|auto|toyota|honda|tesla|bmw|ford)\b/i.test(query)) {
    result.vertical = "vehicles";
  } else if (/\b(insurance|loan|mortgage|plumber|electrician|lawyer|doctor|dentist)\b/i.test(query)) {
    result.vertical = "services";
  } else if (result.isCommercial) {
    result.vertical = "shopping";
  }

  return result;
}

// Suggested "shortcut" links for verticals — these are the obvious first stops.
export const VERTICAL_PORTALS: Record<
  NonNullable<QueryIntent["vertical"]>,
  { name: string; url: string; emoji: string; description: string }[]
> = {
  "real-estate": [
    { name: "Zillow", url: "https://www.zillow.com", emoji: "🏠", description: "Listings, prices, Zestimate" },
    { name: "Realtor.com", url: "https://www.realtor.com", emoji: "🔑", description: "MLS listings" },
    { name: "Redfin", url: "https://www.redfin.com", emoji: "🟥", description: "Map-based search" },
    { name: "Trulia", url: "https://www.trulia.com", emoji: "🌳", description: "Local insights" },
  ],
  shopping: [
    { name: "Amazon", url: "https://www.amazon.com", emoji: "📦", description: "Everything store" },
    { name: "eBay", url: "https://www.ebay.com", emoji: "🛒", description: "Auctions & deals" },
    { name: "Etsy", url: "https://www.etsy.com", emoji: "🎨", description: "Handmade & vintage" },
  ],
  jobs: [
    { name: "LinkedIn", url: "https://www.linkedin.com/jobs", emoji: "💼", description: "Professional network" },
    { name: "Indeed", url: "https://www.indeed.com", emoji: "🔍", description: "Job search engine" },
    { name: "Glassdoor", url: "https://www.glassdoor.com", emoji: "🚪", description: "Jobs + company reviews" },
  ],
  travel: [
    { name: "Google Flights", url: "https://www.google.com/travel/flights", emoji: "✈️", description: "Compare fares" },
    { name: "Kayak", url: "https://www.kayak.com", emoji: "🛶", description: "Meta-search" },
    { name: "Booking.com", url: "https://www.booking.com", emoji: "🏨", description: "Hotels" },
  ],
  restaurants: [
    { name: "Yelp", url: "https://www.yelp.com", emoji: "⭐", description: "Reviews & menus" },
    { name: "Google Maps", url: "https://maps.google.com", emoji: "🗺️", description: "Find nearby" },
    { name: "OpenTable", url: "https://www.opentable.com", emoji: "🍽️", description: "Reservations" },
  ],
  services: [
    { name: "Yelp", url: "https://www.yelp.com", emoji: "⭐", description: "Local pros" },
    { name: "Angie's List", url: "https://www.angi.com", emoji: "🛠️", description: "Home services" },
  ],
  vehicles: [
    { name: "Cars.com", url: "https://www.cars.com", emoji: "🚗", description: "New & used" },
    { name: "AutoTrader", url: "https://www.autotrader.com", emoji: "🚙", description: "Listings" },
    { name: "CarGurus", url: "https://www.cargurus.com", emoji: "📊", description: "Price comparisons" },
  ],
  general: [],
};
