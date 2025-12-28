import { EventChecklist } from '../types';

export const createEmptyChecklist = (): EventChecklist => ({
  outbound: {},
  inbound: {},
  damaged: {},
  lost: {},
  notes: {},
  logs: [],
  signatures: {
    outbound: undefined,
    inbound: undefined
  },
  slips: []
});

export const normalizeChecklist = (raw?: EventChecklist): EventChecklist => {
  if (!raw) return createEmptyChecklist();
  return {
    outbound: raw.outbound || {},
    inbound: raw.inbound || {},
    damaged: raw.damaged || {},
    lost: raw.lost || {},
    notes: raw.notes || {},
    logs: raw.logs || [],
    signature: raw.signature,
    signatures: raw.signatures || { outbound: raw.signature ? { manager: raw.signature, direction: 'OUT' } : undefined, inbound: undefined },
    slips: raw.slips || []
  };
};
