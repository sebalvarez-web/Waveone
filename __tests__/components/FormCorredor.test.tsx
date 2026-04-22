import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormCorredor } from "@/components/corredores/FormCorredor";

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({
    from: () => ({
      insert: mockInsert,
      update: mockUpdate,
      eq: jest.fn().mockReturnThis(),
    }),
  }),
  useUser: () => ({ id: "user-1" }),
}));

const mockPlanes = [
  { id: "plan-1", nombre: "Club Competitivo", precio_mensual: 45 },
];

describe("FormCorredor", () => {
  it("muestra campos requeridos", () => {
    render(
      <FormCorredor
        planes={mockPlanes}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(screen.getByPlaceholderText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/correo/i)).toBeInTheDocument();
  });

  it("no envía si nombre está vacío", async () => {
    render(
      <FormCorredor
        planes={mockPlanes}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  it("llama onSuccess después de guardar exitosamente", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const onSuccess = jest.fn();

    render(
      <FormCorredor
        planes={mockPlanes}
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />
    );

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
});
