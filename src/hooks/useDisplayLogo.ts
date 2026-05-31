import { useQuery } from '@tanstack/react-query';
import { loadCompanyInfo, DEFAULT_COMPANY_INFO } from '@/lib/quotes/company-info';

/**
 * Reads the in-system display logo from crm_settings.company_info.displayLogoUrl.
 * Falls back to DEFAULT_COMPANY_INFO.displayLogoUrl ('/logoReg.png') while loading
 * or if no value is set. Cached for 5 minutes so the header doesn't refetch on
 * every navigation.
 */
export const useDisplayLogo = (): string => {
  const { data } = useQuery({
    queryKey: ['display-logo'],
    queryFn: async () => {
      const info = await loadCompanyInfo();
      return info.displayLogoUrl || DEFAULT_COMPANY_INFO.displayLogoUrl;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return data || DEFAULT_COMPANY_INFO.displayLogoUrl;
};
