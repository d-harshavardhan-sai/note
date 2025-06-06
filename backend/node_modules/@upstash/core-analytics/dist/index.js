"use strict";var g=Object.defineProperty;var k=Object.getOwnPropertyDescriptor;var _=Object.getOwnPropertyNames;var y=Object.prototype.hasOwnProperty;var w=(l,e)=>{for(var t in e)g(l,t,{get:e[t],enumerable:!0})},A=(l,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of _(e))!y.call(l,s)&&s!==t&&g(l,s,{get:()=>e[s],enumerable:!(i=k(e,s))||i.enumerable});return l};var x=l=>A(g({},"__esModule",{value:!0}),l);var S={};w(S,{Analytics:()=>b});module.exports=x(S);var p=`
local key = KEYS[1]
local field = ARGV[1]

local data = redis.call("ZRANGE", key, 0, -1, "WITHSCORES")
local count = {}

for i = 1, #data, 2 do
  local json_str = data[i]
  local score = tonumber(data[i + 1])
  local obj = cjson.decode(json_str)

  local fieldValue = obj[field]

  if count[fieldValue] == nil then
    count[fieldValue] = score
  else
    count[fieldValue] = count[fieldValue] + score
  end
end

local result = {}
for k, v in pairs(count) do
  table.insert(result, {k, v})
end

return result
`,f=`
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1]) -- First timestamp to check
local increment = tonumber(ARGV[2])       -- Increment between each timestamp
local num_timestamps = tonumber(ARGV[3])  -- Number of timestampts to check (24 for a day and 24 * 7 for a week)
local num_elements = tonumber(ARGV[4])    -- Number of elements to fetch in each category
local check_at_most = tonumber(ARGV[5])   -- Number of elements to check at most.

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

-- select num_elements many items
local true_group = {}
local false_group = {}
local denied_group = {}
local true_count = 0
local false_count = 0
local denied_count = 0
local i = #result - 1

-- index to stop at after going through "checkAtMost" many items:
local cutoff_index = #result - 2 * check_at_most

-- iterate over the results
while (true_count + false_count + denied_count) < (num_elements * 3) and 1 <= i and i >= cutoff_index do
  local score = tonumber(result[i + 1])
  if score > 0 then
    local element = result[i]
    if string.find(element, "success\\":true") and true_count < num_elements then
      table.insert(true_group, {score, element})
      true_count = true_count + 1
    elseif string.find(element, "success\\":false") and false_count < num_elements then
      table.insert(false_group, {score, element})
      false_count = false_count + 1
    elseif string.find(element, "success\\":\\"denied") and denied_count < num_elements then
      table.insert(denied_group, {score, element})
      denied_count = denied_count + 1
    end
  end
  i = i - 2
end

return {true_group, false_group, denied_group}
`,h=`
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1])
local increment = tonumber(ARGV[2])
local num_timestamps = tonumber(ARGV[3])

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

return result
`;var b=class{redis;prefix;bucketSize;constructor(e){this.redis=e.redis,this.prefix=e.prefix??"@upstash/analytics",this.bucketSize=this.parseWindow(e.window)}validateTableName(e){if(!/^[a-zA-Z0-9_-]+$/.test(e))throw new Error(`Invalid table name: ${e}. Table names can only contain letters, numbers, dashes and underscores.`)}parseWindow(e){if(typeof e=="number"){if(e<=0)throw new Error(`Invalid window: ${e}`);return e}let t=/^(\d+)([smhd])$/;if(!t.test(e))throw new Error(`Invalid window: ${e}`);let[,i,s]=e.match(t),n=parseInt(i);switch(s){case"s":return n*1e3;case"m":return n*1e3*60;case"h":return n*1e3*60*60;case"d":return n*1e3*60*60*24;default:throw new Error(`Invalid window unit: ${s}`)}}getBucket(e){let t=e??Date.now();return Math.floor(t/this.bucketSize)*this.bucketSize}async ingest(e,...t){this.validateTableName(e),await Promise.all(t.map(async i=>{let s=this.getBucket(i.time),n=[this.prefix,e,s].join(":");await this.redis.zincrby(n,1,JSON.stringify({...i,time:void 0}))}))}formatBucketAggregate(e,t,i){let s={};return e.forEach(([n,r])=>{t=="success"&&(n=n===1?"true":n===null?"false":n),s[t]=s[t]||{},s[t][(n??"null").toString()]=r}),{time:i,...s}}async aggregateBucket(e,t,i){this.validateTableName(e);let s=this.getBucket(i),n=[this.prefix,e,s].join(":"),r=await this.redis.eval(p,[n],[t]);return this.formatBucketAggregate(r,t,s)}async aggregateBuckets(e,t,i,s){this.validateTableName(e);let n=this.getBucket(s),r=[];for(let o=0;o<i;o+=1)r.push(this.aggregateBucket(e,t,n)),n=n-this.bucketSize;return Promise.all(r)}async aggregateBucketsWithPipeline(e,t,i,s,n){this.validateTableName(e),n=n??48;let r=this.getBucket(s),o=[],c=this.redis.pipeline(),u=[];for(let a=1;a<=i;a+=1){let d=[this.prefix,e,r].join(":");c.eval(p,[d],[t]),o.push(r),r=r-this.bucketSize,(a%n==0||a==i)&&(u.push(c.exec()),c=this.redis.pipeline())}return(await Promise.all(u)).flat().map((a,d)=>this.formatBucketAggregate(a,t,o[d]))}async getAllowedBlocked(e,t,i){this.validateTableName(e);let s=[this.prefix,e].join(":"),n=this.getBucket(i),r=await this.redis.eval(h,[s],[n,this.bucketSize,t]),o={};for(let c=0;c<r.length;c+=2){let u=r[c],m=u.identifier,a=+r[c+1];o[m]||(o[m]={success:0,blocked:0}),o[m][u.success?"success":"blocked"]=a}return o}async getMostAllowedBlocked(e,t,i,s,n){this.validateTableName(e);let r=[this.prefix,e].join(":"),o=this.getBucket(s),c=n??i*5,[u,m,a]=await this.redis.eval(f,[r],[o,this.bucketSize,t,i,c]);return{allowed:this.toDicts(u),ratelimited:this.toDicts(m),denied:this.toDicts(a)}}toDicts(e){let t=[];for(let i=0;i<e.length;i+=1){let s=+e[i][0],n=e[i][1];t.push({identifier:n.identifier,count:s})}return t}};0&&(module.exports={Analytics});
