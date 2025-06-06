var d=`
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
`,g=`
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
`,p=`
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
`;var b=class{redis;prefix;bucketSize;constructor(e){this.redis=e.redis,this.prefix=e.prefix??"@upstash/analytics",this.bucketSize=this.parseWindow(e.window)}validateTableName(e){if(!/^[a-zA-Z0-9_-]+$/.test(e))throw new Error(`Invalid table name: ${e}. Table names can only contain letters, numbers, dashes and underscores.`)}parseWindow(e){if(typeof e=="number"){if(e<=0)throw new Error(`Invalid window: ${e}`);return e}let s=/^(\d+)([smhd])$/;if(!s.test(e))throw new Error(`Invalid window: ${e}`);let[,n,i]=e.match(s),t=parseInt(n);switch(i){case"s":return t*1e3;case"m":return t*1e3*60;case"h":return t*1e3*60*60;case"d":return t*1e3*60*60*24;default:throw new Error(`Invalid window unit: ${i}`)}}getBucket(e){let s=e??Date.now();return Math.floor(s/this.bucketSize)*this.bucketSize}async ingest(e,...s){this.validateTableName(e),await Promise.all(s.map(async n=>{let i=this.getBucket(n.time),t=[this.prefix,e,i].join(":");await this.redis.zincrby(t,1,JSON.stringify({...n,time:void 0}))}))}formatBucketAggregate(e,s,n){let i={};return e.forEach(([t,r])=>{s=="success"&&(t=t===1?"true":t===null?"false":t),i[s]=i[s]||{},i[s][(t??"null").toString()]=r}),{time:n,...i}}async aggregateBucket(e,s,n){this.validateTableName(e);let i=this.getBucket(n),t=[this.prefix,e,i].join(":"),r=await this.redis.eval(d,[t],[s]);return this.formatBucketAggregate(r,s,i)}async aggregateBuckets(e,s,n,i){this.validateTableName(e);let t=this.getBucket(i),r=[];for(let o=0;o<n;o+=1)r.push(this.aggregateBucket(e,s,t)),t=t-this.bucketSize;return Promise.all(r)}async aggregateBucketsWithPipeline(e,s,n,i,t){this.validateTableName(e),t=t??48;let r=this.getBucket(i),o=[],c=this.redis.pipeline(),l=[];for(let a=1;a<=n;a+=1){let m=[this.prefix,e,r].join(":");c.eval(d,[m],[s]),o.push(r),r=r-this.bucketSize,(a%t==0||a==n)&&(l.push(c.exec()),c=this.redis.pipeline())}return(await Promise.all(l)).flat().map((a,m)=>this.formatBucketAggregate(a,s,o[m]))}async getAllowedBlocked(e,s,n){this.validateTableName(e);let i=[this.prefix,e].join(":"),t=this.getBucket(n),r=await this.redis.eval(p,[i],[t,this.bucketSize,s]),o={};for(let c=0;c<r.length;c+=2){let l=r[c],u=l.identifier,a=+r[c+1];o[u]||(o[u]={success:0,blocked:0}),o[u][l.success?"success":"blocked"]=a}return o}async getMostAllowedBlocked(e,s,n,i,t){this.validateTableName(e);let r=[this.prefix,e].join(":"),o=this.getBucket(i),c=t??n*5,[l,u,a]=await this.redis.eval(g,[r],[o,this.bucketSize,s,n,c]);return{allowed:this.toDicts(l),ratelimited:this.toDicts(u),denied:this.toDicts(a)}}toDicts(e){let s=[];for(let n=0;n<e.length;n+=1){let i=+e[n][0],t=e[n][1];s.push({identifier:t.identifier,count:i})}return s}};export{b as Analytics};
