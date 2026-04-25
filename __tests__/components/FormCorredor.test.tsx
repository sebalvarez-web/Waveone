import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormCorredor } from "@/components/corredores/FormCorredor";

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockSelect = jest.fn();

jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "corredor_emails") {
        return {
          select: mockSelect,
          insert: mockInsert,
          delete: () => ({ eq: mockDelete }),
        };
      }
      return {
        insert: (payload: unknown) => {
          mockInsert(payload);
          return {
            select: () => ({
              single: jest.fn().mockResolvedValue({ data: { id: "new-id" }, error: null }),
            }),
          };
        },
        update: () => ({ eq: () => mockUpdate() }),
        select: () => ({ single: jest.fn().mockResolvedValue({ data: { id: "new-id" }, error: null }) }),
        eq: jest.fn().mockReturnThis(),
      };
    },
  }),
  useUser: () => ({ id: "user-1" }),
}));

const mockPlanes = [
  { id: "plan-1", nombre: "Club Competitivo", precio_mensual: 45, descripcion: "" },
];

describe("FormCorredor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  it("muestra campos requeridos", () => {
    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByPlaceholderText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/correo/i)).toBeInTheDocument();
  });

  it("no envía si nombre está vacío", async () => {
    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  it("llama onSuccess después de guardar exitosamente", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const onSuccess = jest.fn();

    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/nombre/i), {
      target: { value: "Ana García" },
    });
    fireEvent.change(screen.getByPlaceholderText(/correo/i), {
      target: { value: "ana@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("muestra botón para agregar correo adicional", () => {
    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByRole("button", { name: /agregar correo/i })).toBeInTheDocument();
  });

  it("agrega y elimina filas de email adicional", () => {
    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /agregar correo/i }));
    expect(screen.getByPlaceholderText(/email adicional/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /eliminar correo/i }));
    expect(screen.queryByPlaceholderText(/email adicional/i)).not.toBeInTheDocument();
  });

  it("guarda emails adicionales junto con el corredor (modo crear)", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const onSuccess = jest.fn();

    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/nombre/i), {
      target: { value: "Ana García" },
    });
    fireEvent.change(screen.getByPlaceholderText(/correo/i), {
      target: { value: "ana@test.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /agregar correo/i }));
    fireEvent.change(screen.getByPlaceholderText(/email adicional/i), {
      target: { value: "ana@trabajo.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/etiqueta/i), {
      target: { value: "trabajo" },
    });

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    // insert fue llamado al menos dos veces (corredor + emails)
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
