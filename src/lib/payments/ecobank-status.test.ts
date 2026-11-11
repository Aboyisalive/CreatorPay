import { describe, expect, it } from "vitest";
import { mapTransferStatus } from "./ecobank-provider";

describe("mapTransferStatus", () => {
  it("settles only on an explicit success", () => {
    expect(mapTransferStatus("SUCCESSFUL")).toBe("settled");
    expect(mapTransferStatus("completed")).toBe("settled");
  });

  it("fails on explicit failures", () => {
    expect(mapTransferStatus("FAILED")).toBe("failed");
    expect(mapTransferStatus("Reversed")).toBe("failed");
  });

  it("keeps unknown or missing statuses pending", () => {
    expect(mapTransferStatus("PROCESSING")).toBe("pending");
    expect(mapTransferStatus(null)).toBe("pending");
  });
});
