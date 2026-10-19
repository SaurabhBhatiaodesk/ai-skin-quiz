import prisma from "./db.server";
export function scanFailureCategory(message: string) {
 return /Invalid analysis response/.test(message) ? "invalid_analysis" : /Could not read the analysis/.test(message) ? "unreadable_analysis" : /well-lit photo|clear JPG|blurred/.test(message) ? "photo_quality" : /timed out|too long/.test(message) ? "timeout" : /API key|provider/.test(message) ? "provider_configuration" : /credits|rate limit|Scan limit/.test(message) ? "quota_or_rate_limit" : "processing_failed";
}
async function prepare(){
 await prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS ScanHealth (shop TEXT NOT NULL, day INTEGER NOT NULL, category TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, duration INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(shop,day,category))");
 await prisma.$executeRawUnsafe("DELETE FROM ScanHealth WHERE day < ?",Math.floor(Date.now()/86400000)-29);
}
// Aggregate diagnostics only: no photos, emails, IP addresses or raw provider errors.
export async function recordScanHealth(shop:string, category:string, elapsed:number){
 try {await prepare();await prisma.$executeRawUnsafe("INSERT INTO ScanHealth (shop,day,category,count,duration) VALUES (?,?,?,1,?) ON CONFLICT(shop,day,category) DO UPDATE SET count=ScanHealth.count+1,duration=ScanHealth.duration+excluded.duration",shop,Math.floor(Date.now()/86400000),category,Math.max(0,Math.min(120000,Math.round(elapsed))));}
 catch { console.error("Scan health recording unavailable"); }
}
export async function scanHealth(shop:string){
 await prepare();
 const rows=await prisma.$queryRawUnsafe<Array<{category:string;count:number|bigint;duration:number|bigint}>>("SELECT category,SUM(count) AS count,SUM(duration) AS duration FROM ScanHealth WHERE shop=? GROUP BY category",shop);
 const groups=rows.map(r=>({category:r.category,count:Number(r.count),duration:Number(r.duration)}));
 const total=groups.reduce((sum,r)=>sum+r.count,0),success=groups.find(r=>r.category==="success")?.count||0;
 return {total,success,failed:total-success,averageMs:total?Math.round(groups.reduce((sum,r)=>sum+r.duration,0)/total):0,groups:groups.filter(r=>r.category!=="success").sort((a,b)=>b.count-a.count)};
}
export async function deleteScanHealth(shop:string){await prepare();await prisma.$executeRawUnsafe("DELETE FROM ScanHealth WHERE shop=?",shop);}
