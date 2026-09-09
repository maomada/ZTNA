import "server-only";

import { FusionStore } from "./fusion";
import { fusionRepository } from "./fusion-repository";

export async function loadFusionStore(): Promise<FusionStore> {
  return FusionStore.fromState(
    await fusionRepository.mutate((store) => {
      store.listAccessGrants();
      return store.exportState();
    }),
  );
}
