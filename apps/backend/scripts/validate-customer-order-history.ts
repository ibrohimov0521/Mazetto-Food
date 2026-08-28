import { NotFoundException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { CustomersService } from "../src/modules/customers/customers.service";

type FindFirstArgs = {
  where: {
    id: string;
    customerId: string;
  };
};

type FindManyArgs = {
  where: {
    customerId: string;
  };
  orderBy: {
    createdAt: "desc";
  };
};

function createService(prisma: unknown): CustomersService {
  return new CustomersService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

async function main() {
  const findFirstCalls: FindFirstArgs[] = [];
  const findManyCalls: FindManyArgs[] = [];
  const prisma = {
    customerOrder: {
      findFirst: async (args: FindFirstArgs) => {
        findFirstCalls.push(args);

        if (
          args.where.id === "order-a" &&
          args.where.customerId === "customer-a"
        ) {
          return {
            id: "order-a",
            customerId: "customer-a",
            order: { status: OrderStatus.CONFIRMED },
          };
        }

        return null;
      },
      findMany: async (args: FindManyArgs) => {
        findManyCalls.push(args);
        return [
          {
            id: "order-a",
            customerId: args.where.customerId,
            order: { status: OrderStatus.COMPLETED },
          },
        ];
      },
    },
  };
  const service = createService(prisma);
  const ownOrder = await service.getCustomerOrder("customer-a", "order-a");

  assert(ownOrder.id === "order-a", "Customer A should read own order");
  assert(
    findFirstCalls[0]?.where.customerId === "customer-a" &&
      findFirstCalls[0]?.where.id === "order-a",
    "Order detail query must scope by customerId and order id",
  );

  try {
    await service.getCustomerOrder("customer-b", "order-a");
    throw new Error("Customer B unexpectedly read Customer A order");
  } catch (error) {
    assert(
      error instanceof NotFoundException,
      "Cross-customer order access must return a safe 404",
    );
  }

  await service.listCustomerOrders("customer-a");
  assert(
    findManyCalls[0]?.where.customerId === "customer-a",
    "Order history list must be scoped to authenticated customerId",
  );
  assert(
    findManyCalls[0]?.orderBy.createdAt === "desc",
    "Order history must be newest first",
  );

  console.log("Customer order history ownership validation passed");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

void main();
