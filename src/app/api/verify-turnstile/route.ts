import { NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(request: Request) {
  const { token } = await request.json();
  const success = token ? await verifyTurnstileToken(token) : false;
  return NextResponse.json({ success });
}
