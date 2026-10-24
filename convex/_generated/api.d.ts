/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as demo from "../demo.js";
import type * as drafts from "../drafts.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_apify from "../lib/apify.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_draftContent from "../lib/draftContent.js";
import type * as lib_drafting from "../lib/drafting.js";
import type * as lib_integrations from "../lib/integrations.js";
import type * as lib_matching from "../lib/matching.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_moss from "../lib/moss.js";
import type * as lib_privacy from "../lib/privacy.js";
import type * as lib_publish from "../lib/publish.js";
import type * as lib_qa from "../lib/qa.js";
import type * as lib_scenarioTypes from "../lib/scenarioTypes.js";
import type * as lib_scenarios from "../lib/scenarios.js";
import type * as lib_search from "../lib/search.js";
import type * as lib_seedData from "../lib/seedData.js";
import type * as lib_x402 from "../lib/x402.js";
import type * as mossIndex from "../mossIndex.js";
import type * as mossState from "../mossState.js";
import type * as playbooks from "../playbooks.js";
import type * as purchases from "../purchases.js";
import type * as references from "../references.js";
import type * as reviews from "../reviews.js";
import type * as validation from "../validation.js";
import type * as x402Node from "../x402Node.js";
import type * as x402State from "../x402State.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  demo: typeof demo;
  drafts: typeof drafts;
  feedback: typeof feedback;
  http: typeof http;
  integrations: typeof integrations;
  "lib/access": typeof lib_access;
  "lib/apify": typeof lib_apify;
  "lib/domain": typeof lib_domain;
  "lib/draftContent": typeof lib_draftContent;
  "lib/drafting": typeof lib_drafting;
  "lib/integrations": typeof lib_integrations;
  "lib/matching": typeof lib_matching;
  "lib/money": typeof lib_money;
  "lib/moss": typeof lib_moss;
  "lib/privacy": typeof lib_privacy;
  "lib/publish": typeof lib_publish;
  "lib/qa": typeof lib_qa;
  "lib/scenarioTypes": typeof lib_scenarioTypes;
  "lib/scenarios": typeof lib_scenarios;
  "lib/search": typeof lib_search;
  "lib/seedData": typeof lib_seedData;
  "lib/x402": typeof lib_x402;
  mossIndex: typeof mossIndex;
  mossState: typeof mossState;
  playbooks: typeof playbooks;
  purchases: typeof purchases;
  references: typeof references;
  reviews: typeof reviews;
  validation: typeof validation;
  x402Node: typeof x402Node;
  x402State: typeof x402State;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
