import { describe, expect, it } from "vitest";
import {
  attributionWindowStart,
  isBotUserAgent,
  isWithinAttributionWindow,
} from "@/lib/attribution-rules";

const eventAt = new Date("2026-10-20T12:00:00.000Z");

describe("attribution window", () => {
  it("accepts a click inside the window before the event", () => {
    expect(
      isWithinAttributionWindow(
        new Date("2026-10-18T12:00:00.000Z"),
        eventAt,
        7,
      ),
    ).toBe(true);
  });

  it("rejects a click outside the window", () => {
    expect(
      isWithinAttributionWindow(
        new Date("2026-10-01T12:00:00.000Z"),
        eventAt,
        7,
      ),
    ).toBe(false);
  });

  it("rejects a click after the event", () => {
    expect(
      isWithinAttributionWindow(
        new Date("2026-10-21T12:00:00.000Z"),
        eventAt,
        7,
      ),
    ).toBe(false);
  });

  it("computes the window start", () => {
    expect(attributionWindowStart(eventAt, 7).toISOString()).toBe(
      "2026-10-13T12:00:00.000Z",
    );
  });
});

describe("bot detection", () => {
  it("flags obvious automated user agents", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("curl/8.0")).toBe(true);
  });

  it("does not flag a normal browser", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(false);
  });
});
