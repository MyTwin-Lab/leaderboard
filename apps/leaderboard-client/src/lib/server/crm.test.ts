import { afterEach, describe, expect, it, vi } from "vitest";
import { submitBookingRequest, type BookingRequest } from "./crm";

const REQUEST: BookingRequest = {
  source: "lab_scientific_committee",
  firstName: "Ada",
  email: "ada@example.com",
  utm: { source: "mytwinlab.care", medium: "booking-page", campaign: "scientific-committee" },
};
const ENDPOINT = "http://backend.test/graphql";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.restoreAllMocks());

describe("submitBookingRequest", () => {
  it("posts the request to crmSubmitBookingRequest and returns the submission", async () => {
    const fetchImpl = vi.fn(async () => json({ data: { crmSubmitBookingRequest: { submissionUuid: "sub-1" } } }));

    await expect(submitBookingRequest(REQUEST, { endpoint: ENDPOINT, fetchImpl })).resolves.toBe("sub-1");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init.body));
    expect(body.query).toContain("crmSubmitBookingRequest(input: $input)");
    expect(body.variables).toEqual({ input: REQUEST });
  });

  it("returns null, without calling anyone, when the backend is not configured", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn();

    await expect(submitBookingRequest(REQUEST, { endpoint: "", fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns null on a GraphQL error, a non-JSON answer or a network failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const graphqlError = vi.fn(async () => json({ errors: [{ message: "Bad Request Exception" }] }, 400));
    const notJson = vi.fn(async () => new Response("<html>502</html>", { status: 502 }));
    const network = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    for (const fetchImpl of [graphqlError, notJson, network]) {
      await expect(submitBookingRequest(REQUEST, { endpoint: ENDPOINT, fetchImpl })).resolves.toBeNull();
    }
  });
});
