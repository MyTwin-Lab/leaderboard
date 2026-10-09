import { afterEach, describe, expect, it, vi } from "vitest";
import { submitBookingRequest, submitLabJoin, submitStory, type BookingRequest } from "./crm";

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

describe("submitLabJoin", () => {
  const JOIN = {
    email: "ada@example.com",
    role: "researcher" as const,
    consentVersion: "2026-10-lab-news",
    utm: { source: "mytwinlab.care", medium: "join-page", campaign: "join-lab" },
  };

  it("posts the member to crmSubmitLabJoin and returns whether they are new", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ data: { crmSubmitLabJoin: { submissionUuid: "sub-1", isFirstOfKind: false } } }),
    );

    await expect(submitLabJoin(JOIN, { endpoint: ENDPOINT, fetchImpl })).resolves.toEqual({
      submissionUuid: "sub-1",
      isFirstOfKind: false,
    });

    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.query).toContain("crmSubmitLabJoin(input: $input)");
    expect(body.variables).toEqual({ input: JOIN });
  });

  it("returns null when the CRM fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => json({ errors: [{ message: "Bad Request Exception" }] }, 400));

    await expect(submitLabJoin(JOIN, { endpoint: ENDPOINT, fetchImpl })).resolves.toBeNull();
  });
});

describe("submitStory", () => {
  const STORY = { email: "ada@example.com", content: "My story", consentVersion: "v1" };

  it("files the story under the lab_join source", async () => {
    const fetchImpl = vi.fn(async () => json({ data: { crmSubmitStory: { submissionUuid: "sub-1" } } }));

    await expect(submitStory(STORY, { endpoint: ENDPOINT, fetchImpl })).resolves.toBe(true);

    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.query).toContain("crmSubmitStory(input: $input)");
    expect(body.variables).toEqual({ input: { ...STORY, source: "lab_join" } });
  });

  it("returns false when the CRM refuses it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => json({ errors: [{ message: "NOT_IN_WAITING_LIST" }] }));

    await expect(submitStory(STORY, { endpoint: ENDPOINT, fetchImpl })).resolves.toBe(false);
  });
});
