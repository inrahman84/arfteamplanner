// Supabase Edge Function entrypoint; pure handler is independently regression-tested.
import {handleRequest} from './handler.mjs';
Deno.serve(handleRequest);
