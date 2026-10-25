// Read-only verification of persisted receipts, exact accruals, and their actual Base Sepolia transfers.
// Optional baseline path proves a rehearsal created no purchases and changed no accrual totals.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { createPublicClient, decodeEventLog, erc20Abi, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { readEnv } from '../connector/lib/mcpClient.mjs';
import { mintSession } from '../shared/session.mjs';
const env=readEnv('.env.local'), secrets=readEnv('.secrets.local');
const c=new ConvexHttpClient(env.VITE_CONVEX_URL);
const o=await c.query(anyApi.agentsConsole.overview,{actor:await mintSession(secrets.DEMO_SESSION_SECRET,'review-desk',60000)});
const chain=createPublicClient({chain:baseSepolia,transport:http()});
const receipts=[...new Map(o.payments.filter(p=>p.state==='settled').map(p=>[p.purchaseId,p])).values()];
const settled=o.purchases.filter(p=>p.status==='test_success');
const total=k=>settled.reduce((n,p)=>n+BigInt(p[k]),0n).toString();
assert.equal(o.earnings.grossAtomic,total('amountAtomic'));
assert.equal(o.earnings.contributorAccruedAtomic,total('contributorShareAtomic'));
assert.equal(o.earnings.platformFeeAtomic,total('platformShareAtomic'));
assert.equal(BigInt(o.earnings.grossAtomic),BigInt(o.earnings.contributorAccruedAtomic)+BigInt(o.earnings.platformFeeAtomic));
assert.equal(o.earnings.paidOutAtomic,'0');
assert.equal(receipts.length,settled.length,'every settled agent purchase has an inspectable receipt');
for(const p of receipts){
 const receipt=await chain.getTransactionReceipt({hash:p.txHash});
 assert.equal(receipt.status,'success');
 const match=receipt.logs.some(l=>{
  if(l.address.toLowerCase()!=='0x036cbd53842c5426634e7929541ec2318f3dcf7e')return false;
  try{const d=decodeEventLog({abi:erc20Abi,data:l.data,topics:l.topics});return d.eventName==='Transfer'&&d.args.to.toLowerCase()===p.payTo.toLowerCase()&&d.args.value===BigInt(p.amountAtomic);}catch{return false;}
 });
 assert.equal(match,true,'receipt must transfer quoted USDC amount to pinned recipient');
 console.log(`Verified Base Sepolia receipt ${p.txHash}: ${p.amountAtomic} atomic USDC to ${p.payTo}, revision ${p.revision}.`);
}
if(process.argv[2]){
 const before=JSON.parse(readFileSync(process.argv[2],'utf8'));
 assert.deepEqual(o.purchases,before.purchases,'rehearsal did not create or alter a purchase');
 assert.deepEqual(o.earnings,before.earnings,'rehearsal did not change the ledger');
 console.log('Existing entitlements reused: purchase records and earnings unchanged.');
}
console.log(JSON.stringify({status:'passed',testnetSales:o.earnings.testnetSales,gross:o.earnings.grossAtomic,accrued:o.earnings.contributorAccruedAtomic,platform:o.earnings.platformFeeAtomic,paidOut:o.earnings.paidOutAtomic,simulatedExcluded:o.earnings.simulatedSales}));
