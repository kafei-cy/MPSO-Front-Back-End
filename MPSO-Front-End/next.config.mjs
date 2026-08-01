/** @type {import('next').NextConfig} */
const nextConfig = {
    devIndicators: false,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
        unoptimized: true,
    },
};

export default nextConfig;
