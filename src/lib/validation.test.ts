import { describe, expect, it } from "vitest";
import {
  createEventSchema,
  createSubmissionSchema,
  loginSchema,
  registerSchema,
  rejectSubmissionSchema,
  reviewSubmissionSchema,
} from "@/lib/validation";

describe("auth validation", () => {
  it("accepts a valid registration", () => {
    const parsed = registerSchema.parse({
      email: "business@example.com",
      password: "Password123!",
      name: "Ada",
      accountType: "BUSINESS",
      workspaceName: "Ada Media",
    });
    expect(parsed.accountType).toBe("BUSINESS");
  });

  it("rejects weak passwords and invalid emails", () => {
    expect(() =>
      registerSchema.parse({
        email: "not-an-email",
        password: "short",
        name: "Ada",
        accountType: "CREATOR",
      }),
    ).toThrow();
  });

  it("requires a workspace name for business accounts only", () => {
    expect(() =>
      registerSchema.parse({
        email: "b@example.com",
        password: "Password123!",
        name: "Ada",
        accountType: "BUSINESS",
      }),
    ).toThrow();
    expect(() =>
      registerSchema.parse({
        email: "c@example.com",
        password: "Password123!",
        name: "Ada",
        accountType: "CREATOR",
      }),
    ).not.toThrow();
  });

  it("requires an email at login", () => {
    expect(() => loginSchema.parse({ email: "", password: "x" })).toThrow();
  });
});

describe("event validation", () => {
  it("requires externalEventId for idempotency", () => {
    expect(() =>
      createEventSchema.parse({
        eventType: "LEAD",
        occurredAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("rejects unknown event types", () => {
    expect(() =>
      createEventSchema.parse({
        externalEventId: "abc",
        eventType: "NOT_A_TYPE",
        occurredAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("defaults source to MANUAL and isTest to false", () => {
    const parsed = createEventSchema.parse({
      externalEventId: "abc",
      eventType: "LEAD",
      occurredAt: new Date().toISOString(),
    });
    expect(parsed.source).toBe("MANUAL");
    expect(parsed.isTest).toBe(false);
  });
});

describe("submission review validation", () => {
  it("requires a reason when rejecting", () => {
    expect(() => rejectSubmissionSchema.parse({})).toThrow();
    expect(() => rejectSubmissionSchema.parse({ reviewNote: "  " })).toThrow();
    expect(
      rejectSubmissionSchema.parse({ reviewNote: "Blurry screenshot." }),
    ).toEqual({ reviewNote: "Blurry screenshot." });
  });

  it("allows approval without a reason but with optional note", () => {
    expect(reviewSubmissionSchema.parse({})).toEqual({ reviewNote: undefined });
  });

  it("validates submission evidence", () => {
    expect(() => createSubmissionSchema.parse({})).toThrow();
    expect(
      createSubmissionSchema.parse({
        evidenceUrl: "https://tiktok.com/@ada/video/1",
      }),
    ).toEqual({
      evidenceUrl: "https://tiktok.com/@ada/video/1",
      evidenceText: undefined,
      note: undefined,
    });
  });
});
