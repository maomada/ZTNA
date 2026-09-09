import { proportional } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";

import type { AccessRow, AuditRow, NetworkAccessRow } from "./console-rows";

export const accessColumns: TableColumn<AccessRow>[] = [
  { key: "source", header: "授权来源", width: proportional(1) },
  { key: "requestId", header: "请求", width: proportional(1) },
  { key: "subject", header: "主体", width: proportional(1) },
  { key: "devicePeer", header: "设备对等节点", width: proportional(1) },
  { key: "scope", header: "范围", width: proportional(1) },
  { key: "asset", header: "资产", width: proportional(1) },
  { key: "destination", header: "目标地址", width: proportional(1) },
  { key: "service", header: "获准服务", width: proportional(1) },
  { key: "routerPeers", header: "路由器对等节点", width: proportional(2) },
  { key: "expires", header: "过期时间", width: proportional(1) },
];

export const auditColumns: TableColumn<AuditRow>[] = [
  { key: "occurred", header: "发生时间", width: proportional(1) },
  { key: "action", header: "操作", width: proportional(1) },
  { key: "origin", header: "来源", width: proportional(1) },
  { key: "resource", header: "资源", width: proportional(2) },
  { key: "details", header: "详情", width: proportional(2) },
];

export const networkAccessColumns: TableColumn<NetworkAccessRow>[] = [
  { key: "occurred", header: "开始时间", width: proportional(1) },
  { key: "decision", header: "决策", width: proportional(1) },
  { key: "user", header: "用户", width: proportional(1) },
  { key: "device", header: "设备", width: proportional(1) },
  { key: "request", header: "Teleport 请求", width: proportional(1) },
  { key: "reviewer", header: "审批人", width: proportional(1) },
  { key: "grant", header: "访问授权", width: proportional(1) },
  { key: "target", header: "资产 / 服务 / 目标地址", width: proportional(2) },
  { key: "router", header: "路由器对等节点", width: proportional(1) },
];
