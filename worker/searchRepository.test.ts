import { describe, expect, it } from "vitest";
import {
  isValidDeleteIds,
  normalizeAdminRange,
  readConfiguredCapacityBytes,
  readConfiguredWarningThresholdPercentage,
} from "./searchRepository";

describe("admin repository input normalization", () => {
  it("normalizes supported overview ranges", () => {
    expect(normalizeAdminRange("24h")).toBe("24h");
    expect(normalizeAdminRange("7d")).toBe("7d");
    expect(normalizeAdminRange("30d")).toBe("30d");
    expect(normalizeAdminRange("year")).toBe("24h");
  });

  it("only accepts bounded repository id batches", () => {
    expect(isValidDeleteIds(["8f620968-894f-48a9-bced-a56202805ed7"])).toBe(true);
    expect(isValidDeleteIds([])).toBe(false);
    expect(isValidDeleteIds(["unsafe/id"])).toBe(false);
    expect(isValidDeleteIds(Array.from({ length: 51 }, (_, index) => `entry-${index}`))).toBe(false);
  });

  it("does not invent a storage capacity when none is configured", () => {
    expect(readConfiguredCapacityBytes(undefined)).toBeNull();
    expect(readConfiguredCapacityBytes("unknown")).toBeNull();
    expect(readConfiguredCapacityBytes("524288000")).toBe(524288000);
    expect(readConfiguredWarningThresholdPercentage(undefined)).toBeNull();
    expect(readConfiguredWarningThresholdPercentage("0")).toBeNull();
    expect(readConfiguredWarningThresholdPercentage("100")).toBeNull();
    expect(readConfiguredWarningThresholdPercentage("80")).toBe(80);
  });
});
