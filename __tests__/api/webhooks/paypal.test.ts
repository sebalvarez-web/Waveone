import { createMocks } from "node-mocks-http";

jest.mock("@/lib/paypal", () => ({
  paypalFetch: jest.fn(),
}));

jest.mock("@/lib/supabase-server", () => ({
  createServerClient: jest.fn(),
}));

import { paypalFetch } from "@/lib/paypal";
import { createServerClient } from "@/lib/supabase-server";
import handler from "@/pages/api/webhooks/paypal";

const mockPaypalFetch = paypalFetch as jest.Mock;
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
          or: jest.fn().mockReturnThis(),
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

describe("POST /api/webhooks/paypal", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, PAYPAL_WEBHOOK_ID: "WH-TEST-ID" };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("devuelve 500 si PAYPAL_WEBHOOK_ID no está configurado", async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    const { req, res } = createMocks({
      method: "POST",
      body: { event_type: "PAYMENT.SALE.COMPLETED" },
    });
    req.headers["paypal-transmission-id"] = "TX-1";
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });

  it("devuelve 400 si falta el header paypal-transmission-id", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { event_type: "PAYMENT.SALE.COMPLETED" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("devuelve 400 si la verificación falla", async () => {
    mockPaypalFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue("unauthorized"),
    });

    const { req, res } = createMocks({
      method: "POST",
      body: { event_type: "PAYMENT.SALE.COMPLETED" },
    });
    req.headers["paypal-transmission-id"] = "TX-1";
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("inserta transacción cuando pago exitoso y corredor encontrado", async () => {
    mockPaypalFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ verification_status: "SUCCESS" }),
    });

    const mockSupabase = makeMockSupabase({ id: "corredor-1" });
    mockCreateServerClient.mockReturnValue(mockSupabase);

    const { req, res } = createMocks({
      method: "POST",
      body: {
        event_type: "PAYMENT.SALE.COMPLETED",
        resource: {
          id: "sale_ABC",
          billing_agreement_id: "I-SUB_ABC",
          payer: { payer_info: { payer_id: "PAYER_ABC" } },
          amount: { total: "45.00", currency: "USD" },
        },
      },
    });
    req.headers["paypal-transmission-id"] = "TX-1";

    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockSupabase._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ingreso",
        estado: "pagado",
        metodo: "paypal",
        monto: 45,
        corredor_id: "corredor-1",
        paypal_order_id: "sale_ABC",
      }),
      { onConflict: "paypal_order_id" }
    );
  });

  it("guarda en pagos_sin_asignar cuando no se encuentra corredor", async () => {
    mockPaypalFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ verification_status: "SUCCESS" }),
    });

    const mockSupabase = makeMockSupabase(null);
    mockCreateServerClient.mockReturnValue(mockSupabase);

    const { req, res } = createMocks({
      method: "POST",
      body: {
        event_type: "PAYMENT.SALE.COMPLETED",
        resource: {
          id: "sale_UNKNOWN",
          billing_agreement_id: "I-UNKNOWN",
          payer: { payer_info: { payer_id: "UNKNOWN_PAYER" } },
          amount: { total: "45.00", currency: "USD" },
        },
      },
    });
    req.headers["paypal-transmission-id"] = "TX-2";

    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: "paypal" })
    );
  });

  it("registra pago fallido cuando se encuentra el corredor", async () => {
    mockPaypalFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ verification_status: "SUCCESS" }),
    });

    const upsertMock = jest.fn().mockResolvedValue({ error: null });
    mockCreateServerClient.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "corredores") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: "corredor-1" }, error: null }),
          };
        }
        if (table === "transacciones") return { upsert: upsertMock };
        return {};
      }),
    });

    const { req, res } = createMocks({
      method: "POST",
      body: {
        id: "WH-FAIL-001",
        event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
        resource: {
          id: "I-SUB_FAIL",
          amount: { total: "45.00", currency: "USD" },
        },
      },
    });
    req.headers["paypal-transmission-id"] = "TX-3";

    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: "vencido",
        metodo: "paypal",
        corredor_id: "corredor-1",
      }),
      { onConflict: "paypal_order_id" }
    );
  });
});
