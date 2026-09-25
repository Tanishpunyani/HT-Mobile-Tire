export interface CityData {
  slug: string;
  name: string;
  state: string;
  zipCodes: string[];
  neighborhoods: string[];
  headline: string;
  subheadline: string;
  metaDescription: string;
  localLandmarks: string[];
  averageResponseTime: string;
  serviceHighlights: string[];
  lat: number;
  lng: number;
  mapEmbedUrl: string;
  faqs: { question: string; answer: string }[];
}

export const CITIES: CityData[] = [
  {
    slug: "dallas",
    name: "Dallas",
    state: "TX",
    zipCodes: ["75201", "75202", "75204", "75205", "75206", "75214", "75219", "75225", "75230", "75240", "75248", "75287"],
    neighborhoods: [
      "Downtown Dallas",
      "Uptown & Arts District",
      "Deep Ellum",
      "Oak Lawn & Turtle Creek",
      "Lakewood & East Dallas",
      "Preston Hollow",
      "North Dallas",
      "Bishop Arts District",
      "Design District",
    ],
    headline: "Mobile Tire Repair & Installation in Dallas, TX",
    subheadline: "On-demand mobile tire service van dispatched directly to your driveway, office parking garage, or roadside breakdown.",
    metaDescription: "Fast, professional mobile tire repair & installation in Dallas, TX. We come directly to you with 28-min average response. Flat repairs, tire swaps, and new tires.",
    localLandmarks: [
      "American Airlines Center",
      "Dallas Arts District",
      "White Rock Lake",
      "Galleria Dallas",
      "Klyde Warren Park",
      "Fair Park",
    ],
    averageResponseTime: "25–35 minutes",
    serviceHighlights: [
      "24/7 Priority Roadside Emergency Response across I-35E, US-75, and Dallas North Tollway",
      "Touchless rim clamping & high-precision mobile laser balancing in your driveway",
      "Corporate fleet tire service in Downtown & Uptown Dallas parking structures",
      "Brand new Michelin, Goodyear, Continental, and quality used tires in-stock",
    ],
    lat: 32.7767,
    lng: -96.797,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d214543.62312644265!2d-96.89667794999999!3d32.8208451!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864c1e05a15e66d3%3A0xb54d0317b444a01e!2sDallas%2C%20TX!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus",
    faqs: [
      {
        question: "How fast can a mobile tire technician reach me in Dallas?",
        answer: "Our mobile tire service vans are staged across North Dallas, Downtown, and the Tollway corridor. Our average emergency response time in Dallas is 25 to 35 minutes.",
      },
      {
        question: "Can you change or patch tires inside a Dallas office parking garage?",
        answer: "Yes! Our custom mobile vans are designed with low-clearance equipment, allowing us to safely service and balance tires inside multi-story parking garages in Uptown, Downtown, and Galleria Dallas.",
      },
      {
        question: "Do you cover major highways around Dallas like I-35E, I-30, and US-75?",
        answer: "Yes, our emergency roadside mobile units are equipped with high-visibility safety beacons, heavy-duty jacks, and rapid dispatch tools for roadside assistance on all Dallas highways.",
      },
      {
        question: "What tire brands do you bring to my Dallas location?",
        answer: "We carry top OEM-approved brands including Michelin, Continental, Bridgestone, Goodyear, Pirelli, and inspected quality used tires for all vehicle types.",
      },
    ],
  },
  {
    slug: "fort-worth",
    name: "Fort Worth",
    state: "TX",
    zipCodes: ["76102", "76104", "76107", "76109", "76116", "76132", "76133", "76137", "76177", "76179"],
    neighborhoods: [
      "Downtown Fort Worth",
      "Sundance Square",
      "Fort Worth Stockyards",
      "Cultural District & West 7th",
      "TCU / Westcliff",
      "Alliance & North Fort Worth",
      "Mira Vista",
    ],
    headline: "Mobile Tire Repair & Roadside Service in Fort Worth, TX",
    subheadline: "Professional mobile tire installation and blowout repair brought straight to your home, ranch, or business.",
    metaDescription: "Fort Worth mobile tire repair and tire replacement at your location. 30-min response in Downtown, Stockyards, TCU & Alliance. Book online with zero wait times.",
    localLandmarks: [
      "Fort Worth Stockyards",
      "Sundance Square",
      "Dickies Arena",
      "Texas Motor Speedway",
      "Fort Worth Botanic Garden",
    ],
    averageResponseTime: "28–38 minutes",
    serviceHighlights: [
      "Rapid dispatch across I-30, I-35W, and Loop 820",
      "Heavy-duty truck, SUV, and commercial fleet mobile tire service",
      "Driveway tire mounting, valve stem repair, and laser wheel balancing",
      "Same-day seasonal tire swaps and new tire delivery",
    ],
    lat: 32.7555,
    lng: -97.3308,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d214647.7955562142!2d-97.46049285!3d32.7483789!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864e7c7fe28876c1%3A0x6b8408f654eb6518!2sFort%20Worth%2C%20TX!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus",
    faqs: [
      {
        question: "Do you service North Fort Worth and the Alliance corridor?",
        answer: "Yes, we have dedicated mobile service vans operating daily throughout North Fort Worth, Alliance, Keller, and Texas Motor Speedway areas.",
      },
      {
        question: "Can you install oversized tires on pickup trucks and SUVs in Fort Worth?",
        answer: "Absolutely. Our mobile tire service vans are equipped with heavy-duty rim mounting arms capable of handling truck wheels up to 24 inches without rim scratching.",
      },
      {
        question: "How do I pay for my mobile tire service in Fort Worth?",
        answer: "No upfront payment is required! You schedule your mobile appointment online, our technician completes the service at your location, and you receive an itemized quote payable via card, mobile pay, or cash.",
      },
    ],
  },
  {
    slug: "plano",
    name: "Plano",
    state: "TX",
    zipCodes: ["75023", "75024", "75025", "75074", "75075", "75093", "75094"],
    neighborhoods: [
      "Legacy West",
      "The Shops at Legacy",
      "West Plano",
      "Downtown Plano Historic District",
      "Willow Bend",
      "Prestonwood",
      "Russell Creek",
    ],
    headline: "Mobile Tire Repair & Tire Service in Plano, TX",
    subheadline: "Skip the tire shop waiting room. We replace, balance, and repair your tires at your Plano home or corporate office.",
    metaDescription: "Mobile tire repair in Plano, TX. Fast flat tire patches, rim swaps & new tire installation at Legacy West, Willow Bend, and across Plano. 25-min dispatch.",
    localLandmarks: [
      "Legacy West",
      "The Shops at Legacy",
      "Arbor Hills Nature Preserve",
      "Oak Point Park",
      "Historic Downtown Plano",
    ],
    averageResponseTime: "20–30 minutes",
    serviceHighlights: [
      "Convenient corporate campus service at Legacy West & Granite Park",
      "EV & luxury vehicle certified (Tesla, BMW, Porsche, Mercedes-Benz)",
      "Zero-scratch touchless tire changing and precision balancing",
      "24/7 roadside emergency tire dispatch on US-75 & Dallas North Tollway",
    ],
    lat: 33.0198,
    lng: -96.6989,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d106972.3396865249!2d-96.786524!3d33.019843!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864c19f77b759361%3A0xd64f15d97034c449!2sPlano%2C%20TX!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus",
    faqs: [
      {
        question: "Can I get my tires replaced while working at Legacy West?",
        answer: "Yes! Many of our Plano customers book service while at work. We perform full tire installation and balancing in your office parking lot so your car is ready when you leave.",
      },
      {
        question: "Do you have special equipment for Tesla and EV tires in Plano?",
        answer: "Yes, our mobile technicians carry EV jack pads, specialized acoustic foam-compatible tire mounting tools, and high-load index tires specifically for electric vehicles.",
      },
      {
        question: "What is the typical arrival time in West Plano?",
        answer: "Our mobile clinic vans average an arrival time of 20 to 30 minutes throughout Plano.",
      },
    ],
  },
  {
    slug: "arlington",
    name: "Arlington",
    state: "TX",
    zipCodes: ["76001", "76002", "76006", "76010", "76011", "76012", "76013", "76014", "76015", "76016", "76017", "76018"],
    neighborhoods: [
      "Entertainment District",
      "Downtown Arlington",
      "UTA Campus Area",
      "North Arlington & Viridian",
      "South Arlington",
      "Dalworthington Gardens",
      "Pantego",
    ],
    headline: "Mobile Tire Repair & Roadside Assistance in Arlington, TX",
    subheadline: "Fast mobile tire replacement, puncture repairs, and emergency roadside dispatch near AT&T Stadium and across Arlington.",
    metaDescription: "Arlington mobile tire repair and emergency tire service. Staged near AT&T Stadium, Globe Life Field & UTA with 25-min response. Call or book online now.",
    localLandmarks: [
      "AT&T Stadium",
      "Globe Life Field",
      "Six Flags Over Texas",
      "UTA Planetarium",
      "River Legacy Parks",
    ],
    averageResponseTime: "25–35 minutes",
    serviceHighlights: [
      "Emergency tire dispatch near AT&T Stadium, Globe Life Field, and Six Flags",
      "Driveway and commercial parking tire service across I-20, I-30, and Hwy 360",
      "Laser wheel balancing & high-performance sport tire installation",
      "Full fleet tire maintenance for local Arlington logistics providers",
    ],
    lat: 32.7357,
    lng: -97.1081,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d107380.08272825414!2d-97.195029!3d32.735687!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864e7d3839211c4b%3A0xb35a8dfd6b1d1db2!2sArlington%2C%20TX!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus",
    faqs: [
      {
        question: "Can you help if I get a flat tire near AT&T Stadium or Six Flags?",
        answer: "Yes, our mobile vans frequently assist drivers in the Arlington Entertainment District parking lots and surrounding roads with rapid 25-minute response.",
      },
      {
        question: "Do you offer mobile rim swaps for winter or all-season tires?",
        answer: "Yes! We can swap your mounted tire and rim sets right in your driveway and laser balance them on-site.",
      },
      {
        question: "Is there an extra mobile call-out charge in Arlington?",
        answer: "No hidden charges! Our upfront pricing includes dispatch, installation, and laser balancing.",
      },
    ],
  },
  {
    slug: "irving",
    name: "Irving",
    state: "TX",
    zipCodes: ["75038", "75039", "75060", "75061", "75062", "75063"],
    neighborhoods: [
      "Las Colinas",
      "Valley Ranch",
      "Heritage District",
      "North Irving",
      "DFW Airport Area",
      "Toyota Music Factory",
    ],
    headline: "Mobile Tire Repair & Installation in Irving & Las Colinas, TX",
    subheadline: "On-demand tire replacement and puncture repair at your home, corporate office, or near DFW Airport.",
    metaDescription: "Mobile tire repair in Irving & Las Colinas, TX. Rapid 25-min mobile tire dispatch near DFW Airport, Toyota Music Factory, and Las Colinas business centers.",
    localLandmarks: [
      "Las Colinas Urban Center",
      "Toyota Music Factory",
      "Mandalay Canals",
      "DFW International Airport",
      "Mustangs of Las Colinas",
    ],
    averageResponseTime: "20–30 minutes",
    serviceHighlights: [
      "Rapid dispatch near DFW International Airport and SH-114 corridor",
      "Corporate office tire service across Las Colinas high-rises",
      "Emergency blowout repair on SH-161 George Bush Turnpike and I-635",
      "Complete mobile tire balancing and touchless wheel care",
    ],
    lat: 32.814,
    lng: -96.9489,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d107238.16335123019!2d-97.028942!3d32.814018!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864c29c8e8609559%3A0xbbfd1a7f4aa3f631!2sIrving%2C%20TX!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus",
    faqs: [
      {
        question: "Do you service vehicles parked near DFW International Airport?",
        answer: "Yes, we regularly service travelers and airport personnel in short/long-term parking areas, airport hotels, and surrounding logistics centers.",
      },
      {
        question: "Can you repair a flat tire in a Las Colinas corporate parking garage?",
        answer: "Yes, our mobile clinic vans are equipped to operate safely in covered parking decks throughout Las Colinas and Irving.",
      },
    ],
  },
  {
    slug: "garland",
    name: "Garland",
    state: "TX",
    zipCodes: ["75040", "75041", "75042", "75043", "75044"],
    neighborhoods: [
      "Historic Downtown Garland",
      "Firewheel",
      "Spring Creek",
      "North Garland",
      "South Garland",
      "Lake Ray Hubbard Area",
    ],
    headline: "Mobile Tire Repair & Roadside Assistance in Garland, TX",
    subheadline: "Convenient driveway tire replacement and 24/7 emergency puncture repair across Garland and Firewheel.",
    metaDescription: "Garland mobile tire repair & installation service. 25-min emergency response near Firewheel Town Center, I-635, and Lake Ray Hubbard. Book online today.",
    localLandmarks: [
      "Firewheel Town Center",
      "Spring Creek Forest Preserve",
      "Granville Arts Center",
      "Lake Ray Hubbard",
      "Historic Downtown Garland",
    ],
    averageResponseTime: "25–35 minutes",
    serviceHighlights: [
      "Driveway tire installation in residential neighborhoods and Firewheel",
      "Emergency tire service along I-635 LBJ Freeway and President George Bush Turnpike",
      "Trailer, boat trailer, and RV tire repair near Lake Ray Hubbard",
      "Tire plug & patch repairs, new tire mounting, and bead leak sealing",
    ],
    lat: 32.9126,
    lng: -96.6389,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d107085.1278148908!2d-96.72149!3d32.912618!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864ea1496a7593c7%3A0xc3f3c4d51a6b0c2a!2sGarland%2C%20TX!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus",
    faqs: [
      {
        question: "Do you service boat trailers near Lake Ray Hubbard in Garland?",
        answer: "Yes! Our mobile technicians carry specialty trailer tire jacks and replacement trailer tires for marine and utility trailers.",
      },
      {
        question: "How fast can you reach Firewheel Town Center in Garland?",
        answer: "Our North Garland mobile units average 20 to 30 minutes to Firewheel and surrounding communities.",
      },
    ],
  },
  {
    slug: "frisco",
    name: "Frisco",
    state: "TX",
    zipCodes: ["75033", "75034", "75035", "75036"],
    neighborhoods: [
      "The Star (Dallas Cowboys HQ)",
      "Frisco Square",
      "Stonebriar",
      "PGA Frisco",
      "Newman Village",
      "Phillips Creek Ranch",
    ],
    headline: "Mobile Tire Repair & Luxury Tire Service in Frisco, TX",
    subheadline: "Premium mobile tire installation and blowout repair delivered to your driveway, office, or The Star in Frisco.",
    metaDescription: "Frisco mobile tire service. Professional mobile tire installation & emergency repair at The Star, PGA Frisco & Stonebriar. Certified EV & luxury vehicle care.",
    localLandmarks: [
      "The Star in Frisco",
      "PGA Frisco",
      "Toyota Stadium",
      "Stonebriar Centre",
      "National Videogame Museum",
    ],
    averageResponseTime: "20–30 minutes",
    serviceHighlights: [
      "High-end luxury and electric vehicle tire mounting & laser balancing",
      "Convenient service while you work at Frisco Square & Hall Park",
      "Emergency blowout dispatch along Dallas North Tollway & SH-121",
      "Touchless rim clamping guarantee on premium alloy wheels",
    ],
    lat: 33.1507,
    lng: -96.8236,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d106742.6105342247!2d-96.906192!3d33.150674!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864c3c1be0b75961%3A0xe510c4314c00f0aa!2sFrisco%2C%20TX!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus",
    faqs: [
      {
        question: "Can you install performance tires on high-end vehicles in Frisco?",
        answer: "Yes, our mobile clinic vans are equipped with computerized touchless changers engineered specifically for low-profile and luxury wheels up to 24 inches.",
      },
      {
        question: "Do you come to residential communities like Stonebriar or Newman Village?",
        answer: "Yes, we service driveways in all gated and master-planned neighborhoods throughout Frisco daily.",
      },
    ],
  },
];

export function getAllCities(): CityData[] {
  return CITIES;
}

export function getCityBySlug(slug: string): CityData | undefined {
  return CITIES.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
}

export function getAllCitySlugs(): string[] {
  return CITIES.map((c) => c.slug);
}
