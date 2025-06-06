import { Aggregate } from '@upstash/core-analytics';
import { Redis as Redis$2 } from '@upstash/redis';

/**
 * EphemeralCache is used to block certain identifiers right away in case they have already exceeded the ratelimit.
 */
type EphemeralCache = {
    isBlocked: (identifier: string) => {
        blocked: boolean;
        reset: number;
    };
    blockUntil: (identifier: string, reset: number) => void;
    set: (key: string, value: number) => void;
    get: (key: string) => number | null;
    incr: (key: string) => number;
    pop: (key: string) => void;
    empty: () => void;
    size: () => number;
};
type RegionContext = {
    redis: Redis$1;
    cache?: EphemeralCache;
};
type MultiRegionContext = {
    regionContexts: Omit<RegionContext[], "cache">;
    cache?: EphemeralCache;
};
type RatelimitResponseType = "timeout" | "cacheBlock" | "denyList";
type Context = RegionContext | MultiRegionContext;
type RatelimitResponse = {
    /**
     * Whether the request may pass(true) or exceeded the limit(false)
     */
    success: boolean;
    /**
     * Maximum number of requests allowed within a window.
     */
    limit: number;
    /**
     * How many requests the user has left within the current window.
     */
    remaining: number;
    /**
     * Unix timestamp in milliseconds when the limits are reset.
     */
    reset: number;
    /**
     * For the MultiRegion setup we do some synchronizing in the background, after returning the current limit.
     * Or when analytics is enabled, we send the analytics asynchronously after returning the limit.
     * In most case you can simply ignore this.
     *
     * On Vercel Edge or Cloudflare workers, you need to explicitly handle the pending Promise like this:
     *
     * ```ts
     * const { pending } = await ratelimit.limit("id")
     * context.waitUntil(pending)
     * ```
     *
     * See `waitUntil` documentation in
     * [Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/#contextwaituntil)
     * and [Vercel](https://vercel.com/docs/functions/edge-middleware/middleware-api#waituntil)
     * for more details.
     * ```
     */
    pending: Promise<unknown>;
    /**
     * Reason behind the result in `success` field.
     * - Is set to "timeout" when request times out
     * - Is set to "cacheBlock" when an identifier is blocked through cache without calling redis because it was
     *    rate limited previously.
     * - Is set to "denyList" when identifier or one of ip/user-agent/country parameters is in deny list. To enable
     *    deny list, see `enableProtection` parameter. To edit the deny list, see the Upstash Ratelimit Dashboard
     *    at https://console.upstash.com/ratelimit.
     * - Is set to undefined if rate limit check had to use Redis. This happens in cases when `success` field in
     *    the response is true. It can also happen the first time sucecss is false.
     */
    reason?: RatelimitResponseType;
    /**
     * The value which was in the deny list if reason: "denyList"
     */
    deniedValue?: DeniedValue;
};
type Algorithm<TContext> = () => {
    limit: (ctx: TContext, identifier: string, rate?: number, opts?: {
        cache?: EphemeralCache;
    }) => Promise<RatelimitResponse>;
    getRemaining: (ctx: TContext, identifier: string) => Promise<{
        remaining: number;
        reset: number;
    }>;
    resetTokens: (ctx: TContext, identifier: string) => Promise<void>;
};
type DeniedValue = string | undefined;
type LimitOptions = {
    geo?: Geo;
    rate?: number;
    ip?: string;
    userAgent?: string;
    country?: string;
};
type Redis$1 = Redis$2;

type Geo = {
    country?: string;
    city?: string;
    region?: string;
    ip?: string;
};
/**
 * denotes the success field in the analytics submission.
 * Set to true when ratelimit check passes. False when request is ratelimited.
 * Set to "denied" when some request value is in deny list.
 */
type EventSuccess = boolean | "denied";
type Event = Geo & {
    identifier: string;
    time: number;
    success: EventSuccess;
};
type AnalyticsConfig = {
    redis: Redis$1;
    prefix?: string;
};
/**
 * The Analytics package is experimental and can change at any time.
 */
declare class Analytics {
    private readonly analytics;
    private readonly table;
    constructor(config: AnalyticsConfig);
    /**
     * Try to extract the geo information from the request
     *
     * This handles Vercel's `req.geo` and  and Cloudflare's `request.cf` properties
     * @param req
     * @returns
     */
    extractGeo(req: {
        geo?: Geo;
        cf?: Geo;
    }): Geo;
    record(event: Event): Promise<void>;
    series<TFilter extends keyof Omit<Event, "time">>(filter: TFilter, cutoff: number): Promise<Aggregate[]>;
    getUsage(cutoff?: number): Promise<Record<string, {
        success: number;
        blocked: number;
    }>>;
    getUsageOverTime<TFilter extends keyof Omit<Event, "time">>(timestampCount: number, groupby: TFilter): Promise<Aggregate[]>;
    getMostAllowedBlocked(timestampCount: number, getTop?: number, checkAtMost?: number): Promise<{
        allowed: {
            identifier: string;
            count: number;
        }[];
        ratelimited: {
            identifier: string;
            count: number;
        }[];
        denied: {
            identifier: string;
            count: number;
        }[];
    }>;
}

