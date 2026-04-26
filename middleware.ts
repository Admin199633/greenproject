export { default } from "next-auth/middleware";

export const config = {
  // Protect all routes under /dashboard
  matcher: ["/dashboard/:path*"],
};
