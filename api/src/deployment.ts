/** Public deployment identity. These fields contain no credentials. */
export function deploymentProfile(env: NodeJS.ProcessEnv = process.env) {
  return {
    brand: "EduBest",
    legal_name: env.SCHOOL_LEGAL_NAME ?? "",
    address: env.SCHOOL_ADDRESS ?? "",
    contact_email: env.SCHOOL_CONTACT_EMAIL ?? "",
    privacy_email: env.SCHOOL_PRIVACY_EMAIL || env.SCHOOL_CONTACT_EMAIL || "",
    hosting: env.DATA_HOSTING_DESCRIPTION ?? "",
    retention: env.DATA_RETENTION_POLICY ?? "",
    basis: env.DATA_PROCESSING_BASIS ?? "",
    country: "DZ",
    currency: "DZD",
    timezone: "Africa/Algiers",
    demo: env.EDUBEST_DEMO_ENABLED === "true",
    review: env.EDUBEST_REVIEW_MODE === "true",
  };
}
