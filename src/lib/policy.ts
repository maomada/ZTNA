import type {
  AccessGrant,
  AssetDetail,
  CompiledAccess,
  RouterGroup,
  StaticAssetPermission,
} from "./fusion";

export function compileStaticAssetPermission(
  permission: StaticAssetPermission,
  asset: AssetDetail,
  routerGroup: RouterGroup,
): CompiledAccess[] {
  if (asset.status !== "managed") {
    return [];
  }

  const services = asset.services.filter(
    (service) =>
      service.exposable &&
      service.accessMethod === "netbird" &&
      (permission.serviceId === undefined || service.id === permission.serviceId),
  );

  return asset.endpoints.flatMap((endpoint) =>
    services.map((service) => ({
      id: `${permission.id}:${endpoint.id}:${service.id}`,
      source: "static_asset_permission",
      scope: permission.scope,
      authorizationId: permission.id,
      subjectId: permission.subjectId,
      devicePeerId: permission.devicePeerId,
      siteId: asset.siteId,
      assetId: asset.id,
      endpointId: endpoint.id,
      serviceId: service.id,
      sourcePeerIds: [permission.devicePeerId],
      networkId: endpoint.networkResource.networkId,
      destination: endpoint.networkResource.destination,
      protocol: service.protocol,
      ports: [service.port],
      routerPeerIds: [...routerGroup.peerIds],
      validUntil: null,
    })),
  );
}

export function compileAccessGrant(
  grant: AccessGrant,
  targets: Array<{ asset: AssetDetail; routerGroup: RouterGroup }>,
): CompiledAccess[] {
  if (grant.status !== "active") {
    return [];
  }

  const serviceIds = new Set(grant.serviceIds);
  return targets.flatMap(({ asset, routerGroup }) => {
    if (asset.status !== "managed") {
      return [];
    }

    const services = asset.services.filter(
      (service) =>
        service.exposable &&
        service.accessMethod === "netbird" &&
        serviceIds.has(service.id),
    );

    return asset.endpoints.flatMap((endpoint) =>
      services.map((service) => ({
        id: `${grant.id}:${endpoint.id}:${service.id}`,
        source: "access_grant",
        scope: grant.scope,
        authorizationId: grant.id,
        subjectId: grant.subjectId,
        devicePeerId: grant.devicePeerId,
        siteId: asset.siteId,
        assetId: asset.id,
        endpointId: endpoint.id,
        serviceId: service.id,
        sourcePeerIds: [grant.devicePeerId],
        networkId: endpoint.networkResource.networkId,
        destination: endpoint.networkResource.destination,
        protocol: service.protocol,
        ports: [service.port],
        routerPeerIds: [...routerGroup.peerIds],
        validUntil: grant.validUntil,
        requestId: grant.requestId,
        reviewerId: grant.reviewerId,
      })),
    );
  });
}
