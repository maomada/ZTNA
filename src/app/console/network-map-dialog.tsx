"use client";

import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import type { DeviceOption } from "./types";
import type { EffectiveNetworkMap } from "@/lib/fusion";

interface NetworkMapDialogProps {
  devices: DeviceOption[];
}

export function NetworkMapDialog({ devices }: NetworkMapDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [networkMap, setNetworkMap] = useState<EffectiveNetworkMap | undefined>();
  const [error, setError] = useState<string | undefined>();

  const managedDevices = devices.filter((device) => device.managed);
  const selectedDevice = managedDevices.find((device) => device.id === deviceId);

  async function selectDevice(nextDeviceId: string): Promise<void> {
    setDeviceId(nextDeviceId);
    setNetworkMap(undefined);
    setError(undefined);
    const device = managedDevices.find((candidate) => candidate.id === nextDeviceId);
    if (device === undefined) {
      return;
    }

    try {
      const params = new URLSearchParams({ devicePeerId: device.peerId, subjectId: device.subjectId });
      const response = await fetch(`/api/network-map?${params.toString()}`);
      const result = (await response.json()) as { item?: EffectiveNetworkMap; error?: string };
      if (!response.ok || result.item === undefined) {
        setError(result.error ?? "无法获取网络映射。");
        return;
      }

      setNetworkMap(result.item);
      startTransition(() => router.refresh());
    } catch {
      setError("网络错误，请重试。");
    }
  }

  return (
    <>
      <Button
        label="查看网络映射"
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(true)}
        isDisabled={managedDevices.length === 0}
        tooltip={managedDevices.length === 0 ? "请先注册受管设备。" : undefined}
      />
      <Dialog isOpen={isOpen} onOpenChange={setIsOpen} purpose="info" padding={4} width={480}>
        <DialogHeader
          title="有效网络映射"
          subtitle="静态权限与有效 AccessGrant 为该设备编译出的授权视图。"
          onOpenChange={setIsOpen}
        />
        <VStack gap={3}>
          <Selector
            label="受管设备"
            options={managedDevices.map((device) => ({
              value: device.id,
              label: `${device.name} (${device.subjectId})`,
              description: device.peerId,
            }))}
            value={deviceId}
            onChange={selectDevice}
            placeholder="选择设备"
            presentation="adaptive"
            isDisabled={managedDevices.length === 0}
            disabledMessage="请先注册受管设备。"
          />
          {error === undefined ? null : <Text type="supporting">{error}</Text>}
          {networkMap === undefined ? null : (
            <VStack gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text weight="semibold">{networkMap.accessRules.length} 条规则</Text>
                <Text type="supporting">版本 {networkMap.revision.slice(0, 12)}</Text>
              </HStack>
              {networkMap.accessRules.length === 0 ? (
                <EmptyState title="默认拒绝" description="该设备当前没有任何有效授权。" isCompact />
              ) : (
                <List hasDividers density="compact">
                  {networkMap.accessRules.map((rule) => (
                    <ListItem
                      key={rule.id}
                      label={`${rule.destination} ${rule.protocol.toUpperCase()}/${rule.ports.join(", ")}`}
                      description={`${rule.assetId} · 路由器 ${rule.routerPeerIds.join(", ")}`}
                      endContent={<Text type="supporting">{rule.validUntil === null ? "静态" : rule.validUntil}</Text>}
                    />
                  ))}
                </List>
              )}
            </VStack>
          )}
        </VStack>
      </Dialog>
    </>
  );
}
