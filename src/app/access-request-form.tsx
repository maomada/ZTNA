"use client";

import { Button } from "@astryxdesign/core/Button";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

interface SiteOption {
  id: string;
  name: string;
}

interface ServiceOption {
  id: string;
  name: string;
  protocol: string;
  port: number;
  accessMethod: string;
  exposable: boolean;
}

interface AssetOption {
  id: string;
  siteId: string;
  name: string;
  services: ServiceOption[];
}

interface DeviceOption {
  id: string;
  name: string;
  subjectId: string;
  peerId: string;
  managed: boolean;
}

interface AccessRequestFormProps {
  sites: SiteOption[];
  assets: AssetOption[];
  devices: DeviceOption[];
}

type Scope = "site" | "asset" | "service";

function defaultValidUntil(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

export function AccessRequestForm({ sites, assets, devices }: AccessRequestFormProps) {
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
      setMessage("Enroll a managed Device before submitting an access request.");
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
        throw new Error(result.error ?? "Access request could not be submitted.");
      }

      setMessage(`Request ${result.item.id} is pending approval. No network access has been granted.`);
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access request could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <FormLayout defaultOptionality="required">
        <Selector
          label="Requested scope"
          options={[
            { value: "site", label: "Site" },
            { value: "asset", label: "Asset" },
            { value: "service", label: "Service" },
          ]}
          value={scope}
          onChange={(value) => setScope(value as Scope)}
          presentation="adaptive"
        />
        {scope === "site" ? (
          <Selector
            label="Site"
            options={sites.map((site) => ({ value: site.id, label: site.name }))}
            value={siteId}
            onChange={setSiteId}
            placeholder="Choose a Site"
            presentation="adaptive"
            isDisabled={sites.length === 0}
            disabledMessage="No Sites are available."
          />
        ) : (
          <Selector
            label="Asset"
            options={assets.map((asset) => ({ value: asset.id, label: asset.name }))}
            value={assetId}
            onChange={selectAsset}
            placeholder="Choose an Asset"
            presentation="adaptive"
            isDisabled={assets.length === 0}
            disabledMessage="No managed Assets are available."
          />
        )}
        {scope === "service" ? (
          <Selector
            label="Service"
            options={serviceOptions.map((service) => ({
              value: service.id,
              label: `${service.name} ${service.protocol.toUpperCase()}/${service.port}`,
            }))}
            value={serviceId}
            onChange={setServiceId}
            placeholder="Choose an exposed NetBird service"
            presentation="adaptive"
            isDisabled={serviceOptions.length === 0}
            disabledMessage="The selected Asset has no NetBird-exposable service."
          />
        ) : null}
        <Selector
          label="Managed device"
          options={managedDevices.map((device) => ({
            value: device.id,
            label: `${device.name} (${device.subjectId})`,
            description: device.peerId,
          }))}
          value={deviceId}
          onChange={setDeviceId}
          placeholder="Choose an enrolled Device"
          presentation="adaptive"
          isDisabled={managedDevices.length === 0}
          disabledMessage="Enroll a managed Device before requesting access."
          description="The request is bound to this user, Device peer, and its pre-existing NetBird Group."
        />
        <TextInput label="Reason" value={reason} onChange={setReason} placeholder="Production investigation" />
        <TextInput
          label="Valid until (ISO 8601)"
          value={validUntil}
          onChange={setValidUntil}
          description="Approval can only create access until this timestamp."
        />
        <VStack gap={2}>
          <HStack gap={2} wrap="wrap">
            <Button
              label="Submit access request"
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              isDisabled={selectedDevice === undefined}
              tooltip="Enroll a managed Device before requesting access."
            />
          </HStack>
          {message === undefined ? null : <Text type="supporting">{message}</Text>}
        </VStack>
      </FormLayout>
    </form>
  );
}
