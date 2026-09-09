"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { proportional, Table } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { fusionMutate } from "./fusion-client";
import { FormDialog } from "./form-dialog";
import type { DeviceRow } from "@/lib/console-rows";

interface DeviceConsoleProps {
  title: string;
  rows: DeviceRow[];
}

const deviceColumns: TableColumn<DeviceRow>[] = [
  { key: "name", header: "设备", width: proportional(1) },
  { key: "subject", header: "主体", width: proportional(1) },
  { key: "peer", header: "NetBird 对等节点", width: proportional(1) },
  { key: "netbirdGroup", header: "专用组", width: proportional(2) },
  { key: "status", header: "注册状态", width: proportional(1) },
];

export function DeviceConsole({ title, rows }: DeviceConsoleProps) {
  const router = useRouter();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [netbirdGroupId, setNetbirdGroupId] = useState("");

  async function submitRegister(): Promise<string | undefined> {
    const result = await fusionMutate("/api/devices", "POST", {
      name: name.trim(),
      subjectId: subjectId.trim(),
      peerId: peerId.trim(),
      netbirdGroupId: netbirdGroupId.trim(),
      managed: true,
    });
    if (!result.ok) {
      return result.error ?? "无法注册设备。";
    }

    startTransition(() => router.refresh());
    return undefined;
  }

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" padding={4} paddingBlockEnd={3}>
        <HStack gap={2} vAlign="center">
          <Text weight="semibold">{title}</Text>
          <Badge label={rows.length} />
        </HStack>
        <Button label="注册设备" variant="secondary" size="sm" onClick={() => setIsRegisterOpen(true)} />
      </HStack>
      {rows.length === 0 ? (
        <VStack padding={4} paddingBlockStart={0}>
          <EmptyState title="暂无已注册设备" description="注册受管设备后，才能申请和执行网络访问授权。" isCompact />
        </VStack>
      ) : (
        <Table data={rows} columns={deviceColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
      )}
      <FormDialog
        isOpen={isRegisterOpen}
        onOpenChange={setIsRegisterOpen}
        title="注册设备"
        subtitle="对等节点 ID 与专用 NetBird 组 ID 必须在 NetBird 中已存在，且该组应只包含此设备对等节点。"
        submitLabel="注册设备"
        onSubmit={submitRegister}
        isSubmitDisabled={name.trim() === "" || subjectId.trim() === "" || peerId.trim() === "" || netbirdGroupId.trim() === ""}
        submitDisabledReason="请填写设备名称、主体 ID、对等节点 ID 和专用组 ID。"
      >
        <TextInput label="设备名称" value={name} onChange={setName} placeholder="alice-laptop" />
        <TextInput label="主体 ID" value={subjectId} onChange={setSubjectId} placeholder="alice@example.com" />
        <TextInput label="NetBird 对等节点 ID" value={peerId} onChange={setPeerId} placeholder="peer-alice-laptop" />
        <TextInput label="专用 NetBird 组 ID" value={netbirdGroupId} onChange={setNetbirdGroupId} placeholder="group_alice_laptop" />
      </FormDialog>
    </>
  );
}
