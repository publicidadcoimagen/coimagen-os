// Simple build-time switches. Vite inlines import.meta.env at build time, so
// changing one means setting the env var in Vercel and redeploying.

// The 5 "Próximamente" placeholder sections (AI Agents Pro, Factory Engine,
// Medical OS, Multi-tenant, Coimagen Cloud). Hidden from the menu and their
// routes disabled (direct URL → NotFound) unless VITE_SHOW_COMING_SOON=true.
// Code is kept on purpose — tracked as pending in the backlog.
export const SHOW_COMING_SOON = import.meta.env.VITE_SHOW_COMING_SOON === "true";
