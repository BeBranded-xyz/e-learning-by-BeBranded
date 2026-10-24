import { CourseAdminScreen } from "../../_components/admin-screens";

export default async function AdminCoursePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CourseAdminScreen courseId={id} />;
}
