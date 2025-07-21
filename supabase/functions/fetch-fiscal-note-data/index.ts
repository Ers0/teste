import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nfe_key } = await req.json();

    if (!nfe_key) {
      return new Response(JSON.stringify({ error: 'NF-e key is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Simulate fetching data from consultadanfe.com or a similar service
    // In a real-world scenario, you would make an HTTP request to the external service here.
    // For this example, we'll return mock data.
    const mockFiscalNoteData = {
      nfe_key: nfe_key,
      issuer_name: `Mock Company for ${nfe_key.substring(0, 8)}`,
      total_value: (Math.random() * 1000 + 100).toFixed(2), // Random value
      issue_date: new Date().toISOString(),
      // Point to a mock PDF file in your public directory
      file_url: `https://zkdeznpqryfqrqxiyypk.supabase.co/storage/v1/object/public/fiscal-notes-files/mock-fiscal-note.pdf`,
    };

    return new Response(JSON.stringify(mockFiscalNoteData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});