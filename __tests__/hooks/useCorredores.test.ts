import { renderHook, act } from "@testing-library/react";
import { useCorredores } from "@/hooks/useCorredores";

const mockFrom = jest.fn();
const mockSupabase = { from: mockFrom };

jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => mockSupabase,
}));

describe("useCorredores", () => {
  beforeEach(() => jest.clearAllMocks());

  it("carga corredores desde Supabase al montar", async () => {
    const mockCorredores = [
      { id: "1", nombre: "James D.", email: "james@test.com", estado: "activo" },
    ];
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockCorredores, error: null }),
    });

    const { result } = renderHook(() => useCorredores());

    await act(async () => {});

    expect(result.current.corredores).toEqual(mockCorredores);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("expone error cuando Supabase falla", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
    });

    const { result } = renderHook(() => useCorredores());
    await act(async () => {});

    expect(result.current.error).not.toBeNull();
    expect(result.current.corredores).toEqual([]);
  });
});
