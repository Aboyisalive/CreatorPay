import { assertEcobankConfigured, assertForgeConfigured, paymentsConfig, type PaymentsConfig } from "./config";
import { EcobankProvider } from "./ecobank-provider";
import { ForgeProvider } from "./forge-provider";
import { MockProvider, MOCK_SCENARIOS, type MockScenario } from "./mock-provider";
import type { PaymentProvider } from "./types";

/**
 * Payment provider factory.
 *
 * Returns one provider per process, chosen by `PAYMENT_PROVIDER`. Caching the
 * instance matters: the mock keeps poll state per payout, and the real provider
 * caches its auth token, both of which must survive across calls in a running
 * server.
 */

let instance: PaymentProvider | undefined;
let override: PaymentProvider | null = null;

/** Force a specific provider (tests, FundingSimulator). Pass null to clear. */
export function setPaymentProvider(provider: PaymentProvider | null): void {
  override = provider;
}

export function getPaymentProvider(): PaymentProvider {
  if (override) {
    return override;
  }
  instance ??= createFromConfig(paymentsConfig());
  return instance;
}

/** Drop the cached instance (config reload / tests). */
export function resetPaymentProvider(): void {
  instance = undefined;
}

function createFromConfig(config: PaymentsConfig): PaymentProvider {
  if (config.provider === "ecobank") {
    assertEcobankConfigured(config);
    return new EcobankProvider(config);
  }
  if (config.provider === "forge") {
    assertForgeConfigured(config);
    return new ForgeProvider(config);
  }
  return new MockProvider({
    scenario: mockScenarioFromEnv(),
    pendingPolls: mockPendingPollsFromEnv(),
  });
}

function mockScenarioFromEnv(): MockScenario {
  const raw = process.env.MOCK_PAYOUT_SCENARIO as MockScenario | undefined;
  if (raw && MOCK_SCENARIOS.includes(raw)) {
    return raw;
  }
  return "success";
}

function mockPendingPollsFromEnv(): number {
  const raw = Number(process.env.MOCK_PENDING_POLLS);
  return Number.isInteger(raw) && raw >= 1 ? raw : 2;
}
