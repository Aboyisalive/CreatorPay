import { z } from "zod";
import { parseNairaToMinor } from "@/lib/money";

const nairaString = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .refine(
    (value) => {
      try {
        parseNairaToMinor(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Enter a valid amount (for example 1500 or 1500.50)." },
  );

const httpUrl = z.url({ protocol: /^https?$/ });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(80),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    accountType: z.enum(["BUSINESS", "CREATOR"]),
    workspaceName: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.accountType === "BUSINESS" && !value.workspaceName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["workspaceName"],
        message: "Enter your business or agency name.",
      });
    }
  });

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

const rewardRuleSchema = z.object({
  name: z.string().trim().min(2, "Name this reward rule.").max(120),
  eventType: z.enum([
    "REGISTRATION",
    "LEAD",
    "PURCHASE",
    "SUBSCRIPTION",
    "APPLICATION",
    "OTHER",
  ]),
  amountNaira: nairaString,
  maxCount: z.number().int().positive().max(1_000_000).nullish(),
  capNaira: nairaString.nullish(),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(3, "Enter a campaign name.").max(140),
  summary: z.string().trim().max(280).optional().nullable(),
  description: z.string().trim().max(10_000).optional().nullable(),
  objectives: z
    .array(
      z.enum([
        "AWARENESS",
        "TRAFFIC",
        "LEADS",
        "REGISTRATIONS",
        "PURCHASES",
        "OTHER",
      ]),
    )
    .min(1, "Choose at least one objective."),
  participationMode: z
    .enum(["INVITE_ONLY", "APPLICATION", "BOTH"])
    .default("INVITE_ONLY"),
  attributionWindowDays: z.number().int().min(1).max(90).default(7),
  destinationUrl: httpUrl,
  startAt: z.iso.datetime({ offset: true }).nullish(),
  endAt: z.iso.datetime({ offset: true }).nullish(),
  budgetNaira: nairaString,
  rewardRules: z.array(rewardRuleSchema).min(1, "Add at least one reward rule."),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const inviteCreatorSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

export const createEventSchema = z.object({
  externalEventId: z.string().trim().min(1).max(200),
  eventType: z.enum([
    "REGISTRATION",
    "LEAD",
    "PURCHASE",
    "SUBSCRIPTION",
    "APPLICATION",
    "OTHER",
  ]),
  occurredAt: z.iso.datetime({ offset: true }),
  valueNaira: nairaString.nullish(),
  trackingToken: z.string().trim().min(8).max(200).nullish(),
  isTest: z.boolean().default(false),
  source: z.enum(["API", "IMPORT", "MANUAL", "PROMO_CODE"]).default("MANUAL"),
});

export const createDeliverableSchema = z.object({
  name: z.string().trim().min(2, "Name this deliverable.").max(140),
  type: z.enum([
    "CONTENT_POST",
    "CONTENT_STORY",
    "CONTENT_REEL",
    "CONTENT_VIDEO",
    "CONTENT_BLOG",
    "CONTENT_LIVE",
    "OTHER",
  ]),
  description: z.string().trim().max(2000).optional().nullable(),
  quantity: z.number().int().min(1).max(100).default(1),
  evidenceType: z
    .enum(["URL", "FILE", "TEXT", "SOCIAL_HANDLE"])
    .default("URL"),
  dueAt: z.iso.datetime({ offset: true }).nullish(),
});

export const updateDeliverableSchema = createDeliverableSchema.partial();

export const createSubmissionSchema = z
  .object({
    evidenceUrl: httpUrl.optional().nullable(),
    evidenceText: z.string().trim().max(5000).optional().nullable(),
    note: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.evidenceUrl && !value.evidenceText) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceUrl"],
        message: "Provide a URL or text evidence.",
      });
    }
  });

export const reviewSubmissionSchema = z.object({
  reviewNote: z.string().trim().max(2000).optional().nullable(),
});

export const rejectSubmissionSchema = z.object({
  reviewNote: z
    .string()
    .trim()
    .min(1, "Explain why this submission is being rejected.")
    .max(2000),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type RewardRuleInput = z.infer<typeof rewardRuleSchema>;
export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
