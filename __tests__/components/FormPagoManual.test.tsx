import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormPagoManual } from "@/components/finanzas/FormPagoManual";

const mockInsert = jest.fn().mockResolvedValue({ error: null });
jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({ from: () => ({ insert: mockInsert }) }),
}));

describe("FormPagoManual", () => {
  it("llama a onSuccess cuando el formulario es válido", async () => {
    const onSuccess = jest.fn();
    render(<FormPagoManual onSuccess={onSuccess} corredores={[]} />);

    fireEvent.change(screen.getByPlaceholderText(/descripción/i), {
      target: { value: "Pago mensual" },
    });
    fireEvent.change(screen.getByPlaceholderText(/0.00/), {
      target: { value: "85" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
