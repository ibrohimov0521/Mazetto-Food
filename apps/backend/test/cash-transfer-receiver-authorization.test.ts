import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

const receiver: AuthenticatedUser = {
  id: "receiver-user",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  isGlobalScope: false,
  roles: ["CASHIER"],
  permissions: ["SHIFT_VIEW_OWN"],
};

function serviceForTransfer(options: {
  assignedReceiver?: boolean;
  receiverHasOpenShift?: boolean;
} = {}) {
  return new ShiftsService({
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
    branch: {
      findFirst: async () => ({ id: "branch-a" }),
    },
    shift: {
      findFirst: async () =>
        options.receiverHasOpenShift ? { id: "shift-a" } : null,
    },
    cashTransfer: {
      findFirst: async () => ({
        id: "transfer-a",
        branchId: "branch-a",
        fromShift: { employeeId: "employee-b" },
        toShiftId: options.assignedReceiver ? "shift-a" : null,
        toShift: options.assignedReceiver
          ? { employeeId: receiver.employeeId }
          : null,
        status: "PENDING",
      }),
    },
  } as never);
}

test("assigned cashier can inspect a transfer addressed to their shift", async () => {
  const transfer = await serviceForTransfer({ assignedReceiver: true })
    .getCashTransferDetail("transfer-a", receiver);

  assert.equal(transfer.id, "transfer-a");
});

test("cashier with an open branch shift can inspect an unassigned pending transfer", async () => {
  const transfer = await serviceForTransfer({ receiverHasOpenShift: true })
    .getCashTransferDetail("transfer-a", receiver);

  assert.equal(transfer.id, "transfer-a");
});

test("cashier without an open shift cannot inspect an unassigned pending transfer", async () => {
  await assert.rejects(
    serviceForTransfer().getCashTransferDetail("transfer-a", receiver),
    /Boshqa xodim smenasini ko'rish mumkin emas/,
  );
});

test("manager role alone cannot open a shift for another employee", async () => {
  const service = new ShiftsService({} as never);
  const manager: AuthenticatedUser = {
    ...receiver,
    roles: ["BRANCH_MANAGER"],
    permissions: ["SHIFT_OPEN"],
  };

  await assert.rejects(
    service.openShift(
      { employeeId: "employee-b", openingBalance: 0 },
      manager,
    ),
    /Cannot operate another employee shift/,
  );
});
