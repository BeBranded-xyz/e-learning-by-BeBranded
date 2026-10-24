"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAdmin } from "../provider/admin-context.js";
import type { AdminClient } from "../api/admin-client.js";

export const adminKeys = {
  all: ["elearning-admin"] as const,
  courses: () => [...adminKeys.all, "courses"] as const,
  course: (courseId: string) => [...adminKeys.all, "course", courseId] as const,
  assignments: (courseId: string) => [...adminKeys.all, "assignments", courseId] as const,
  lesson: (lessonId: string) => [...adminKeys.all, "lesson", lessonId] as const,
  quiz: (lessonId: string) => [...adminKeys.all, "quiz", lessonId] as const,
  grants: (lessonId: string) => [...adminKeys.all, "grants", lessonId] as const,
  report: (kind: string, id: string) => [...adminKeys.all, "report", kind, id] as const,
};

export function useAdminCourses() {
  const { admin } = useAdmin();
  return useQuery({ queryKey: adminKeys.courses(), queryFn: () => admin.listCourses() });
}

export function useAdminCourse(courseId: string) {
  const { admin } = useAdmin();
  return useQuery({
    queryKey: adminKeys.course(courseId),
    queryFn: () => admin.getCourse(courseId),
  });
}

export function useAssignments(courseId: string) {
  const { admin } = useAdmin();
  return useQuery({
    queryKey: adminKeys.assignments(courseId),
    queryFn: () => admin.listAssignments(courseId),
  });
}

/**
 * A write that refreshes the course afterwards (and the course list, whose
 * titles and statuses it may change). Admin data has no optimistic update:
 * the server's answer is the truth (modules/data-fetching).
 */
export function useCourseMutation<V, R>(
  courseId: string | null,
  write: (admin: AdminClient, variables: V) => Promise<R>,
) {
  const { admin } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: V) => write(admin, variables),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.courses() });
      if (courseId !== null) {
        await queryClient.invalidateQueries({ queryKey: adminKeys.course(courseId) });
        await queryClient.invalidateQueries({ queryKey: adminKeys.assignments(courseId) });
      }
    },
  });
}
