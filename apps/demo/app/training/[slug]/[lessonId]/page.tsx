import { LessonScreen } from "../../../_components/screens";

export default async function LessonRoute({
  params,
}: {
  readonly params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  return <LessonScreen slug={slug} lessonId={lessonId} />;
}
