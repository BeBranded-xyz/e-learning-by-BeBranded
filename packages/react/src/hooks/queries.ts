"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useElearning } from "../provider/context.js";

/** Query keys of the learner API; mutations invalidate them (data-fetching through the query cache). */
export const queryKeys = {
  all: ["elearning"] as const,
  catalog: () => ["elearning", "catalog"] as const,
  course: (slug: string) => ["elearning", "course", slug] as const,
  lesson: (id: string) => ["elearning", "lesson", id] as const,
  myProgress: () => ["elearning", "me", "progress"] as const,
};

export function useCatalog() {
  const { api } = useElearning();
  return useQuery({
    queryKey: queryKeys.catalog(),
    queryFn: ({ signal }) => api.listCourses(signal),
  });
}

export function useCourse(slug: string) {
  const { api } = useElearning();
  return useQuery({
    queryKey: queryKeys.course(slug),
    queryFn: ({ signal }) => api.getCourse(slug, signal),
  });
}

export function useLesson(lessonId: string) {
  const { api } = useElearning();
  return useQuery({
    queryKey: queryKeys.lesson(lessonId),
    queryFn: ({ signal }) => api.getLesson(lessonId, signal),
  });
}

export function useMyProgress() {
  const { api } = useElearning();
  return useQuery({
    queryKey: queryKeys.myProgress(),
    queryFn: ({ signal }) => api.myProgress(signal),
  });
}

/** Progress changes touch the lesson, its course and the dashboards: refresh them all. */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.all });
}

export function useStartLesson() {
  const { api } = useElearning();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (lessonId: string) => api.startLesson(lessonId),
    onSuccess: invalidate,
  });
}

export function useCompleteLesson() {
  const { api } = useElearning();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (lessonId: string) => api.completeLesson(lessonId),
    onSuccess: invalidate,
  });
}

export function useEnroll() {
  const { api } = useElearning();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (courseId: string) => api.enroll(courseId),
    onSuccess: invalidate,
  });
}
