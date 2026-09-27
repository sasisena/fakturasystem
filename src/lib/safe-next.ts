/** Godtar bare interne stier som «neste side» etter innlogging (hindrer videresending til andre nettsider). */
export const safeNext = (neste: string | undefined, fallback: string) =>
  neste && neste.startsWith('/') && !neste.startsWith('//') ? neste : fallback;
