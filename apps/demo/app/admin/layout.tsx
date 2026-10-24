import { cookies } from "next/headers";
import type { ReactNode } from "react";

import "@blocknote/mantine/style.css";
import "@bebranded/elearning-admin/styles.css";

import { DEMO_PERSONAS, PERSONA_COOKIE, isPersona } from "../../lib/demo-users";

/**
 * The host decides who reaches its back-office (spec 04): here, the admin
 * persona only. The module's admin routes check `isAdmin` again.
 */
export default async function AdminLayout({ children }: { readonly children: ReactNode }) {
  const persona = (await cookies()).get(PERSONA_COOKIE)?.value;
  const isAdmin = isPersona(persona) && DEMO_PERSONAS[persona].learner.isAdmin;
  return (
    <>
      <h1>Back-office</h1>
      {isAdmin ? children : <p role="alert">Only the training admin can open the back-office.</p>}
    </>
  );
}
