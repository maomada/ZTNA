"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
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
import type { DiscoveryRow } from "@/lib/console-rows";

interface DiscoveryConsoleProps {
  title: string;
  rows: DiscoveryRow[];
  sites: SiteOption[];
  routerGroups: RouterGroupOption[];
}

export function DiscoveryConsole({ title, rows, sites, routerGroups }: DiscoveryConsoleProps) {
  const router = useRouter();
  const [importing, setImporting] = useState<DiscoveryRow | null>(null);
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualSiteId, setManualSiteId] = useState("");
  const [manualRouterGroupId, setManualRouterGroupId] = useState("");
  const [manualType, setManualType] = useState("ipv4");
  const [manualAddress, setManualAddress] = useState("");
  const [manualHostname, setManualHostname] = useState("");

  const manualRouterGroups = routerGroups.filter((group) => group.siteId === manualSiteId);

  function openManualDialog(): void {
    setManualSiteId(sites[0]?.id ?? "");
    setManualRouterGroupId(routerGroups.find((group) => group.siteId === sites[0]?.id)?.id ?? "");
    setManualType("ipv4");
    setManualAddress("");
    setManualHostname("");
    setIsManualOpen(true);
  }

  async function submitManual(): Promise<string | undefined> {
    const result = await fusionMutate("/api/discovered-assets", "POST", {
      siteId: manualSiteId,
      routerGroupId: manualRouterGroupId,
      type: manualType,
      address: manualAddress.trim(),
      hostname: manualHostname.trim() === "" ? undefined : manualHostname.trim(),
      source: "manual",
    });
    if (!result.ok) {
      return result.error ?? "无法录入发现记录。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  function openImport(row: DiscoveryRow): void {
    setImporting(row);
    setName(row.suggestedName);
    setHostname(row.hostname ?? "");
  }

  async function submitImport(): Promise<string | undefined> {
    if (importing === null) {
      return undefined;
    }

    const result = await fusionMutate(`/api/discovered-assets/${importing.id}/import`, "POST", {
      name: name.trim(),
      hostname: hostname.trim() === "" ? undefined : hostname.trim(),
    });
    if (!result.ok) {
      return result.error ?? "无法导入发现记录。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  const columns: TableColumn<DiscoveryRow>[] = [
    { key: "site", header: "站点", width: proportional(1) },
    { key: "endpoint", header: "观测端点", width: proportional(2) },
    { key: "source", header: "来源", width: proportional(1) },
    { key: "discovered", header: "发现时间", width: proportional(1) },
    {
      key: "status",
      header: "审核状态",
      width: proportional(2),
      renderCell: (row) =>
        row.statusKey === "unmanaged" ? <Badge variant="warning" label="待导入" /> : <Text>{row.status}</Text>,
    },
    {
      key: "actions",
      header: "操作",
      width: proportional(1),
      renderCell: (row) =>
        row.statusKey === "unmanaged" ? (
          <Button label="导入" variant="secondary" size="sm" onClick={() => openImport(row)} />
        ) : null,
    },
  ];

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" padding={4} paddingBlockEnd={3}>
        <HStack gap={2} vAlign="center">
          <Text weight="semibold">{title}</Text>
          <Badge label={rows.filter((row) => row.statusKey === "unmanaged").length} />
        </HStack>
        <Button label="手动录入" variant="secondary" size="sm" onClick={openManualDialog} isDisabled={sites.length === 0 || routerGroups.length === 0} tooltip={sites.length === 0 || routerGroups.length === 0 ? "请先创建站点和路由器组。" : undefined} />
      </HStack>
      {rows.length === 0 ? (
        <VStack padding={4} paddingBlockStart={0}>
          <EmptyState title="暂无发现记录" description="暂未收到待审核的资产发现结果。" isCompact />
        </VStack>
      ) : (
        <Table data={rows} columns={columns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
      )}
      <FormDialog
        isOpen={importing !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setImporting(null);
          }
        }}
        title="导入发现记录"
        subtitle={importing === null ? undefined : `站点 ${importing.site} · 端点 ${importing.endpoint} 将成为受管资产的首个端点。`}
        submitLabel="导入为资产"
        onSubmit={submitImport}
        isSubmitDisabled={name.trim() === ""}
        submitDisabledReason="请填写资产名称。"
      >
        <TextInput label="资产名称" value={name} onChange={setName} placeholder="fileserver-01" />
        <TextInput label="主机名" value={hostname} onChange={setHostname} placeholder="fileserver-01.internal" isOptional />
      </FormDialog>
      <FormDialog
        isOpen={isManualOpen}
        onOpenChange={setIsManualOpen}
        title="手动录入发现"
        subtitle="手动录入与自动发现一致：只是观测结果，导入前不会成为可信资产。"
        submitLabel="录入发现记录"
        onSubmit={submitManual}
        isSubmitDisabled={manualSiteId === "" || manualRouterGroupId === "" || manualAddress.trim() === ""}
        submitDisabledReason="请选择站点与路由器组，并填写端点地址。"
      >
        <Selector
          label="站点"
          options={sites.map((site) => ({ value: site.id, label: site.name }))}
          value={manualSiteId}
          onChange={(value) => {
            setManualSiteId(value);
            setManualRouterGroupId(routerGroups.find((group) => group.siteId === value)?.id ?? "");
          }}
          placeholder="选择站点"
          presentation="adaptive"
        />
        <Selector
          label="路由器组"
          options={manualRouterGroups.map((group) => ({ value: group.id, label: group.name }))}
          value={manualRouterGroupId}
          onChange={setManualRouterGroupId}
          placeholder="选择路由器组"
          presentation="adaptive"
          isDisabled={manualRouterGroups.length === 0}
          disabledMessage="所选站点还没有路由器组。"
        />
        <Selector
          label="端点类型"
          options={[
            { value: "ipv4", label: "IPv4" },
            { value: "ipv6", label: "IPv6" },
            { value: "dns", label: "DNS 域名" },
          ]}
          value={manualType}
          onChange={setManualType}
          presentation="adaptive"
        />
        <TextInput
          label="端点地址"
          value={manualAddress}
          onChange={setManualAddress}
          placeholder={manualType === "dns" ? "nas-01.internal" : "192.168.1.10"}
        />
        <TextInput label="主机名" value={manualHostname} onChange={setManualHostname} placeholder="nas-01.internal" isOptional />
      </FormDialog>
    </>
  );
}
