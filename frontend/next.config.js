/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Rewrites run on the Next.js server, so this must not use a NEXT_PUBLIC_
    // variable. A stale public Vercel variable previously overrode the working
    // backend and sent every product and login request to a retired URL.
    const backendUrl = (process.env.BACKEND_URL || "https://gears-glitch.onrender.com")
      .trim()
      .replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
