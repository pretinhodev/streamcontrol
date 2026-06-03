export interface ColorPreset {
  id: string;
  name: string;
  // Accent colors for general UI in hex
  primary: string; // Primary brand color
  secondary: string; // Secondary companion color
  
  // Specific logo gradient layers (stops as arrays of hex colors)
  gradBack: [string, string, string]; // [start, mid, end] or [start, end]
  gradMiddle: [string, string, string];
  gradFront: [string, string, string];
  
  // Outer ambient glow style
  glowBg: string; // CSS style or tailwind background definition for ambient glows
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "cosmic-void",
    name: "Cosmic Void",
    primary: "#FF007F",
    secondary: "#7E00FF",
    gradBack: ["#001188", "#3F00B3", "#7E00FF"],
    gradMiddle: ["#7E00FF", "#A800FF", "#D900C7"],
    gradFront: ["#D900C7", "#FF007F", "#FF55AA"],
    glowBg: "from-[#001188]/20 via-[#7E00FF]/15 to-[#FF007F]/15"
  },
  {
    id: "magenta",
    name: "Magenta",
    primary: "#FF007F",
    secondary: "#A800FF",
    gradBack: ["#6A00B0", "#A800FF", "#D900C7"],
    gradMiddle: ["#A800FF", "#E90099", "#FF007F"],
    gradFront: ["#FF007F", "#FF3366", "#FF758C"],
    glowBg: "from-[#A800FF]/15 via-[#FF007F]/15 to-[#FF758C]/15"
  },
  {
    id: "cosmic-eclipse",
    name: "Cosmic Eclipse",
    primary: "#E0007A",
    secondary: "#02000A",
    gradBack: ["#02000A", "#0C0221", "#1E0045"],
    gradMiddle: ["#1C0230", "#4D0072", "#900084"],
    gradFront: ["#900084", "#D900C7", "#FF007F"],
    glowBg: "from-[#02000A]/35 via-[#4D0072]/20 to-[#FF007F]/20"
  },
  {
    id: "sunset",
    name: "Sunset",
    primary: "#FF0055",
    secondary: "#FF5500",
    gradBack: ["#880055", "#CC0055", "#FF0055"],
    gradMiddle: ["#FF0055", "#FF3322", "#FF5500"],
    gradFront: ["#FF5500", "#FF8800", "#FFAA00"],
    glowBg: "from-[#880055]/15 via-[#FF0055]/15 to-[#FFAA00]/15"
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    primary: "#FFAA00",
    secondary: "#FF8C00",
    gradBack: ["#6A3B00", "#A85A00", "#FF8C00"],
    gradMiddle: ["#FF8C00", "#FF9900", "#FFAA00"],
    gradFront: ["#FFAA00", "#FFCC00", "#FFE000"],
    glowBg: "from-[#A85A00]/15 via-[#FFAA00]/15 to-[#FFE000]/15"
  },
  {
    id: "neon-green",
    name: "Neon Green",
    primary: "#39FF14",
    secondary: "#00FF88",
    gradBack: ["#00AA66", "#008855", "#00FF88"],
    gradMiddle: ["#39FF14", "#00FF77", "#00FFBB"],
    gradFront: ["#CCFF00", "#77FF00", "#00FF33"],
    glowBg: "from-[#008855]/15 via-[#39FF14]/15 to-[#00FF33]/15"
  },
  {
    id: "cyan-burst",
    name: "Cyan Burst",
    primary: "#00FFCC",
    secondary: "#0055FF",
    gradBack: ["#0055FF", "#0088FF", "#00AAFF"],
    gradMiddle: ["#0077FF", "#00CCFF", "#00FFCC"],
    gradFront: ["#00FFCC", "#00FFAA", "#00FF88"],
    glowBg: "from-[#0055FF]/15 via-[#00FFCC]/15 to-[#00FF88]/15"
  },
  {
    id: "electric",
    name: "Electric",
    primary: "#00D2FF",
    secondary: "#0033FF",
    gradBack: ["#000B4D", "#00107A", "#001C99"],
    gradMiddle: ["#0024CC", "#0033FF", "#3366FF"],
    gradFront: ["#3366FF", "#00AAFF", "#00D2FF"],
    glowBg: "from-[#001C99]/15 via-[#3366FF]/15 to-[#00D2FF]/15"
  },
  {
    id: "arctic",
    name: "Arctic",
    primary: "#E2E8F0",
    secondary: "#718096",
    gradBack: ["#2D3748", "#4A5568", "#718096"],
    gradMiddle: ["#4A5568", "#CBD5E0", "#E2E8F0"],
    gradFront: ["#CBD5E0", "#E2E8F0", "#F8FAFC"],
    glowBg: "from-[#718096]/15 via-[#E2E8F0]/15 to-[#F8FAFC]/15"
  }
];

export function shiftColor(hex: string, percent: number): string {
  // Strip hash if present
  let cleanHex = hex.replace("#", "");
  // If shorthand shorthand like F03, expand it
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map(c => c + c).join("");
  }
  let num = parseInt(cleanHex, 16);
  let amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let G = (num >> 8 & 0x00FF) + amt;
  let B = (num & 0x0000FF) + amt;
  
  // Safe bounds [0, 255]
  R = Math.max(0, Math.min(255, R));
  G = Math.max(0, Math.min(255, G));
  B = Math.max(0, Math.min(255, B));
  
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export function generateCustomPreset(primary: string, secondary: string): ColorPreset {
  return {
    id: "custom",
    name: "Customizado",
    primary: primary,
    secondary: secondary,
    gradBack: [
      shiftColor(primary, -35),
      shiftColor(secondary, -20),
      secondary
    ],
    gradMiddle: [
      secondary,
      shiftColor(primary, -10),
      primary
    ],
    gradFront: [
      primary,
      shiftColor(primary, 20),
      shiftColor(primary, 45)
    ],
    glowBg: "custom-glow" // Custom handles this via direct inline CSS variables
  };
}

export function getPresetById(id?: string, customPrimary?: string, customSecondary?: string): ColorPreset {
  if (id === "custom" && customPrimary && customSecondary) {
    return generateCustomPreset(customPrimary, customSecondary);
  }
  return COLOR_PRESETS.find(p => p.id === id) || COLOR_PRESETS[0];
}
