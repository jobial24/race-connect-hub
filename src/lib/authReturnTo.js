export function safeReturnTo() {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return "/";
}