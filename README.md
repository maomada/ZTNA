# Fusion 控制平面

面向资产的 ZTNA/PAM 控制平面第一阶段。它独立于 NetBird 对等节点和 IP 地址，对站点、路由器组、资产、端点和服务进行建模。

## 运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000` 查看基于 Astryx 的资产登记界面。

## 持久化

对于需要在进程重启后保留数据或运行多个应用实例的部署，请将 `DATABASE_URL` 设置为 PostgreSQL 连接 URL。Fusion 会在首次使用时创建 `fusion_control_plane_state` 表，并将当前控制平面快照存储为一行受锁保护的 JSONB 数据。未设置 `DATABASE_URL` 时，系统会刻意使用带有种子数据的进程本地内存，仅适用于本地开发。

## 第一阶段 API

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

IPv4 端点会编译为资产范围的 `/32` 网络资源，IPv6 端点会编译为 `/128`，DNS 端点则保留域名。静态资产权限会将一个主体和设备对等节点绑定到一个资产，并且只编译该资产中可通过 NetBird 暴露的服务。可选的 `serviceId` 可将权限缩小到一个直接服务及其精确协议和端口。`AccessGrant` 会对绑定设备、显式过期时间、撤销状态以及站点/资产/服务快照应用相同的编译逻辑。在授权的 NetBird 同步明确应用资源配置前，生成的资源和编译规则都只是本地目标状态。

每次编译有效访问权限时都会评估授权过期。请在 TTL 边界按计划调用受保护的 NetBird 策略同步端点，使 NetBird 获得相应清空或缩减后的规则集。

`/api/network-map` 会返回某主体和设备专属的静态权限与有效 AccessGrant 并集；其版本会在有效授权发生变化时更新。必须同时提供 `subjectId` 和 `devicePeerId`，以避免共享对等节点跨身份汇聚规则。该接口刻意不规定内核路由粒度；NetBird 连接器可以保留聚合路由，同时将这些规则作为防火墙策略强制执行。

发现结果与信任刻意分离：管理员通过发现导入 API 导入前，已发现端点不具备资产、网络资源、策略或有效访问权限。

`POST /api/access-requests` 会记录绑定到一个主体和受管设备的待审批站点、资产或服务申请。它会验证所申请的可通过 NetBird 暴露的目标和 TTL，但刻意不会创建 AccessGrant、有效规则或网络资源。Teleport 审批仍是创建授权的唯一依据。

向 `POST /api/network-access-events` 发送标准化的数据平面连接报告前，请设置 `NETWORK_AUDIT_INGEST_SECRET`；调用方必须通过 `x-network-audit-secret` 发送该值。Fusion 会根据有效策略重新计算每个允许或拒绝结果，而非信任调用方提供的决策；随后会尽可能记录用户、设备、访问授权、Teleport 请求、路由器对等节点、资产、服务、目标地址、协议和端口上下文。

## Teleport 连接器

向 `/api/integrations/teleport/access-requests` 发送标准化的 Teleport 请求事件前，请设置 `TELEPORT_WEBHOOK_SECRET`。该端点要求通过 `x-teleport-webhook-secret` 发送相同值，并接受 `approved`、`revoked` 和 `expired` 事件类型。已批准事件需要 `requestId`、`reviewerId`、`subjectId`、`devicePeerId`、范围字段和 `validUntil`；它会创建一条幂等的 Teleport 来源 AccessGrant。授权会在可选的 NetBird 策略同步前提交；若远端同步失败，请重试受保护的策略端点，而不是重放已变化的授权。

## NetBird 连接器

请设置 `NETBIRD_API_TOKEN`，可选地覆盖 `NETBIRD_API_URL`，并设置独立的 `NETBIRD_SYNC_SECRET`。每个 RouterGroup 都必须通过 `netbirdGroupId` 包含其 NetBird 组 ID；Fusion 从不根据路由对等节点 ID 猜测该值，并会在写入资源前验证该组。调用任一资源同步端点时，需让 `x-netbird-sync-secret` 等于 `NETBIRD_SYNC_SECRET`。单资源端点返回一项已同步资源；批量端点会尝试每个本地网络资源，并在无法同步的资源旁返回 `error`。远端调用发生在 PostgreSQL 事务之外；只有目标资源未变化时，Fusion 才会写入 `network_resource.synced` 或 `network_resource.sync_failed` 审计事件。过期结果会返回 `409`，且不会改变较新的目标状态，应当重试。

对于 L3/L4 强制执行，请为每个受管设备注册一个仅包含该设备对等节点的既有 NetBird 组。创建 AccessRequest、静态资产权限或 AccessGrant 时，都需要精确的受管主体/设备注册。将 `NETBIRD_FUSION_POLICY_ID` 设置为专用于 Fusion 的空策略，然后在资源同步后使用相同密钥调用 `POST /api/network-policies/sync`。Fusion 会验证每个设备组恰好包含其注册对等节点，仅替换该专用策略中标记为自身所有的规则，并且不会为单个 Teleport 请求创建 NetBird 组、资源或策略。该策略会为每个有效主体/设备/资产/服务授权创建一条单向精确资源规则。若同步期间访问权限发生变化，Fusion 会重新计算一次后再返回 `409`；请在授权 TTL 边界安排重试。设置 `NETBIRD_POLICY_SYNC_ON_TELEPORT=true` 后，会在 Teleport Webhook 收到 `approved`、`revoked` 或 `expired` 事件后协调同一策略。必须单独删除或禁用 NetBird 过于宽泛的默认 `All` 策略，否则它可能绕过此默认拒绝边界。

## 验证

```bash
npm test
npm run check
npm run build
```
