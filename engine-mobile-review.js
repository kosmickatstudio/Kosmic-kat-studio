/*
 * Compatibility shim for the legacy Motion module loader.
 *
 * Mobile approval styles and behavior now live in engine-asset-review.js.
 * motion.js still loads this filename in older cached builds, so keeping this
 * tiny no-op file prevents a stale service-worker/page combination from
 * producing a 404. It intentionally adds no UI, state, auth, or generation
 * behavior.
 */
(function(){"use strict";})();
