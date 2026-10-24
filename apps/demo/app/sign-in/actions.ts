"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { PERSONA_COOKIE, isPersona } from "../../lib/demo-users";
import { LOCALE_COOKIE } from "../../lib/demo-messages";

/** Demo sign-in: stores the chosen persona name in a cookie. Not authentication. */
export async function signInAs(formData: FormData): Promise<void> {
  const persona = formData.get("persona");
  const store = await cookies();
  if (typeof persona === "string" && isPersona(persona)) {
    store.set(PERSONA_COOKIE, persona, { httpOnly: true, sameSite: "lax", path: "/" });
  } else {
    store.set(PERSONA_COOKIE, "signed-out", { httpOnly: true, sameSite: "lax", path: "/" });
  }
  redirect(persona === "admin" ? "/admin" : "/");
}

/** Locale is independent from identity and persists across demo navigation. */
export async function changeLocale(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (locale !== "en" && locale !== "fr") return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 31_536_000,
  });
  revalidatePath("/", "layout");
}
