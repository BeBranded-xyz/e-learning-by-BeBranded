import { redirect } from "next/navigation";

/** Profile selection lives in the toolbar; old demo links still resolve. */
export default function SignInPage() {
  redirect("/");
}
