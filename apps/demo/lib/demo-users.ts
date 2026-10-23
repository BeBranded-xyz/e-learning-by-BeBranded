import type { LearnerInput } from "@bebranded/elearning-core";

/**
 * FAKE users for the demo only. Choosing a persona sets a cookie with its
 * name: there is no password and no real authentication. A real host plugs
 * its own session into the `identity` resolver instead.
 */
export const DEMO_PERSONAS = {
  staff: {
    label: "Sam (staff)",
    learner: {
      learnerId: "demo-staff",
      tenantId: null,
      roles: ["staff"],
      grade: 1,
      isAdmin: false,
    },
  },
  manager: {
    label: "Morgan (manager)",
    learner: {
      learnerId: "demo-manager",
      tenantId: null,
      roles: ["staff", "manager"],
      grade: 3,
      isAdmin: false,
    },
  },
  admin: {
    label: "Alex (training admin)",
    learner: { learnerId: "demo-admin", tenantId: null, roles: ["training_admin"], isAdmin: true },
  },
} satisfies Record<string, { label: string; learner: LearnerInput }>;

export type DemoPersona = keyof typeof DEMO_PERSONAS;

export const PERSONA_COOKIE = "demo_persona";

export function isPersona(value: string | undefined): value is DemoPersona {
  return value !== undefined && Object.hasOwn(DEMO_PERSONAS, value);
}

/**
 * Optional suffix appended to the persona's learner id, so automated tests
 * (and several people sharing one demo) each get a fresh learner.
 */
export const LEARNER_SUFFIX_COOKIE = "demo_learner_suffix";
const SUFFIX = /^[a-z0-9]{1,32}$/;

export function learnerFor(persona: DemoPersona, suffix: string | undefined) {
  const { learner } = DEMO_PERSONAS[persona];
  return suffix !== undefined && SUFFIX.test(suffix)
    ? { ...learner, learnerId: `${learner.learnerId}-${suffix}` }
    : learner;
}
