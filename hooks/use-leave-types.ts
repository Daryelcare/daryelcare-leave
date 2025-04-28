
import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth } from "@/lib/api-utils"
import type { LeaveType } from "@/lib/types"

/**
 * Custom hook to fetch leave types from the API
 * @returns Query result containing leave types data, loading state, and error state
 */
export function useLeaveTypes() {
  return useQuery<LeaveType[]>({
    queryKey: ["leaveTypes"],
    queryFn: async () => {
      try {
        const data = await fetchWithAuth("/api/leave-types")
        // Map the database field names to the frontend field names
        return data.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          color: item.color || "#6366f1",
          defaultDays: item.default_days || 0,
          isPaid: item.is_paid || false, 
          requiresApproval: item.requires_approval || true,
          allowNegativeBalance: item.allow_negative_balance || false,
          isActive: item.is_active || true,
        })) || []
      } catch (error) {
        console.error("Error fetching leave types:", error)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1, // Only retry once to avoid excessive requests
  })
}
