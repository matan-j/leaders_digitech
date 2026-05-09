export type CRMChannel = 'whatsapp' | 'email';

export const CRM_LEAD_CLASS = 'Lead';
export const CRM_CUSTOMER_CLASS = 'Customer';
export const CRM_SOFT_DELETE_FILTER = 'is_deleted.eq.false,is_deleted.is.null';

type QueryLike = {
  or: (filter: string) => QueryLike;
  eq: (column: string, value: unknown) => QueryLike;
};

export const applyNotDeleted = <T extends QueryLike>(query: T): T =>
  query.or(CRM_SOFT_DELETE_FILTER) as T;

export const applyLeadClass = <T extends QueryLike>(query: T): T =>
  query.eq('crm_class', CRM_LEAD_CLASS) as T;

export const applyCustomerClass = <T extends QueryLike>(query: T): T =>
  query.eq('crm_class', CRM_CUSTOMER_CLASS) as T;

export const hasRequiredDestination = (
  recipient: { phone?: string | null; email?: string | null },
  channel: CRMChannel,
) => (
  channel === 'whatsapp'
    ? Boolean(recipient.phone?.trim())
    : Boolean(recipient.email?.trim())
);

export const pickBestContactForChannel = <T extends {
  phone?: string | null;
  email?: string | null;
  is_primary?: boolean | null;
}>(contacts: T[], channel: CRMChannel): T | null => (
  contacts.find((contact) => contact.is_primary && hasRequiredDestination(contact, channel))
  ?? contacts.find((contact) => hasRequiredDestination(contact, channel))
  ?? contacts.find((contact) => contact.is_primary)
  ?? contacts[0]
  ?? null
);

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export async function fetchInstitutionIds(
  createQuery: () => any,
  pageSize = 1000,
): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await createQuery().range(from, to);
    if (error) throw error;

    const rows = (data ?? []) as { id: string }[];
    ids.push(...rows.map((row) => row.id));
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return [...new Set(ids)];
}

export async function countInstitutionIdsWithDestination(
  supabase: any,
  institutionIds: string[],
  channel: CRMChannel,
): Promise<number> {
  if (institutionIds.length === 0) return 0;

  const matched = new Set<string>();
  const destinationColumn = channel === 'whatsapp' ? 'phone' : 'email';

  for (const ids of chunk(institutionIds, 500)) {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select(`institution_id, ${destinationColumn}`)
      .in('institution_id', ids)
      .not(destinationColumn, 'is', null);

    if (error) throw error;

    for (const contact of data ?? []) {
      const destination = contact[destinationColumn];
      if (typeof destination === 'string' && destination.trim()) {
        matched.add(contact.institution_id);
      }
    }
  }

  return matched.size;
}

export async function countSendableInstitutions(
  supabase: any,
  createInstitutionQuery: () => any,
  channel: CRMChannel,
): Promise<number> {
  const ids = await fetchInstitutionIds(createInstitutionQuery);
  return countInstitutionIdsWithDestination(supabase, ids, channel);
}
