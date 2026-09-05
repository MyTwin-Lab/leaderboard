import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { DigestRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";

const digestRepo = new DigestRepository();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await fetchContributorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const digest = await digestRepo.findById(id);
  if (!digest) return NextResponse.json({ error: "Digest not found" }, { status: 404 });

  return NextResponse.json(digest);
}
