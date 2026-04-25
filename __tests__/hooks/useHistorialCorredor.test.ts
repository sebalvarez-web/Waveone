import { renderHook, act } from "@testing-library/react";
import { useHistorialCorredor } from "@/hooks/useHistorialCorredor";

const mockFrom = jest.fn();
jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({ from: mockFrom }),
}));

const CORREDOR_ID = "corredor-1";

describe("useHistorialCorredor", () => {
  beforeEach(() => jest.clearAllMocks());

  it("combina historial y pausas ordenados por fecha desc", async () => {
    const mockHistorial = [
      {
        id: "h1",
        corredor_id: CORREDOR_ID,
        fecha: "2026-03-10T00:00:00Z",
        tipo: "cambio_plan",
        plan_id_anterior: null,
        plan_id_nuevo: "p1",
        estado_anterior: null,
        estado_nuevo: null,
        nota: null,
        creado_por: null,
        plan_anterior: null,
        plan_nuevo: { id: "p1", nombre: "Club Competitivo" },
        creado_por_user: null,
      },
    ];
    const mockPausas = [
      {
        id: "p1",
        corredor_id: CORREDOR_ID,
        mes: 2,
        año: 2026,
        tarifa_mantenimiento: 5,
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "corredor_historial") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockHistorial, error: null }),
        };
      }
      if (table === "pausas") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: mockPausas, error: null }),
        };
      }
    });

    const { result } = renderHook(() => useHistorialCorredor(CORREDOR_ID));
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.historial).toHaveLength(2);
    // historial entry first (más reciente)
    expect(result.current.historial[0].tipo).toBe("cambio_plan");
    expect(result.current.historial[0].plan_nuevo?.nombre).toBe("Club Competitivo");
    // pausa entry second
    expect(result.current.historial[1].tipo).toBe("pausa");
    expect(result.current.historial[1].mes).toBe(2);
  });

  it("expone error si Supabase falla", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "corredor_historial") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: null, error: new Error("DB fail") }),
        };
      }
      if (table === "pausas") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
    });

    const { result } = renderHook(() => useHistorialCorredor(CORREDOR_ID));
    await act(async () => {});

    expect(result.current.error).not.toBeNull();
    expect(result.current.historial).toEqual([]);
  });
});
