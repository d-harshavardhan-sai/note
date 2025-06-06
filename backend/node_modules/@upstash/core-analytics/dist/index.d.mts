import { Redis } from '@upstash/redis';

type Event = {
    time?: number;
    [key: string]: string | number | boolean | undefined;
};
type Window = `${number}${"s" | "m" | "h" | "d"}`;
type AnalyticsConfig = {
    redis: Redis;
    /**
     * Configure the bucket size for analytics. All events inside the window will be stored inside
     * the same bucket. This reduces the number of keys that need to be scanned when aggregating
     * and reduces your cost.
     *
     * Must be either a string in the format of `1s`, `2m`, `3h`, `4d` or a number of milliseconds.
     */
    window: Window | number;
    prefix?: string;
    /**
     * Configure the retention period for analytics. All events older than the retention period will
     * be deleted. This reduces the number of keys that need to be scanned when aggregating.
     *
     * Can either be a string in the format of `1s`, `2m`, `3h`, `4d` or a number of milliseconds.
     * 0, negative or undefined means that the retention is disabled.
     *
     * @default Disabled
     *
     * Buckets are evicted when they are read, not when they are written. This is much cheaper since
     * it only requires a single command to ingest data.
     */
    retention?: Window | number;
};
interface AggregateTime {
    time: number;
}
interface AggregateGeneric {
    [someFieldName: string]: {
        [someFieldValue: string]: number;
    };
}
type Aggregate = AggregateTime & AggregateGeneric;
type RawSuccessResponse = 1 | null;
type SuccessResponse = RawSuccessResponse | string;

declare class Analytics {
    private readonly redis;
    private readonly prefix;
    private readonly bucketSize;
    constructor(config: AnalyticsConfig);
    private validateTableName;
    /**
     * Parses the window string into a number of milliseconds
     */
    private parseWindow;
    getBucket(time?: number): number;
    /**
     * Ingest a new event
     * @param table
     * @param event
     */
    ingest(table: string, ...events: Event[]): Promise<void>;
    protected formatBucketAggregate(rawAggregate: [SuccessResponse, number][], groupBy: string, bucket: number): Aggregate;
    aggregateBucket(table: string, groupBy: string, timestamp?: number): Promise<Aggregate>;
    aggregateBuckets(table: string, groupBy: string, bucketCount: number, timestamp?: number): Promise<Aggregate[]>;
    aggregateBucketsWithPipeline(table: string, groupBy: string, bucketCount: number, timestamp?: number, maxPipelineSize?: number): Promise<Aggregate[]>;
    getAllowedBlocked(table: string, timestampCount: number, timestamp?: number): Promise<Record<string, {
        success: number;
        blocked: number;
    }>>;
    /**
     * Fetches the most allowed & blocked and denied items.
     *
     * @param table Ratelimit prefix to search for analytics
     * @param timestampCount Number of timestamps (24 for a day and 24 * 7 for a week)
     * @param itemCount Number of items to fetch from each category. If set to 30,
     *                  30 items will be fetched from each category. 90 items will be
     *                  returned in total if there are enough items in each category.
     * @param timestamp Most recent bucket timestamp to read from
     * @param checkAtMost Early finish parameter. Imagine that itemCount is set to 30.
     *                    If checkAtMost is set to 100, script will stop after checking
     *                    100 items even if there aren't 90 items yet.
     *                    Set to `itemCount * 5` by default.
     * @returns most allowed & blocked and denied items
     */
    getMostAllowedBlocked(table: string, timestampCount: number, itemCount: number, timestamp?: number, checkAtMost?: number): Promise<{
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
    /**
     * convert ["a", 1, ...] to [{identifier: 1, count: 1}, ...]
     * @param array
     */
    protected toDicts(array: [string, {
        identifier: string;
        success: boolean;
    }][]): {
        identifier: string;
        count: number;
    }[];
}

export { type Aggregate, Analytics };