type Unit = "ms" | "s" | "m" | "h" | "d";
type Duration = `${number} ${Unit}` | `${number}${Unit}`;

type RatelimitConfig<TContext> = {
    /**
     * The ratelimiter function to use.
     *
     * Choose one of the predefined ones or implement your own.
     * Available algorithms are exposed via static methods:
     * - Ratelimiter.fixedWindow
     * - Ratelimiter.slidingWindow
     * - Ratelimiter.tokenBucket
     */
    limiter: Algorithm<TContext>;
    ctx: TContext;
    /**
     * All keys in redis are prefixed with this.
     *
     * @default `@upstash/ratelimit`
     */
    prefix?: string;
    /**
     * If enabled, the ratelimiter will keep a global cache of identifiers, that have
     * exhausted their ratelimit. In serverless environments this is only possible if
     * you create the ratelimiter instance outside of your handler function. While the
     * function is still hot, the ratelimiter can block requests without having to
     * request data from redis, thus saving time and money.
     *
     * Whenever an identifier has exceeded its limit, the ratelimiter will add it to an
     * internal list together with its reset timestamp. If the same identifier makes a
     * new request before it is reset, we can immediately reject it.
     *
     * Set to `false` to disable.
     *
     * If left undefined, a map is created automatically, but it can only work
     * if the map or the  ratelimit instance is created outside your serverless function handler.
     */
    ephemeralCache?: Map<string, number> | false;
    /**
     * If set, the ratelimiter will allow requests to pass after this many milliseconds.
     *
     * Use this if you want to allow requests in case of network problems
     *
     * @default 5000
     */
    timeout?: number;
    /**
     * If enabled, the ratelimiter will store analytics data in redis, which you can check out at
     * https://console.upstash.com/ratelimit
     *
     * @default false
     */
    analytics?: boolean;
    /**
     * Enables deny list. If set to true, requests with identifier or ip/user-agent/countrie
     * in the deny list will be rejected automatically. To edit the deny list, check out the
     * ratelimit dashboard at https://console.upstash.com/ratelimit
     *
     * @default false
     */
    enableProtection?: boolean;
    denyListThreshold?: number;
};
/**
 * Ratelimiter using serverless redis from https://upstash.com/
 *
 * @example
 * ```ts
 * const { limit } = new Ratelimit({
 *    redis: Redis.fromEnv(),
 *    limiter: Ratelimit.slidingWindow(
 *      10,     // Allow 10 requests per window of 30 minutes
 *      "30 m", // interval of 30 minutes
 *    ),
 * })
 *
 * ```
 */
declare abstract class Ratelimit<TContext extends Context> {
    protected readonly limiter: Algorithm<TContext>;
    protected readonly ctx: TContext;
    protected readonly prefix: string;
    protected readonly timeout: number;
    protected readonly primaryRedis: Redis$1;
    protected readonly analytics?: Analytics;
    protected readonly enableProtection: boolean;
    protected readonly denyListThreshold: number;
    constructor(config: RatelimitConfig<TContext>);
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
    limit: (identifier: string, req?: LimitOptions) => Promise<RatelimitResponse>;
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
    blockUntilReady: (identifier: string, timeout: number) => Promise<RatelimitResponse>;
    resetUsedTokens: (identifier: string) => Promise<void>;
    /**
     * Returns the remaining token count together with a reset timestamps
     *
     * @param identifier identifir to check
     * @returns object with `remaining` and reset fields. `remaining` denotes
     *          the remaining tokens and reset denotes the timestamp when the
     *          tokens reset.
     */
    getRemaining: (identifier: string) => Promise<{
        remaining: number;
        reset: number;
    }>;
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
    private getRatelimitResponse;
    /**
     * Creates an array with the original response promise and a timeout promise
     * if this.timeout > 0.
     *
     * @param response Ratelimit response promise
     * @returns array with the response and timeout promise. also includes the timeout id
     */
    private applyTimeout;
    /**
     * submits analytics if this.analytics is set
     *
     * @param ratelimitResponse final rate limit response
     * @param identifier identifier to submit
     * @param req limit options
     * @returns rate limit response after updating the .pending field
     */
    private submitAnalytics;
    private getKey;
    /**
     * returns a list of defined values from
     * [identifier, req.ip, req.userAgent, req.country]
     *
     * @param identifier identifier
     * @param req limit options
     * @returns list of defined values
     */
    private getDefinedMembers;
}

