import { Redis } from '@upstash/redis';

// Redis 클라이언트 초기화 (환경 변수에서 자격 증명 사용)
let redis: Redis;

try {
  const url = process.env.UPSTASH_REDIS_HOST;
  const token = process.env.UPSTASH_REDIS_PASSWORD;
  
  if (!url || !token) {
    console.warn('Upstash Redis 환경 변수가 설정되지 않았습니다. 더미 클라이언트를 사용합니다.');
    // 더미 Redis 클라이언트 생성
    redis = {
      get: async () => null,
      set: async () => null,
      del: async () => 0,
      keys: async () => [],
      exists: async () => 0,
      incr: async () => 0,
      decr: async () => 0,
    } as unknown as Redis;
  } else {
    redis = new Redis({
      url,
      token,
    });
  }
} catch (error) {
  console.error('Upstash Redis 클라이언트 초기화 오류:', error);
  // 오류 발생 시 더미 클라이언트 생성
  redis = {
    get: async () => null,
    set: async () => null,
    del: async () => 0,
    keys: async () => [],
    exists: async () => 0,
    incr: async () => 0,
    decr: async () => 0,
  } as unknown as Redis;
}

export { redis }; 