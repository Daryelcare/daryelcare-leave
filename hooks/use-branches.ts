import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth } from "@/lib/api-utils"
import type { Branch } from "@/lib/types"

/**
 * Custom hook to fetch branches from the API
 * @returns Query result containing branches data, loading state, and error state
 */
export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: async () => {
      try {
        const data = await fetchWithAuth("/api/branches")
        return data || []
      } catch (error) {
        console.error("Error fetching branches:", error)
        // Propagate the error to be handled by the component
        throw error
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1, // Only retry once to avoid excessive requests
  })
}