type MultiRegionRatelimitConfig = {
    /**
     * Instances of `@upstash/redis`
     * @see https://github.com/upstash/upstash-redis#quick-start
     */
    redis: Redis$1[];
    /**
     * The ratelimiter function to use.
     *
     * Choose one of the predefined ones or implement your own.
     * Available algorithms are exposed via static methods:
     * - MultiRegionRatelimit.fixedWindow
     */
    limiter: Algorithm<MultiRegionContext>;
    /**
     * All keys in redis are prefixed with this.
     *
     * @default `@upstash/ratelimit`
     */
    prefix?: string;
    /**
     * If enabled, the ratelimiter will keep a global cache of identifiers, that have
     * exhausted their ratelimit. In serverless environments this is only possible if
     * you create the ratelimiter instance outside of your handler function. While the
     * function is still hot, the ratelimiter can block requests without having to
     * request data from redis, thus saving time and money.
     *
     * Whenever an identifier has exceeded its limit, the ratelimiter will add it to an
     * internal list together with its reset timestamp. If the same identifier makes a
     * new request before it is reset, we can immediately reject it.
     *
     * Set to `false` to disable.
     *
     * If left undefined, a map is created automatically, but it can only work
     * if the map or the ratelimit instance is created outside your serverless function handler.
     */
    ephemeralCache?: Map<string, number> | false;
    /**
     * If set, the ratelimiter will allow requests to pass after this many milliseconds.
     *
     * Use this if you want to allow requests in case of network problems
     */
    timeout?: number;
    /**
     * If enabled, the ratelimiter will store analytics data in redis, which you can check out at
     * https://console.upstash.com/ratelimit
     *
     * @default false
     */
    analytics?: boolean;
    /**
     * If enabled, lua scripts will be sent to Redis with SCRIPT LOAD durint the first request.
     * In the subsequent requests, hash of the script will be used to invoke it
     *
     * @default true
     */
    cacheScripts?: boolean;
};
/**
 * Ratelimiter using serverless redis from https://upstash.com/
 *
 * @example
 * ```ts
 * const { limit } = new MultiRegionRatelimit({
 *    redis: Redis.fromEnv(),
 *    limiter: MultiRegionRatelimit.fixedWindow(
 *      10,     // Allow 10 requests per window of 30 minutes
 *      "30 m", // interval of 30 minutes
 *    )
 * })
 *
 * ```
 */
declare class MultiRegionRatelimit extends Ratelimit<MultiRegionContext> {
    /**
     * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithn of your choice.
     */
    constructor(config: MultiRegionRatelimitConfig);
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
    static fixedWindow(
    /**
     * How many requests are allowed per window.
     */
    tokens: number, 
    /**
     * The duration in which `tokens` requests are allowed.
     */
    window: Duration): Algorithm<MultiRegionContext>;
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
    static slidingWindow(
    /**
     * How many requests are allowed per window.
     */
    tokens: number, 
    /**
     * The duration in which `tokens` requests are allowed.
     */
    window: Duration): Algorithm<MultiRegionContext>;
}

type Redis = Pick<Redis$1, "get" | "set">;
type RegionRatelimitConfig = {
    /**
     * Instance of `@upstash/redis`
     * @see https://github.com/upstash/upstash-redis#quick-start
     */
    redis: Redis;
    /**
     * The ratelimiter function to use.
     *
     * Choose one of the predefined ones or implement your own.
     * Available algorithms are exposed via static methods:
     * - Ratelimiter.fixedWindow
     * - Ratelimiter.slidingWindow
     * - Ratelimiter.tokenBucket
     */
    limiter: Algorithm<RegionContext>;
    /**
     * All keys in redis are prefixed with this.
     *
     * @default `@upstash/ratelimit`
     */
    prefix?: string;
    /**
     * If enabled, the ratelimiter will keep a global cache of identifiers, that have
     * exhausted their ratelimit. In serverless environments this is only possible if
     * you create the ratelimiter instance outside of your handler function. While the
     * function is still hot, the ratelimiter can block requests without having to
     * request data from redis, thus saving time and money.
     *
     * Whenever an identifier has exceeded its limit, the ratelimiter will add it to an
     * internal list together with its reset timestamp. If the same identifier makes a
     * new request before it is reset, we can immediately reject it.
     *
     * Set to `false` to disable.
     *
     * If left undefined, a map is created automatically, but it can only work
     * if the map or the ratelimit instance is created outside your serverless function handler.
     */
    ephemeralCache?: Map<string, number> | false;
    /**
     * If set, the ratelimiter will allow requests to pass after this many milliseconds.
     *
     * Use this if you want to allow requests in case of network problems
     */
    timeout?: number;
    /**
     * If enabled, the ratelimiter will store analytics data in redis, which you can check out at
     * https://console.upstash.com/ratelimit
     *
     * @default false
     */
    analytics?: boolean;
    /**
     * @deprecated Has no affect since v2.0.3. Instead, hash values of scripts are
     * hardcoded in the sdk and it attempts to run the script using EVALSHA (with the hash).
     * If it fails, runs script load.
     *
     * Previously, if enabled, lua scripts were sent to Redis with SCRIPT LOAD durint the first request.
     * In the subsequent requests, hash of the script would be used to invoke the scripts
     *
     * @default true
     */
    cacheScripts?: boolean;
    /**
     * @default false
     */
    enableProtection?: boolean;
    /**
     * @default 6
     */
    denyListThreshold?: number;
};
/**
 * Ratelimiter using serverless redis from https://upstash.com/
 *
 * @example
 * ```ts
 * const { limit } = new Ratelimit({
 *    redis: Redis.fromEnv(),
 *    limiter: Ratelimit.slidingWindow(
 *      "30 m", // interval of 30 minutes
 *      10,     // Allow 10 requests per window of 30 minutes
 *    )
 * })
 *
 * ```
 */
