"use client";

import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

interface FormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  subtitle?: string;
  submitLabel: string;
  cancelLabel?: string;
  onSubmit: () => Promise<string | undefined>;
  isSubmitDisabled?: boolean;
  submitDisabledReason?: string;
  children: ReactNode;
}

export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  submitLabel,
  cancelLabel = "取消",
  onSubmit,
  isSubmitDisabled = false,
  submitDisabledReason,
  children,
}: FormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(undefined);
    const error = await onSubmit();
    setIsSubmitting(false);
    if (error !== undefined) {
      setMessage(error);
      return;
    }

    onOpenChange(false);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" padding={4}>
      <DialogHeader title={title} subtitle={subtitle} onOpenChange={onOpenChange} />
      <form onSubmit={submit}>
        <FormLayout defaultOptionality="required">
          {children}
          {message === undefined ? null : <Text type="supporting">{message}</Text>}
          <HStack gap={2} justify="end">
            <Button label={cancelLabel} variant="ghost" type="button" onClick={() => onOpenChange(false)} />
            <Button
              label={submitLabel}
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              isDisabled={isSubmitDisabled}
              tooltip={isSubmitDisabled ? submitDisabledReason : undefined}
            />
          </HStack>
        </FormLayout>
      </form>
    </Dialog>
  );
}
