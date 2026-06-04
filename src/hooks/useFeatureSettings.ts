import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const FEATURE_SETTINGS_QUERY_KEY = ["feature-settings"];

interface FeatureSettings {
  rewardsPageEnabled: boolean;
}

const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
  rewardsPageEnabled: true,
};

export const useFeatureSettings = () => {
  const query = useQuery({
    queryKey: FEATURE_SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<FeatureSettings> => {
      const { data, error } = await supabase
        .from("system_defaults")
        .select("rewards_page_enabled")
        .maybeSingle();

      if (error) {
        console.error("Error loading feature settings:", error);
        return DEFAULT_FEATURE_SETTINGS;
      }

      return {
        rewardsPageEnabled: data?.rewards_page_enabled ?? true,
      };
    },
    staleTime: 60 * 1000,
  });

  return {
    ...DEFAULT_FEATURE_SETTINGS,
    ...query.data,
    isLoading: query.isLoading,
  };
};
