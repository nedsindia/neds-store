// NEDS STORE Admin — Central theme tokens.
// Enterprise Green / Black / White palette per approved design_guidelines.json

export const theme = {
  brand: {
    name: "NEDS STORE",
    fullName: "Next Era Digital Solutions",
    tagline: "Learn • Grow • Succeed",
    currency: "INR",
    locale: "en-IN",
  },
  colors: {
    primary: "#059669",
    primaryHover: "#047857",
    primaryLight: "#D1FAE5",
    primaryForeground: "#FFFFFF",

    bg: "#FFFFFF",
    bgSecondary: "#F4F4F5",
    bgTertiary: "#FAFAFA",

    surface: "#09090B", // black sidebar
    surfaceMuted: "#18181B",
    surfaceForeground: "#FFFFFF",

    border: "#E4E4E7",
    borderDark: "#27272A",
    borderLight: "#F4F4F5",

    text: "#09090B",
    textMuted: "#71717A",
    textSubtle: "#A1A1AA",
    textInverse: "#FFFFFF",

    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#3B82F6",
  },
  fonts: {
    heading: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
    body: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  sidebarWidth: 260,
  headerHeight: 64,
};

export const inr = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(Number(n))) return "₹0";
  try {
    return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  } catch {
    return "₹" + n;
  }
};

export const formatDate = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
