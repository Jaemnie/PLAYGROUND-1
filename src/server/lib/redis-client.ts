import Redis from 'ioredis';

let redis: any;

try {
  const host = process.env.UPSTASH_REDIS_HOST;
  const port = parseInt(process.env.UPSTASH_REDIS_PORT || '6379');
  const password = process.env.UPSTASH_REDIS_PASSWORD;
  
  if (!host || !password) {
    console.warn('Redis 환경 변수가 설정되지 않았습니다. 더미 클라이언트를 사용합니다.');
    // 더미 Redis 클라이언트 생성
    redis = {
      get: async () => null,
      set: async () => null,
      del: async () => 0,
      keys: async () => [],
      exists: async () => 0,
      incr: async () => 0,
      decr: async () => 0,
    };
  } else {
    redis = new Redis({
      host,
      port,
      password,
      tls: {
        rejectUnauthorized: false
      }
    });
  }
} catch (error) {
  console.error('Redis 클라이언트 초기화 오류:', error);
  // 오류 발생 시 더미 클라이언트 생성
  redis = {
    get: async () => null,
    set: async () => null,
    del: async () => 0,
    keys: async () => [],
    exists: async () => 0,
    incr: async () => 0,
    decr: async () => 0,
  };
}

export { redis }; 