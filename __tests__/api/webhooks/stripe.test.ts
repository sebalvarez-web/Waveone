import { createMocks } from "node-mocks-http";

jest.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

jest.mock("@/lib/supabase-server", () => ({
  createServerClient: jest.fn(),
}));

import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase-server";
import handler from "@/pages/api/webhooks/stripe";

const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockCreateServerClient = createServerClient as jest.Mock;

function makeMockSupabase(corredor: { id: string } | null) {
  const mockUpsert = jest.fn();
  const upsertChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: "tx-1" }, error: null }),
  };
  mockUpsert.mockReturnValue(upsertChain);
  const mockInsert = jest.fn().mockResolvedValue({ error: null });
  const mockRpc = jest.fn().mockResolvedValue({ error: null });
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "corredores") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: corredor, error: null }),
        };
      }
      if (table === "transacciones") return { upsert: mockUpsert };
      if (table === "pagos_sin_asignar") return { insert: mockInsert };
      return {};
    }),
    rpc: mockRpc,
    _mockUpsert: mockUpsert,
    _mockInsert: mockInsert,
  };
}

describe("POST /api/webhooks/stripe", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, STRIPE_WEBHOOK_SECRET: "whsec_test_secret" };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("devuelve 500 si STRIPE_WEBHOOK_SECRET no está configurado", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { req, res } = createMocks({ method: "POST" });
    req.headers["stripe-signature"] = "any";
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });

  it("devuelve 400 si falta el header stripe-signature", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("devuelve 400 si la firma es inválida", async () => {
    (mockStripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { req, res } = createMocks({ method: "POST" });
    req.headers["stripe-signature"] = "bad_sig";
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("inserta transacción pagada cuando pago exitoso y corredor encontrado", async () => {
    const mockSupabase = makeMockSupabase({ id: "corredor-1" });
    mockCreateServerClient.mockReturnValue(mockSupabase);

    const fakeEvent = {
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus_ABC",
          id: "in_ABC",
          amount_paid: 8500,
          currency: "usd",
        },
      },
    };
    (mockStripe.webhooks.constructEvent as jest.Mock).mockReturnValue(fakeEvent);

    const { req, res } = createMocks({ method: "POST" });
    req.headers["stripe-signature"] = "valid_sig";
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockSupabase._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ingreso",
        estado: "pagado",
        metodo: "stripe",
        monto: 85,
        corredor_id: "corredor-1",
        stripe_payment_id: "in_ABC",
      }),
      { onConflict: "stripe_payment_id" }
    );
  });

  it("guarda en pagos_sin_asignar cuando no se encuentra corredor", async () => {
    const mockSupabase = makeMockSupabase(null);
    mockCreateServerClient.mockReturnValue(mockSupabase);

    const fakeEvent = {
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus_UNKNOWN",
          id: "in_UNKNOWN",
          amount_paid: 8500,
          currency: "usd",
        },
      },
    };
    (mockStripe.webhooks.constructEvent as jest.Mock).mockReturnValue(fakeEvent);

    const { req, res } = createMocks({ method: "POST" });
    req.headers["stripe-signature"] = "valid_sig";
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: "stripe" })
    );
  });
});
