import * as redis from "redis"
const redisUrl = process.env.REDIS_URI || 'redis://localhost:6379'

if (!redisUrl) {
  throw new Error("Redis Url Not Defined");
}

const client = redis.createClient({
  url: redisUrl
});

client.on('error', (err) => console.error('Redis Client Error', err));

// Connect to Redis
client.connect();
console.log(redisUrl, "redisUrl")


export const cacheDocument = (key,val,expiry) => {
  if (expiry) {
    return client.set(key, val, "EX", expiry);
  }
  return client.set(key, val, "EX", 3600) //default expiry
};


export const getCachedDocument = (key)=> {
  return client.get(key);
};

export const deleteCachedDocument = async (keys) => {
  if (!keys || keys.length === 0) return;
  try {
   
    const keysArray = keys.filter(Boolean); 

    if (keysArray.length > 0) {
      await client.del(...keysArray); 
    }
  } catch (error) {
    console.error("Error deleting cache keys:", error);
  }
};