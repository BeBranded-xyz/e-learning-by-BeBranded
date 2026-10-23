"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PERSONA_COOKIE, isPersona } from "../../lib/demo-users";

/** Demo sign-in: stores the chosen persona name in a cookie. Not authentication. */
export async function signInAs(formData: FormData): Promise<void> {
  const persona = formData.get("persona");
  const store = await cookies();
  if (typeof persona === "string" && isPersona(persona)) {
    store.set(PERSONA_COOKIE, persona, { httpOnly: true, sameSite: "lax", path: "/" });
  } else {
    store.delete(PERSONA_COOKIE);
  }
  redirect("/");
}
