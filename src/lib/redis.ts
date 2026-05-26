import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    console.log("Redis connected");
  } catch {
    console.warn("Redis unavailable — running without cache");
  }
}

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown, ttlSec = 60): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (ttlSec > 0) {
      await redis.setex(key, ttlSec, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch {
    // silently fail
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        50,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // silently fail
  }
}

export async function incr(key: string): Promise<number> {
  try {
    return await redis.incr(key);
  } catch {
    return 0;
  }
}

export async function decr(key: string): Promise<number> {
  try {
    return await redis.decr(key);
  } catch {
    return 0;
  }
}

export async function setCounter(key: string, value: number, ttlSec = 86400): Promise<void> {
  try {
    await redis.set(key, String(value), "EX", ttlSec);
  } catch {
    // silently fail
  }
}

export async function getCounter(key: string): Promise<number> {
  try {
    const val = await redis.get(key);
    return val ? Number.parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export default redis;
