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
  const mockUpsert = jest.fn().mockResolvedValue({ error: null });
  const mockInsert = jest.fn().mockResolvedValue({ error: null });
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
    _mockUpsert: mockUpsert,
    _mockInsert: mockInsert,
  };
}

describe("POST /api/webhooks/paypal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve 400 si la verificación falla", async () => {
    mockPaypalFetch.mockResolvedValue({ ok: false });

    const { req, res } = createMocks({
      method: "POST",
      body: { event_type: "PAYMENT.SALE.COMPLETED" },
    });
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

    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: "paypal" })
    );
  });
});
