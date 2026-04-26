export const mockDb = {
  customer: {
    count: jest.fn(),
  },
  business: {
    findUniqueOrThrow: jest.fn(),
  },
  document: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  documentItem: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  documentCounter: {
    upsert: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

export function resetMockDb() {
  Object.values(mockDb).forEach((group) => {
    Object.values(group).forEach((fn) => {
      if (typeof fn === "function" && "mockReset" in fn) {
        (fn as jest.Mock).mockReset();
      }
    });
  });

  mockDb.$transaction.mockReset();
}
