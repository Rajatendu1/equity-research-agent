import { NextResponse } from "next/server";
import { buildInfo } from "../../generated-build-info";

export async function GET() {
  return NextResponse.json({
    app: "vigilant",
    commit: buildInfo.commit,
    builtAt: buildInfo.builtAt,
  });
}
