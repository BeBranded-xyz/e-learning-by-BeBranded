import { HomeScreen } from "./_components/screens";

import { demoSession } from "@/lib/demo-session";
import { demoMessages } from "@/lib/demo-messages";

export default async function HomePage() {
  const messages = demoMessages((await demoSession()).locale);
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">{messages.home}</h1>
      <HomeScreen />
    </div>
  );
}
