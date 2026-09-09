"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { proportional, Table } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { fusionMutate } from "./fusion-client";
import { FormDialog } from "./form-dialog";
import type { RouterGroupOption, SiteOption } from "./types";
import type { AssetRow } from "@/lib/console-rows";
import type { AssetDetail } from "@/lib/fusion";

interface AssetConsoleProps {
  title: string;
  rows: AssetRow[];
  assets: AssetDetail[];
  sites: SiteOption[];
  routerGroups: RouterGroupOption[];
}

const assetColumns: TableColumn<AssetRow>[] = [
  { key: "name", header: "资产", width: proportional(1) },
  { key: "site", header: "站点", width: proportional(1) },
  { key: "routerGroup", header: "路由器组", width: proportional(1) },
  { key: "endpoint", header: "端点", width: proportional(1) },
  { key: "networkResource", header: "网络资源", width: proportional(1) },
  { key: "services", header: "可暴露服务", width: proportional(2) },
  { key: "status", header: "状态", width: proportional(1) },
];

const accessMethodLabels: Record<string, string> = {
  netbird: "NetBird 直连",
  teleport: "Teleport",
  teleport_ssh: "Teleport SSH",
  teleport_database: "Teleport 数据库",
  teleport_kubernetes: "Teleport Kubernetes",
  teleport_application: "Teleport 应用",
  teleport_rdp: "Teleport RDP",
};

