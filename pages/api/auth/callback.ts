import { NextApiRequest, NextApiResponse } from "next";
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;

  if (code) {
    const supabase = createPagesServerClient({ req, res });
    await supabase.auth.exchangeCodeForSession(String(code));
  }

  res.redirect("/");
}
