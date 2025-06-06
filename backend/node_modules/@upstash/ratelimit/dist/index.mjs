var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/analytics.ts
import { Analytics as CoreAnalytics } from "@upstash/core-analytics";
var Analytics = class {
  analytics;
  table = "events";
  constructor(config) {
    this.analytics = new CoreAnalytics({
      // @ts-expect-error we need to fix the types in core-analytics, it should only require the methods it needs, not the whole sdk
      redis: config.redis,
      window: "1h",
      prefix: config.prefix ?? "@upstash/ratelimit",
      retention: "90d"
    });
  }
  /**
   * Try to extract the geo information from the request
   *
   * This handles Vercel's `req.geo` and  and Cloudflare's `request.cf` properties
   * @param req
   * @returns
   */
  extractGeo(req) {
    if (req.geo !== void 0) {
      return req.geo;
    }
    if (req.cf !== void 0) {
      return req.cf;
    }
    return {};
  }
  async record(event) {
    await this.analytics.ingest(this.table, event);
  }
  async series(filter, cutoff) {
    const timestampCount = Math.min(
      (this.analytics.getBucket(Date.now()) - this.analytics.getBucket(cutoff)) / (60 * 60 * 1e3),
      256
    );
    return this.analytics.aggregateBucketsWithPipeline(this.table, filter, timestampCount);
  }
  async getUsage(cutoff = 0) {
    const timestampCount = Math.min(
      (this.analytics.getBucket(Date.now()) - this.analytics.getBucket(cutoff)) / (60 * 60 * 1e3),
      256
    );
    const records = await this.analytics.getAllowedBlocked(this.table, timestampCount);
    return records;
  }
  async getUsageOverTime(timestampCount, groupby) {
    const result = await this.analytics.aggregateBucketsWithPipeline(this.table, groupby, timestampCount);
    return result;
  }
  async getMostAllowedBlocked(timestampCount, getTop, checkAtMost) {
    getTop = getTop ?? 5;
    const timestamp = void 0;
    return this.analytics.getMostAllowedBlocked(this.table, timestampCount, getTop, timestamp, checkAtMost);
  }
};

// src/cache.ts
var Cache = class {
  /**
   * Stores identifier -> reset (in milliseconds)
   */
  cache;
  constructor(cache) {
    this.cache = cache;
  }
  isBlocked(identifier) {
    if (!this.cache.has(identifier)) {
      return { blocked: false, reset: 0 };
    }
    const reset = this.cache.get(identifier);
    if (reset < Date.now()) {
      this.cache.delete(identifier);
      return { blocked: false, reset: 0 };
    }
    return { blocked: true, reset };
  }
  blockUntil(identifier, reset) {
    this.cache.set(identifier, reset);
  }
  set(key, value) {
    this.cache.set(key, value);
  }
  get(key) {
    return this.cache.get(key) || null;
  }
  incr(key) {
    let value = this.cache.get(key) ?? 0;
    value += 1;
    this.cache.set(key, value);
    return value;
  }
  pop(key) {
    this.cache.delete(key);
  }
  empty() {
    this.cache.clear();
  }
  size() {
    return this.cache.size;
  }
};

