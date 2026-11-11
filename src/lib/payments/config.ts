import { z } from "zod";

/**
 * Payment rail configuration (Ecobank).
 *
 * Read from the environment and validated eagerly so a misconfigured rail
 * fails at the seam instead of mid-transfer. Subscription keys and the secret
 * key are read here and never logged -- `redacted()` produces a safe-to-log
 * view with every secret masked.
 *
 * Defaults point at the community-documented UAT gateway (see the integration
 * plan section 11); confirm the base URL against the real API definition.
 */

const configSchema = z.object({
  // The product always runs the real Ecobank rail. The mock survives only as a
  // test-only fake injected via setPaymentProvider(), never on the product path.
  provider: z.enum(["mock", "ecobank", "forge"]).default("ecobank"),
  fundingMode: z.enum(["simulated", "webhook"]).default("simulated"),
  env: z.enum(["sandbox", "production"]).default("sandbox"),
  baseUrl: z.string().url().default("https://apimuat-gateway.ecobank.com"),
  defaultCurrency: z.string().length(3).default("NGN"),
  webhookPublicUrl: z.string().default(""),

  // Layer 1: subscription key (core product covers Auth + Payment + Notification).
  keyCore: z.string().default(""),

  // Layer 3: onboarding credentials.
  clientId: z.string().default(""),
  // Sandbox defaults observed in the UAT API explorer (real client overrides).
  sourceCode: z.string().default("CORP_CIB_MOBILE"),
  affiliateCode: z.string().default("EGH"),
  publicKey: z.string().default(""),
  secretKey: z.string().default(""),
  ipAddress: z.string().default(""),
  // The pool account debited for a payout (present in the sandbox payload).
  sourceAccountNo: z.string().default(""),

  // Access Youth Tech Forge 2026: Xtradot Bank sandbox (reachable only from
  // inside the team's cluster namespace; see docs/Forge_2026_..._Guide.pdf s5).
  forgeBaseUrl: z.string().url().default("http://bank-api.ingress-apisix.svc.cluster.local/v1"),
  forgeApiKey: z.string().default(""),
  forgeSourceAccount: z.string().default(""),
  forgeWebhookSecret: z.string().default(""),
});

export type PaymentsConfig = z.infer<typeof configSchema>;

const ENV_NAMES: Record<keyof PaymentsConfig, string> = {
  provider: "PAYMENT_PROVIDER",
  fundingMode: "FUNDING_MODE",
  env: "ECOBANK_ENV",
  baseUrl: "ECOBANK_BASE_URL",
  defaultCurrency: "ECOBANK_DEFAULT_CURRENCY",
  webhookPublicUrl: "ECOBANK_WEBHOOK_PUBLIC_URL",
  keyCore: "ECOBANK_KEY_CORE",
  clientId: "ECOBANK_CLIENT_ID",
  sourceCode: "ECOBANK_SOURCE_CODE",
  affiliateCode: "ECOBANK_AFFILIATE_CODE",
  publicKey: "ECOBANK_PUBLIC_KEY",
  secretKey: "ECOBANK_SECRET_KEY",
  ipAddress: "ECOBANK_IP_ADDRESS",
  sourceAccountNo: "ECOBANK_SOURCE_ACCOUNT",
  forgeBaseUrl: "FORGE_BANK_BASE_URL",
  forgeApiKey: "GATEWAY_KEY",
  forgeSourceAccount: "FORGE_SOURCE_ACCOUNT",
  forgeWebhookSecret: "FORGE_WEBHOOK_SECRET",
};

/** Credentials that must never appear in a log line or an API response. */
const SECRET_FIELDS: readonly (keyof PaymentsConfig)[] = [
  "keyCore",
  "secretKey",
  "forgeApiKey",
  "forgeWebhookSecret",
];

/**
 * Onboarding credentials the real Ecobank rail cannot run without. The mock
 * rail needs none of these, so the demo is fully credential-free.
 */
const REQUIRED_ECOBANK_FIELDS: readonly (keyof PaymentsConfig)[] = [
  "keyCore",
  "clientId",
  "sourceCode",
  "affiliateCode",
  "publicKey",
  "secretKey",
  "ipAddress",
];

/** Credentials the Forge (Xtradot Bank sandbox) rail cannot run without. */
const REQUIRED_FORGE_FIELDS: readonly (keyof PaymentsConfig)[] = ["forgeApiKey", "forgeSourceAccount"];

function read(): PaymentsConfig {
  return configSchema.parse({
    provider: process.env.PAYMENT_PROVIDER,
    fundingMode: process.env.FUNDING_MODE,
    env: process.env.ECOBANK_ENV,
    baseUrl: process.env.ECOBANK_BASE_URL,
    defaultCurrency: process.env.ECOBANK_DEFAULT_CURRENCY,
    webhookPublicUrl: process.env.ECOBANK_WEBHOOK_PUBLIC_URL,
    keyCore: process.env.ECOBANK_KEY_CORE,
    clientId: process.env.ECOBANK_CLIENT_ID,
    sourceCode: process.env.ECOBANK_SOURCE_CODE,
    affiliateCode: process.env.ECOBANK_AFFILIATE_CODE,
    publicKey: process.env.ECOBANK_PUBLIC_KEY,
    secretKey: process.env.ECOBANK_SECRET_KEY,
    ipAddress: process.env.ECOBANK_IP_ADDRESS,
    sourceAccountNo: process.env.ECOBANK_SOURCE_ACCOUNT,
    forgeBaseUrl: process.env.FORGE_BANK_BASE_URL || undefined,
    forgeApiKey: process.env.GATEWAY_KEY,
    forgeSourceAccount: process.env.FORGE_SOURCE_ACCOUNT,
    forgeWebhookSecret: process.env.FORGE_WEBHOOK_SECRET,
  });
}

let cached: PaymentsConfig | undefined;

export function paymentsConfig(): PaymentsConfig {
  cached ??= read();
  return cached;
}

/** Test/config-reload hook: drop the cached snapshot. */
export function resetPaymentsConfig(): void {
  cached = undefined;
}

/**
 * Throws when `PAYMENT_PROVIDER=ecobank` but any onboarding credential is
 * missing, naming the exact env vars. Called once at the provider seam.
 */
export function assertEcobankConfigured(config: PaymentsConfig = paymentsConfig()): void {
  const missing = REQUIRED_ECOBANK_FIELDS.filter((field) => !config[field]).map(
    (field) => ENV_NAMES[field],
  );
  if (missing.length > 0) {
    throw new Error(
      `PAYMENT_PROVIDER=ecobank but missing ${missing.join(", ")}. Copy .env.example and fill them in.`,
    );
  }
}

/** Throws when `PAYMENT_PROVIDER=forge` but a required env var is missing. */
export function assertForgeConfigured(config: PaymentsConfig = paymentsConfig()): void {
  const missing = REQUIRED_FORGE_FIELDS.filter((field) => !config[field]).map(
    (field) => ENV_NAMES[field],
  );
  if (missing.length > 0) {
    throw new Error(
      `PAYMENT_PROVIDER=forge but missing ${missing.join(", ")}. GATEWAY_KEY is injected by the cluster secret huawei-gateway.`,
    );
  }
}

/** A safe-to-log view of the config with every secret masked. */
export function redactedConfig(config: PaymentsConfig = paymentsConfig()): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  for (const field of SECRET_FIELDS) {
    if (out[field]) {
      out[field] = "***";
    }
  }
  return out;
}
