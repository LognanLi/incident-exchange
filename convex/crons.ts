import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Catches publishes and deactivations from any path; a no-op when the index already matches.
crons.interval("refresh Moss public-preview index", { minutes: 10 }, internal.semanticSearch.rebuildPublicIndex, {});
export default crons;