// src/duration.ts
function ms(d) {
  const match = d.match(/^(\d+)\s?(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Unable to parse window size: ${d}`);
  }
  const time = Number.parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case "ms": {
      return time;
    }
    case "s": {
      return time * 1e3;
    }
    case "m": {
      return time * 1e3 * 60;
    }
    case "h": {
      return time * 1e3 * 60 * 60;
    }
    case "d": {
      return time * 1e3 * 60 * 60 * 24;
    }
    default: {
      throw new Error(`Unable to parse window size: ${d}`);
    }
  }
}

// src/hash.ts
var safeEval = async (ctx, script, keys, args) => {
  try {
    return await ctx.redis.evalsha(script.hash, keys, args);
  } catch (error) {
    if (`${error}`.includes("NOSCRIPT")) {
      const hash = await ctx.redis.scriptLoad(script.script);
      if (hash !== script.hash) {
        console.warn(
          "Upstash Ratelimit: Expected hash and the hash received from Redis are different. Ratelimit will work as usual but performance will be reduced."
        );
      }
      return await ctx.redis.evalsha(hash, keys, args);
    }
    throw error;
  }
};

// src/lua-scripts/single.ts
var fixedWindowLimitScript = `
  local key           = KEYS[1]
  local window        = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == tonumber(incrementBy) then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end

  return r
`;
var fixedWindowRemainingTokensScript = `
      local key = KEYS[1]
      local tokens = 0

      local value = redis.call('GET', key)
      if value then
          tokens = value
      end
      return tokens
    `;
var slidingWindowLimitScript = `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local tokens      = tonumber(ARGV[1]) -- tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds
  local incrementBy = ARGV[4]           -- increment rate per request at a given value, default is 1

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
  if requestsInPreviousWindow + requestsInCurrentWindow >= tokens then
    return -1
  end

  local newValue = redis.call("INCRBY", currentKey, incrementBy)
  if newValue == tonumber(incrementBy) then
    -- The first time this key is set, the value will be equal to incrementBy.
    -- So we only need the expire command once
    redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
  end
  return tokens - ( newValue + requestsInPreviousWindow )
`;
var slidingWindowRemainingTokensScript = `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local now         = ARGV[1]           -- current timestamp in milliseconds
  local window      = ARGV[2]           -- interval in milliseconds

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end

  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  return requestsInPreviousWindow + requestsInCurrentWindow
`;
var tokenBucketLimitScript = `
  local key         = KEYS[1]           -- identifier including prefixes
  local maxTokens   = tonumber(ARGV[1]) -- maximum number of tokens
  local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
  local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
  local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
  local incrementBy = tonumber(ARGV[5]) -- how many tokens to consume, default is 1
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")
        
  local refilledAt
  local tokens

  if bucket[1] == false then
    refilledAt = now
    tokens = maxTokens
  else
    refilledAt = tonumber(bucket[1])
    tokens = tonumber(bucket[2])
  end
        
  if now >= refilledAt + interval then
    local numRefills = math.floor((now - refilledAt) / interval)
    tokens = math.min(maxTokens, tokens + numRefills * refillRate)

    refilledAt = refilledAt + numRefills * interval
  end

  if tokens == 0 then
    return {-1, refilledAt + interval}
  end

  local remaining = tokens - incrementBy
  local expireAt = math.ceil(((maxTokens - remaining) / refillRate)) * interval
        
  redis.call("HSET", key, "refilledAt", refilledAt, "tokens", remaining)
  redis.call("PEXPIRE", key, expireAt)
  return {remaining, refilledAt + interval}
`;
var tokenBucketIdentifierNotFound = -1;
var tokenBucketRemainingTokensScript = `
  local key         = KEYS[1]
  local maxTokens   = tonumber(ARGV[1])
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")

  if bucket[1] == false then
    return {maxTokens, ${tokenBucketIdentifierNotFound}}
  end
        
  return {tonumber(bucket[2]), tonumber(bucket[1])}
`;
var cachedFixedWindowLimitScript = `
  local key     = KEYS[1]
  local window  = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == incrementBy then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end
      
  return r
`;
var cachedFixedWindowRemainingTokenScript = `
  local key = KEYS[1]
  local tokens = 0

  local value = redis.call('GET', key)
  if value then
      tokens = value
  end
  return tokens
`;

// src/lua-scripts/multi.ts
var fixedWindowLimitScript2 = `
	local key           = KEYS[1]
	local id            = ARGV[1]
	local window        = ARGV[2]
	local incrementBy   = tonumber(ARGV[3])

	redis.call("HSET", key, id, incrementBy)
	local fields = redis.call("HGETALL", key)
	if #fields == 2 and tonumber(fields[2])==incrementBy then
	-- The first time this key is set, and the value will be equal to incrementBy.
	-- So we only need the expire command once
	  redis.call("PEXPIRE", key, window)
	end

	return fields
`;
var fixedWindowRemainingTokensScript2 = `
      local key = KEYS[1]
      local tokens = 0

      local fields = redis.call("HGETALL", key)

      return fields
    `;
var slidingWindowLimitScript2 = `
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local tokens        = tonumber(ARGV[1]) -- tokens per window
	local now           = ARGV[2]           -- current timestamp in milliseconds
	local window        = ARGV[3]           -- interval in milliseconds
	local requestId     = ARGV[4]           -- uuid for this request
	local incrementBy   = tonumber(ARGV[5]) -- custom rate, default is  1

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window
	if requestsInPreviousWindow * (1 - percentageInCurrent ) + requestsInCurrentWindow >= tokens then
	  return {currentFields, previousFields, false}
	end

	redis.call("HSET", currentKey, requestId, incrementBy)

	if requestsInCurrentWindow == 0 then 
	  -- The first time this key is set, the value will be equal to incrementBy.
	  -- So we only need the expire command once
	  redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
	end
	return {currentFields, previousFields, true}
`;
var slidingWindowRemainingTokensScript2 = `
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local now         	= ARGV[1]           -- current timestamp in milliseconds
  	local window      	= ARGV[2]           -- interval in milliseconds

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window
  	requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
	
	return requestsInCurrentWindow + requestsInPreviousWindow
`;

// src/lua-scripts/reset.ts
var resetScript = `
      local pattern = KEYS[1]

      -- Initialize cursor to start from 0
      local cursor = "0"

      repeat
          -- Scan for keys matching the pattern
          local scan_result = redis.call('SCAN', cursor, 'MATCH', pattern)

          -- Extract cursor for the next iteration
          cursor = scan_result[1]

          -- Extract keys from the scan result
          local keys = scan_result[2]

          for i=1, #keys do
          redis.call('DEL', keys[i])
          end

      -- Continue scanning until cursor is 0 (end of keyspace)
      until cursor == "0"
    `;

// src/lua-scripts/hash.ts
var SCRIPTS = {
  singleRegion: {
    fixedWindow: {
      limit: {
        script: fixedWindowLimitScript,
        hash: "b13943e359636db027ad280f1def143f02158c13"
      },
      getRemaining: {
        script: fixedWindowRemainingTokensScript,
        hash: "8c4c341934502aee132643ffbe58ead3450e5208"
      }
    },
    slidingWindow: {
      limit: {
        script: slidingWindowLimitScript,
        hash: "e1391e429b699c780eb0480350cd5b7280fd9213"
      },
      getRemaining: {
        script: slidingWindowRemainingTokensScript,
        hash: "65a73ac5a05bf9712903bc304b77268980c1c417"
      }
    },
    tokenBucket: {
      limit: {
        script: tokenBucketLimitScript,
        hash: "5bece90aeef8189a8cfd28995b479529e270b3c6"
      },
      getRemaining: {
        script: tokenBucketRemainingTokensScript,
        hash: "a15be2bb1db2a15f7c82db06146f9d08983900d0"
      }
    },
    cachedFixedWindow: {
      limit: {
        script: cachedFixedWindowLimitScript,
        hash: "c26b12703dd137939b9a69a3a9b18e906a2d940f"
      },
      getRemaining: {
        script: cachedFixedWindowRemainingTokenScript,
        hash: "8e8f222ccae68b595ee6e3f3bf2199629a62b91a"
      }
    }
  },
  multiRegion: {
    fixedWindow: {
      limit: {
        script: fixedWindowLimitScript2,
        hash: "a8c14f3835aa87bd70e5e2116081b81664abcf5c"
      },
      getRemaining: {
        script: fixedWindowRemainingTokensScript2,
        hash: "8ab8322d0ed5fe5ac8eb08f0c2e4557f1b4816fd"
      }
    },
    slidingWindow: {
      limit: {
        script: slidingWindowLimitScript2,
        hash: "cb4fdc2575056df7c6d422764df0de3a08d6753b"
      },
      getRemaining: {
        script: slidingWindowRemainingTokensScript2,
        hash: "558c9306b7ec54abb50747fe0b17e5d44bd24868"
      }
    }
  }
};
var RESET_SCRIPT = {
  script: resetScript,
  hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50"
};

// src/types.ts
var DenyListExtension = "denyList";
var IpDenyListKey = "ipDenyList";
var IpDenyListStatusKey = "ipDenyListStatus";

// src/deny-list/scripts.ts
var checkDenyListScript = `
  -- Checks if values provideed in ARGV are present in the deny lists.
  -- This is done using the allDenyListsKey below.

  -- Additionally, checks the status of the ip deny list using the
  -- ipDenyListStatusKey below. Here are the possible states of the
  -- ipDenyListStatusKey key:
  -- * status == -1: set to "disabled" with no TTL
  -- * status == -2: not set, meaning that is was set before but expired
  -- * status  >  0: set to "valid", with a TTL
  --
  -- In the case of status == -2, we set the status to "pending" with
  -- 30 second ttl. During this time, the process which got status == -2
  -- will update the ip deny list.

  local allDenyListsKey     = KEYS[1]
  local ipDenyListStatusKey = KEYS[2]

  local results = redis.call('SMISMEMBER', allDenyListsKey, unpack(ARGV))
  local status  = redis.call('TTL', ipDenyListStatusKey)
  if status == -2 then
    redis.call('SETEX', ipDenyListStatusKey, 30, "pending")
  end

  return { results, status }
`;

// src/deny-list/ip-deny-list.ts
var ip_deny_list_exports = {};
__export(ip_deny_list_exports, {
  ThresholdError: () => ThresholdError,
  disableIpDenyList: () => disableIpDenyList,
  updateIpDenyList: () => updateIpDenyList
});

// src/deny-list/time.ts
var MILLISECONDS_IN_HOUR = 60 * 60 * 1e3;
var MILLISECONDS_IN_DAY = 24 * MILLISECONDS_IN_HOUR;
var MILLISECONDS_TO_2AM = 2 * MILLISECONDS_IN_HOUR;
var getIpListTTL = (time) => {
  const now = time || Date.now();
  const timeSinceLast2AM = (now - MILLISECONDS_TO_2AM) % MILLISECONDS_IN_DAY;
  return MILLISECONDS_IN_DAY - timeSinceLast2AM;
};

// src/deny-list/ip-deny-list.ts
var baseUrl = "https://raw.githubusercontent.com/stamparm/ipsum/master/levels";
var ThresholdError = class extends Error {
  constructor(threshold) {
    super(`Allowed threshold values are from 1 to 8, 1 and 8 included. Received: ${threshold}`);
    this.name = "ThresholdError";
  }
};
var getIpDenyList = async (threshold) => {
  if (typeof threshold !== "number" || threshold < 1 || threshold > 8) {
    throw new ThresholdError(threshold);
  }
  try {
    const response = await fetch(`${baseUrl}/${threshold}.txt`);
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`);
    }
    const data = await response.text();
    const lines = data.split("\n");
    return lines.filter((value) => value.length > 0);
  } catch (error) {
    throw new Error(`Failed to fetch ip deny list: ${error}`);
  }
};
var updateIpDenyList = async (redis, prefix, threshold, ttl) => {
  const allIps = await getIpDenyList(threshold);
  const allDenyLists = [prefix, DenyListExtension, "all"].join(":");
  const ipDenyList = [prefix, DenyListExtension, IpDenyListKey].join(":");
  const statusKey = [prefix, IpDenyListStatusKey].join(":");
  const transaction = redis.multi();
  transaction.sdiffstore(allDenyLists, allDenyLists, ipDenyList);
  transaction.del(ipDenyList);
  transaction.sadd(ipDenyList, allIps.at(0), ...allIps.slice(1));
  transaction.sdiffstore(ipDenyList, ipDenyList, allDenyLists);
  transaction.sunionstore(allDenyLists, allDenyLists, ipDenyList);
  transaction.set(statusKey, "valid", { px: ttl ?? getIpListTTL() });
  return await transaction.exec();
};
var disableIpDenyList = async (redis, prefix) => {
  const allDenyListsKey = [prefix, DenyListExtension, "all"].join(":");
  const ipDenyListKey = [prefix, DenyListExtension, IpDenyListKey].join(":");
  const statusKey = [prefix, IpDenyListStatusKey].join(":");
  const transaction = redis.multi();
  transaction.sdiffstore(allDenyListsKey, allDenyListsKey, ipDenyListKey);
  transaction.del(ipDenyListKey);
  transaction.set(statusKey, "disabled");
  return await transaction.exec();
};

