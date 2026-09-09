import { AppShell } from "@astryxdesign/core/AppShell";
import { Card } from "@astryxdesign/core/Card";
import { Section } from "@astryxdesign/core/Section";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { proportional, Table } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";

import { AccessRequestForm } from "./access-request-form";
import { FusionStore } from "@/lib/fusion";
import { fusionRepository } from "@/lib/fusion-repository";

export const dynamic = "force-dynamic";

interface AssetRow extends Record<string, unknown> {
  id: string;
  name: string;
  site: string;
  routerGroup: string;
  endpoint: string;
  networkResource: string;
  services: string;
  status: string;
}

interface AccessRow extends Record<string, unknown> {
  id: string;
  source: string;
  requestId: string;
  subject: string;
  devicePeer: string;
  scope: string;
  asset: string;
  destination: string;
  service: string;
  routerPeers: string;
  expires: string;
}

interface DiscoveryRow extends Record<string, unknown> {
  id: string;
  site: string;
  endpoint: string;
  source: string;
  discovered: string;
  status: string;
}

interface AuditRow extends Record<string, unknown> {
  id: string;
  occurred: string;
  action: string;
  origin: string;
  resource: string;
  details: string;
}

interface RequestRow extends Record<string, unknown> {
  id: string;
  subject: string;
  devicePeer: string;
  scope: string;
  target: string;
  validUntil: string;
  status: string;
}

interface NetworkAccessRow extends Record<string, unknown> {
  id: string;
  occurred: string;
  decision: string;
  user: string;
  device: string;
  request: string;
  reviewer: string;
  grant: string;
  target: string;
  router: string;
}

interface DeviceRow extends Record<string, unknown> {
  id: string;
  name: string;
  subject: string;
  peer: string;
  netbirdGroup: string;
  status: string;
}

const columns: TableColumn<AssetRow>[] = [
  { key: "name", header: "Asset", width: proportional(1) },
  { key: "site", header: "Site", width: proportional(1) },
  { key: "routerGroup", header: "Router Group", width: proportional(1) },
  { key: "endpoint", header: "Endpoint", width: proportional(1) },
  { key: "networkResource", header: "Network Resource", width: proportional(1) },
  { key: "services", header: "Exposable services", width: proportional(2) },
  { key: "status", header: "Status", width: proportional(1) },
];

const accessColumns: TableColumn<AccessRow>[] = [
  { key: "source", header: "Authorization", width: proportional(1) },
  { key: "requestId", header: "Request", width: proportional(1) },
  { key: "subject", header: "Subject", width: proportional(1) },
  { key: "devicePeer", header: "Device peer", width: proportional(1) },
  { key: "scope", header: "Scope", width: proportional(1) },
  { key: "asset", header: "Asset", width: proportional(1) },
  { key: "destination", header: "Destination", width: proportional(1) },
  { key: "service", header: "Allowed service", width: proportional(1) },
  { key: "routerPeers", header: "Router peers", width: proportional(2) },
  { key: "expires", header: "Expires", width: proportional(1) },
];

const discoveryColumns: TableColumn<DiscoveryRow>[] = [
  { key: "site", header: "Site", width: proportional(1) },
  { key: "endpoint", header: "Observed endpoint", width: proportional(2) },
  { key: "source", header: "Source", width: proportional(1) },
  { key: "discovered", header: "Discovered", width: proportional(1) },
  { key: "status", header: "Review status", width: proportional(2) },
];

const auditColumns: TableColumn<AuditRow>[] = [
  { key: "occurred", header: "Occurred", width: proportional(1) },
  { key: "action", header: "Action", width: proportional(1) },
  { key: "origin", header: "Origin", width: proportional(1) },
  { key: "resource", header: "Resource", width: proportional(2) },
  { key: "details", header: "Details", width: proportional(2) },
];

const requestColumns: TableColumn<RequestRow>[] = [
  { key: "subject", header: "Subject", width: proportional(1) },
  { key: "devicePeer", header: "Device peer", width: proportional(1) },
  { key: "scope", header: "Scope", width: proportional(1) },
  { key: "target", header: "Target", width: proportional(2) },
  { key: "validUntil", header: "Valid until", width: proportional(1) },
  { key: "status", header: "Status", width: proportional(1) },
];

