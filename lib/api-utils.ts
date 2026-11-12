/**
 * Utility functions for API calls
 */
import { supabase } from "./supabase"

/**
 * Headers carrying the logged-in user's Supabase access token, so API routes
 * can tell who is calling. Empty if nobody is logged in.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/**
 * Fetch with authentication headers
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns The response data
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...options.headers,
      },
    })

    if (!response.ok) {
      // Read the body once, then use the API's own error message if it sent one
      const errorText = await response.text().catch(() => "")
      let message = `API error: ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        if (errorData?.error) message = errorData.error
      } catch {
        if (errorText) message = `API error: ${response.status} - ${errorText.substring(0, 100)}`
      }
      throw new Error(message)
    }

    // Check if the response is empty
    const contentType = response.headers.get("content-type")
    if (response.status === 204 || !contentType || contentType === "") {
      return null
    }

    // Parse JSON response
    if (contentType && contentType.includes("application/json")) {
      return response.json()
    }

    // Return text for other content types
    return response.text()
  } catch (error) {
    // Enhance network errors with more context
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Network error: Unable to connect to the API. Please check your internet connection.")
    }

    throw error
  }
}

/**
 * Handle API errors for display
 * @param error - The error object
 * @returns A user-friendly error message
 */
export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    // Check for specific error messages and provide more helpful guidance
    if (error.message.includes("Missing Supabase environment variables")) {
      return "Authentication service configuration error. Please contact support."
    }
    if (error.message.includes("Invalid API key")) {
      return "Authentication service configuration error. Please contact support."
    }
    if (error.message.includes("Network error")) {
      return "Unable to connect to the server. Please check your internet connection and try again."
    }
    return error.message
  }
  return "An unexpected error occurred"
}
