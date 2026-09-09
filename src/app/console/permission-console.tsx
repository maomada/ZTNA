"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Selector } from "@astryxdesign/core/Selector";
import { proportional, Table } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { fusionMutate } from "./fusion-client";
import { FormDialog } from "./form-dialog";
import type { AssetOption, DeviceOption } from "./types";
import type { PermissionRow } from "@/lib/console-rows";

interface PermissionConsoleProps {
  title: string;
  rows: PermissionRow[];
  devices: DeviceOption[];
  assets: AssetOption[];
}

export function PermissionConsole({ title, rows, devices, assets }: PermissionConsoleProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [deleting, setDeleting] = useState<PermissionRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);

  const managedDevices = devices.filter((device) => device.managed);
  const selectedDevice = managedDevices.find((device) => device.id === deviceId);
  const selectedAsset = assets.find((asset) => asset.id === assetId);

  function openCreate(): void {
    setDeviceId(managedDevices[0]?.id ?? "");
    setAssetId(assets[0]?.id ?? "");
    setServiceId("");
    setIsCreateOpen(true);
  }

  async function submitCreate(): Promise<string | undefined> {
    if (selectedDevice === undefined || selectedAsset === undefined) {
      return "请选择受管设备和资产。";
    }

    const result = await fusionMutate("/api/asset-permissions", "POST", {
      subjectId: selectedDevice.subjectId,
      devicePeerId: selectedDevice.peerId,
      assetId,
      serviceId: serviceId === "" ? undefined : serviceId,
    });
    if (!result.ok) {
      return result.error ?? "无法创建静态权限。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) {
      return;
    }

    setIsDeleting(true);
    const result = await fusionMutate(`/api/asset-permissions/${deleting.id}`, "DELETE");
    setIsDeleting(false);
    if (result.ok) {
      setDeleting(null);
      setDeleteError(undefined);
      startTransition(() => router.refresh());
      return;
    }

    setDeleteError(result.error ?? "删除失败，请重试。");
  }

  const columns: TableColumn<PermissionRow>[] = [
    { key: "subject", header: "主体", width: proportional(1) },
    { key: "devicePeer", header: "设备对等节点", width: proportional(1) },
    { key: "asset", header: "资产", width: proportional(1) },
    { key: "scope", header: "范围", width: proportional(1) },
    { key: "service", header: "服务", width: proportional(1) },
    { key: "createdAt", header: "创建时间", width: proportional(1) },
    {
      key: "actions",
      header: "操作",
      width: proportional(1),
      renderCell: (row) => (
        <Button
          label="删除"
          variant="ghost"
          size="sm"
          onClick={() => {
            setDeleting(row);
            setDeleteError(undefined);
          }}
        />
      ),
    },
  ];

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" padding={4} paddingBlockEnd={3}>
        <HStack gap={2} vAlign="center">
          <Text weight="semibold">{title}</Text>
          <Badge label={rows.length} />
        </HStack>
        <Button
          label="新建静态权限"
          variant="secondary"
          size="sm"
          onClick={openCreate}
          isDisabled={managedDevices.length === 0 || assets.length === 0}
          tooltip={managedDevices.length === 0 ? "请先注册受管设备。" : assets.length === 0 ? "请先创建受管资产。" : undefined}
        />
      </HStack>
      {rows.length === 0 ? (
        <VStack padding={4} paddingBlockStart={0}>
          <EmptyState title="暂无静态权限" description="创建静态权限后，其规则会编译进有效访问。" isCompact />
        </VStack>
      ) : (
        <Table data={rows} columns={columns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
      )}
      <FormDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="新建静态权限"
        subtitle="范围选择服务时，只授予该服务的精确协议和端口；范围选择资产时，授予其全部可通过 NetBird 暴露的服务。"
        submitLabel="创建权限"
        onSubmit={submitCreate}
        isSubmitDisabled={deviceId === "" || assetId === ""}
        submitDisabledReason="请选择受管设备和资产。"
      >
        <Selector
          label="受管设备"
          options={managedDevices.map((device) => ({
            value: device.id,
            label: `${device.name} (${device.subjectId})`,
            description: device.peerId,
          }))}
          value={deviceId}
          onChange={setDeviceId}
          placeholder="选择已注册设备"
          presentation="adaptive"
          isDisabled={managedDevices.length === 0}
          disabledMessage="请先注册受管设备。"
        />
        <Selector
          label="资产"
          options={assets.map((asset) => ({ value: asset.id, label: asset.name }))}
          value={assetId}
          onChange={(value) => {
            setAssetId(value);
            setServiceId("");
          }}
          placeholder="选择资产"
          presentation="adaptive"
          isDisabled={assets.length === 0}
          disabledMessage="没有可用的受管资产。"
        />
        <Selector
          label="服务范围"
          options={[
            { value: "", label: "整个资产（全部已暴露服务）" },
            ...(selectedAsset?.services ?? []).map((service) => ({
              value: service.id,
              label: `${service.name} ${service.protocol.toUpperCase()}/${service.port}`,
            })),
          ]}
          value={serviceId}
          onChange={setServiceId}
          presentation="adaptive"
          isDisabled={(selectedAsset?.services ?? []).length === 0}
          disabledMessage="所选资产没有可通过 NetBird 暴露的服务。"
        />
      </FormDialog>
      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDeleting(null);
          }
        }}
        title="删除静态权限"
        description={`将移除 ${deleting?.subject ?? ""} 对 ${deleting?.asset ?? ""} 的常驻访问，编译出的网络规则会随之消失。${deleteError === undefined ? "" : `上次操作失败：${deleteError}`}`}
        actionLabel="删除权限"
        onAction={confirmDelete}
        isActionLoading={isDeleting}
      />
    </>
  );
}
