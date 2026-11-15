import { PageShell } from "@/components/PageShell";
import { SizeGuidePage } from "@/features/seo/SizeGuidePage";
import { sizeGuideMetadata } from "@/features/seo/sizes";

export const metadata = sizeGuideMetadata("1x1");

export default function Page() {
  return (
    <PageShell>
      <SizeGuidePage slug="1x1" />
    </PageShell>
  );
}
