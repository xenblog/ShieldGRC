/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_INTERNAL_URL || 'http://backend:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
