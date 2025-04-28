/**
 * Utility functions for API calls
 */

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
        ...options.headers,
      },
    })

    if (!response.ok) {
      const contentType = response.headers.get("content-type")

      // Handle JSON error responses
      if (contentType && contentType.includes("application/json")) {
        try {
          const errorData = await response.json()
          throw new Error(errorData.error || `API error: ${response.status}`)
        } catch (jsonError) {
          // If JSON parsing fails, fall back to text
          const errorText = await response.text().catch(() => "Unknown error")
          throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}`)
        }
      }

      // Handle non-JSON error responses
      const errorText = await response.text().catch(() => "Unknown error")
      throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}`)
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
