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
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in Brampton, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Brampton.",
    metaDescription: "Professional mobile tire repair & installation in Brampton, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Brampton%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in Brampton?",
        answer: "Our mobile tire service van comes directly to your location in Brampton equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in Brampton?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
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
    neighborhoods: [],
    headline: "Mobile Tire Repair & Installation in Mississauga, ON",
    subheadline: "On-demand mobile tire service van brought directly to your driveway, workplace, or roadside location in Mississauga.",
    metaDescription: "Professional mobile tire repair & installation in Mississauga, ON. Flat repairs, tire swaps, and balancing brought directly to your location with HT Mobile Tire.",
    localLandmarks: [],
    averageResponseTime: "On-Demand Service",
    serviceHighlights: [
      "Mobile tire repair and puncture patching at your location",
      "On-site tire mounting and computerized wheel balancing",
      "Seasonal rim and tire swap service",
      "Emergency roadside tire assistance",
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Mississauga%2C+ON&output=embed",
    faqs: [
      {
        question: "How does mobile tire service work in Mississauga?",
        answer: "Our mobile tire service van comes directly to your location in Mississauga equipped with professional mounting, balancing, and repair equipment.",
      },
      {
        question: "How do I schedule mobile tire service in Mississauga?",
        answer: "You can book easily online through our website or call us at +1 (647) 995-6665.",
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