const networkAccessColumns: TableColumn<NetworkAccessRow>[] = [
  { key: "occurred", header: "Started", width: proportional(1) },
  { key: "decision", header: "Decision", width: proportional(1) },
  { key: "user", header: "User", width: proportional(1) },
  { key: "device", header: "Device", width: proportional(1) },
  { key: "request", header: "Teleport request", width: proportional(1) },
  { key: "reviewer", header: "Reviewer", width: proportional(1) },
  { key: "grant", header: "Grant", width: proportional(1) },
  { key: "target", header: "Asset / service / destination", width: proportional(2) },
  { key: "router", header: "Router peer", width: proportional(1) },
];

const deviceColumns: TableColumn<DeviceRow>[] = [
  { key: "name", header: "Device", width: proportional(1) },
  { key: "subject", header: "Subject", width: proportional(1) },
  { key: "peer", header: "NetBird peer", width: proportional(1) },
  { key: "netbirdGroup", header: "Dedicated Group", width: proportional(2) },
  { key: "status", header: "Enrollment", width: proportional(1) },
];

export default async function Home() {
  const fusionStore = FusionStore.fromState(
    await fusionRepository.mutate((store) => {
      store.listAccessGrants();
      return store.exportState();
    }),
  );
  const sites = fusionStore.listSites();
  const routerGroups = fusionStore.listRouterGroups();
  const assets = fusionStore.listAssets();
  const resources = fusionStore.listNetworkResources();
  const permissions = fusionStore.listStaticAssetPermissions();
  const grants = fusionStore.listAccessGrants();
  const accessRequests = fusionStore.listAccessRequests();
  const devices = fusionStore.listDevices();
  const discoveries = fusionStore.listDiscoveredAssets();
  const auditEvents = fusionStore.listAuditEvents();
  const networkAccessEvents = fusionStore.listNetworkAccessEvents();
  const activeGrants = grants.filter((grant) => grant.status === "active");
  const mapAuthorization = permissions[0] ?? activeGrants[0];
  const networkMap =
    mapAuthorization === undefined
      ? undefined
      : fusionStore.getEffectiveNetworkMap(mapAuthorization.devicePeerId, mapAuthorization.subjectId);
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  const routerGroupNames = new Map(routerGroups.map((routerGroup) => [routerGroup.id, routerGroup.name]));
  const assetNames = new Map(assets.map((asset) => [asset.id, asset.name]));
  const rows: AssetRow[] = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    site: siteNames.get(asset.siteId) ?? asset.siteId,
    routerGroup: routerGroupNames.get(asset.routerGroupId) ?? asset.routerGroupId,
    endpoint: asset.endpoints.map((endpoint) => endpoint.address).join(", ") || "No endpoint",
    networkResource: asset.endpoints.map((endpoint) => endpoint.networkResource.destination).join(", ") || "Not compiled",
    services:
      asset.services
        .filter((service) => service.exposable)
        .map((service) => `${service.name} ${service.protocol.toUpperCase()}/${service.port}`)
        .join(", ") || "No exposable service",
    status: asset.status === "managed" ? "Managed" : "Disabled",
  }));
  const discoveryRows: DiscoveryRow[] = discoveries.map((discovered) => ({
    id: discovered.id,
    site: siteNames.get(discovered.siteId) ?? discovered.siteId,
    endpoint: `${discovered.type.toUpperCase()} ${discovered.address}`,
    source: discovered.source.replaceAll("_", " "),
    discovered: discovered.discoveredAt,
    status:
      discovered.status === "unmanaged"
        ? "Unmanaged: no Asset, resource, or authorization"
        : `Imported as ${assetNames.get(discovered.importedAssetId ?? "") ?? discovered.importedAssetId ?? "unknown Asset"}`,
  }));
  const auditRows: AuditRow[] = auditEvents.map((event) => ({
    id: event.id,
    occurred: event.occurredAt,
    action: event.action.replaceAll(".", " "),
    origin: event.origin === "teleport" ? "Teleport" : "Control plane",
    resource: `${event.resourceType.replaceAll("_", " ")} ${event.resourceId}`,
    details: Object.entries(event.details)
      .map(([key, value]) => `${key}=${value}`)
      .join(" "),
  }));
  const requestRows: RequestRow[] = accessRequests.map((request) => ({
    id: request.id,
    subject: request.subjectId,
    devicePeer: request.devicePeerId,
    scope: request.scope === "site" ? "Site" : request.scope === "asset" ? "Asset" : "Service",
    target:
      request.scope === "site"
        ? siteNames.get(request.siteId) ?? request.siteId
        : request.scope === "asset"
          ? assetNames.get(request.assetId ?? "") ?? request.assetId ?? "Unknown Asset"
          : `${assetNames.get(request.assetId ?? "") ?? request.assetId ?? "Unknown Asset"} / ${assets
              .flatMap((asset) => asset.services)
              .find((service) => service.id === request.serviceId)?.name ?? request.serviceId ?? "Unknown Service"}`,
    validUntil: request.validUntil,
    status: "Pending approval",
  }));
  const networkAccessRows: NetworkAccessRow[] = networkAccessEvents.map((event) => {
    const service = assets.flatMap((asset) => asset.services).find((candidate) => candidate.id === event.serviceId);
    const asset = assetNames.get(event.assetId ?? "") ?? event.assetId ?? "Unknown Asset";

    return {
      id: event.id,
      occurred: event.startedAt,
      decision: event.decision.toUpperCase(),
      user: event.userId,
      device: event.deviceId,
      request: event.requestId ?? "Not applicable",
      reviewer: event.reviewerId ?? "Not applicable",
      grant: event.grantId ?? "Static policy or denied",
      target: `${asset} / ${service?.name ?? "Unknown service"} / ${event.destination}:${event.port}`,
      router: event.routerPeerId,
    };
  });
  const deviceRows: DeviceRow[] = devices.map((device) => ({
    id: device.id,
    name: device.name,
    subject: device.subjectId,
    peer: device.peerId,
    netbirdGroup: device.netbirdGroupId,
    status: device.managed ? "Managed" : "Unmanaged",
  }));
  const accessRows: AccessRow[] = [
    ...permissions.flatMap((permission) =>
      fusionStore.getCompiledAccessForPermission(permission.id).map((access) => ({
        id: access.id,
        source: "Static permission",
        requestId: "Not applicable",
        subject: access.subjectId,
        devicePeer: access.devicePeerId,
        scope: access.scope === "asset" ? "Asset" : "Service",
        asset: assetNames.get(access.assetId) ?? access.assetId,
        destination: access.destination,
        service: `${access.protocol.toUpperCase()}/${access.ports.join(", ")}`,
        routerPeers: access.routerPeerIds.join(", "),
        expires: "No expiry",
      })),
    ),
    ...activeGrants.flatMap((grant) =>
      fusionStore.getCompiledAccessForGrant(grant.id).map((access) => ({
        id: access.id,
        source: grant.source === "teleport" ? "Teleport grant" : "Access grant",
        requestId: access.requestId ?? "Manual",
        subject: access.subjectId,
        devicePeer: access.devicePeerId,
        scope: access.scope === "site" ? "Site" : access.scope === "asset" ? "Asset" : "Service",
        asset: assetNames.get(access.assetId) ?? access.assetId,
        destination: access.destination,
        service: `${access.protocol.toUpperCase()}/${access.ports.join(", ")}`,
        routerPeers: access.routerPeerIds.join(", "),
        expires: access.validUntil ?? "No expiry",
      })),
    ),
  ];
  const policyStatus = accessRows.length > 0 ? "success" : "neutral";
  const policyMessage =
    permissions.length === 0 && activeGrants.length === 0
      ? "No static permission or active AccessGrant exists. Every device peer is default denied."
      : accessRows.length === 0
        ? "Authorizations exist, but no managed NetBird-exposable service can be compiled."
        : `${accessRows.length} effective rule${accessRows.length === 1 ? "" : "s"} compiled from static permissions and active AccessGrants.`;

  return (
    <AppShell
      contentPadding={4}
      height="auto"
      mobileNav={{ breakpoint: "md" }}
      sideNav={
        <SideNav
          collapsible
          header={<SideNavHeading heading="Fusion Control" superheading="ZTNA / PAM" headingHref="/" />}>
          <SideNavSection title="Control plane" isHeaderHidden>
            <SideNavItem label="Assets" href="/" isSelected />
            <SideNavItem label="Discovery review" href="#discovery" />
            <SideNavItem label="Devices" href="#devices" />
            <SideNavItem label="Sites" href="#sites" />
            <SideNavItem label="Router groups" href="#router-groups" />
          </SideNavSection>
          <SideNavSection title="Access lifecycle">
            <SideNavItem label="Asset permissions" href="#asset-permissions" />
            <SideNavItem label="Request access" href="#request-access" />
            <SideNavItem label="Access grants" href="#effective-access" />
            <SideNavItem label="Unified audit" href="#audit" />
          </SideNavSection>
        </SideNav>
      }
      variant="section">
      <VStack gap={6}>
        <VStack gap={2}>
          <Heading level={1}>Asset registry</Heading>
          <Text color="secondary">
            Model routing-peer-reachable equipment as stable Assets, then compile each endpoint into a scoped Network Resource.
          </Text>
          <HStack gap={2} vAlign="center">
            <StatusDot variant="accent" label="Asset layer active" />
            <Text type="supporting">Static permissions and active AccessGrants compile together. Unmatched device peers remain default denied.</Text>
          </HStack>
        </VStack>

        <HStack gap={3} wrap="wrap">
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Sites</Text>
              <Heading level={2}>{sites.length}</Heading>
              <Text color="secondary">Network namespaces</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Managed assets</Text>
              <Heading level={2}>{assets.filter((asset) => asset.status === "managed").length}</Heading>
              <Text color="secondary">Stable asset identities</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Unmanaged discoveries</Text>
              <Heading level={2}>{discoveries.filter((discovered) => discovered.status === "unmanaged").length}</Heading>
              <Text color="secondary">Awaiting administrator import</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Desired resources</Text>
              <Heading level={2}>{resources.length}</Heading>
              <Text color="secondary">Awaiting NetBird synchronization</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Static permissions</Text>
              <Heading level={2}>{permissions.length}</Heading>
              <Text color="secondary">Subject and device bindings</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Managed devices</Text>
              <Heading level={2}>{devices.filter((device) => device.managed).length}</Heading>
              <Text color="secondary">Eligible for NetBird enforcement</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Active access grants</Text>
              <Heading level={2}>{activeGrants.length}</Heading>
              <Text color="secondary">TTL-bound temporary access</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Pending access requests</Text>
              <Heading level={2}>{accessRequests.length}</Heading>
              <Text color="secondary">Awaiting approval, not authorized</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">Effective Network Map</Text>
              <Heading level={2}>{networkMap?.accessRules.length ?? 0}</Heading>
              <Text color="secondary">
                {networkMap === undefined
                  ? "Awaiting device-bound authorization"
                  : `Revision ${networkMap.revision.slice(0, 12)}`}
              </Text>
            </VStack>
          </Card>
        </HStack>

        <Section id="sites" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>Asset inventory</Heading>
              <Text color="secondary">
                Assets are grouped by Site and resolve through a RouterGroup before each endpoint becomes a Network Resource.
              </Text>
            </VStack>
          </VStack>
          <Table data={rows} columns={columns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
        </Section>

        <Section id="discovery" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>Discovery review</Heading>
              <Text color="secondary">
                Discovery records are observations, not trusted Assets. An administrator must explicitly import a record before its endpoint becomes a Network Resource.
              </Text>
            </VStack>
            <HStack gap={2} vAlign="center">
              <StatusDot variant="neutral" label="Discovery never creates authorization" />
              <Text type="supporting">Importing creates no permission or AccessGrant.</Text>
            </HStack>
          </VStack>
          <Table
            data={discoveryRows}
            columns={discoveryColumns}
            density="compact"
            dividers="rows"
            hasHover
            idKey="id"
            textOverflow="truncate"
          />
        </Section>

        <Section id="devices" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>Device enrollment</Heading>
              <Text color="secondary">
                Every direct network authorization binds one subject and managed Device to a pre-existing single-peer NetBird Group. Fusion validates the Group before enforcement.
              </Text>
            </VStack>
          </VStack>
          <Table
            data={deviceRows}
            columns={deviceColumns}
            density="compact"
            dividers="rows"
            hasHover
            idKey="id"
            textOverflow="truncate"
          />
        </Section>

        <Section id="request-access" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>Request access</Heading>
              <Text color="secondary">
                Request a Site, Asset, or exact Service for one device and a bounded TTL. Submission records a pending request only; a Teleport approval must create the AccessGrant before any network rule exists.
              </Text>
            </VStack>
            <AccessRequestForm
              sites={sites.map((site) => ({ id: site.id, name: site.name }))}
              assets={assets
                .filter((asset) => asset.status === "managed")
                .map((asset) => ({
                  id: asset.id,
                  siteId: asset.siteId,
                  name: asset.name,
                  services: asset.services.map((service) => ({
                    id: service.id,
                    name: service.name,
                    protocol: service.protocol,
                    port: service.port,
                    accessMethod: service.accessMethod,
                    exposable: service.exposable,
                  })),
                }))}
              devices={devices.map((device) => ({
                id: device.id,
                name: device.name,
                subjectId: device.subjectId,
                peerId: device.peerId,
                managed: device.managed,
              }))}
            />
          </VStack>
          <Table data={requestRows} columns={requestColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
        </Section>

        <Section id="effective-access" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>Effective Asset access</Heading>
              <Text color="secondary">
                Static permissions and active AccessGrants share one compiler. Teleport grants retain their request ID. Asset scope compiles exposed NetBird services; Service scope compiles one exact protocol and port. Teleport-managed services never produce a direct network rule.
              </Text>
            </VStack>
            <HStack gap={2} vAlign="center">
              <StatusDot variant={policyStatus} label={policyMessage} />
              <Text type="supporting">{policyMessage}</Text>
            </HStack>
          </VStack>
          <Table
            data={accessRows}
            columns={accessColumns}
            density="compact"
            dividers="rows"
            hasHover
            idKey="id"
            textOverflow="truncate"
          />
        </Section>

        <Section id="audit" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>Unified audit</Heading>
              <Text color="secondary">
                Network decisions preserve the user, device, Grant, Teleport request, destination, service, and Router Peer context. Control-plane transitions remain available alongside them.
              </Text>
            </VStack>
          </VStack>
          <VStack gap={2} padding={4}>
            <Heading level={3}>Network access events</Heading>
            <Text type="supporting">ALLOW and DENY are recalculated against the current effective policy when reported.</Text>
          </VStack>
          <Table
            data={networkAccessRows}
            columns={networkAccessColumns}
            density="compact"
            dividers="rows"
            hasHover
            idKey="id"
            textOverflow="truncate"
          />
          <VStack gap={2} padding={4}>
            <Heading level={3}>Control-plane changes</Heading>
            <Text type="supporting">Successful control-plane and Teleport transitions are retained most-recent-first.</Text>
          </VStack>
          <Table data={auditRows} columns={auditColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
        </Section>

        <Section id="asset-permissions" variant="transparent">
          <VStack gap={1}>
            <Heading level={2}>Static permission boundary</Heading>
            <Text color="secondary">
              Static permissions never expire. For approval-backed temporary access, create an AccessGrant with a request ID, reason, and `validUntil` through the management API.
            </Text>
          </VStack>
        </Section>

        <Section id="router-groups" variant="muted">
          <VStack gap={2}>
            <Heading level={2}>NetBird resource boundary</Heading>
            <Text>
              IPv4 endpoints compile to `/32`, IPv6 endpoints compile to `/128`, and DNS endpoints retain their domain target. The desired state is namespaced by Site, Network, and RouterGroup, so an address is never used as the Asset identity.
            </Text>
            <Text color="secondary">
              `/api/network-map` emits device-specific authorization revisions. No remote NetBird resource is provisioned until management API credentials and the target account are configured.
            </Text>
          </VStack>
        </Section>
      </VStack>
    </AppShell>
  );
}
