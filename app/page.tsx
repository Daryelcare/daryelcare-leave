import { redirect } from "next/navigation"

export default function Home() {
  // In a real app, we would check authentication status here
  // For now, we'll just redirect to the login page
  redirect("/login")
}
