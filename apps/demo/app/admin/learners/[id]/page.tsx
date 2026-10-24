import { LearnerScreen } from "../../_components/admin-screens";

export default async function AdminLearnerPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LearnerScreen learnerId={decodeURIComponent(id)} />;
}
