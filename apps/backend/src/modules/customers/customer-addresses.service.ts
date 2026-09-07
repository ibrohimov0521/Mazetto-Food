import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeDeliveryLocation } from "./delivery-location";
import type { SaveCustomerAddressDto } from "./dto/delivery-location.dto";

@Injectable()
export class CustomerAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, label: true, location: true, updatedAt: true },
    });
  }

  async save(customerId: string, id: string, dto: SaveCustomerAddressDto) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !dto.label.trim()) {
      throw new BadRequestException("Manzil nomini tekshiring.");
    }
    const location = normalizeDeliveryLocation(dto.location);
    return this.prisma.$transaction(async (tx) => {
      // Serialize address writes per customer, including the saved-address limit.
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`;
      const where = { customerId_id: { customerId, id } };
      const existing = await tx.customerAddress.findUnique({ where });
      if (
        !existing &&
        (await tx.customerAddress.count({ where: { customerId } })) >= 10
      ) {
        throw new BadRequestException(
          "10 tagacha manzil saqlash mumkin. Eski manzillardan birini o'chiring.",
        );
      }
      return tx.customerAddress.upsert({
        where,
        create: { id, customerId, label: dto.label.trim(), location },
        update: { label: dto.label.trim(), location },
        select: { id: true, label: true, location: true, updatedAt: true },
      });
    });
  }

  async remove(customerId: string, id: string) {
    await this.prisma.customerAddress.deleteMany({ where: { customerId, id } });
    return { deleted: true };
  }
}
