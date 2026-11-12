export const SESSION_EXPIRED_EVENT = "z-index-session-expired";

export function expiredSessionToken(error, currentToken) {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  if (status !== 401 && !(status === 403 && code === "SUBSCRIPTION_INACTIVE"))
    return null;
  const url = error?.config?.url || "";
  if (/\bauth\/(?:company-login|pin-login)(?:[/?#]|$)/.test(url)) return null;
  const headers = error?.config?.headers || {};
  const header =
    headers.get?.("Authorization") ||
    Object.entries(headers).find(
      ([key]) => key.toLowerCase() === "authorization",
    )?.[1];
  const sentToken =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice(7)
      : null;
  return sentToken && sentToken === currentToken ? sentToken : null;
}
