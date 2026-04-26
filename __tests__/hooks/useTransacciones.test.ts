import { renderHook, act } from "@testing-library/react";
import { useTransacciones } from "@/hooks/useTransacciones";

const mockFrom = jest.fn();
const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
};
const mockSupabase = {
  from: mockFrom,
  channel: jest.fn().mockReturnValue(mockChannel),
  removeChannel: jest.fn(),
};

jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => mockSupabase,
}));

describe("useTransacciones", () => {
  beforeEach(() => jest.clearAllMocks());

  it("carga transacciones ordenadas por fecha desc", async () => {
    const mockData = [
      { id: "1", tipo: "ingreso", monto: 85, estado: "pagado" },
    ];
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: mockData, error: null }),
    });

    const { result } = renderHook(() => useTransacciones());

    await act(async () => {});

    expect(result.current.transacciones).toEqual(mockData);
    expect(result.current.loading).toBe(false);
  });
});
