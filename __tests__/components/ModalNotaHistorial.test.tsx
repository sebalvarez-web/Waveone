import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModalNotaHistorial } from "@/components/corredores/ModalNotaHistorial";

const mockInsert = jest.fn();
jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
  useUser: () => ({ id: "user-1" }),
}));

describe("ModalNotaHistorial", () => {
  const defaultProps = {
    corredorId: "corredor-1",
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("muestra el campo de nota y botón guardar", () => {
    render(<ModalNotaHistorial {...defaultProps} />);
    expect(screen.getByPlaceholderText(/nota/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("no envía si la nota está vacía", async () => {
    render(<ModalNotaHistorial {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  it("llama onSuccess después de guardar exitosamente", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const onSuccess = jest.fn();

    render(<ModalNotaHistorial {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/nota/i), {
      target: { value: "Lesión rodilla, regresa en marzo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          corredor_id: "corredor-1",
          tipo: "nota",
          nota: "Lesión rodilla, regresa en marzo",
          creado_por: "user-1",
        }),
      ])
    );
  });

  it("no llama onSuccess si Supabase retorna error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "DB error" } });
    const onSuccess = jest.fn();

    render(<ModalNotaHistorial {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/nota/i), {
      target: { value: "Una nota cualquiera" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
