"use client";

import { Button } from "@astryxdesign/core/Button";
import Link from "next/link";

export function LinkButton({ label, href }: { label: string; href: string }) {
  return <Button label={label} variant="ghost" size="sm" href={href} as={Link} />;
}
