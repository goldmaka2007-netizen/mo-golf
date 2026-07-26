const configuredAdminEmail = (): string =>
  import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() ?? '';

export const isAdminEmail = (email?: string | null): boolean => {
  const adminEmail = configuredAdminEmail();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
};
