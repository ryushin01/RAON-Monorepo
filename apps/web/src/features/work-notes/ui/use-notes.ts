"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotes } from "../api/actions";

export function useNotes(workId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["work-notes", workId];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await listNotes(workId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
  return { ...query, invalidate: () => queryClient.invalidateQueries({ queryKey }) };
}
