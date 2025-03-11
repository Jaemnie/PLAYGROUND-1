import { Redis } from '@upstash/redis';

// Redis 클라이언트 초기화 (환경 변수에서 자격 증명 사용)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_HOST || '',
  token: process.env.UPSTASH_REDIS_PASSWORD || '',
});

export default redis; 