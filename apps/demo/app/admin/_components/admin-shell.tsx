"use client";

import { AuthorNavigation, ElearningAdminProvider } from "@bebranded/elearning-admin";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { useDemo } from "@/components/demo-context";
import { elearningKit } from "@/registry/elearning/elearning-kit";
import { design } from "@/elearning.design";

const courseHref = (id: string) => `/admin/courses/${id}`;
const lessonHref = (id: string) => `/admin/lessons/${id}`;

export function AdminShell({ children }: { readonly children: ReactNode }) {
  const { locale, sessionKey, messages } = useDemo();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const courseId = /^\/admin\/courses\/([^/]+)$/.exec(pathname)?.[1];
  const lessonId = /^\/admin\/lessons\/([^/]+)$/.exec(pathname)?.[1];
  return (
    <ElearningAdminProvider
      apiBase="/api/elearning"
      locale={locale}
      sessionKey={sessionKey}
      design={design}
      ui={elearningKit}
      videoUploadHint={messages.videoUploadHint}
    >
      <div className="demo-admin-shell">
        <aside className="demo-admin-sidebar" data-open={open}>
          <div className="demo-admin-sidebar-title">
            <span>{messages.admin}</span>
            <button
              type="button"
              className="demo-admin-menu"
              aria-label={messages.navigation}
              aria-expanded={open}
              aria-controls="admin-navigation"
              onClick={() => {
                setOpen((value) => !value);
              }}
            >
              <Menu aria-hidden="true" size={20} />
            </button>
          </div>
          <div id="admin-navigation">
            <AuthorNavigation
              courseId={courseId}
              lessonId={lessonId}
              catalogHref="/admin"
              courseHref={courseHref}
              lessonHref={lessonHref}
            />
          </div>
        </aside>
        <div className="demo-admin-content">
          <h1 className="sr-only">{messages.admin}</h1>
          {children}
        </div>
      </div>
    </ElearningAdminProvider>
  );
}
