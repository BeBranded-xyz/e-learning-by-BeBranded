import { CourseScreen } from "../../_components/screens";

export default async function CourseRoute({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CourseScreen slug={slug} />;
}
