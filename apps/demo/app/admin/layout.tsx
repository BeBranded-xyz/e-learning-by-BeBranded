import { demoSession } from "@/lib/demo-session";
import { demoMessages } from "@/lib/demo-messages";
import type { ReactNode } from "react";

import "@blocknote/mantine/style.css";
import "@bebranded/elearning-admin/styles.css";

import { DEMO_PERSONAS } from "../../lib/demo-users";

/**
 * The host decides who reaches its back-office (spec 04): here, the admin
 * persona only. The module's admin routes check `isAdmin` again.
 */
export default async function AdminLayout({ children }: { readonly children: ReactNode }) {
  const { persona, locale } = await demoSession();
  const messages = demoMessages(locale);
  const isAdmin = persona !== null && DEMO_PERSONAS[persona].learner.isAdmin;
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{messages.admin}</h1>
      {isAdmin ? (
        children
      ) : (
        <p role="alert" className="text-destructive">
          {messages.adminOnly}
        </p>
      )}
    </div>
  );
}
