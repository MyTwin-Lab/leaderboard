import { describe, expect, it } from "vitest";
import {
  BOOKING_INTENTS,
  bookingCrmSource,
  bookingPath,
  bookingUtm,
  calendlyBookingUrl,
  parseBookingIntent,
} from "./booking";

describe("parseBookingIntent", () => {
  it("keeps the known intents", () => {
    for (const intent of BOOKING_INTENTS) expect(parseBookingIntent(intent)).toBe(intent);
    expect(parseBookingIntent(["sandbox-project", "twin-creation"])).toBe("sandbox-project");
  });

  it("drops anything else, the former intents included", () => {
    expect(parseBookingIntent(undefined)).toBeNull();
    expect(parseBookingIntent("")).toBeNull();
    expect(parseBookingIntent("TWIN-CREATION")).toBeNull();
    expect(parseBookingIntent("twin")).toBeNull();
    expect(parseBookingIntent("project")).toBeNull();
    expect(parseBookingIntent("benchmark-submission")).toBeNull();
    expect(parseBookingIntent({ toString: () => "twin-creation" })).toBeNull();
  });
});

describe("bookingPath", () => {
  it("carries the intent", () => {
    expect(bookingPath("twin-creation")).toBe("/book?for=twin-creation");
    expect(bookingPath("scientific-committee")).toBe("/book?for=scientific-committee");
  });
});

describe("bookingCrmSource", () => {
  it("gives each intent its own lab_* source", () => {
    expect(bookingCrmSource("twin-creation")).toBe("lab_twin_creation");
    expect(bookingCrmSource("sandbox-project")).toBe("lab_sandbox_project");
    expect(bookingCrmSource("scientific-committee")).toBe("lab_scientific_committee");
    expect(bookingCrmSource(null)).toBe("lab_general");
  });
});

describe("bookingUtm", () => {
  it("names the campaign after the intent", () => {
    expect(bookingUtm("scientific-committee")).toEqual({
      source: "mytwinlab.care",
      medium: "booking-page",
      campaign: "scientific-committee",
    });
    expect(bookingUtm(null).campaign).toBe("general");
  });
});

describe("calendlyBookingUrl", () => {
  it("prefills the details and tags the request with its CRM submission", () => {
    const url = new URL(
      calendlyBookingUrl({
        firstName: "  Ada ",
        email: " ada+lab@example.com ",
        intent: "sandbox-project",
        submissionUuid: "4f1c2b9e-0000-4000-8000-000000000000",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://calendly.com/rubens-mytwin/30min");
    expect(url.searchParams.get("name")).toBe("Ada");
    expect(url.searchParams.get("email")).toBe("ada+lab@example.com");
    expect(url.searchParams.get("utm_source")).toBe("mytwinlab.care");
    expect(url.searchParams.get("utm_medium")).toBe("booking-page");
    expect(url.searchParams.get("utm_campaign")).toBe("sandbox-project");
    expect(url.searchParams.get("utm_content")).toBe("4f1c2b9e-0000-4000-8000-000000000000");
  });

  it("falls back to a general campaign, and no utm_content without a submission", () => {
    const url = new URL(
      calendlyBookingUrl({ firstName: "Ada", email: "ada@example.com", intent: null, submissionUuid: null }),
    );
    expect(url.searchParams.get("utm_campaign")).toBe("general");
    expect(url.searchParams.has("utm_content")).toBe(false);
  });
});
