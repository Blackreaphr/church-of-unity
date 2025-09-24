// Back-compat shim for older bundles that import "/assets/stats.js"
// Delegate to the canonical module under "/site/stats.js".
// Keeping this path stable avoids 404/500s from stale client caches.
import "/site/stats.js";

