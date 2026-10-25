#!/bin/sh
# Incident Exchange: prints {"Authorization":"Bearer <15-minute access token>"} for MCP clients that support a headers helper.
# Needs IX_TOKEN_ENDPOINT, IX_CLIENT_ID, IX_CLIENT_SECRET, IX_MCP_ENDPOINT in the environment (from your credential file).
curl -s -X POST "$IX_TOKEN_ENDPOINT" -d grant_type=client_credentials -d client_id="$IX_CLIENT_ID" \
  --data-urlencode client_secret="$IX_CLIENT_SECRET" --data-urlencode resource="$IX_MCP_ENDPOINT" |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.access_token){console.error(j.error_description||j.error);process.exit(1)}process.stdout.write(JSON.stringify({Authorization:"Bearer "+j.access_token}))})'
