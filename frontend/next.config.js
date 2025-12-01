/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8020/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:8020/uploads/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
