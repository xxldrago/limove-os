import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-sans)", "var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        body: ["var(--font-sans)", "var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      colors: {
        fern: {
          page: "#090D14",
          ink: "#F8FAFC",
          ink2: "#94A3B8",
          ink3: "#94A3B8",
          ink4: "#64748B",
          brand: "#10B981",
          brand2: "#059669",
          branddeep: "#34D399",
          tint: "rgba(52, 211, 153, 0.1)",
          line: "#1E2638",
          aquatrack: "#1E2638",
          aquafill: "#10B981",
          mint: "#34D399",
          clay: "#F87171",
        },
        maple: {
          bg: "#ECE7E1",
          ink: "#4A4239",
          body: "#5A5048",
          faint: "#756A60",
          muted: "#8A7F73",
          line: "#D6CFC6",
          light: "#FBF8F4",
          amber: "#E8A552",
          leaf: "#7FB069",
          blue: "#5B7DB1",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;