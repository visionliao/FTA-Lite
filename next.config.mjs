/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // 只有在构建服务器端代码时，才应用这个规则
    if (isServer) {
      // 将导致问题的模块 '@chroma-core/default-embed' 标记为外部依赖。
      // 这会告诉 Next.js 的打包工具不要尝试去打包这个模块，
      // 而是假设它在最终的 Node.js 运行环境中是可用的。
      config.externals.push({
        '@chroma-core/default-embed': 'commonjs @chroma-core/default-embed',
      });
    }

    // 必须返回修改后的 config 对象
    return config;
  },
}

export default nextConfig
