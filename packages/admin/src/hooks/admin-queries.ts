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

/** Null waits for the id (a lesson page knows its course only once the lesson loaded). */
export function useAdminCourse(courseId: string | null) {
  const { admin } = useAdmin();
  return useQuery({
    queryKey: adminKeys.course(courseId ?? ""),
    queryFn: () => admin.getCourse(courseId ?? ""),
    enabled: courseId !== null,
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

export function useAdminLesson(lessonId: string) {
  const { admin } = useAdmin();
  return useQuery({
    queryKey: adminKeys.lesson(lessonId),
    queryFn: () => admin.getLesson(lessonId),
    // A video being uploaded or processed is followed until the webhook marks it ready.
    refetchInterval: (query) => {
      const status = query.state.data?.video?.status;
      return status === "uploading" || status === "processing" ? 5_000 : false;
    },
  });
}

export function useAdminQuiz(lessonId: string) {
  const { admin } = useAdmin();
  return useQuery({ queryKey: adminKeys.quiz(lessonId), queryFn: () => admin.getQuiz(lessonId) });
}

/** A lesson write: refreshes the lesson, its quiz, and its course tree. */
export function useLessonMutation<V, R>(
  lesson: { readonly id: string; readonly course_id: string },
  write: (admin: AdminClient, variables: V) => Promise<R>,
) {
  const { admin } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: V) => write(admin, variables),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.lesson(lesson.id) });
      await queryClient.invalidateQueries({ queryKey: adminKeys.quiz(lesson.id) });
      await queryClient.invalidateQueries({ queryKey: adminKeys.course(lesson.course_id) });
    },
  });
}
