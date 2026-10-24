import { HomeScreen } from "./_components/screens";

export default function HomePage() {
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Your training</h1>
      <HomeScreen />
    </div>
  );
}
