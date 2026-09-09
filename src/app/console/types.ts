export interface SiteOption {
  id: string;
  name: string;
}

export interface RouterGroupOption {
  id: string;
  siteId: string;
  name: string;
}

export interface DeviceOption {
  id: string;
  name: string;
  subjectId: string;
  peerId: string;
  managed: boolean;
}

export interface AssetServiceOption {
  id: string;
  name: string;
  protocol: string;
  port: number;
  accessMethod: string;
  exposable: boolean;
}

export interface AssetOption {
  id: string;
  siteId: string;
  name: string;
  services: AssetServiceOption[];
}