// src/deny-list/deny-list.ts
var denyListCache = new Cache(/* @__PURE__ */ new Map());
var checkDenyListCache = (members) => {
  return members.find(
    (member) => denyListCache.isBlocked(member).blocked
  );
};
var blockMember = (member) => {
  if (denyListCache.size() > 1e3)
    denyListCache.empty();
  denyListCache.blockUntil(member, Date.now() + 6e4);
};
var checkDenyList = async (redis, prefix, members) => {
  const [deniedValues, ipDenyListStatus] = await redis.eval(
    checkDenyListScript,
    [
      [prefix, DenyListExtension, "all"].join(":"),
      [prefix, IpDenyListStatusKey].join(":")
    ],
    members
  );
  let deniedValue = void 0;
  deniedValues.map((memberDenied, index) => {
    if (memberDenied) {
      blockMember(members[index]);
      deniedValue = members[index];
    }
  });
  return {
    deniedValue,
    invalidIpDenyList: ipDenyListStatus === -2
  };
};
var resolveLimitPayload = (redis, prefix, [ratelimitResponse, denyListResponse], threshold) => {
  if (denyListResponse.deniedValue) {
    ratelimitResponse.success = false;
    ratelimitResponse.remaining = 0;
    ratelimitResponse.reason = "denyList";
    ratelimitResponse.deniedValue = denyListResponse.deniedValue;
  }
  if (denyListResponse.invalidIpDenyList) {
    const updatePromise = updateIpDenyList(redis, prefix, threshold);
    ratelimitResponse.pending = Promise.all([
      ratelimitResponse.pending,
      updatePromise
    ]);
  }
  return ratelimitResponse;
};
var defaultDeniedResponse = (deniedValue) => {
  return {
    success: false,
    limit: 0,
    remaining: 0,
    reset: 0,
    pending: Promise.resolve(),
    reason: "denyList",
    deniedValue
  };
};

