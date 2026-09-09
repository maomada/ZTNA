"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { DateTimeInput } from "@astryxdesign/core/DateTimeInput";
import type { ISODateTimeString } from "@astryxdesign/core/DateTimeInput";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { proportional, Table } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { AccessRequestForm } from "../access-request-form";
import { fusionMutate } from "./fusion-client";
import { FormDialog } from "./form-dialog";
import type { AssetOption, DeviceOption, SiteOption } from "./types";
import type { GrantRow, RequestRow } from "@/lib/console-rows";

interface AccessConsoleProps {
  title: string;
  requestRows: RequestRow[];
  grantRows: GrantRow[];
  sites: SiteOption[];
  assets: AssetOption[];
  devices: DeviceOption[];
}

const requestColumns: TableColumn<RequestRow>[] = [
  { key: "reason", header: "申请原因", width: proportional(1) },
  { key: "subject", header: "主体", width: proportional(1) },
  { key: "devicePeer", header: "设备对等节点", width: proportional(1) },
  { key: "scope", header: "范围", width: proportional(1) },
  { key: "target", header: "目标", width: proportional(2) },
  { key: "validUntil", header: "有效期至", width: proportional(1) },
];

const grantColumnsBase: TableColumn<GrantRow>[] = [
  { key: "source", header: "来源", width: proportional(1) },
  { key: "subject", header: "主体", width: proportional(1) },
  { key: "devicePeer", header: "设备对等节点", width: proportional(1) },
  { key: "scope", header: "范围", width: proportional(1) },
  { key: "target", header: "目标", width: proportional(2) },
  { key: "validUntil", header: "有效期至", width: proportional(1) },
  { key: "status", header: "状态", width: proportional(1) },
];

type GrantScope = "site" | "asset" | "service";

