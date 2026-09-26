import { describe, expect, it } from "vitest";
import { bookingPath, calendlyBookingUrl, parseBookingIntent } from "./booking";

describe("parseBookingIntent", () => {
  it("keeps the two known intents", () => {
    expect(parseBookingIntent("twin")).toBe("twin");
    expect(parseBookingIntent("project")).toBe("project");
    expect(parseBookingIntent(["project", "twin"])).toBe("project");
  });

  it("drops anything else", () => {
    expect(parseBookingIntent(undefined)).toBeNull();
    expect(parseBookingIntent("")).toBeNull();
    expect(parseBookingIntent("TWIN")).toBeNull();
  });
});

describe("bookingPath", () => {
  it("carries the intent", () => {
    expect(bookingPath("twin")).toBe("/book?for=twin");
    expect(bookingPath("project")).toBe("/book?for=project");
  });
});

describe("calendlyBookingUrl", () => {
  it("prefills the details and tags the request", () => {
    const url = new URL(calendlyBookingUrl({ firstName: "  Ada ", email: " ada+lab@example.com ", intent: "project" }));
    expect(`${url.origin}${url.pathname}`).toBe("https://calendly.com/rubens-mytwin/30min");
    expect(url.searchParams.get("name")).toBe("Ada");
    expect(url.searchParams.get("email")).toBe("ada+lab@example.com");
    expect(url.searchParams.get("utm_source")).toBe("mytwinlab.care");
    expect(url.searchParams.get("utm_medium")).toBe("booking-page");
    expect(url.searchParams.get("utm_campaign")).toBe("sandbox-project");
  });

  it("falls back to a general campaign without an intent", () => {
    const url = new URL(calendlyBookingUrl({ firstName: "Ada", email: "ada@example.com", intent: null }));
    expect(url.searchParams.get("utm_campaign")).toBe("general");
  });
});
