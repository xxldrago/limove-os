export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - /api/auth (NextAuth endpoints)
     * - /api/health
     * - /login
     * - static files (_next, images, favicon, fonts)
     */
    "/((?!api/auth|api/health|login|_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|icons|fonts).*)",
  ],
};