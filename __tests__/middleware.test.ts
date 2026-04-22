/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";

// Mock de Supabase auth-helpers
jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createMiddlewareClient: jest.fn(),
}));

import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { middleware } from "../middleware";

const mockCreateMiddlewareClient = createMiddlewareClient as jest.Mock;

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

describe("middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("permite acceso a /login sin sesión", async () => {
    mockCreateMiddlewareClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    });

    const req = makeRequest("/login");
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });

  it("redirige a /login si no hay sesión en ruta protegida", async () => {
    mockCreateMiddlewareClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    });

    const req = makeRequest("/");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("permite acceso a ruta protegida con sesión activa", async () => {
    mockCreateMiddlewareClient.mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: "abc" } } },
        }),
      },
    });

    const req = makeRequest("/");
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });
});