// src/ratelimit.ts
var Ratelimit = class {
  limiter;
  ctx;
  prefix;
  timeout;
  primaryRedis;
  analytics;
  enableProtection;
  denyListThreshold;
  constructor(config) {
    this.ctx = config.ctx;
    this.limiter = config.limiter;
    this.timeout = config.timeout ?? 5e3;
    this.prefix = config.prefix ?? "@upstash/ratelimit";
    this.enableProtection = config.enableProtection ?? false;
    this.denyListThreshold = config.denyListThreshold ?? 6;
    this.primaryRedis = "redis" in this.ctx ? this.ctx.redis : this.ctx.regionContexts[0].redis;
    this.analytics = config.analytics ? new Analytics({
      redis: this.primaryRedis,
      prefix: this.prefix
    }) : void 0;
    if (config.ephemeralCache instanceof Map) {
      this.ctx.cache = new Cache(config.ephemeralCache);
    } else if (config.ephemeralCache === void 0) {
      this.ctx.cache = new Cache(/* @__PURE__ */ new Map());
    }
  }
  /**
   * Determine if a request should pass or be rejected based on the identifier and previously chosen ratelimit.
   *
   * Use this if you want to reject all requests that you can not handle right now.
   *
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: Redis.fromEnv(),
   *    limiter: Ratelimit.slidingWindow(10, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.limit(id)
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   *
   * @param req.rate - The rate at which tokens will be added or consumed from the token bucket. A higher rate allows for more requests to be processed. Defaults to 1 token per interval if not specified.
   *
   * Usage with `req.rate`
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: Redis.fromEnv(),
   *    limiter: Ratelimit.slidingWindow(100, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.limit(id, {rate: 10})
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   */
  limit = async (identifier, req) => {
    let timeoutId = null;
    try {
      const response = this.getRatelimitResponse(identifier, req);
      const { responseArray, newTimeoutId } = this.applyTimeout(response);
      timeoutId = newTimeoutId;
      const timedResponse = await Promise.race(responseArray);
      const finalResponse = this.submitAnalytics(timedResponse, identifier, req);
      return finalResponse;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };
  /**
   * Block until the request may pass or timeout is reached.
   *
   * This method returns a promise that resolves as soon as the request may be processed
   * or after the timeout has been reached.
   *
   * Use this if you want to delay the request until it is ready to get processed.
   *
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: Redis.fromEnv(),
   *    limiter: Ratelimit.slidingWindow(10, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.blockUntilReady(id, 60_000)
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   */
  blockUntilReady = async (identifier, timeout) => {
    if (timeout <= 0) {
      throw new Error("timeout must be positive");
    }
    let res;
    const deadline = Date.now() + timeout;
    while (true) {
      res = await this.limit(identifier);
      if (res.success) {
        break;
      }
      if (res.reset === 0) {
        throw new Error("This should not happen");
      }
      const wait = Math.min(res.reset, deadline) - Date.now();
      await new Promise((r) => setTimeout(r, wait));
      if (Date.now() > deadline) {
        break;
      }
    }
    return res;
  };
  resetUsedTokens = async (identifier) => {
    const pattern = [this.prefix, identifier].join(":");
    await this.limiter().resetTokens(this.ctx, pattern);
  };
  /**
   * Returns the remaining token count together with a reset timestamps
   * 
   * @param identifier identifir to check
   * @returns object with `remaining` and reset fields. `remaining` denotes
   *          the remaining tokens and reset denotes the timestamp when the
   *          tokens reset.
   */
  getRemaining = async (identifier) => {
    const pattern = [this.prefix, identifier].join(":");
    return await this.limiter().getRemaining(this.ctx, pattern);
  };
  /**
   * Checks if the identifier or the values in req are in the deny list cache.
   * If so, returns the default denied response.
   * 
   * Otherwise, calls redis to check the rate limit and deny list. Returns after
   * resolving the result. Resolving is overriding the rate limit result if
   * the some value is in deny list.
   * 
   * @param identifier identifier to block
   * @param req options with ip, user agent, country, rate and geo info
   * @returns rate limit response
   */
  getRatelimitResponse = async (identifier, req) => {
    const key = this.getKey(identifier);
    const definedMembers = this.getDefinedMembers(identifier, req);
    const deniedValue = checkDenyListCache(definedMembers);
    const result = deniedValue ? [defaultDeniedResponse(deniedValue), { deniedValue, invalidIpDenyList: false }] : await Promise.all([
      this.limiter().limit(this.ctx, key, req?.rate),
      this.enableProtection ? checkDenyList(this.primaryRedis, this.prefix, definedMembers) : { deniedValue: void 0, invalidIpDenyList: false }
    ]);
    return resolveLimitPayload(this.primaryRedis, this.prefix, result, this.denyListThreshold);
  };
  /**
   * Creates an array with the original response promise and a timeout promise
   * if this.timeout > 0.
   * 
   * @param response Ratelimit response promise
   * @returns array with the response and timeout promise. also includes the timeout id
   */
  applyTimeout = (response) => {
    let newTimeoutId = null;
    const responseArray = [response];
    if (this.timeout > 0) {
      const timeoutResponse = new Promise((resolve) => {
        newTimeoutId = setTimeout(() => {
          resolve({
            success: true,
            limit: 0,
            remaining: 0,
            reset: 0,
            pending: Promise.resolve(),
            reason: "timeout"
          });
        }, this.timeout);
      });
      responseArray.push(timeoutResponse);
    }
    return {
      responseArray,
      newTimeoutId
    };
  };
  /**
   * submits analytics if this.analytics is set
   * 
   * @param ratelimitResponse final rate limit response
   * @param identifier identifier to submit
   * @param req limit options
   * @returns rate limit response after updating the .pending field
   */
  submitAnalytics = (ratelimitResponse, identifier, req) => {
    if (this.analytics) {
      try {
        const geo = req ? this.analytics.extractGeo(req) : void 0;
        const analyticsP = this.analytics.record({
          identifier: ratelimitResponse.reason === "denyList" ? ratelimitResponse.deniedValue : identifier,
          time: Date.now(),
          success: ratelimitResponse.reason === "denyList" ? "denied" : ratelimitResponse.success,
          ...geo
        }).catch((error) => {
          let errorMessage = "Failed to record analytics";
          if (`${error}`.includes("WRONGTYPE")) {
            errorMessage = `
    Failed to record analytics. See the information below:

    This can occur when you uprade to Ratelimit version 1.1.2
    or later from an earlier version.

    This occurs simply because the way we store analytics data
    has changed. To avoid getting this error, disable analytics
    for *an hour*, then simply enable it back.

    `;
          }
          console.warn(errorMessage, error);
        });
        ratelimitResponse.pending = Promise.all([ratelimitResponse.pending, analyticsP]);
      } catch (error) {
        console.warn("Failed to record analytics", error);
      }
      ;
    }
    ;
    return ratelimitResponse;
  };
  getKey = (identifier) => {
    return [this.prefix, identifier].join(":");
  };
  /**
   * returns a list of defined values from
   * [identifier, req.ip, req.userAgent, req.country]
   * 
   * @param identifier identifier
   * @param req limit options
   * @returns list of defined values
   */
  getDefinedMembers = (identifier, req) => {
    const members = [identifier, req?.ip, req?.userAgent, req?.country];
    return members.filter(Boolean);
  };
};

// src/multi.ts
function randomId() {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < 16; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
var MultiRegionRatelimit = class extends Ratelimit {
  /**
   * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithn of your choice.
   */
  constructor(config) {
    super({
      prefix: config.prefix,
      limiter: config.limiter,
      timeout: config.timeout,
      analytics: config.analytics,
      ctx: {
        regionContexts: config.redis.map((redis) => ({
          redis
        })),
        cache: config.ephemeralCache ? new Cache(config.ephemeralCache) : void 0
      }
    });
  }
  /**
   * Each request inside a fixed time increases a counter.
   * Once the counter reaches the maximum allowed number, all further requests are
   * rejected.
   *
   * **Pro:**
   *
   * - Newer requests are not starved by old ones.
   * - Low storage cost.
   *
   * **Con:**
   *
   * A burst of requests near the boundary of a window can result in a very
   * high request rate because two windows will be filled with requests quickly.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - A fixed timeframe
   */
  static fixedWindow(tokens, window) {
    const windowDuration = ms(window);
    return () => ({
      async limit(ctx, identifier, rate) {
        if (ctx.cache) {
          const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
          if (blocked) {
            return {
              success: false,
              limit: tokens,
              remaining: 0,
              reset: reset2,
              pending: Promise.resolve(),
              reason: "cacheBlock"
            };
          }
        }
        const requestId = randomId();
        const bucket = Math.floor(Date.now() / windowDuration);
        const key = [identifier, bucket].join(":");
        const incrementBy = rate ? Math.max(1, rate) : 1;
        const dbs = ctx.regionContexts.map((regionContext) => ({
          redis: regionContext.redis,
          request: safeEval(
            regionContext,
            SCRIPTS.multiRegion.fixedWindow.limit,
            [key],
            [requestId, windowDuration, incrementBy]
          )
        }));
        const firstResponse = await Promise.any(dbs.map((s) => s.request));
        const usedTokens = firstResponse.reduce((accTokens, usedToken, index) => {
          let parsedToken = 0;
          if (index % 2) {
            parsedToken = Number.parseInt(usedToken);
          }
          return accTokens + parsedToken;
        }, 0);
        const remaining = tokens - usedTokens;
        async function sync() {
          const individualIDs = await Promise.all(dbs.map((s) => s.request));
          const allIDs = [...new Set(
            individualIDs.flat().reduce((acc, curr, index) => {
              if (index % 2 === 0) {
                acc.push(curr);
              }
              return acc;
            }, [])
          ).values()];
          for (const db of dbs) {
            const usedDbTokensRequest = await db.request;
            const usedDbTokens = usedDbTokensRequest.reduce(
              (accTokens, usedToken, index) => {
                let parsedToken = 0;
                if (index % 2) {
                  parsedToken = Number.parseInt(usedToken);
                }
                return accTokens + parsedToken;
              },
              0
            );
            const dbIdsRequest = await db.request;
            const dbIds = dbIdsRequest.reduce((ids, currentId, index) => {
              if (index % 2 === 0) {
                ids.push(currentId);
              }
              return ids;
            }, []);
            if (usedDbTokens >= tokens) {
              continue;
            }
            const diff = allIDs.filter((id) => !dbIds.includes(id));
            if (diff.length === 0) {
              continue;
            }
            for (const requestId2 of diff) {
              await db.redis.hset(key, { [requestId2]: incrementBy });
            }
          }
        }
        const success = remaining > 0;
        const reset = (bucket + 1) * windowDuration;
        if (ctx.cache && !success) {
          ctx.cache.blockUntil(identifier, reset);
        }
        return {
          success,
          limit: tokens,
          remaining,
          reset,
          pending: sync()
        };
      },
      async getRemaining(ctx, identifier) {
        const bucket = Math.floor(Date.now() / windowDuration);
        const key = [identifier, bucket].join(":");
        const dbs = ctx.regionContexts.map((regionContext) => ({
          redis: regionContext.redis,
          request: safeEval(
            regionContext,
            SCRIPTS.multiRegion.fixedWindow.getRemaining,
            [key],
            [null]
          )
        }));
        const firstResponse = await Promise.any(dbs.map((s) => s.request));
        const usedTokens = firstResponse.reduce((accTokens, usedToken, index) => {
          let parsedToken = 0;
          if (index % 2) {
            parsedToken = Number.parseInt(usedToken);
          }
          return accTokens + parsedToken;
        }, 0);
        return {
          remaining: Math.max(0, tokens - usedTokens),
          reset: (bucket + 1) * windowDuration
        };
      },
      async resetTokens(ctx, identifier) {
        const pattern = [identifier, "*"].join(":");
        if (ctx.cache) {
          ctx.cache.pop(identifier);
        }
        await Promise.all(ctx.regionContexts.map((regionContext) => {
          safeEval(
            regionContext,
            RESET_SCRIPT,
            [pattern],
            [null]
          );
        }));
      }
    });
  }
  /**
   * Combined approach of `slidingLogs` and `fixedWindow` with lower storage
   * costs than `slidingLogs` and improved boundary behavior by calculating a
   * weighted score between two windows.
   *
   * **Pro:**
   *
   * Good performance allows this to scale to very high loads.
   *
   * **Con:**
   *
   * Nothing major.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - The duration in which the user can max X requests.
   */
  static slidingWindow(tokens, window) {
    const windowSize = ms(window);
    const windowDuration = ms(window);
    return () => ({
      async limit(ctx, identifier, rate) {
        if (ctx.cache) {
          const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
          if (blocked) {
            return {
              success: false,
              limit: tokens,
              remaining: 0,
              reset: reset2,
              pending: Promise.resolve(),
              reason: "cacheBlock"
            };
          }
        }
        const requestId = randomId();
        const now = Date.now();
        const currentWindow = Math.floor(now / windowSize);
        const currentKey = [identifier, currentWindow].join(":");
        const previousWindow = currentWindow - 1;
        const previousKey = [identifier, previousWindow].join(":");
        const incrementBy = rate ? Math.max(1, rate) : 1;
        const dbs = ctx.regionContexts.map((regionContext) => ({
          redis: regionContext.redis,
          request: safeEval(
            regionContext,
            SCRIPTS.multiRegion.slidingWindow.limit,
            [currentKey, previousKey],
            [tokens, now, windowDuration, requestId, incrementBy]
            // lua seems to return `1` for true and `null` for false
          )
        }));
        const percentageInCurrent = now % windowDuration / windowDuration;
        const [current, previous, success] = await Promise.any(dbs.map((s) => s.request));
        if (success) {
          current.push(requestId, incrementBy.toString());
        }
        const previousUsedTokens = previous.reduce((accTokens, usedToken, index) => {
          let parsedToken = 0;
          if (index % 2) {
            parsedToken = Number.parseInt(usedToken);
          }
          return accTokens + parsedToken;
        }, 0);
        const currentUsedTokens = current.reduce((accTokens, usedToken, index) => {
          let parsedToken = 0;
          if (index % 2) {
            parsedToken = Number.parseInt(usedToken);
          }
          return accTokens + parsedToken;
        }, 0);
        const previousPartialUsed = Math.ceil(previousUsedTokens * (1 - percentageInCurrent));
        const usedTokens = previousPartialUsed + currentUsedTokens;
        const remaining = tokens - usedTokens;
        async function sync() {
          const res = await Promise.all(dbs.map((s) => s.request));
          const allCurrentIds = [...new Set(
            res.flatMap(([current2]) => current2).reduce((acc, curr, index) => {
              if (index % 2 === 0) {
                acc.push(curr);
              }
              return acc;
            }, [])
          ).values()];
          for (const db of dbs) {
            const [current2, _previous, _success] = await db.request;
            const dbIds = current2.reduce((ids, currentId, index) => {
              if (index % 2 === 0) {
                ids.push(currentId);
              }
              return ids;
            }, []);
            const usedDbTokens = current2.reduce((accTokens, usedToken, index) => {
              let parsedToken = 0;
              if (index % 2) {
                parsedToken = Number.parseInt(usedToken);
              }
              return accTokens + parsedToken;
            }, 0);
            if (usedDbTokens >= tokens) {
              continue;
            }
            const diff = allCurrentIds.filter((id) => !dbIds.includes(id));
            if (diff.length === 0) {
              continue;
            }
            for (const requestId2 of diff) {
              await db.redis.hset(currentKey, { [requestId2]: incrementBy });
            }
          }
        }
        const reset = (currentWindow + 1) * windowDuration;
        if (ctx.cache && !success) {
          ctx.cache.blockUntil(identifier, reset);
        }
        return {
          success: Boolean(success),
          limit: tokens,
          remaining: Math.max(0, remaining),
          reset,
          pending: sync()
        };
      },
      async getRemaining(ctx, identifier) {
        const now = Date.now();
        const currentWindow = Math.floor(now / windowSize);
        const currentKey = [identifier, currentWindow].join(":");
        const previousWindow = currentWindow - 1;
        const previousKey = [identifier, previousWindow].join(":");
        const dbs = ctx.regionContexts.map((regionContext) => ({
          redis: regionContext.redis,
          request: safeEval(
            regionContext,
            SCRIPTS.multiRegion.slidingWindow.getRemaining,
            [currentKey, previousKey],
            [now, windowSize]
            // lua seems to return `1` for true and `null` for false
          )
        }));
        const usedTokens = await Promise.any(dbs.map((s) => s.request));
        return {
          remaining: Math.max(0, tokens - usedTokens),
          reset: (currentWindow + 1) * windowSize
        };
      },
      async resetTokens(ctx, identifier) {
        const pattern = [identifier, "*"].join(":");
        if (ctx.cache) {
          ctx.cache.pop(identifier);
        }
        await Promise.all(ctx.regionContexts.map((regionContext) => {
          safeEval(
            regionContext,
            RESET_SCRIPT,
            [pattern],
            [null]
          );
        }));
      }
    });
  }
};

// src/single.ts
var RegionRatelimit = class extends Ratelimit {
  /**
   * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithm of your choice.
   */
  constructor(config) {
    super({
      prefix: config.prefix,
      limiter: config.limiter,
      timeout: config.timeout,
      analytics: config.analytics,
      ctx: {
        redis: config.redis
      },
      ephemeralCache: config.ephemeralCache,
      enableProtection: config.enableProtection,
      denyListThreshold: config.denyListThreshold
    });
  }
  /**
   * Each request inside a fixed time increases a counter.
   * Once the counter reaches the maximum allowed number, all further requests are
   * rejected.
   *
   * **Pro:**
   *
   * - Newer requests are not starved by old ones.
   * - Low storage cost.
   *
   * **Con:**
   *
   * A burst of requests near the boundary of a window can result in a very
   * high request rate because two windows will be filled with requests quickly.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - A fixed timeframe
   */
  static fixedWindow(tokens, window) {
    const windowDuration = ms(window);
    return () => ({
      async limit(ctx, identifier, rate) {
        const bucket = Math.floor(Date.now() / windowDuration);
        const key = [identifier, bucket].join(":");
        if (ctx.cache) {
          const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
          if (blocked) {
            return {
              success: false,
              limit: tokens,
              remaining: 0,
              reset: reset2,
              pending: Promise.resolve(),
              reason: "cacheBlock"
            };
          }
        }
        const incrementBy = rate ? Math.max(1, rate) : 1;
        const usedTokensAfterUpdate = await safeEval(
          ctx,
          SCRIPTS.singleRegion.fixedWindow.limit,
          [key],
          [windowDuration, incrementBy]
        );
        const success = usedTokensAfterUpdate <= tokens;
        const remainingTokens = Math.max(0, tokens - usedTokensAfterUpdate);
        const reset = (bucket + 1) * windowDuration;
        if (ctx.cache && !success) {
          ctx.cache.blockUntil(identifier, reset);
        }
        return {
          success,
          limit: tokens,
          remaining: remainingTokens,
          reset,
          pending: Promise.resolve()
        };
      },
      async getRemaining(ctx, identifier) {
        const bucket = Math.floor(Date.now() / windowDuration);
        const key = [identifier, bucket].join(":");
        const usedTokens = await safeEval(
          ctx,
          SCRIPTS.singleRegion.fixedWindow.getRemaining,
          [key],
          [null]
        );
        return {
          remaining: Math.max(0, tokens - usedTokens),
          reset: (bucket + 1) * windowDuration
        };
      },
      async resetTokens(ctx, identifier) {
        const pattern = [identifier, "*"].join(":");
        if (ctx.cache) {
          ctx.cache.pop(identifier);
        }
        await safeEval(
          ctx,
          RESET_SCRIPT,
          [pattern],
          [null]
        );
      }
    });
  }
  /**
   * Combined approach of `slidingLogs` and `fixedWindow` with lower storage
   * costs than `slidingLogs` and improved boundary behavior by calculating a
   * weighted score between two windows.
   *
   * **Pro:**
   *
   * Good performance allows this to scale to very high loads.
   *
   * **Con:**
   *
   * Nothing major.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - The duration in which the user can max X requests.
   */
  static slidingWindow(tokens, window) {
    const windowSize = ms(window);
    return () => ({
      async limit(ctx, identifier, rate) {
        const now = Date.now();
        const currentWindow = Math.floor(now / windowSize);
        const currentKey = [identifier, currentWindow].join(":");
        const previousWindow = currentWindow - 1;
        const previousKey = [identifier, previousWindow].join(":");
        if (ctx.cache) {
          const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
          if (blocked) {
            return {
              success: false,
              limit: tokens,
              remaining: 0,
              reset: reset2,
              pending: Promise.resolve(),
              reason: "cacheBlock"
            };
          }
        }
        const incrementBy = rate ? Math.max(1, rate) : 1;
        const remainingTokens = await safeEval(
          ctx,
          SCRIPTS.singleRegion.slidingWindow.limit,
          [currentKey, previousKey],
          [tokens, now, windowSize, incrementBy]
        );
        const success = remainingTokens >= 0;
        const reset = (currentWindow + 1) * windowSize;
        if (ctx.cache && !success) {
          ctx.cache.blockUntil(identifier, reset);
        }
        return {
          success,
          limit: tokens,
          remaining: Math.max(0, remainingTokens),
          reset,
          pending: Promise.resolve()
        };
      },
      async getRemaining(ctx, identifier) {
        const now = Date.now();
        const currentWindow = Math.floor(now / windowSize);
        const currentKey = [identifier, currentWindow].join(":");
        const previousWindow = currentWindow - 1;
        const previousKey = [identifier, previousWindow].join(":");
        const usedTokens = await safeEval(
          ctx,
          SCRIPTS.singleRegion.slidingWindow.getRemaining,
          [currentKey, previousKey],
          [now, windowSize]
        );
        return {
          remaining: Math.max(0, tokens - usedTokens),
          reset: (currentWindow + 1) * windowSize
        };
      },
      async resetTokens(ctx, identifier) {
        const pattern = [identifier, "*"].join(":");
        if (ctx.cache) {
          ctx.cache.pop(identifier);
        }
        await safeEval(
          ctx,
          RESET_SCRIPT,
          [pattern],
          [null]
        );
      }
    });
  }
  /**
   * You have a bucket filled with `{maxTokens}` tokens that refills constantly
   * at `{refillRate}` per `{interval}`.
   * Every request will remove one token from the bucket and if there is no
   * token to take, the request is rejected.
   *
   * **Pro:**
   *
   * - Bursts of requests are smoothed out and you can process them at a constant
   * rate.
   * - Allows to set a higher initial burst limit by setting `maxTokens` higher
   * than `refillRate`
   */
  static tokenBucket(refillRate, interval, maxTokens) {
    const intervalDuration = ms(interval);
    return () => ({
      async limit(ctx, identifier, rate) {
        if (ctx.cache) {
          const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
          if (blocked) {
            return {
              success: false,
              limit: maxTokens,
              remaining: 0,
              reset: reset2,
              pending: Promise.resolve(),
              reason: "cacheBlock"
            };
          }
        }
        const now = Date.now();
        const incrementBy = rate ? Math.max(1, rate) : 1;
        const [remaining, reset] = await safeEval(
          ctx,
          SCRIPTS.singleRegion.tokenBucket.limit,
          [identifier],
          [maxTokens, intervalDuration, refillRate, now, incrementBy]
        );
        const success = remaining >= 0;
        if (ctx.cache && !success) {
          ctx.cache.blockUntil(identifier, reset);
        }
        return {
          success,
          limit: maxTokens,
          remaining,
          reset,
          pending: Promise.resolve()
        };
      },
      async getRemaining(ctx, identifier) {
        const [remainingTokens, refilledAt] = await safeEval(
          ctx,
          SCRIPTS.singleRegion.tokenBucket.getRemaining,
          [identifier],
          [maxTokens]
        );
        const freshRefillAt = Date.now() + intervalDuration;
        const identifierRefillsAt = refilledAt + intervalDuration;
        return {
          remaining: remainingTokens,
          reset: refilledAt === tokenBucketIdentifierNotFound ? freshRefillAt : identifierRefillsAt
        };
      },
      async resetTokens(ctx, identifier) {
        const pattern = identifier;
        if (ctx.cache) {
          ctx.cache.pop(identifier);
        }
        await safeEval(
          ctx,
          RESET_SCRIPT,
          [pattern],
          [null]
        );
      }
    });
  }
  /**
   * cachedFixedWindow first uses the local cache to decide if a request may pass and then updates
   * it asynchronously.
   * This is experimental and not yet recommended for production use.
   *
   * @experimental
   *
   * Each request inside a fixed time increases a counter.
   * Once the counter reaches the maximum allowed number, all further requests are
   * rejected.
   *
   * **Pro:**
   *
   * - Newer requests are not starved by old ones.
   * - Low storage cost.
   *
   * **Con:**
   *
   * A burst of requests near the boundary of a window can result in a very
   * high request rate because two windows will be filled with requests quickly.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - A fixed timeframe
   */
  static cachedFixedWindow(tokens, window) {
    const windowDuration = ms(window);
    return () => ({
      async limit(ctx, identifier, rate) {
        if (!ctx.cache) {
          throw new Error("This algorithm requires a cache");
        }
        const bucket = Math.floor(Date.now() / windowDuration);
        const key = [identifier, bucket].join(":");
        const reset = (bucket + 1) * windowDuration;
        const incrementBy = rate ? Math.max(1, rate) : 1;
        const hit = typeof ctx.cache.get(key) === "number";
        if (hit) {
          const cachedTokensAfterUpdate = ctx.cache.incr(key);
          const success = cachedTokensAfterUpdate < tokens;
          const pending = success ? safeEval(
            ctx,
            SCRIPTS.singleRegion.cachedFixedWindow.limit,
            [key],
            [windowDuration, incrementBy]
          ) : Promise.resolve();
          return {
            success,
            limit: tokens,
            remaining: tokens - cachedTokensAfterUpdate,
            reset,
            pending
          };
        }
        const usedTokensAfterUpdate = await safeEval(
          ctx,
          SCRIPTS.singleRegion.cachedFixedWindow.limit,
          [key],
          [windowDuration, incrementBy]
        );
        ctx.cache.set(key, usedTokensAfterUpdate);
        const remaining = tokens - usedTokensAfterUpdate;
        return {
          success: remaining >= 0,
          limit: tokens,
          remaining,
          reset,
          pending: Promise.resolve()
        };
      },
      async getRemaining(ctx, identifier) {
        if (!ctx.cache) {
          throw new Error("This algorithm requires a cache");
        }
        const bucket = Math.floor(Date.now() / windowDuration);
        const key = [identifier, bucket].join(":");
        const hit = typeof ctx.cache.get(key) === "number";
        if (hit) {
          const cachedUsedTokens = ctx.cache.get(key) ?? 0;
          return {
            remaining: Math.max(0, tokens - cachedUsedTokens),
            reset: (bucket + 1) * windowDuration
          };
        }
        const usedTokens = await safeEval(
          ctx,
          SCRIPTS.singleRegion.cachedFixedWindow.getRemaining,
          [key],
          [null]
        );
        return {
          remaining: Math.max(0, tokens - usedTokens),
          reset: (bucket + 1) * windowDuration
        };
      },
      async resetTokens(ctx, identifier) {
        if (!ctx.cache) {
          throw new Error("This algorithm requires a cache");
        }
        const bucket = Math.floor(Date.now() / windowDuration);
        const key = [identifier, bucket].join(":");
        ctx.cache.pop(key);
        const pattern = [identifier, "*"].join(":");
        await safeEval(
          ctx,
          RESET_SCRIPT,
          [pattern],
          [null]
        );
      }
    });
  }
};
export {
  Analytics,
  ip_deny_list_exports as IpDenyList,
  MultiRegionRatelimit,
  RegionRatelimit as Ratelimit
};
//# sourceMappingURL=index.mjs.map