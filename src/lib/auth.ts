import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "אימייל", type: "email" },
        password: { label: "סיסמה", type: "password" },
      },
      async authorize(credentials) {
        const { db } = await import("./db");
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const { password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email },
          include: { business: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          businessId: user.business?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // user is typed as AdapterUser — cast to access extra fields
        token.businessId = (user as { businessId?: string | null }).businessId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.businessId = token.businessId as string | null;
      }
      return session;
    },
  },
};
