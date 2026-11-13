import { parseVaultTransfer as parse } from "./book-bundle-format.mjs";
export { MAX_BUNDLE_BYTES } from "./book-bundle-format.mjs";
export interface VaultBundle {
  format: "WritelyVaultBundle";
  version: 1;
  vault: string;
  blocks: { projectId: string; id: string; text: string }[];
}
export function parseVaultTransfer(text: string): {
  vault: string;
  blocks: VaultBundle["blocks"];
  bundle: boolean;
} {
  return parse(text);
}
