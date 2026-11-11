const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|headless|phantom|curl|wget|python-requests|facebookexternalhit|slackbot|whatsapp|telegrambot/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && BOT_PATTERN.test(userAgent));
}

export function attributionWindowStart(
  eventAt: Date,
  windowDays: number,
): Date {
  return new Date(eventAt.getTime() - windowDays * 24 * 60 * 60 * 1000);
}

/**
 * A click can only be attributed when it happened at or before the conversion
 * and inside the campaign's disclosed attribution window.
 */
export function isWithinAttributionWindow(
  clickAt: Date,
  eventAt: Date,
  windowDays: number,
): boolean {
  const delta = eventAt.getTime() - clickAt.getTime();
  return delta >= 0 && delta <= windowDays * 24 * 60 * 60 * 1000;
}
