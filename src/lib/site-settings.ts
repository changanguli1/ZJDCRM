import { useEffect, useState } from "react";
import { api } from "./api";

export type SiteSettings = {
  site_name?: string;
  login_text?: string;
  announcement?: string;
  logo_url?: string;
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({});
  useEffect(() => {
    api.get<SiteSettings>("/settings/public")
      .then((value) => {
        setSettings(value);
        if (value.site_name) document.title = value.site_name;
      })
      .catch(() => undefined);
  }, []);
  return settings;
}
