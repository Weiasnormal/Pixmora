import { PageShell } from "@/components/PageShell";
import { SizeGuidePage } from "@/features/seo/SizeGuidePage";
import { sizeGuideMetadata } from "@/features/seo/sizes";

export const metadata = sizeGuideMetadata("2x2");

export default function Page() {
  return (
    <PageShell>
      <SizeGuidePage slug="2x2" />
    </PageShell>
  );
}
