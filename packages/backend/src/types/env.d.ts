declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      API_BASE_URL?: string;
      DB_HOST?: string;
      DB_PORT?: string;
      DB_NAME?: string;
      DB_USER?: string;
      DB_PASSWORD?: string;
      DB_POOL_MIN?: string;
      DB_POOL_MAX?: string;
      REDIS_HOST?: string;
      REDIS_PORT?: string;
      REDIS_PASSWORD?: string;
      REDIS_DB?: string;
      AWS_REGION?: string;
      AWS_ACCESS_KEY_ID?: string;
      AWS_SECRET_ACCESS_KEY?: string;
      S3_BUCKET_NAME?: string;
      S3_ENDPOINT?: string;
      JWT_SECRET?: string;
      JWT_EXPIRES_IN?: string;
      WEATHER_API_KEY?: string;
      WEATHER_API_URL?: string;
      LOG_LEVEL?: string;
      LOG_FILE_PATH?: string;
      RATE_LIMIT_WINDOW_MS?: string;
      RATE_LIMIT_MAX_REQUESTS?: string;
    }
  }
}

export {};
