export const createServerSupabaseClient = async () =>
  globalThis.__bfSupabase.server();

export const createAdminSupabaseClient = () => globalThis.__bfSupabase.admin();
