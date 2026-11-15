import "server-only";
export type PublicNotice = {
  brand: string;
  legal_name: string;
  address: string;
  contact_email: string;
  privacy_email: string;
  hosting: string;
  retention: string;
  basis: string;
  demo: boolean;
  preopening?: boolean;
};
export async function publicNotice(): Promise<PublicNotice | null> {
  if (process.env.EDUBEST_PUBLIC_SITE_ONLY === "true")
    return {
      brand: "EduBest",
      legal_name: process.env.SCHOOL_LEGAL_NAME || "",
      address: process.env.SCHOOL_ADDRESS || "",
      contact_email: process.env.SCHOOL_CONTACT_EMAIL || "",
      privacy_email: process.env.SCHOOL_PRIVACY_EMAIL || "",
      hosting:
        "Site hébergé par Octenium sur le serveur onyx.octenium.net. La localisation physique des données et sauvegardes doit être confirmée avant l’ouverture de la gestion scolaire.",
      retention:
        "L’espace de gestion n’est pas encore ouvert. L’établissement doit définir les durées de conservation des dossiers d’élèves, factures et sauvegardes avant d’y enregistrer des données réelles.",
      basis:
        "Ce site présente l’école et ses services. Les inscriptions et dossiers scolaires ne sont pas collectés sur le site à ce stade. Pour une demande, contactez directement l’établissement par email.",
      demo: false,
      preopening: true,
    };
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4200"}/api/public/notice`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
