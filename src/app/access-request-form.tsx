"use client";

import { Button } from "@astryxdesign/core/Button";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import type { AssetOption, DeviceOption, SiteOption } from "./console/types";

interface AccessRequestFormProps {
  sites: SiteOption[];
  assets: AssetOption[];
  devices: DeviceOption[];
  onSubmitted?: () => void;
}

type Scope = "site" | "asset" | "service";

function defaultValidUntil(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

export function AccessRequestForm({ sites, assets, devices, onSubmitted }: AccessRequestFormProps) {
  const router = useRouter();
  const managedDevices = devices.filter((device) => device.managed);
  const [scope, setScope] = useState<Scope>("service");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(assets[0]?.services.find((service) => service.exposable && service.accessMethod === "netbird")?.id ?? "");
  const [deviceId, setDeviceId] = useState(managedDevices[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [message, setMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAsset = assets.find((asset) => asset.id === assetId);
  const selectedDevice = managedDevices.find((device) => device.id === deviceId);
  const serviceOptions = (selectedAsset?.services ?? []).filter(
    (service) => service.exposable && service.accessMethod === "netbird",
  );

  function selectAsset(nextAssetId: string): void {
    setAssetId(nextAssetId);
    const nextAsset = assets.find((asset) => asset.id === nextAssetId);
    setServiceId(nextAsset?.services.find((service) => service.exposable && service.accessMethod === "netbird")?.id ?? "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (selectedDevice === undefined) {
      setMessage("请先注册受管设备，再提交访问申请。");
      return;
    }

    setIsSubmitting(true);
    setMessage(undefined);

    const body: Record<string, string> = {
      subjectId: selectedDevice.subjectId,
      devicePeerId: selectedDevice.peerId,
      scope,
      reason,
      validUntil,
    };
    if (scope === "site") {
      body.siteId = siteId;
    } else {
      body.assetId = assetId;
      if (scope === "service") {
        body.serviceId = serviceId;
      }
    }

    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string; item?: { id: string } };
      if (!response.ok || result.item === undefined) {
        throw new Error(result.error ?? "无法提交访问申请。");
      }

      setMessage(`申请 ${result.item.id} 正等待审批，尚未授予网络访问权限。`);
      startTransition(() => router.refresh());
      onSubmitted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法提交访问申请。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <FormLayout defaultOptionality="required">
        <Selector
          label="申请范围"
          options={[
            { value: "site", label: "站点" },
            { value: "asset", label: "资产" },
            { value: "service", label: "服务" },
          ]}
          value={scope}
          onChange={(value) => setScope(value as Scope)}
          presentation="adaptive"
        />
        {scope === "site" ? (
          <Selector
            label="站点"
            options={sites.map((site) => ({ value: site.id, label: site.name }))}
            value={siteId}
            onChange={setSiteId}
            placeholder="选择站点"
            presentation="adaptive"
            isDisabled={sites.length === 0}
            disabledMessage="没有可用的站点。"
          />
        ) : (
          <Selector
            label="资产"
            options={assets.map((asset) => ({ value: asset.id, label: asset.name }))}
            value={assetId}
            onChange={selectAsset}
            placeholder="选择资产"
            presentation="adaptive"
            isDisabled={assets.length === 0}
            disabledMessage="没有可用的受管资产。"
          />
        )}
        {scope === "service" ? (
          <Selector
            label="服务"
            options={serviceOptions.map((service) => ({
              value: service.id,
              label: `${service.name} ${service.protocol.toUpperCase()}/${service.port}`,
            }))}
            value={serviceId}
            onChange={setServiceId}
            placeholder="选择已暴露的 NetBird 服务"
            presentation="adaptive"
            isDisabled={serviceOptions.length === 0}
            disabledMessage="所选资产没有可通过 NetBird 暴露的服务。"
          />
        ) : null}
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
          disabledMessage="请先注册受管设备，再申请访问。"
          description="该申请会绑定当前用户、设备对等节点和其已有的 NetBird 组。"
        />
        <TextInput label="申请原因" value={reason} onChange={setReason} placeholder="生产问题排查" />
        <TextInput
          label="有效期至（ISO 8601）"
          value={validUntil}
          onChange={setValidUntil}
          description="审批只能创建截至该时间戳的访问权限。"
        />
        <VStack gap={2}>
          <HStack gap={2} wrap="wrap">
            <Button
              label="提交访问申请"
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              isDisabled={selectedDevice === undefined}
              tooltip="请先注册受管设备，再申请访问。"
            />
          </HStack>
          {message === undefined ? null : <Text type="supporting">{message}</Text>}
        </VStack>
      </FormLayout>
    </form>
  );
}
