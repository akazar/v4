/**
 * Merges P2P and SFU stream IDs for `available-streams` broadcasts.
 */
let p2pStreamKeys = () => [];
let sfuStreamKeys = () => [];

export function registerP2PStreamKeysGetter(fn) {
  p2pStreamKeys = fn;
}

export function registerSfuStreamKeysGetter(fn) {
  sfuStreamKeys = fn;
}

export function getMergedStreamIds() {
  return [...new Set([...p2pStreamKeys(), ...sfuStreamKeys()])].sort();
}
