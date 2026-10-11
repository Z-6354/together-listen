/**
 * Together Listen V2 server entry.
 *
 * This file will gradually replace the legacy server.js entry point.
 * Business modules should be registered through dedicated modules.
 */

export function createServerApp() {
  return {
    name: "together-listen-v2"
  };
}