function defaultValidUntil(): string {
  const date = new Date(Date.now() + 30 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AccessConsole({ title, requestRows, grantRows, sites, assets, devices }: AccessConsoleProps) {
  const router = useRouter();
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [grantDeviceId, setGrantDeviceId] = useState("");
  const [grantScope, setGrantScope] = useState<GrantScope>("service");
  const [grantSiteId, setGrantSiteId] = useState("");
  const [grantAssetId, setGrantAssetId] = useState("");
  const [grantServiceId, setGrantServiceId] = useState("");
  const [grantValidUntil, setGrantValidUntil] = useState<ISODateTimeString | undefined>(defaultValidUntil() as ISODateTimeString);
  const [grantReason, setGrantReason] = useState("");
  const [revoking, setRevoking] = useState<GrantRow | null>(null);
  const [revokeError, setRevokeError] = useState<string | undefined>();
  const [isRevoking, setIsRevoking] = useState(false);

  const managedDevices = devices.filter((device) => device.managed);
  const grantDevice = managedDevices.find((device) => device.id === grantDeviceId);
  const grantAsset = assets.find((asset) => asset.id === grantAssetId);
  const grantServiceOptions = (grantAsset?.services ?? []).filter(
    (service) => service.exposable && service.accessMethod === "netbird",
  );

  function openGrantDialog(): void {
    setGrantDeviceId(managedDevices[0]?.id ?? "");
    setGrantScope("service");
    setGrantSiteId(sites[0]?.id ?? "");
    setGrantAssetId(assets[0]?.id ?? "");
    setGrantServiceId("");
    setGrantValidUntil(defaultValidUntil() as ISODateTimeString);
    setGrantReason("");
    setIsGrantOpen(true);
  }

  async function submitGrant(): Promise<string | undefined> {
    if (grantDevice === undefined) {
      return "请选择受管设备。";
    }
    if (grantValidUntil === undefined) {
      return "请设置有效期。";
    }

    const body: Record<string, string> = {
      subjectId: grantDevice.subjectId,
      devicePeerId: grantDevice.peerId,
      scope: grantScope,
      validUntil: grantValidUntil,
      reason: grantReason.trim(),
      source: "manual",
    };
    if (grantScope === "site") {
      body.siteId = grantSiteId;
    } else {
      body.assetId = grantAssetId;
      if (grantScope === "service") {
        body.serviceId = grantServiceId;
      }
    }

    const result = await fusionMutate("/api/access-grants", "POST", body);
    if (!result.ok) {
      return result.error ?? "无法创建授权。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  async function confirmRevoke(): Promise<void> {
    if (revoking === null) {
      return;
    }

    setIsRevoking(true);
    const result = await fusionMutate(`/api/access-grants/${revoking.id}/revoke`, "POST");
    setIsRevoking(false);
    if (result.ok) {
      setRevoking(null);
      setRevokeError(undefined);
      startTransition(() => router.refresh());
      return;
    }

    setRevokeError(result.error ?? "撤销失败，请重试。");
  }

  const grantColumns: TableColumn<GrantRow>[] = [
    ...grantColumnsBase,
    {
      key: "actions",
      header: "操作",
      width: proportional(1),
      renderCell: (row) =>
        row.canRevoke ? (
          <Button
            label="撤销"
            variant="ghost"
            size="sm"
            onClick={() => {
              setRevoking(row);
              setRevokeError(undefined);
            }}
          />
        ) : null,
    },
  ];

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" padding={4}>
        <HStack gap={2} vAlign="center">
          <Text weight="semibold">{title}</Text>
          <Badge label={requestRows.length} />
        </HStack>
        <HStack gap={2}>
          <Button
            label="创建授权"
            variant="secondary"
            size="sm"
            onClick={openGrantDialog}
            isDisabled={managedDevices.length === 0}
            tooltip={managedDevices.length === 0 ? "请先注册受管设备。" : undefined}
          />
          <Button
            label="申请访问"
            variant="secondary"
            size="sm"
            onClick={() => setIsRequestOpen(true)}
            isDisabled={sites.length === 0 || assets.length === 0 || managedDevices.length === 0}
            tooltip={managedDevices.length === 0 ? "请先注册受管设备。" : undefined}
          />
        </HStack>
      </HStack>
      <VStack gap={4} padding={4} paddingBlockStart={0}>
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Heading level={3}>待审批申请</Heading>
            <Badge label={requestRows.length} />
          </HStack>
          {requestRows.length === 0 ? (
            <EmptyState title="暂无访问申请" description="提交申请后，会在此等待 Teleport 审批。" isCompact />
          ) : (
            <Table data={requestRows} columns={requestColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
          )}
        </VStack>
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Heading level={3}>访问授权</Heading>
            <Badge label={grantRows.length} />
          </HStack>
          {grantRows.length === 0 ? (
            <EmptyState title="暂无访问授权" description="Teleport 审批或手动创建的授权会显示在这里并开始倒计时。" isCompact />
          ) : (
            <Table data={grantRows} columns={grantColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
          )}
        </VStack>
      </VStack>
      <Dialog isOpen={isRequestOpen} onOpenChange={setIsRequestOpen} purpose="form" padding={4}>
        <DialogHeader
          title="申请访问"
          subtitle="为受管设备申请站点、资产或精确服务，并设置有限 TTL。"
          onOpenChange={setIsRequestOpen}
        />
        <AccessRequestForm
          sites={sites}
          assets={assets}
          devices={devices}
          onSubmitted={() => setIsRequestOpen(false)}
        />
      </Dialog>
      <FormDialog
        isOpen={isGrantOpen}
        onOpenChange={setIsGrantOpen}
        title="创建授权"
        subtitle="手动授权用于应急场景；生产环境的授权应由 Teleport 审批驱动并关联请求 ID。"
        submitLabel="创建授权"
        onSubmit={submitGrant}
        isSubmitDisabled={grantDeviceId === "" || (grantScope === "site" ? grantSiteId === "" : grantAssetId === "") || (grantScope === "service" && grantServiceId === "") || grantValidUntil === undefined}
        submitDisabledReason="请选择设备和目标，并设置有效期。"
      >
        <Selector
          label="受管设备"
          options={managedDevices.map((device) => ({
            value: device.id,
            label: `${device.name} (${device.subjectId})`,
            description: device.peerId,
          }))}
          value={grantDeviceId}
          onChange={setGrantDeviceId}
          placeholder="选择已注册设备"
          presentation="adaptive"
          isDisabled={managedDevices.length === 0}
          disabledMessage="请先注册受管设备。"
        />
        <Selector
          label="授权范围"
          options={[
            { value: "site", label: "站点" },
            { value: "asset", label: "资产" },
            { value: "service", label: "服务" },
          ]}
          value={grantScope}
          onChange={(value) => {
            setGrantScope(value as GrantScope);
            setGrantServiceId("");
          }}
          presentation="adaptive"
        />
        {grantScope === "site" ? (
          <Selector
            label="站点"
            options={sites.map((site) => ({ value: site.id, label: site.name }))}
            value={grantSiteId}
            onChange={setGrantSiteId}
            placeholder="选择站点"
            presentation="adaptive"
            isDisabled={sites.length === 0}
            disabledMessage="没有可用的站点。"
          />
        ) : (
          <Selector
            label="资产"
            options={assets.map((asset) => ({ value: asset.id, label: asset.name }))}
            value={grantAssetId}
            onChange={(value) => {
              setGrantAssetId(value);
              setGrantServiceId("");
            }}
            placeholder="选择资产"
            presentation="adaptive"
            isDisabled={assets.length === 0}
            disabledMessage="没有可用的受管资产。"
          />
        )}
        {grantScope === "service" ? (
          <Selector
            label="服务"
            options={grantServiceOptions.map((service) => ({
              value: service.id,
              label: `${service.name} ${service.protocol.toUpperCase()}/${service.port}`,
            }))}
            value={grantServiceId}
            onChange={setGrantServiceId}
            placeholder="选择已暴露的 NetBird 服务"
            presentation="adaptive"
            isDisabled={grantServiceOptions.length === 0}
            disabledMessage="所选资产没有可通过 NetBird 暴露的服务。"
          />
        ) : null}
        <DateTimeInput
          label="有效期至"
          value={grantValidUntil}
          onChange={setGrantValidUntil}
          description="到期后授权自动失效，无需人工删除策略。"
        />
        <TextInput label="授权原因" value={grantReason} onChange={setGrantReason} placeholder="生产问题排查" isOptional />
      </FormDialog>
      <AlertDialog
        isOpen={revoking !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setRevoking(null);
          }
        }}
        title="撤销访问授权"
        description={`将立即终止 ${revoking?.subject ?? ""} 的这条授权，其编译出的网络规则会在下次策略同步时清除。${revokeError === undefined ? "" : `上次操作失败：${revokeError}`}`}
        actionLabel="撤销授权"
        onAction={confirmRevoke}
        isActionLoading={isRevoking}
      />
    </>
  );
}