export function AssetConsole({ title, rows, assets, sites, routerGroups }: AssetConsoleProps) {
  const router = useRouter();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [routerGroupId, setRouterGroupId] = useState("");
  const [hostname, setHostname] = useState("");
  const [endpointType, setEndpointType] = useState("ipv4");
  const [endpointAddress, setEndpointAddress] = useState("");
  const [isEndpointOpen, setIsEndpointOpen] = useState(false);
  const [newEndpointType, setNewEndpointType] = useState("ipv4");
  const [newEndpointAddress, setNewEndpointAddress] = useState("");
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceProtocol, setServiceProtocol] = useState("tcp");
  const [servicePort, setServicePort] = useState("");
  const [serviceAccessMethod, setServiceAccessMethod] = useState("netbird");
  const [serviceExposable, setServiceExposable] = useState(true);
  const [deleting, setDeleting] = useState<AssetRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedAsset = selectedAssetId === null ? undefined : assets.find((asset) => asset.id === selectedAssetId);
  const siteRouterGroups = routerGroups.filter((group) => group.siteId === siteId);

  function openCreate(): void {
    setName("");
    setSiteId(sites[0]?.id ?? "");
    setRouterGroupId(routerGroups.find((group) => group.siteId === sites[0]?.id)?.id ?? "");
    setHostname("");
    setEndpointType("ipv4");
    setEndpointAddress("");
    setIsCreateOpen(true);
  }

  function openEndpointDialog(): void {
    setNewEndpointType("ipv4");
    setNewEndpointAddress("");
    setIsEndpointOpen(true);
  }

  function openServiceDialog(): void {
    setServiceName("");
    setServiceProtocol("tcp");
    setServicePort("");
    setServiceAccessMethod("netbird");
    setServiceExposable(true);
    setIsServiceOpen(true);
  }

  async function submitCreate(): Promise<string | undefined> {
    const created = await fusionMutate<{ id: string }>("/api/assets", "POST", {
      name,
      siteId,
      routerGroupId,
      hostname: hostname.trim() === "" ? undefined : hostname.trim(),
    });
    if (!created.ok || created.item === undefined) {
      return created.error ?? "无法创建资产。";
    }

    const address = endpointAddress.trim();
    if (address !== "") {
      const endpoint = await fusionMutate(`/api/assets/${created.item.id}/endpoints`, "POST", {
        type: endpointType,
        address,
        primary: true,
      });
      if (!endpoint.ok) {
        return `资产已创建，但端点添加失败：${endpoint.error ?? "请在资产详情中补充端点。"}`;
      }
    }

    setSelectedAssetId(created.item.id);
    startTransition(() => router.refresh());
    return undefined;
  }

  async function submitEndpoint(): Promise<string | undefined> {
    if (selectedAsset === undefined) {
      return undefined;
    }

    const result = await fusionMutate(`/api/assets/${selectedAsset.id}/endpoints`, "POST", {
      type: newEndpointType,
      address: newEndpointAddress.trim(),
    });
    if (!result.ok) {
      return result.error ?? "无法添加端点。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  async function submitService(): Promise<string | undefined> {
    if (selectedAsset === undefined) {
      return undefined;
    }

    const port = Number(servicePort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return "端口必须是 1 到 65535 之间的整数。";
    }

    const result = await fusionMutate(`/api/assets/${selectedAsset.id}/services`, "POST", {
      name: serviceName.trim(),
      protocol: serviceProtocol,
      port,
      accessMethod: serviceAccessMethod,
      exposable: serviceExposable,
    });
    if (!result.ok) {
      return result.error ?? "无法添加服务。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  async function toggleExposable(serviceId: string, exposable: boolean): Promise<void> {
    if (selectedAsset === undefined) {
      return;
    }

    await fusionMutate(`/api/services/${serviceId}`, "PATCH", { exposable });
    startTransition(() => router.refresh());
  }

  async function deleteService(serviceId: string): Promise<void> {
    if (selectedAsset === undefined) {
      return;
    }

    await fusionMutate(`/api/services/${serviceId}`, "DELETE");
    startTransition(() => router.refresh());
  }

  async function toggleAssetStatus(): Promise<void> {
    if (selectedAsset === undefined) {
      return;
    }

    await fusionMutate(`/api/assets/${selectedAsset.id}`, "PATCH", {
      status: selectedAsset.status === "managed" ? "disabled" : "managed",
    });
    startTransition(() => router.refresh());
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) {
      return;
    }

    setIsDeleting(true);
    const result = await fusionMutate(`/api/assets/${deleting.id}`, "DELETE");
    setIsDeleting(false);
    if (result.ok) {
      if (deleting.id === selectedAssetId) {
        setSelectedAssetId(null);
      }
      setDeleting(null);
      setDeleteError(undefined);
      startTransition(() => router.refresh());
      return;
    }

    setDeleteError(result.error ?? "删除失败，请重试。");
  }

  const columns: TableColumn<AssetRow>[] = [
    ...assetColumns,
    {
      key: "actions",
      header: "操作",
      width: proportional(1),
      renderCell: (row: AssetRow) => (
        <HStack gap={1}>
          <Button label="详情" variant="secondary" size="sm" onClick={() => setSelectedAssetId(row.id)} />
          <Button
            label="删除"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDeleting(row);
              setDeleteError(undefined);
            }}
          />
        </HStack>
      ),
    },
  ];

  return (
    <>
      <Layout height="auto" content={
        <LayoutContent>
          <HStack hAlign="between" vAlign="center" wrap="wrap" padding={4} paddingBlockEnd={3}>
            <HStack gap={2} vAlign="center">
              <Text weight="semibold">{title}</Text>
              <Badge label={rows.length} />
            </HStack>
            <Button
              label="新建资产"
              variant="secondary"
              size="sm"
              onClick={openCreate}
              isDisabled={sites.length === 0 || routerGroups.length === 0}
              tooltip={sites.length === 0 || routerGroups.length === 0 ? "请先创建站点和路由器组。" : undefined}
            />
          </HStack>
          {rows.length === 0 ? (
            <VStack padding={4} paddingBlockStart={0}>
              <EmptyState title="暂无资产" description="新建资产，或从发现审核中导入一条记录。" isCompact />
            </VStack>
          ) : (
            <Table data={rows} columns={columns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
          )}
        </LayoutContent>
      } end={
        <LayoutPanel width={380} hasDivider isScrollable label="资产详情">
          {selectedAsset === undefined ? (
            <VStack padding={4}>
              <EmptyState title="未选择资产" description="点击任一行的“详情”查看并管理其端点与服务。" isCompact />
            </VStack>
          ) : (
            <VStack gap={4} padding={4}>
              <VStack gap={1}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Heading level={3}>{selectedAsset.name}</Heading>
                  {selectedAsset.status === "managed" ? null : <Badge variant="warning" label="已禁用" />}
                </HStack>
                {selectedAsset.hostname === undefined ? null : <Text type="supporting">{selectedAsset.hostname}</Text>}
                <Text type="supporting">
                  {siteOptionsLabel(selectedAsset, sites, routerGroups)}
                </Text>
              </VStack>
              <Button
                label={selectedAsset.status === "managed" ? "禁用资产" : "启用资产"}
                variant="secondary"
                size="sm"
                clickAction={toggleAssetStatus}
              />
              <Divider />
              <VStack gap={2}>
                <HStack hAlign="between" vAlign="center">
                  <Text weight="semibold">端点</Text>
                  <Button label="添加端点" variant="secondary" size="sm" onClick={openEndpointDialog} />
                </HStack>
                {selectedAsset.endpoints.length === 0 ? (
                  <Text color="secondary">暂无端点；添加端点后才会编译出网络资源。</Text>
                ) : (
                  <List hasDividers density="compact">
                    {selectedAsset.endpoints.map((endpoint) => (
                      <ListItem
                        key={endpoint.id}
                        label={endpoint.address}
                        description={`${endpoint.type.toUpperCase()} · ${endpoint.networkResource.destination}${endpoint.primary ? " · 主端点" : ""}`}
                      />
                    ))}
                  </List>
                )}
              </VStack>
              <Divider />
              <VStack gap={2}>
                <HStack hAlign="between" vAlign="center">
                  <Text weight="semibold">服务</Text>
                  <Button label="添加服务" variant="secondary" size="sm" onClick={openServiceDialog} />
                </HStack>
                {selectedAsset.services.length === 0 ? (
                  <Text color="secondary">暂无服务；标记为可通过 NetBird 暴露的服务才能被申请和授权。</Text>
                ) : (
                  <List hasDividers density="compact">
                    {selectedAsset.services.map((service) => (
                      <ListItem
                        key={service.id}
                        label={service.name}
                        description={`${service.protocol.toUpperCase()}/${service.port} · ${accessMethodLabels[service.accessMethod] ?? service.accessMethod}`}
                        endContent={
                          <HStack gap={2} vAlign="center">
                            <Switch
                              label={`暴露 ${service.name}`}
                              isLabelHidden
                              size="sm"
                              value={service.exposable}
                              changeAction={(checked) => toggleExposable(service.id, checked)}
                            />
                            <Button label={`删除 ${service.name}`} variant="ghost" size="sm" onClick={() => deleteService(service.id)}>
                              删除
                            </Button>
                          </HStack>
                        }
                      />
                    ))}
                  </List>
                )}
              </VStack>
            </VStack>
          )}
        </LayoutPanel>
      } />
      <FormDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="新建资产"
        subtitle="资产是稳定的标识；端点会编译为限定在站点与路由器组范围内的网络资源。"
        submitLabel="创建资产"
        onSubmit={submitCreate}
        isSubmitDisabled={name.trim() === "" || siteId === "" || routerGroupId === ""}
        submitDisabledReason="请填写资产名称并选择站点与路由器组。"
      >
        <TextInput label="资产名称" value={name} onChange={setName} placeholder="mysql-prod-02" />
        <Selector
          label="站点"
          options={sites.map((site) => ({ value: site.id, label: site.name }))}
          value={siteId}
          onChange={(value) => {
            setSiteId(value);
            setRouterGroupId(routerGroups.find((group) => group.siteId === value)?.id ?? "");
          }}
          placeholder="选择站点"
          presentation="adaptive"
        />
        <Selector
          label="路由器组"
          options={siteRouterGroups.map((group) => ({ value: group.id, label: group.name }))}
          value={routerGroupId}
          onChange={setRouterGroupId}
          placeholder="选择路由器组"
          presentation="adaptive"
          isDisabled={siteRouterGroups.length === 0}
          disabledMessage="所选站点还没有路由器组。"
        />
        <TextInput label="主机名" value={hostname} onChange={setHostname} placeholder="mysql-prod-02.internal" isOptional />
        <Selector
          label="端点类型"
          options={[
            { value: "ipv4", label: "IPv4" },
            { value: "ipv6", label: "IPv6" },
            { value: "dns", label: "DNS 域名" },
          ]}
          value={endpointType}
          onChange={setEndpointType}
          presentation="adaptive"
          description="可选。提供首个端点后才会编译出网络资源。"
        />
        <TextInput label="端点地址" value={endpointAddress} onChange={setEndpointAddress} placeholder="10.20.30.20" isOptional />
      </FormDialog>
      <FormDialog
        isOpen={isEndpointOpen}
        onOpenChange={setIsEndpointOpen}
        title={`添加端点 · ${selectedAsset?.name ?? ""}`}
        subtitle="IPv4 编译为 /32，IPv6 编译为 /128，DNS 保留域名。"
        submitLabel="添加端点"
        onSubmit={submitEndpoint}
        isSubmitDisabled={newEndpointAddress.trim() === ""}
        submitDisabledReason="请填写端点地址。"
      >
        <Selector
          label="端点类型"
          options={[
            { value: "ipv4", label: "IPv4" },
            { value: "ipv6", label: "IPv6" },
            { value: "dns", label: "DNS 域名" },
          ]}
          value={newEndpointType}
          onChange={setNewEndpointType}
          presentation="adaptive"
        />
        <TextInput
          label="端点地址"
          value={newEndpointAddress}
          onChange={setNewEndpointAddress}
          placeholder={newEndpointType === "dns" ? "mysql-prod.internal" : "10.20.30.21"}
        />
      </FormDialog>
      <FormDialog
        isOpen={isServiceOpen}
        onOpenChange={setIsServiceOpen}
        title={`添加服务 · ${selectedAsset?.name ?? ""}`}
        subtitle="服务决定访问方式：NetBird 直连编译为网络规则，Teleport 系列由 Teleport 代理并保留会话审计。"
        submitLabel="添加服务"
        onSubmit={submitService}
        isSubmitDisabled={serviceName.trim() === "" || servicePort.trim() === ""}
        submitDisabledReason="请填写服务名称和端口。"
      >
        <TextInput label="服务名称" value={serviceName} onChange={setServiceName} placeholder="MySQL" />
        <Selector
          label="协议"
          options={[
            { value: "tcp", label: "TCP" },
            { value: "udp", label: "UDP" },
          ]}
          value={serviceProtocol}
          onChange={setServiceProtocol}
          presentation="adaptive"
        />
        <TextInput label="端口" value={servicePort} onChange={setServicePort} placeholder="3306" />
        <Selector
          label="访问方式"
          options={Object.entries(accessMethodLabels).map(([value, label]) => ({ value, label }))}
          value={serviceAccessMethod}
          onChange={setServiceAccessMethod}
          presentation="adaptive"
        />
        <Switch
          label="可通过 NetBird 暴露"
          description="只有暴露的服务会编译进网络规则；Teleport 管理的服务保持关闭。"
          value={serviceExposable}
          onChange={setServiceExposable}
        />
      </FormDialog>
      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDeleting(null);
          }
        }}
        title={`删除资产 ${deleting?.name ?? ""}`}
        description={`将删除其端点、网络资源、服务和静态权限，并从有效授权中移除该资产。${deleteError === undefined ? "" : `上次操作失败：${deleteError}`}`}
        actionLabel="删除资产"
        onAction={confirmDelete}
        isActionLoading={isDeleting}
      />
    </>
  );
}

function siteOptionsLabel(asset: AssetDetail, sites: SiteOption[], routerGroups: RouterGroupOption[]): string {
  const site = sites.find((candidate) => candidate.id === asset.siteId)?.name ?? asset.siteId;
  const routerGroup = routerGroups.find((candidate) => candidate.id === asset.routerGroupId)?.name ?? asset.routerGroupId;
  return `${site} · ${routerGroup}`;
}
