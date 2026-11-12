/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors and lint errors now fail the build, so mistakes are caught
  // before they reach the live site.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
