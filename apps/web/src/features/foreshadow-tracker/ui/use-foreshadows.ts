"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listForeshadows } from "../api/actions";

export function useForeshadows(workId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["foreshadows", workId];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await listForeshadows(workId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
  return { ...query, invalidate: () => queryClient.invalidateQueries({ queryKey }) };
}
