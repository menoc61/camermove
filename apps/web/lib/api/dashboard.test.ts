import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./client";
import { getDashboard } from "./dashboard";

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

const mockedApiFetch = vi.mocked(apiFetch);

describe("getDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dashboard payload on success", async () => {
    const payload = {
      upcoming: [
        {
          id: "b1",
          reference: "CM-001",
          origin: "Douala",
          destination: "Yaounde",
          departureAt: "2026-09-10T08:00:00.000Z",
          totalAmount: 5000,
          status: "CONFIRMED",
          ticketId: "t1",
        },
      ],
      history: [],
      tickets: [],
    };
    mockedApiFetch.mockResolvedValueOnce(payload);

    await expect(getDashboard("tok_123")).resolves.toEqual(payload);
    expect(mockedApiFetch).toHaveBeenCalledOnce();
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/v1/me/dashboard", {
      method: "GET",
      token: "tok_123",
    });
  });

  it("throws ApiError on 401", async () => {
    mockedApiFetch.mockRejectedValueOnce(new ApiError(401, "Unauthorized"));

    const promise = getDashboard("bad_token");
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 401 });
  });
});
