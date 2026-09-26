export const SERVICE_NAMES = [
  "Flat Tire Repair",
  "Swap Rim Tire On/Off",
  "Wheel Balancing",
  "New and Used Tires",
  "Fleet Tire Service",
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

export const SERVICE_CATALOG: Record<ServiceName, { name: ServiceName; defaultPrice: number; description: string }> = {
  "Flat Tire Repair": {
    name: "Flat Tire Repair",
    defaultPrice: 49.0,
    description: "Mobile puncture repair, bead sealing, and pressure calibration.",
  },
  "Swap Rim Tire On/Off": {
    name: "Swap Rim Tire On/Off",
    defaultPrice: 49.0,
    description: "Seasonal tire swaps, wheel dismount/remount on rims.",
  },
  "Wheel Balancing": {
    name: "Wheel Balancing",
    defaultPrice: 49.0,
    description: "High-speed precision wheel balancing for smooth, vibration-free driving.",
  },
  "New and Used Tires": {
    name: "New and Used Tires",
    defaultPrice: 89.0,
    description: "New and quality inspected pre-owned tires supplied and installed roadside.",
  },
  "Fleet Tire Service": {
    name: "Fleet Tire Service",
    defaultPrice: 150.0,
    description: "Commercial van and fleet tire maintenance, rotation, and emergency service.",
  },
};

export function getDefaultServicePrice(serviceName: string | null | undefined): number {
  if (!serviceName) return 49.0;
  const match = normalizeServiceName(serviceName);
  if (match && match in SERVICE_CATALOG) {
    return SERVICE_CATALOG[match as ServiceName].defaultPrice;
  }
  return 49.0;
}

export function normalizeServiceName(query: string | null | undefined): string {
  if (!query) return "";
  const cleaned = query.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (cleaned.includes("flat") || cleaned.includes("puncture")) {
    return "Flat Tire Repair";
  }
  if (cleaned.includes("swap") || cleaned.includes("rim") || cleaned.includes("mount")) {
    return "Swap Rim Tire On/Off";
  }
  if (cleaned.includes("balanc")) {
    return "Wheel Balancing";
  }
  if (cleaned.includes("fleet") || cleaned.includes("commercial")) {
    return "Fleet Tire Service";
  }
  if (cleaned.includes("new") || cleaned.includes("used")) {
    return "New and Used Tires";
  }

  // Exact or case-insensitive match
  const found = SERVICE_NAMES.find(
    (name) => name.toLowerCase() === query.toLowerCase()
  );
  return found || "";
}
