export function canUseFeature(user, feature) {
  return Boolean(user?.company?.features?.includes(feature));
}

export function canOpenPage(user, pathname) {
  if (pathname.startsWith("/driver/live-location"))
    return canUseFeature(user, "liveLocation");
  if (pathname.startsWith("/driver/")) return canUseFeature(user, "delivery");
  return Boolean(user?.company);
}

export function defaultRoute(user) {
  if (user?.role === "EXPEDITOR") return "/exp/sales";
  if (user?.role === "WAREHOUSE") return "/warehouse/stock";
  if (user?.role === "DRIVER")
    return canUseFeature(user, "delivery")
      ? "/driver/deliveries"
      : "/forbidden";
  return "/";
}