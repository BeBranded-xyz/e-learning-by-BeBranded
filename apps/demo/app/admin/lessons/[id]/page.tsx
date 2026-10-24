import { LessonAdminScreen } from "../../_components/admin-screens";

export default async function AdminLessonPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LessonAdminScreen lessonId={id} />;
}
