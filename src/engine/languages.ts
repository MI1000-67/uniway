export const layoutLanguages = [
  { value: "eng", label: "English (English)" },
  { value: "tam", label: "Tamil (தமிழ்)" },
  { value: "sin", label: "Sinhala (සිංහල)" },
  { value: "hin", label: "Hindi (हिन्दी)" },
  { value: "ara", label: "Arabic (العربية)" },
  { value: "spa", label: "Spanish (Español)" },
  { value: "fra", label: "French (Français)" },
  { value: "deu", label: "German (Deutsch)" },
] as const;
export type LayoutLanguage = (typeof layoutLanguages)[number]["value"];
