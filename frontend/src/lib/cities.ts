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
  lat?: number;
  lng?: number;
  mapEmbedUrl: string;
  faqs: { question: string; answer: string }[];
}

export const CITIES: CityData[] = [
  {
    slug: "brampton",
    name: "Brampton",
    state: "ON",
    zipCodes: [],
    neighborhoods: [
      "Bramalea",
      "Downtown Brampton",
      "Mount Pleasant",
      "Springdale",
      "Castlemore",
      "Heart Lake",
      "Credit Valley",
      "Fletcher's Meadow",
      "Snelgrove",
    ],
    headline: "Mobile Tire Repair & Installation in Brampton, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Brampton.",
    metaDescription: "Book mobile tire services in Brampton, including new and used tires, rim swaps, wheel balancing and flat tire repair. 24/7 emergency roadside assistance.",
    localLandmarks: [
      "Highway 410",
      "Highway 407 ETR",
      "Queen Street",
      "Bovaird Drive",
      "Steeles Avenue",
      "Bramalea City Centre",
      "Mount Pleasant GO Station",
      "Bramalea GO Station",
    ],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire service dispatched directly to your vehicle location in Brampton",
      "Scheduled appointments for residential driveways, workplaces, and commercial sites",
      "New and used tires, seasonal rim swaps, computerized balancing, flat repair, and fleet service",
      "24/7 emergency roadside tire assistance available across Brampton",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Brampton%2C+ON&output=embed",
    faqs: [
      {
        question: "Does HT Mobile Tire provide mobile tire service in Brampton?",
        answer: "Yes, HT Mobile Tire provides on-site mobile tire service across Brampton. Our fully equipped mobile tire van travels directly to your vehicle's location at your home, workplace, or roadside.",
      },
      {
        question: "Can I book new or used tire installation in Brampton?",
        answer: "Yes, you can order new or quality inspected pre-owned tires and have them delivered, mounted, and balanced directly at your location in Brampton by scheduled appointment.",
      },
      {
        question: "Can I schedule a rim and tire swap at my location?",
        answer: "Yes, we provide seasonal tire changeovers and rim swaps at your residential driveway or workplace in Brampton, eliminating the need to haul tires to a shop.",
      },
      {
        question: "Is mobile wheel balancing available in Brampton?",
        answer: "Yes, our mobile service van is equipped with computerized wheel balancing equipment to balance wheels on-site, helping eliminate highway vibration and promote even tire wear.",
      },
      {
        question: "Can I request mobile flat tire repair?",
        answer: "Yes, we perform on-site flat tire repairs for punctures within the safe repairable tread area at your location in Brampton, or install your spare tire if the tire cannot be safely repaired.",
      },
      {
        question: "Does HT Mobile Tire provide fleet tire services?",
        answer: "Yes, we offer scheduled mobile tire servicing, maintenance, and repair for commercial vans and business fleets in Brampton to help minimize fleet downtime.",
      },
      {
        question: "Are regular mobile tire services available by appointment?",
        answer: "Yes, regular mobile tire services—including new tire installation, seasonal swaps, wheel balancing, and non-urgent repairs—are scheduled by appointment through our website or by phone.",
      },
      {
        question: "Is emergency roadside tire assistance available 24/7?",
        answer: "Yes, emergency roadside tire assistance is available 24/7 across Brampton for urgent situations such as sudden punctures, blowouts, or spare tire installations. Call +1 (647) 995-6665 for immediate dispatch.",
      },
    ],
  },
  {
    slug: "toronto",
    name: "Toronto",
    state: "ON",
    zipCodes: [],
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in Toronto, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Toronto.",
    metaDescription: "Professional mobile tire repair & installation in Toronto, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Toronto%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in Toronto?",
        answer: "Our mobile tire service van comes directly to your location in Toronto equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in Toronto?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
      },
    ],
  },
  {
    slug: "mississauga",
    name: "Mississauga",
    state: "ON",
    zipCodes: [],
    neighborhoods: [
      "Port Credit",
      "Streetsville",
      "Meadowvale",
      "Erin Mills",
      "Cooksville",
      "Clarkson-Lorne Park",
      "Malton",
      "Lakeview",
      "Downtown Core (City Centre)",
    ],
    headline: "Mobile Tire Repair & Installation in Mississauga, ON",
    subheadline: "Mobile tire services brought directly to your vehicle location in Mississauga by scheduled appointment.",
    metaDescription: "Book mobile tire services in Mississauga by appointment, including tires, rim swaps, wheel balancing & flat repair. 24/7 emergency roadside assistance.",
    localLandmarks: [
      "Square One Shopping Centre",
      "Living Arts Centre",
      "Port Credit Memorial Park",
      "Erindale GO Station",
    ],
    averageResponseTime: "By Appointment",
    serviceHighlights: [
      "Mobile tire services arranged by appointment at your vehicle location in Mississauga",
      "Scheduled appointments for residential driveways, office lots, and commercial yards",
      "New and used tires, seasonal rim swaps, wheel balancing, flat repair, and fleet service",
      "24/7 emergency roadside tire assistance available across Mississauga",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Mississauga%2C+ON&output=embed",
    faqs: [
      {
        question: "Does HT Mobile Tire provide mobile tire service across Mississauga?",
        answer: "Yes, HT Mobile Tire provides professional on-site mobile tire service throughout Mississauga. Our technician travels directly to your vehicle's location at your home, workplace, or roadside.",
      },
      {
        question: "Does the technician travel directly to my vehicle location in Mississauga?",
        answer: "Yes, our mobile service model brings tire servicing directly to you so you do not have to visit a tire shop. Our technician travels directly to your vehicle's location to complete your requested service on-site.",
      },
      {
        question: "Which Mississauga neighbourhoods are included in the service area?",
        answer: "We provide mobile tire service across Mississauga communities, including Port Credit, Streetsville, Meadowvale, Erin Mills, Cooksville, Clarkson-Lorne Park, Malton, Lakeview, and the Downtown Core (City Centre).",
      },
      {
        question: "Can I book seasonal rim and tire swaps at my Mississauga home?",
        answer: "Yes, we provide seasonal tire changeovers and rim swaps directly in residential driveways across Mississauga by scheduled appointment, saving you the hassle of loading and transporting tires.",
      },
      {
        question: "Can businesses enquire about commercial fleet tire services in Mississauga?",
        answer: "Businesses can enquire about mobile fleet tire services in Mississauga. Regular fleet services are arranged by appointment to help maintain vehicles on-site.",
      },
      {
        question: "Can I request on-site flat tire repair or wheel balancing in Mississauga?",
        answer: "Yes, we perform on-site flat tire repairs for repairable punctures by appointment or 24/7 emergency roadside assistance, as well as on-site wheel balancing to help reduce wheel vibration. Both services are performed directly at your parked vehicle.",
      },
      {
        question: "Can I order new or used tires delivered and installed in Mississauga?",
        answer: "HT Mobile Tire offers new and used tire options. Contact us with your vehicle and tire requirements to discuss availability and arrange a scheduled appointment.",
      },
      {
        question: "Is emergency roadside tire assistance available 24/7 in Mississauga?",
        answer: "Yes, emergency roadside tire assistance is available 24/7 across Mississauga for urgent situations such as highway blowouts, severe punctures, or spare tire installation. Call +1 (647) 995-6665 for assistance.",
      },
    ],
  },
  {
    slug: "etobicoke",
    name: "Etobicoke",
    state: "ON",
    zipCodes: [],
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in Etobicoke, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Etobicoke.",
    metaDescription: "Professional mobile tire repair & installation in Etobicoke, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Etobicoke%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in Etobicoke?",
        answer: "Our mobile tire service van comes directly to your location in Etobicoke equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in Etobicoke?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
      },
    ],
  },
  {
    slug: "north-york",
    name: "North York",
    state: "ON",
    zipCodes: [],
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in North York, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in North York.",
    metaDescription: "Professional mobile tire repair & installation in North York, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=North+York%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in North York?",
        answer: "Our mobile tire service van comes directly to your location in North York equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in North York?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
      },
    ],
  },
  {
    slug: "vaughan",
    name: "Vaughan",
    state: "ON",
    zipCodes: [],
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in Vaughan, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Vaughan.",
    metaDescription: "Professional mobile tire repair & installation in Vaughan, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Vaughan%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in Vaughan?",
        answer: "Our mobile tire service van comes directly to your location in Vaughan equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in Vaughan?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
      },
    ],
  },
  {
    slug: "woodbridge",
    name: "Woodbridge",
    state: "ON",
    zipCodes: [],
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in Woodbridge, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Woodbridge.",
    metaDescription: "Professional mobile tire repair & installation in Woodbridge, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Woodbridge%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in Woodbridge?",
        answer: "Our mobile tire service van comes directly to your location in Woodbridge equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in Woodbridge?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
      },
    ],
  },
  {
    slug: "milton",
    name: "Milton",
    state: "ON",
    zipCodes: [],
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in Milton, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Milton.",
    metaDescription: "Professional mobile tire repair & installation in Milton, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Milton%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in Milton?",
        answer: "Our mobile tire service van comes directly to your location in Milton equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in Milton?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
      },
    ],
  },
  {
    slug: "georgetown",
    name: "Georgetown",
    state: "ON",
    zipCodes: [],
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in Georgetown, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Georgetown.",
    metaDescription: "Professional mobile tire repair & installation in Georgetown, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Georgetown%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in Georgetown?",
        answer: "Our mobile tire service van comes directly to your location in Georgetown equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in Georgetown?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
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
