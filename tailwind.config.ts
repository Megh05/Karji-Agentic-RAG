import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
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
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      container: {
        center: true,
        padding: "2rem",
        screens: {
          "2xl": "1400px",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        breathe: {
          "0%, 100%": { 
            transform: "scale(1)", 
            boxShadow: "0 0 0 0 hsl(var(--accent) / 0.4)"
          },
          "50%": { 
            transform: "scale(1.02)", 
            boxShadow: "0 0 0 10px hsl(var(--accent) / 0)"
          },
        },
        "particle-float": {
          "0%": { 
            transform: "translateY(0) rotate(0deg)", 
            opacity: "1" 
          },
          "100%": { 
            transform: "translateY(-20px) rotate(180deg)", 
            opacity: "0" 
          },
        },
        typewriter: {
          from: { width: "0" },
          to: { width: "100%" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 5px hsl(var(--accent) / 0.3)" },
          "50%": { boxShadow: "0 0 20px hsl(var(--accent) / 0.6)" },
        },
        "fade-in": {
          from: { 
            opacity: "0", 
            transform: "translateY(10px)" 
          },
          to: { 
            opacity: "1", 
            transform: "translateY(0)" 
          },
        },
        "typing-pulse": {
          "0%, 60%, 100%": { 
            transform: "translateY(0)", 
            opacity: "0.4" 
          },
          "30%": { 
            transform: "translateY(-8px)", 
            opacity: "1" 
          },
        },
        "golden-wave": {
          "0%": {
            backgroundPosition: "0% 50%",
          },
          "50%": {
            backgroundPosition: "100% 50%",
          },
          "100%": {
            backgroundPosition: "0% 50%",
          },
        },
        "floating-orbs": {
          "0%, 100%": {
            transform: "translateY(0px) rotate(0deg)",
            opacity: "0.7",
          },
          "33%": {
            transform: "translateY(-10px) rotate(120deg)",
            opacity: "0.9",
          },
          "66%": {
            transform: "translateY(5px) rotate(240deg)",
            opacity: "0.5",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        breathe: "breathe 4s infinite",
        "particle-float": "particle-float 3s infinite",
        typewriter: "typewriter 2s",
        "glow-pulse": "glow-pulse 2s infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "typing-pulse": "typing-pulse 1.5s infinite",
        "golden-wave": "golden-wave 8s ease-in-out infinite",
        "floating-orbs": "floating-orbs 12s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
