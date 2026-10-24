import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { DEMO_PERSONAS, isPersona } from "../../lib/demo-users";
import { signInAs } from "./actions";

const DESCRIPTIONS: Readonly<Record<keyof typeof DEMO_PERSONAS, string>> = {
  staff: "Sees the courses open to everyone.",
  manager: "Also sees the courses reserved to managers.",
  admin: "Opens the back-office: courses, rules, reports.",
};

export default function SignInPage() {
  return (
    <section aria-labelledby="sign-in-title" className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 id="sign-in-title" className="text-3xl font-semibold tracking-tight">
          Choose a demo user
        </h1>
        <p className="text-muted-foreground">
          Each user has different roles, so each sees different courses.
        </p>
      </div>
      <form action={signInAs} className="grid gap-4 sm:grid-cols-3">
        {Object.entries(DEMO_PERSONAS).map(([key, persona]) => (
          <Card key={key} className="justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4" aria-hidden="true" />
                {persona.label}
              </CardTitle>
              <CardDescription>{isPersona(key) ? DESCRIPTIONS[key] : null}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="submit" name="persona" value={key} className="w-full">
                {persona.label}
              </Button>
            </CardContent>
          </Card>
        ))}
        <div className="sm:col-span-3">
          <Button type="submit" name="persona" value="" variant="outline">
            Sign out
          </Button>
        </div>
      </form>
    </section>
  );
}
