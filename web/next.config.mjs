/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Android app talks to this server on port 4000 with a Bearer token, so
  // the route handlers must never be statically cached.
  experimental: {
    // Keep the mongoose driver out of the client bundle entirely.
    serverComponentsExternalPackages: ['mongoose'],
  },
};

export default nextConfig;
