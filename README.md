# Fusion Control Plane

Phase 1 of the Asset-aware ZTNA/PAM control plane. It models Sites, RouterGroups, Assets, Endpoints, and Services independently of NetBird peers and IP addresses.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the Astryx-based asset registry.

## Persistence

Set `DATABASE_URL` to a PostgreSQL connection URL for any deployment that must survive a process restart or run more than one application instance. Fusion creates its `fusion_control_plane_state` table on first use and stores the current control-plane snapshot as one locked JSONB row. Without `DATABASE_URL`, it deliberately uses seeded process-local memory for local development only.

## Phase 1 API

- `POST` / `GET` `/api/sites`
- `GET` `/api/sites/:id`
- `POST` / `GET` `/api/router-groups`
- `GET` `/api/router-groups/:id`
- `POST` / `GET` `/api/assets`
- `GET` / `PATCH` / `DELETE` `/api/assets/:id`
- `POST` `/api/assets/:id/endpoints`
- `POST` `/api/assets/:id/services`
- `PATCH` / `DELETE` `/api/services/:id`
- `POST` / `GET` `/api/asset-permissions`
- `DELETE` `/api/asset-permissions/:id`
- `GET` `/api/effective-access?devicePeerId=:peerId&subjectId=:subjectId`
- `POST` / `GET` `/api/access-grants`
- `POST` / `GET` `/api/access-requests`
- `POST` / `GET` `/api/devices`
- `GET` `/api/devices/:id`
- `GET` / `DELETE` `/api/access-grants/:id`
- `POST` `/api/access-grants/:id/revoke`
- `POST` `/api/integrations/teleport/access-requests`
- `GET` `/api/network-map?devicePeerId=:peerId&subjectId=:subjectId`
- `POST` / `GET` `/api/discovered-assets`
- `POST` `/api/discovered-assets/:id/import`
- `GET` `/api/audit-events`
- `POST` / `GET` `/api/network-access-events`
- `POST` `/api/network-resources/:id/sync`
- `POST` `/api/network-resources/sync`
- `POST` `/api/network-policies/sync`

IPv4 endpoints compile to an asset-scoped `/32` Network Resource; IPv6 endpoints compile to `/128`; DNS endpoints retain their domain name. A static Asset Permission binds one subject and device peer to one Asset, then only compiles that Asset's NetBird-exposable Services. Passing an optional `serviceId` narrows the permission to one direct service and its exact protocol and port. An `AccessGrant` applies the same compiler logic with a bound device, explicit expiry, revocation, and a Site/Asset/Service snapshot. The resulting resources and compiled rules are local desired state until an authorized NetBird synchronization explicitly applies the resource configuration.

Grant expiry is evaluated whenever effective access is compiled. Run the protected NetBird policy synchronization endpoint on a schedule at the TTL boundary so NetBird receives the resulting empty or reduced rule set.

`/api/network-map` returns the subject-and-device-specific union of static permissions and active AccessGrants with a revision that changes whenever its effective authorization changes. Both `subjectId` and `devicePeerId` are required so a shared peer cannot aggregate rules across identities. It intentionally does not prescribe kernel-route granularity; a NetBird connector can preserve aggregated routing while enforcing these rules as firewall policy.

Discovery is intentionally separate from trust: a discovered endpoint has no Asset, Network Resource, policy, or effective access until an administrator imports it through the discovery import API.

`POST /api/access-requests` records a pending Site, Asset, or Service request bound to one subject and managed Device. It validates the requested NetBird-exposable target and TTL, but intentionally does not create an AccessGrant, effective rule, or Network Resource. A Teleport approval remains the authority that creates the grant.

Set `NETWORK_AUDIT_INGEST_SECRET` before sending normalized data-plane connection reports to `POST /api/network-access-events`; the caller must send it as `x-network-audit-secret`. Fusion recalculates each ALLOW or DENY against the effective policy rather than trusting a caller-provided decision, then records the user, device, Grant, Teleport Request, Router Peer, Asset, service, destination, protocol, and port context when available.

## Teleport Connector

Set `TELEPORT_WEBHOOK_SECRET` before sending normalized Teleport request events to `/api/integrations/teleport/access-requests`. The endpoint requires the same value in `x-teleport-webhook-secret` and accepts `approved`, `revoked`, and `expired` event types. An approved event requires `requestId`, `reviewerId`, `subjectId`, `devicePeerId`, scope fields, and `validUntil`; it creates one idempotent Teleport-sourced AccessGrant. The grant is committed before optional NetBird policy synchronization; if that remote synchronization fails, retry the protected policy endpoint rather than replaying a changed authorization.

## NetBird Connector

Set `NETBIRD_API_TOKEN`, optionally override `NETBIRD_API_URL`, and set a distinct `NETBIRD_SYNC_SECRET`. Each RouterGroup must include its NetBird Group ID as `netbirdGroupId`; Fusion never guesses it from a routing peer ID and verifies the Group before writing a resource. Call either resource sync endpoint with `x-netbird-sync-secret` equal to `NETBIRD_SYNC_SECRET`. The single-resource endpoint returns one synchronized resource. The bulk endpoint attempts every local Network Resource and returns an `error` beside each resource that could not synchronize. Remote calls happen outside the PostgreSQL transaction; Fusion writes a `network_resource.synced` or `network_resource.sync_failed` audit event only when the desired Resource is unchanged. A stale result returns `409` without changing the newer desired state and should be retried.

For L3/L4 enforcement, enroll every managed Device with a pre-existing NetBird Group that contains only that Device peer. Creating an AccessRequest, Static Asset Permission, or AccessGrant requires that exact managed Subject/Device enrollment. Set `NETBIRD_FUSION_POLICY_ID` to an otherwise empty policy dedicated to Fusion, then call `POST /api/network-policies/sync` with the same secret after resource synchronization. Fusion verifies that each Device Group contains exactly its enrolled peer, replaces only rules marked as its own in that dedicated policy, and creates no NetBird Group, Resource, or Policy for an individual Teleport request. The policy uses one unidirectional exact-resource rule per effective Subject/Device/Asset/Service authorization. If access changes during synchronization, Fusion recomputes it once before returning `409`; schedule a retry at the Grant TTL boundary. Set `NETBIRD_POLICY_SYNC_ON_TELEPORT=true` to reconcile that same policy after an approved, revoked, or expired Teleport webhook. NetBird's broad default `All` policy must be removed or disabled separately, or it can override this default-deny boundary.

## Verify

```bash
npm test
npm run check
npm run build
```
