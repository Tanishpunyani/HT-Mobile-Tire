import { prisma } from "../prisma";

type CustomerData = {
  name: string;
  email: string;
  phone: string;
};

export async function syncCustomer(
  userId: string,
  customerData: CustomerData
) {
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      userId,
    },
  });

  if (existingCustomer) {
    return existingCustomer;
  }

  const customer = await prisma.customer.create({
    data: {
      userId,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
    },
  });

  return customer;
}