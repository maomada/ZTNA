"use client";

import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Heading, Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Grid } from "@astryxdesign/core/Grid";
import { KeyRound, Radar, ScrollText, Server, ShieldCheck, Waypoints } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

const tileIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  sites: Waypoints,
  assets: Server,
  discovery: Radar,
  requests: KeyRound,
  grants: ShieldCheck,
  rules: ScrollText,
};

export interface OverviewTile {
  label: string;
  value: number;
  description: string;
  icon: keyof typeof tileIcons;
}

export function OverviewTiles({ tiles }: { tiles: OverviewTile[] }) {
  return (
    <Grid columns={{ minWidth: 180, max: 6 }} gap={3}>
      {tiles.map((tile) => {
        const IconComponent = tileIcons[tile.icon];
        return (
          <Card key={tile.label}>
            <VStack gap={1}>
              <HStack gap={1} vAlign="center">
                {IconComponent === undefined ? null : <Icon icon={IconComponent} size="sm" color="accent" />}
                <Text type="supporting">{tile.label}</Text>
              </HStack>
              <Heading level={3}>{tile.value}</Heading>
              <Text type="supporting">{tile.description}</Text>
            </VStack>
          </Card>
        );
      })}
    </Grid>
  );
}
