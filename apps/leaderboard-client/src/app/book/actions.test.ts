import { beforeEach, describe, expect, it, vi } from "vitest";

const submitBookingRequest = vi.fn();
vi.mock("@/lib/server/crm", () => ({ submitBookingRequest }));

const { startBooking } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => submitBookingRequest.mockReset());

describe("startBooking", () => {
  it("records the request under the intent's source, then hands over the Calendly URL", async () => {
    submitBookingRequest.mockResolvedValue("sub-1");

    const result = await startBooking(
      "benchmark-submission",
      form({ firstName: " Ada ", email: " Ada@Example.com " }),
    );

    expect(submitBookingRequest).toHaveBeenCalledWith({
      source: "lab_benchmark_submission",
      firstName: "Ada",
      email: "ada@example.com",
      utm: { source: "mytwinlab.care", medium: "booking-page", campaign: "benchmark-submission" },
    });
    if (!("url" in result)) throw new Error("expected a URL");
    const url = new URL(result.url);
    expect(url.searchParams.get("utm_campaign")).toBe("benchmark-submission");
    expect(url.searchParams.get("utm_content")).toBe("sub-1");
  });

  it("treats an unknown intent as a general request", async () => {
    submitBookingRequest.mockResolvedValue("sub-2");

    await startBooking("lab_admin", form({ firstName: "Ada", email: "ada@example.com" }));

    expect(submitBookingRequest).toHaveBeenCalledWith(expect.objectContaining({ source: "lab_general" }));
  });

  it("still sends the visitor to Calendly when the CRM is unavailable", async () => {
    submitBookingRequest.mockResolvedValue(null);

    const result = await startBooking("twin-creation", form({ firstName: "Ada", email: "ada@example.com" }));

    if (!("url" in result)) throw new Error("expected a URL");
    expect(new URL(result.url).searchParams.has("utm_content")).toBe(false);
  });

  it("keeps a filled honeypot out of the CRM, with the same answer", async () => {
    const result = await startBooking(
      "twin-creation",
      form({ firstName: "Ada", email: "ada@example.com", website: "https://spam.example" }),
    );

    expect(submitBookingRequest).not.toHaveBeenCalled();
    expect("url" in result).toBe(true);
  });

  it("refuses an invalid email or an empty first name", async () => {
    await expect(startBooking(null, form({ firstName: "Ada", email: "not-an-email" }))).resolves.toEqual({
      error: "invalid",
    });
    await expect(startBooking(null, form({ firstName: "  ", email: "ada@example.com" }))).resolves.toEqual({
      error: "invalid",
    });
    expect(submitBookingRequest).not.toHaveBeenCalled();
  });
});
