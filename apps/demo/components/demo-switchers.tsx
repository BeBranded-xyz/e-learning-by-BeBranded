"use client";

import { useFormStatus } from "react-dom";

import { changeLocale, signInAs } from "@/app/sign-in/actions";
import { NativeSelect } from "@/components/ui/native-select";
import type { DemoLocale, DemoMessages } from "@/lib/demo-messages";
import type { DemoPersona } from "@/lib/demo-users";

function Switcher({
  label,
  name,
  value,
  options,
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly options: Readonly<Record<string, string>>;
}) {
  const { pending } = useFormStatus();
  return (
    <NativeSelect
      aria-label={label}
      name={name}
      defaultValue={value}
      size="sm"
      disabled={pending}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {Object.entries(options).map(([key, text]) => (
        <option key={key} value={key}>
          {text}
        </option>
      ))}
    </NativeSelect>
  );
}

export function DemoSwitchers({
  persona,
  locale,
  messages,
}: {
  readonly persona: DemoPersona | null;
  readonly locale: DemoLocale;
  readonly messages: DemoMessages;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={signInAs}>
        <Switcher
          key={persona}
          label={messages.profile}
          name="persona"
          value={persona ?? "signed-out"}
          options={{
            staff: messages.learner,
            manager: messages.manager,
            admin: messages.administrator,
            "signed-out": messages.signedOut,
          }}
        />
      </form>
      <form action={changeLocale}>
        <Switcher
          key={locale}
          label={messages.language}
          name="locale"
          value={locale}
          options={{ en: "English", fr: "Français" }}
        />
      </form>
    </div>
  );
}
