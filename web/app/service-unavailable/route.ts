export const dynamic = "force-dynamic";
function unavailable() {
  return Response.json(
    {
      message:
        "L’espace de gestion ouvrira prochainement. Contactez contact@edubest.dz. / سيفتح فضاء التسيير قريبًا. تواصلوا مع المدرسة.",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Retry-After": "86400",
      },
    },
  );
}
export {
  unavailable as GET,
  unavailable as POST,
  unavailable as PUT,
  unavailable as PATCH,
  unavailable as DELETE,
  unavailable as HEAD,
  unavailable as OPTIONS,
};
