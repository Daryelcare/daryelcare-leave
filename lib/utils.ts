
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to check if a leave type should affect the days balance
export function shouldDeductFromBalance(leaveType: string): boolean {
  // Only "Annual Leave" and "Working Holiday" should deduct from the 28 days balance
  return leaveType === "Annual Leave" || leaveType === "Working Holiday"
}
