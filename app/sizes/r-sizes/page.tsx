import { PageShell } from "@/components/PageShell";
import { SizeGuidePage } from "@/features/seo/SizeGuidePage";
import { sizeGuideMetadata } from "@/features/seo/sizes";

export const metadata = sizeGuideMetadata("r-sizes");

export default function Page() {
  return (
    <PageShell>
      <SizeGuidePage slug="r-sizes" />
    </PageShell>
  );
}
