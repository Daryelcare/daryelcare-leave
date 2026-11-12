// Re-export the single toast store so every toast reaches the <Toaster />.
// (This used to be a second copy of the hook with its own state, so toasts
// sent through it were never displayed.)
export { useToast, toast } from "@/hooks/use-toast"
