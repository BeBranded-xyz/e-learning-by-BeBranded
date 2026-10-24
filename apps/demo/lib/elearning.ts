import { elearningExport, playwrightPdf } from "@bebranded/elearning-export";
import { createElearning } from "@bebranded/elearning-server";
import type { Elearning } from "@bebranded/elearning-server";
import { chromium } from "playwright-core";

import { design } from "../elearning.design";
import { demoFileStorage } from "./demo-files";
import { demoMediaProvider } from "./demo-media/provider";
import { getDemoStorage } from "./demo-storage";
import { LEARNER_SUFFIX_COOKIE, PERSONA_COOKIE, selectedPersona, learnerFor } from "./demo-users";
import { readEnv } from "./env";

function cookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  const entry = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry?.slice(name.length + 1);
}

function create(): Elearning {
  const env = readEnv();
  return createElearning({
    storage: getDemoStorage(),
    identity: (request) => {
      const persona = selectedPersona(cookie(request, PERSONA_COOKIE));
      return Promise.resolve(
        persona !== null ? learnerFor(persona, cookie(request, LEARNER_SUFFIX_COOKIE)) : null,
      );
    },
    // Attributed video excerpts are served locally; no video-provider account is needed.
    // Editor images and attachments go to the local disk behind signed URLs.
    files: demoFileStorage,
    video: demoMediaProvider,
    // PDF through the Chromium Playwright installs (`playwright install chromium`), launched
    // on the first export and kept open; Word needs no browser. Export links open lesson pages.
    exporter: elearningExport({
      pdf: playwrightPdf({ launch: () => chromium.launch() }),
      design,
    }),
    exportLessonUrl: ({ courseSlug, lessonId }) =>
      new URL(`/training/${courseSlug}/${lessonId}`, env.DEMO_PUBLIC_URL).toString(),
  });
}

// One module instance per server process, kept across hot reloads in development.
const holder = globalThis as typeof globalThis & { demoElearning?: Elearning };

export function getElearning(): Elearning {
  holder.demoElearning ??= create();
  return holder.demoElearning;
}
