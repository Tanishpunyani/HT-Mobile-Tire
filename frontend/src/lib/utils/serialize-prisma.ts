/**
 * Utility to recursively serialize Prisma Decimal, Date, and special objects
 * so they can be safely passed from Server Components to Client Components
 * without React serialization errors.
 */

export function serializeDecimal<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      // Prisma Decimal instance check
      if (
        value &&
        typeof value === "object" &&
        (value.constructor?.name === "Decimal" ||
          value.d !== undefined ||
          (typeof value.toNumber === "function" && typeof value.toFixed === "function"))
      ) {
        return Number(value);
      }
      return value;
    })
  );
}

export function serializePrisma<T>(obj: T): T {
  return serializeDecimal(obj);
}
