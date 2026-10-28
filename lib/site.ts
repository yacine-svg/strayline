/** Copy outside the worlds: navigation, buttons, the stat and accessible labels. */
export const SITE = {
  name: "STRAYLINE",
  meta: {
    title: "Strayline",
    description: "An endless runner where the world changes under your feet.",
  },
  nav: [
    { label: "Home", href: "#" },
    { label: "Worlds", href: "#worlds" },
    { label: "Gear", href: "#gear" },
    { label: "Leaderboard", href: "#leaderboard" },
    { label: "Contact", href: "#contact" },
  ],
  /** Extra links that only live in the menu panel. */
  menuExtras: [
    { label: "Press kit", href: "#press" },
    { label: "Support", href: "#support" },
    { label: "Community", href: "#community" },
  ],
  play: { label: "Play", href: "#play" },
  cta: { label: "Start run", href: "#play" },
  stat: { value: "3.1M", label: "Runs today" },
  labels: {
    home: "Strayline home",
    mainNav: "Main",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    worlds: "Worlds",
    pause: "Pause background video",
    resume: "Play background video",
    showWorld: (name: string) => `Show ${name}`,
  },
} as const;
