"use client";

import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";
import { Heading, Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/Stack";
import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({ crumbs, title, description }: { crumbs: Crumb[]; title: string; description: string }) {
  return (
    <VStack gap={1}>
      <Breadcrumbs variant="supporting" label="面包屑">
        {crumbs.map((crumb, index) => (
          <BreadcrumbItem key={crumb.label} href={crumb.href} as={crumb.href === undefined ? undefined : Link} isCurrent={index === crumbs.length - 1}>
            {crumb.label}
          </BreadcrumbItem>
        ))}
      </Breadcrumbs>
      <Heading level={1}>{title}</Heading>
      <Text>{description}</Text>
    </VStack>
  );
}
