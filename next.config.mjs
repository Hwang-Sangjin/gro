/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // experimental: {
  //   viewTransition: true,
  // },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oylrztkzvelncthlkoal.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
