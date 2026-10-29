/** @type {import('next').NextConfig} */
const nextConfig = {
  // This tells Turbopack to stop looking around and use your current folder as the absolute root
  experimental: {
    turbopack: {
      root: __dirname,
    },
  },
};

module.exports = nextConfig;