import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Role, type UserRow } from "@/lib/db-types";

export const authOptions: NextAuthOptions = {
  // Credentials provider requires the JWT session strategy — no DB adapter
  // needed, so Supabase is only used to look up the user in authorize().
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const { data } = await supabaseAdmin()
          .from("User")
          .select("*")
          .eq("email", credentials.email.toLowerCase())
          .maybeSingle();
        const user = data as UserRow | null;
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
