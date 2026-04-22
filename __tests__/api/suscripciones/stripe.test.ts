import { createMocks } from "node-mocks-http";

jest.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      list: jest.fn(),
      create: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/supabase-server", () => ({
  createServerClient: jest.fn(),
}));

import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase-server";
import handler from "@/pages/api/suscripciones/stripe";

const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockCreateServerClient = createServerClient as jest.Mock;

describe("POST /api/suscripciones/stripe", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve 405 si el método no es POST", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("crea customer en Stripe si el corredor no tiene stripe_customer_id", async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "corredor-1", email: "test@test.com", nombre: "Test", stripe_customer_id: null },
        error: null,
      }),
      update: jest.fn().mockReturnThis(),
    };
    mockCreateServerClient.mockReturnValue(mockSupabase);

    (mockStripe.customers.list as jest.Mock).mockResolvedValue({ data: [] });
    (mockStripe.customers.create as jest.Mock).mockResolvedValue({ id: "cus_NEW" });
    (mockStripe.subscriptions.create as jest.Mock).mockResolvedValue({
      id: "sub_NEW",
      status: "active",
    });

    const { req, res } = createMocks({
      method: "POST",
      body: { corredor_id: "corredor-1", stripe_price_id: "price_ABC" },
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: "test@test.com",
      name: "Test",
      metadata: { corredor_id: "corredor-1" },
    });
  });
});
