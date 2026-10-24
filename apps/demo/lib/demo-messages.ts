export const en = {
  title: "Learning by BeBranded",
  description: "Explore courses, videos and quizzes in the BeBranded learning demo.",
  navigation: "Main navigation",
  training: "Training",
  admin: "Back-office",
  profile: "Demo profile",
  learner: "Learner",
  manager: "Manager",
  administrator: "Administrator",
  signedOut: "Signed out",
  language: "Language",
  github: "Source code on GitHub",
  brand: "Visit BeBranded",
  home: "Your training",
  allTraining: "All training",
  backToCourse: "Back to the course",
  allCourses: "All courses",
  adminOnly: "Only the training admin can open the back-office.",
  footer: "Explore the demo as a learner, manager or administrator. Demo profiles are fictional.",
  videoCredit:
    "Video excerpts: Big Buck Bunny, © 2008 Blender Foundation. Cropped to 30 seconds and re-encoded for this demo.",
  license: "CC BY 3.0",
} as const;

export type DemoMessages = { readonly [K in keyof typeof en]: string };
export type DemoLocale = "en" | "fr";

export const fr: DemoMessages = {
  title: "Learning by BeBranded",
  description: "Découvrez les formations, vidéos et quiz de la démo BeBranded.",
  navigation: "Navigation principale",
  training: "Formations",
  admin: "Administration",
  profile: "Profil de démonstration",
  learner: "Apprenant",
  manager: "Responsable",
  administrator: "Administrateur",
  signedOut: "Déconnecté",
  language: "Langue",
  github: "Code source sur GitHub",
  brand: "Découvrir BeBranded",
  home: "Vos formations",
  allTraining: "Toutes les formations",
  backToCourse: "Retour à la formation",
  allCourses: "Toutes les formations",
  adminOnly: "Seul l’administrateur de formation peut accéder à l’administration.",
  footer:
    "Explorez la démo comme apprenant, responsable ou administrateur. Les profils sont fictifs.",
  videoCredit:
    "Extraits vidéo : Big Buck Bunny, © 2008 Blender Foundation. Extraits de 30 secondes réencodés pour cette démo.",
  license: "CC BY 3.0",
};

export const LOCALE_COOKIE = "demo_locale";
export const demoMessages = (locale: DemoLocale): DemoMessages => (locale === "fr" ? fr : en);

export function demoLocale(cookie: string | undefined, acceptLanguage = ""): DemoLocale {
  if (cookie === "en" || cookie === "fr") return cookie;
  const firstLanguage = acceptLanguage.split(",")[0]?.trim().toLowerCase();
  return firstLanguage?.startsWith("fr") === true ? "fr" : "en";
}