declare class RegionRatelimit extends Ratelimit<RegionContext> {
    /**
     * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithm of your choice.
     */
    constructor(config: RegionRatelimitConfig);
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
    static fixedWindow(
    /**
     * How many requests are allowed per window.
     */
    tokens: number, 
    /**
     * The duration in which `tokens` requests are allowed.
     */
    window: Duration): Algorithm<RegionContext>;
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
    static slidingWindow(
    /**
     * How many requests are allowed per window.
     */
    tokens: number, 
    /**
     * The duration in which `tokens` requests are allowed.
     */
    window: Duration): Algorithm<RegionContext>;
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
    static tokenBucket(
    /**
     * How many tokens are refilled per `interval`
     *
     * An interval of `10s` and refillRate of 5 will cause a new token to be added every 2 seconds.
     */
    refillRate: number, 
    /**
     * The interval for the `refillRate`
     */
    interval: Duration, 
    /**
     * Maximum number of tokens.
     * A newly created bucket starts with this many tokens.
     * Useful to allow higher burst limits.
     */
    maxTokens: number): Algorithm<RegionContext>;
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
    static cachedFixedWindow(
    /**
     * How many requests are allowed per window.
     */
    tokens: number, 
    /**
     * The duration in which `tokens` requests are allowed.
     */
    window: Duration): Algorithm<RegionContext>;
}

declare class ThresholdError extends Error {
    constructor(threshold: number);
}
/**
 * Gets the list of ips from the github source which are not in the
 * deny list already
 *
 * First, gets the ip list from github using the threshold. Then, calls redis with
 * a transaction which does the following:
 * - subtract the current ip deny list from all
 * - delete current ip deny list
 * - recreate ip deny list with the ips from github. Ips already in the users own lists
 *   are excluded.
 * - status key is set to valid with ttl until next 2 AM UTC, which is a bit later than
 *   when the list is updated on github.
 *
 * @param redis redis instance
 * @param prefix ratelimit prefix
 * @param threshold ips with less than or equal to the threshold are not included
 * @param ttl time to live in milliseconds for the status flag. Optional. If not
 *  passed, ttl is infferred from current time.
 * @returns list of ips which are not in the deny list
 */
declare const updateIpDenyList: (redis: Redis$1, prefix: string, threshold: number, ttl?: number) => Promise<unknown[]>;
/**
 * Disables the ip deny list by removing the ip deny list from the all
 * set and removing the ip deny list. Also sets the status key to disabled
 * with no ttl.
 *
 * @param redis redis instance
 * @param prefix ratelimit prefix
 * @returns
 */
declare const disableIpDenyList: (redis: Redis$1, prefix: string) => Promise<unknown[]>;

type ipDenyList_ThresholdError = ThresholdError;
declare const ipDenyList_ThresholdError: typeof ThresholdError;
declare const ipDenyList_disableIpDenyList: typeof disableIpDenyList;
declare const ipDenyList_updateIpDenyList: typeof updateIpDenyList;
declare namespace ipDenyList {
  export {
    ipDenyList_ThresholdError as ThresholdError,
    ipDenyList_disableIpDenyList as disableIpDenyList,
    ipDenyList_updateIpDenyList as updateIpDenyList,
  };
}

export { Algorithm, Analytics, AnalyticsConfig, Duration, ipDenyList as IpDenyList, MultiRegionRatelimit, MultiRegionRatelimitConfig, RegionRatelimit as Ratelimit, RegionRatelimitConfig as RatelimitConfig };
