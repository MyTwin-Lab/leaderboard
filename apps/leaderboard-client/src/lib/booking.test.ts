import { describe, expect, it } from "vitest";
import {
  BOOKING_INTENTS,
  BOOKING_ORIGINS,
  bookingCrmSource,
  bookingPath,
  bookingUtm,
  lemcalBookingUrl,
  parseBookingIntent,
  parseBookingOrigin,
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

  it("carries the origin when there is one", () => {
    expect(bookingPath("scientific-committee", "benchmark")).toBe("/book?for=scientific-committee&from=benchmark");
    expect(bookingPath("sandbox-project", "challenges")).toBe("/book?for=sandbox-project&from=challenges");
  });
});

describe("parseBookingOrigin", () => {
  it("keeps the known origins", () => {
    for (const origin of Object.keys(BOOKING_ORIGINS)) expect(parseBookingOrigin(origin)).toBe(origin);
    expect(parseBookingOrigin(["benchmark", "sandbox"])).toBe("benchmark");
  });

  it("drops anything else, URLs and inherited keys included", () => {
    expect(parseBookingOrigin(undefined)).toBeNull();
    expect(parseBookingOrigin("")).toBeNull();
    expect(parseBookingOrigin("/benchmark")).toBeNull();
    expect(parseBookingOrigin("https://evil.example")).toBeNull();
    expect(parseBookingOrigin("toString")).toBeNull();
    expect(parseBookingOrigin("__proto__")).toBeNull();
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

describe("lemcalBookingUrl", () => {
  it("prefills the name and email through guestInfos, and nothing else", () => {
    const url = new URL(lemcalBookingUrl({ firstName: "  Ada ", email: " ada+lab@example.com " }));
    expect(`${url.origin}${url.pathname}`).toBe("https://app.lemcal.com/@mytwinlab/30min");
    expect(JSON.parse(url.searchParams.get("guestInfos") ?? "")).toEqual({
      name: "Ada",
      email: "ada+lab@example.com",
    });
    expect([...url.searchParams.keys()]).toEqual(["guestInfos"]);
  });
});
