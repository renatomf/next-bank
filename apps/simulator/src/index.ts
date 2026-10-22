// The simulator's public API: what the API's composition root mounts in the
// same service (v1.2.0 plan, D2). Nothing else of the simulator is imported
// from outside it.
export { simulatorPlugin, type SimulatorPluginOptions } from './plugin.ts';
export { type Send, WebhookDispatcher } from './base/webhook-dispatcher.ts';
export { Faults, parseFaultProfile, seededRandom } from './base/faults.ts';
