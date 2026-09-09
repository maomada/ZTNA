"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { fusionMutate } from "./fusion-client";
import { FormDialog } from "./form-dialog";
import type { SiteOption } from "./types";
import type { RouterGroupListItem, SiteListItem } from "@/lib/console-rows";

interface SiteConsoleProps {
  title: string;
  sites: SiteListItem[];
  routerGroups: RouterGroupListItem[];
}

export function SiteConsole({ title, sites, routerGroups }: SiteConsoleProps) {
  const router = useRouter();
  const [isSiteOpen, setIsSiteOpen] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [groupSiteId, setGroupSiteId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [peerIdsText, setPeerIdsText] = useState("");
  const [netbirdGroupId, setNetbirdGroupId] = useState("");

  async function submitSite(): Promise<string | undefined> {
    const result = await fusionMutate("/api/sites", "POST", {
      name: siteName.trim(),
      networkId: networkId.trim(),
      description: siteDescription.trim() === "" ? undefined : siteDescription.trim(),
    });
    if (!result.ok) {
      return result.error ?? "无法创建站点。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  async function submitRouterGroup(): Promise<string | undefined> {
    const peerIds = peerIdsText
      .split(",")
      .map((peerId) => peerId.trim())
      .filter((peerId) => peerId !== "");
    const result = await fusionMutate("/api/router-groups", "POST", {
      siteId: groupSiteId,
      name: groupName.trim(),
      peerIds,
      netbirdGroupId: netbirdGroupId.trim() === "" ? undefined : netbirdGroupId.trim(),
    });
    if (!result.ok) {
      return result.error ?? "无法创建路由器组。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" padding={4}>
        <HStack gap={2} vAlign="center">
          <Text weight="semibold">{title}</Text>
          <Badge label={sites.length} />
        </HStack>
        <HStack gap={2}>
          <Button label="新建路由器组" variant="secondary" size="sm" onClick={() => setIsGroupOpen(true)} isDisabled={sites.length === 0} tooltip={sites.length === 0 ? "请先创建站点。" : undefined} />
          <Button label="新建站点" variant="secondary" size="sm" onClick={() => setIsSiteOpen(true)} />
        </HStack>
      </HStack>
      <VStack gap={4} padding={4} paddingBlockStart={0}>
        <VStack gap={2}>
          <Heading level={3}>站点</Heading>
          {sites.length === 0 ? (
            <EmptyState title="暂无站点" description="创建第一个站点，作为资产的网络命名空间。" isCompact />
          ) : (
            <List hasDividers density="compact">
              {sites.map((site) => (
                <ListItem key={site.id} label={site.name} description={site.description === "" ? site.networkId : `${site.networkId} · ${site.description}`} />
              ))}
            </List>
          )}
        </VStack>
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Heading level={3}>路由器组</Heading>
            <Badge label={routerGroups.length} />
          </HStack>
          {routerGroups.length === 0 ? (
            <EmptyState title="暂无路由器组" description="在每个站点下创建路由器组并声明其对等节点。" isCompact />
          ) : (
            <List hasDividers density="compact">
              {routerGroups.map((group) => (
                <ListItem
                  key={group.id}
                  label={group.name}
                  description={`站点 ${group.site} · 对等节点 ${group.peerIds.join(", ")}`}
                  endContent={
                    group.netbirdGroupId === undefined ? <Badge variant="warning" label="未配置 NetBird 组" /> : <Text type="supporting">{group.netbirdGroupId}</Text>
                  }
                />
              ))}
            </List>
          )}
        </VStack>
      </VStack>
      <FormDialog
        isOpen={isSiteOpen}
        onOpenChange={setIsSiteOpen}
        title="新建站点"
        subtitle="networkId 是站点在目标网络中的命名空间标识。"
        submitLabel="创建站点"
        onSubmit={submitSite}
        isSubmitDisabled={siteName.trim() === "" || networkId.trim() === ""}
        submitDisabledReason="请填写站点名称和 networkId。"
      >
        <TextInput label="站点名称" value={siteName} onChange={setSiteName} placeholder="北京 IDC" />
        <TextInput label="networkId" value={networkId} onChange={setNetworkId} placeholder="net_beijing_idc" />
        <TextInput label="描述" value={siteDescription} onChange={setSiteDescription} placeholder="北京的主要生产站点。" isOptional />
      </FormDialog>
      <FormDialog
        isOpen={isGroupOpen}
        onOpenChange={setIsGroupOpen}
        title="新建路由器组"
        subtitle="对等节点 ID 以英文逗号分隔；netbirdGroupId 用于 NetBird 同步，缺失时无法同步资源。"
        submitLabel="创建路由器组"
        onSubmit={submitRouterGroup}
        isSubmitDisabled={groupSiteId === "" || groupName.trim() === "" || peerIdsText.trim() === ""}
        submitDisabledReason="请选择站点并填写名称与对等节点。"
      >
        <Selector
          label="站点"
          options={sites.map((site) => ({ value: site.id, label: site.name }))}
          value={groupSiteId}
          onChange={setGroupSiteId}
          placeholder="选择站点"
          presentation="adaptive"
        />
        <TextInput label="路由器组名称" value={groupName} onChange={setGroupName} placeholder="北京路由器组" />
        <TextInput label="对等节点 ID" value={peerIdsText} onChange={setPeerIdsText} placeholder="router-bj-01, router-bj-02" />
        <TextInput label="NetBird 组 ID" value={netbirdGroupId} onChange={setNetbirdGroupId} placeholder="group_bj_routers" isOptional />
      </FormDialog>
    </>
  );
}
