 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type",
 };
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Get today's date
     const today = new Date().toISOString().split("T")[0];
 
     // Get database stats using the function we created
     const { data: dbStats, error: dbError } = await supabase.rpc(
       "get_database_stats"
     );
 
     if (dbError) {
       console.error("Error getting database stats:", dbError);
     }
 
     const totalRows = dbStats?.total_rows || 0;
     const tableStats = dbStats?.table_stats || [];
 
     // Calculate total size in MB
     let totalSizeBytes = 0;
     if (Array.isArray(tableStats)) {
       totalSizeBytes = tableStats.reduce(
         (sum: number, t: { size_bytes?: number }) => sum + (t.size_bytes || 0),
         0
       );
     }
     const databaseSizeMb = totalSizeBytes / (1024 * 1024);
 
     // Get storage stats (list all buckets and their sizes)
     let storageSizeMb = 0;
     try {
       const { data: buckets } = await supabase.storage.listBuckets();
       if (buckets && buckets.length > 0) {
         for (const bucket of buckets) {
           const { data: files } = await supabase.storage
             .from(bucket.name)
             .list("", { limit: 1000 });
           if (files) {
             // Note: This is an approximation as we can't get exact file sizes easily
             storageSizeMb += files.length * 0.1; // Rough estimate
           }
         }
       }
     } catch (storageError) {
       console.error("Error getting storage stats:", storageError);
     }
 
     // Get previous usage log for cumulative tracking
     const { data: previousLog } = await supabase
       .from("usage_logs")
       .select("edge_function_invocations, api_requests")
       .order("date", { ascending: false })
       .limit(1)
       .single();
 
     // Check if today's log exists
     const { data: existingLog } = await supabase
       .from("usage_logs")
       .select("*")
       .eq("date", today)
       .single();
 
     const newInvocations = (existingLog?.edge_function_invocations || 0) + 1;
     const newApiRequests = (existingLog?.api_requests || 0) + 1;
 
     // Upsert today's usage log
     const { data: usageLog, error: upsertError } = await supabase
       .from("usage_logs")
       .upsert(
         {
           date: today,
           database_rows: totalRows,
           database_size_mb: Math.round(databaseSizeMb * 100) / 100,
           storage_size_mb: Math.round(storageSizeMb * 100) / 100,
           edge_function_invocations: newInvocations,
           api_requests: newApiRequests,
           bandwidth_mb: 0, // Cannot be measured directly
         },
         { onConflict: "date" }
       )
       .select()
       .single();
 
     if (upsertError) {
       throw upsertError;
     }
 
     // Get cumulative stats
     const { data: allLogs } = await supabase
       .from("usage_logs")
       .select("*")
       .order("date", { ascending: false })
       .limit(30);
 
     const cumulative = {
       total_edge_invocations: allLogs?.reduce(
         (sum, log) => sum + (log.edge_function_invocations || 0),
         0
       ),
       total_api_requests: allLogs?.reduce(
         (sum, log) => sum + (log.api_requests || 0),
         0
       ),
     };
 
     return new Response(
       JSON.stringify({
         success: true,
         today: usageLog,
         cumulative,
         table_stats: tableStats,
       }),
       {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       }
     );
   } catch (error) {
     console.error("Error collecting usage:", error);
     return new Response(
       JSON.stringify({
         success: false,
         error: error instanceof Error ? error.message : "Unknown error",
       }),
       {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       }
     );
   }
 });