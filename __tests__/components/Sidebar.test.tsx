import { render, screen } from "@testing-library/react";
import { useRouter } from "next/router";
import { Sidebar } from "@/components/layout/Sidebar";

jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue([]),
  }) as jest.Mock;
});

const mockUseRouter = useRouter as jest.Mock;

describe("Sidebar", () => {
  it("marca Panel Control como activo en la ruta /", () => {
    mockUseRouter.mockReturnValue({ pathname: "/" });
    render(<Sidebar pagosSinAsignar={0} />);
    const link = screen.getByText("Panel Control").closest("a");
    expect(link).toHaveClass("border-r-4");
  });

  it("marca Corredores como activo en la ruta /corredores", () => {
    mockUseRouter.mockReturnValue({ pathname: "/corredores" });
    render(<Sidebar pagosSinAsignar={0} />);
    const link = screen.getByText("Corredores").closest("a");
    expect(link).toHaveClass("border-r-4");
  });

  it("muestra badge cuando hay pagos sin asignar", () => {
    mockUseRouter.mockReturnValue({ pathname: "/" });
    render(<Sidebar pagosSinAsignar={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("no muestra badge cuando hay 0 pagos sin asignar", () => {
    mockUseRouter.mockReturnValue({ pathname: "/" });
    render(<Sidebar pagosSinAsignar={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
